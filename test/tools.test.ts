import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  registerCodesightCommands,
  registerCodesightTools,
  registerSessionNotice,
  setArtifactStatusProviderForTest,
  setCodesightRunnerForTest,
  setOnboardingFlagPathForTest,
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
  assert.equal(typeof pi.commands['codesight-init'].handler, 'function');
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

test('init command runs wiki and init', async () => {
  const pi = fakePi();
  registerCodesightCommands(pi);
  let capturedArgs: string[][] = [];
  setCodesightRunnerForTest(async (args, cwd) => {
    capturedArgs.push(args);
    return {
      command: ['npx', 'codesight', ...args].join(' '),
      cwd,
      exitCode: 0,
      stdout: args.join(' '),
      stderr: '',
      ok: true,
    };
  });

  try {
    const ctx = { ui: { notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
    await pi.commands['codesight-init'].handler('', ctx);
    assert.deepEqual(capturedArgs, [['--wiki'], ['--init']]);
    assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-init'), true);
    assert.equal(pi.messages.some((entry) => entry.kind === 'notify' && entry.level === 'info'), true);
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
  setArtifactStatusProviderForTest(() => ({ files: [], missing: ['AGENTS.md'], stale: false }));

  const markerRoot = mkdtempSync(join(tmpdir(), 'pi-codesight-onboard-'));
  const markerPath = join(markerRoot, 'marker');
  writeFileSync(markerPath, 'seen');
  setOnboardingFlagPathForTest(markerPath);

  try {
    const ctx = { ui: { confirm: async () => false, notify: (message: string, level: string) => pi.messages.push({ kind: 'notify', message, level }) } };
    await pi.events.session_start[0](null, ctx);
    assert.match(pi.messages[0].message, /Use \/codesight-init\./);
  } finally {
    setOnboardingFlagPathForTest(join(process.cwd(), '.codesight-onboarding-shown'));
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
  const root = mkdtempSync(join(tmpdir(), 'pi-codesight-alias-'));
  mkdirSync(join(root, '.codesight'), { recursive: true });
  writeFileSync(join(root, '.codesight/config.md'), '# Config\n\n## Environment Variables\n\n- `API_KEY` **required** — source\n');

  const result = await envTool.execute('1', { directory: root, required_only: true });
  assert.match(result.content[0].text, /API_KEY/);
});

test('session start prompts once on first install', async () => {
  const pi = fakePi();
  registerSessionNotice(pi);
  setArtifactStatusProviderForTest(() => ({ files: [], missing: [], stale: false }));

  const markerRoot = mkdtempSync(join(tmpdir(), 'pi-codesight-onboard-'));
  const markerPath = join(markerRoot, 'marker');
  setOnboardingFlagPathForTest(markerPath);

  let confirmCalls = 0;
  const ctx = {
    ui: {
      confirm: async () => {
        confirmCalls += 1;
        return false;
      },
      notify: (_message: string, _level: string) => {},
    },
  };

  try {
    await pi.events.session_start[0](null, ctx);
    await pi.events.session_start[0](null, ctx);
    assert.equal(confirmCalls, 1);
  } finally {
    setOnboardingFlagPathForTest(join(process.cwd(), '.codesight-onboarding-shown'));
    setArtifactStatusProviderForTest((await import('../src/stale.ts')).getArtifactStatus);
  }
});

test('session start onboarding can run initial setup', async () => {
  const pi = fakePi();
  registerSessionNotice(pi);
  setArtifactStatusProviderForTest(() => ({ files: [], missing: [], stale: false }));

  const markerRoot = mkdtempSync(join(tmpdir(), 'pi-codesight-onboard-'));
  const markerPath = join(markerRoot, 'marker');
  setOnboardingFlagPathForTest(markerPath);

  const calls: string[][] = [];
  setCodesightRunnerForTest(async (args, cwd) => {
    calls.push(args);
    return {
      command: ['npx', 'codesight', ...args].join(' '),
      cwd,
      exitCode: 0,
      stdout: args.join(' '),
      stderr: '',
      ok: true,
    };
  });

  try {
    const ctx = {
      ui: {
        confirm: async () => true,
        notify: (_message: string, _level: string) => {},
      },
    };
    await pi.events.session_start[0](null, ctx);
    assert.deepEqual(calls, [['--wiki'], ['--init'], ['--hook']]);
    assert.equal(pi.messages.some((entry) => entry.customType === 'codesight-onboarding'), true);
  } finally {
    setCodesightRunnerForTest(runCodesight);
    setOnboardingFlagPathForTest(join(process.cwd(), '.codesight-onboarding-shown'));
    setArtifactStatusProviderForTest((await import('../src/stale.ts')).getArtifactStatus);
  }
});
