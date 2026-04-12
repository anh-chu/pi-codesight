import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCodesightCommands,
  registerCodesightTools,
  registerSessionNotice,
  setArtifactStatusProviderForTest,
  setCodesightRunnerForTest,
} from '../src/tools.ts';
import { runCodesight } from '../src/codesight.ts';

function fakePi() {
  const tools: any[] = [];
  const commands: Record<string, any> = {};
  const events: Record<string, Function[]> = {};
  const messages: any[] = [];
  return {
    tools,
    commands,
    events,
    messages,
    registerTool(def: any) { tools.push(def); },
    registerCommand(name: string, def: any) { commands[name] = def; },
    on(name: string, handler: Function) { (events[name] ??= []).push(handler); },
    sendMessage(message: any) { messages.push(message); },
  };
}

test('registers expected codesight tools', () => {
  const pi = fakePi();
  registerCodesightTools(pi);
  assert.deepEqual(
    pi.tools.map((tool) => tool.name),
    [
      'codesight_get_wiki_index',
      'codesight_get_wiki_article',
      'codesight_get_summary',
      'codesight_get_routes',
      'codesight_get_schema',
      'codesight_get_blast_radius',
      'codesight_get_env',
      'codesight_get_hot_files',
      'codesight_refresh',
    ],
  );
  assert.equal(typeof pi.tools[0].execute, 'function');
});

test('registers slash commands and session hook', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);
  registerSessionNotice(pi);

  assert.equal(typeof pi.commands['codesight-refresh'].handler, 'function');
  assert.equal(typeof pi.commands.wiki.handler, 'function');
  assert.equal(typeof pi.commands.blast.handler, 'function');
  assert.ok(pi.events.session_start?.length > 0);

  const ctx = { ui: { notify: (_msg: string) => {} } };
  await pi.commands.wiki.handler('', ctx);
  assert.equal(pi.messages.length > 0, true);
});

test('refresh command uses injected runner', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);
  let capturedArgs: string[] | null = null;
  setCodesightRunnerForTest(async (args, cwd) => {
    capturedArgs = args;
    return {
      command: ['npx', 'codesight', ...args].join(' '),
      cwd,
      exitCode: 0,
      stdout: 'ok stdout',
      stderr: '',
      ok: true,
    };
  });

  try {
    const ctx = { ui: { notify: (message: string) => pi.messages.push({ kind: 'notify', message }) } };
    await pi.commands['codesight-refresh'].handler('', ctx);
    assert.deepEqual(capturedArgs, []);
    assert.equal(pi.messages.some((entry) => entry.kind === 'notify' && /CodeSight refreshed/.test(entry.message)), true);
    assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-refresh'), true);
  } finally {
    setCodesightRunnerForTest(runCodesight);
  }
});

test('blast command rejects escape path', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);

  const ctx = { ui: { notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
  await pi.commands.blast.handler('../escape.ts', ctx);

  assert.equal(pi.messages[0].message, 'Blast target must stay inside the project root');
  assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-blast'), false);
});

test('session notice warns on missing artifacts', async () => {
  const pi = fakePi();
  registerSessionNotice(pi);
  setArtifactStatusProviderForTest(() => ({ files: [], missing: ['.codesight/wiki/index.md'], stale: false }));

  try {
    const ctx = { ui: { notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
    await pi.events.session_start[0](null, ctx);
    assert.match(pi.messages[0].message, /artifacts missing/);
  } finally {
    setArtifactStatusProviderForTest((await import('../src/stale.ts')).getArtifactStatus);
  }
});

test('refresh command surfaces runner failure', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);
  setCodesightRunnerForTest(async (args, cwd) => ({
    command: ['npx', 'codesight', ...args].join(' '),
    cwd,
    exitCode: 1,
    stdout: '',
    stderr: 'boom',
    ok: false,
    error: 'boom',
  }));

  try {
    const ctx = { ui: { notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
    await pi.commands['codesight-refresh'].handler('all', ctx);
    assert.equal(pi.messages.some((entry) => entry.kind === 'notify' && entry.level === 'warning'), true);
    assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-refresh'), true);
  } finally {
    setCodesightRunnerForTest(runCodesight);
  }
});

test('blast command runs successful query', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);
  setCodesightRunnerForTest(async (args, cwd) => ({
    command: ['npx', 'codesight', ...args].join(' '),
    cwd,
    exitCode: 0,
    stdout: 'blast ok',
    stderr: '',
    ok: true,
  }));

  try {
    const ctx = { ui: { notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
    await pi.commands.blast.handler('src/app.ts', ctx);
    assert.equal(pi.messages.some((entry) => entry.kind === 'notify' && entry.level === 'info'), true);
    assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-blast'), true);
    assert.equal(pi.messages[0].message, 'blast ok');
  } finally {
    setCodesightRunnerForTest(runCodesight);
  }
});

test('env tool accepts upstream required_only alias', async () => {
  const pi = fakePi();
  registerCodesightTools(pi);
  const envTool = pi.tools.find((tool: any) => tool.name === 'codesight_get_env');
  const root = '/tmp/pi-codesight-alias';
  const fs = await import('node:fs');
  fs.mkdirSync(`${root}/.codesight`, { recursive: true });
  fs.writeFileSync(`${root}/.codesight/config.md`, '# Config\n\n## Environment Variables\n\n- `API_KEY` **required** — source\n');

  const result = await envTool.execute('1', { directory: root, required_only: true });
  assert.match(result.content[0].text, /API_KEY/);
});
