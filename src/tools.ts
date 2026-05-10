import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatCompactSection, truncateText } from './format.ts';
import { projectRoot, renderCodesightCommand, resolveProjectPath, runCodesight } from './codesight.ts';
import {
  readEnv,
  readHotFiles,
  readRoutes,
  readSchema,
  readSummary,
  readWikiArticle,
  readWikiIndex,
} from './queries.ts';
import { getArtifactStatus } from './stale.ts';

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
let onboardingFlagPath = join(PACKAGE_ROOT, '.codesight-onboarding-shown');

export function setOnboardingFlagPathForTest(path: string) {
  onboardingFlagPath = path;
}

let runCodesightImpl = runCodesight;
let getArtifactStatusImpl = getArtifactStatus;

export function setCodesightRunnerForTest(fn: typeof runCodesight) {
  runCodesightImpl = fn;
}

export function setArtifactStatusProviderForTest(fn: typeof getArtifactStatus) {
  getArtifactStatusImpl = fn;
}

const ROOT_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
  },
};


function onboardingPromptSeen() {
  return existsSync(onboardingFlagPath);
}

function markOnboardingPromptSeen() {
  try {
    writeFileSync(onboardingFlagPath, 'seen');
  } catch {
    // ignore
  }
}

function onboardingResultText(result: { ok: boolean; exitCode: number; stdout: string; stderr: string; command: string }) {
  return formatCompactSection(result.ok ? 'CodeSight setup completed' : 'CodeSight setup failed', [
    '- command: ' + result.command,
    '- status: ' + (result.ok ? 'ok' : 'failed (' + result.exitCode + ')'),
    '- output: ' + truncateText(result.stdout || result.stderr || 'No output returned.', 3000),
  ]);
}

async function runInitialSetup(root: string): Promise<ToolResult> {
  const results: Array<{ command: string; ok: boolean; exitCode: number; stdout: string; stderr: string }> = [];
  for (const args of [['--wiki'], ['--init'], ['--hook']]) {
    const result = await runCodesightImpl(args, root);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((result) => !result.ok);
  if (failed) {
    return {
      content: onboardingResultText(failed),
      details: {
        executedCommands: results.map((result) => result.command),
        results,
        ok: false,
      },
    };
  }

  const final = results[results.length - 1];
  return {
    content: formatCompactSection('CodeSight setup completed', [
      '- command: ' + results.map((result) => result.command).join(' && '),
      '- status: ok',
      '- output: ' + truncateText(final?.stdout || 'Setup complete.', 3000),
    ]),
    details: {
      executedCommands: results.map((result) => result.command),
      results,
      ok: true,
    },
  };
}
const ROUTE_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
    prefix: { type: 'string', description: 'Filter routes by path prefix like /api/users' },
    tag: { type: 'string', description: 'Filter routes by tag or subsystem label' },
    method: { type: 'string', description: 'Filter by HTTP method like GET, POST, PUT, DELETE' },
  },
};

const SCHEMA_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
    model: { type: 'string', description: 'Filter schema by model name' },
  },
};

const BLAST_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
    file: { type: 'string', description: 'Project-relative file path to analyze' },
    depth: { type: 'number', description: 'Max traversal depth', minimum: 1, maximum: 20 },
  },
  required: ['file'],
};

const ENV_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
    requiredOnly: { type: 'boolean', description: 'If true, only return required environment variables' },
  },
};

const HOT_FILES_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to read from' },
    limit: { type: 'number', description: 'Maximum number of files to return', minimum: 1, maximum: 50 },
  },
};

const REFRESH_SCHEMA = {
  type: 'object',
  properties: {
    directory: { type: 'string', description: 'Project directory to refresh' },
    wiki: { type: 'boolean', description: 'Generate wiki artifacts' },
    init: { type: 'boolean', description: 'Generate AGENTS.md and related AI context files' },
  },
};

type ToolResult = {
  content: string;
  details: Record<string, unknown>;
};

function textResult(content: string, details: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text', text: content }],
    details,
  };
}

function rootForParams(params: { directory?: string }) {
  return projectRoot(params.directory ?? '.');
}

function extractText(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item === 'object' && 'text' in item ? String((item as { text?: unknown }).text ?? '') : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function normalizeQueryResult(result: { content: string | string[]; details: Record<string, unknown> }): ToolResult {
  return {
    content: extractText(result.content),
    details: result.details,
  };
}

async function runRefresh(root: string): Promise<ToolResult> {
  const result = await runCodesightImpl([], root);
  const output = truncateText(result.stdout || result.stderr || 'No output returned.', 4000);
  const header = result.ok ? 'CodeSight refreshed' : 'CodeSight refresh failed';
  return {
    content: formatCompactSection(header, [
      `- command: ${renderCodesightCommand([])}`,
      `- status: ${result.ok ? 'ok' : `failed (${result.exitCode})`}`,
      `- output: ${output}`,
    ]),
    details: { command: result.command, ok: result.ok, exitCode: result.exitCode, stderr: result.stderr },
  };
}

async function runInitSetup(root: string): Promise<ToolResult> {
  const results: Array<{ command: string; ok: boolean; exitCode: number; stdout: string; stderr: string }> = [];
  for (const args of [['--wiki'], ['--init']]) {
    const result = await runCodesightImpl(args, root);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((result) => !result.ok);
  if (failed) {
    return {
      content: onboardingResultText(failed),
      details: {
        executedCommands: results.map((result) => result.command),
        results,
        ok: false,
      },
    };
  }

  const final = results[results.length - 1];
  return {
    content: formatCompactSection('CodeSight init completed', [
      '- command: ' + results.map((result) => result.command).join(' && '),
      '- status: ok',
      '- output: ' + truncateText(final?.stdout || 'Setup complete.', 3000),
    ]),
    details: {
      executedCommands: results.map((result) => result.command),
      results,
      ok: true,
    },
  };
}

function emitSessionMessage(pi: any, kind: string, content: string, details: Record<string, unknown>) {
  pi.sendMessage({
    customType: `codesight-${kind}`,
    content,
    display: true,
    details,
  });
}

export function registerCodesightTools(pi: any) {
  const toolDefinitions = [
    {
      name: 'codesight_get_wiki_index',
      label: 'CodeSight Wiki Index',
      description: 'Read the codesight wiki index for fast repo orientation',
      promptSnippet: 'Read codesight wiki catalog for fast repo orientation',
      promptGuidelines: [
        'STEP 1 (orientation). Call this at session start before any exploration.',
        'Do NOT use grep, find, or read first.',
        'After this, use codesight_get_wiki_article for subsystems, then trace specific symbols with your language server or symbol search tools.'
      ],
      parameters: ROOT_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string }) => {
        const result = readWikiIndex(rootForParams(params));
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_wiki_article',
      label: 'CodeSight Wiki Article',
      description: 'Read one codesight wiki article by subsystem name',
      promptSnippet: 'Read one codesight wiki article by subsystem name',
      promptGuidelines: [
        'STEP 1 (subsystem orientation). Call this when investigating a subsystem (auth, database, payments, etc.).',
        'Do NOT grep for subsystem code first.',
        'After reading, trace specific symbols with your language server or symbol search tools.',
        'Wiki articles tell you WHERE things live, not how they work.',
      ],
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Project directory to read from' },
          article: { type: 'string', description: 'Wiki article name like auth, database, payments, overview' },
        },
        required: ['article'],
      },
      execute: async (_toolCallId: string, params: { directory?: string; article: string }) => {
        const result = readWikiArticle(rootForParams(params), params.article);
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_summary',
      label: 'CodeSight Summary',
      description: 'Get compact codesight project overview',
      promptSnippet: 'Get compact codesight project overview',
      promptGuidelines: [
        'STEP 1 (architecture). Call this for any broad "what is this repo?" question.',
        'Do NOT open source files to understand project structure.',
        'After this, drill down with codesight_get_wiki_article or codesight_get_routes.',
      ],
      parameters: ROOT_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string }) => {
        const result = readSummary(rootForParams(params));
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_routes',
      label: 'CodeSight Routes',
      description: 'Get routes filtered by prefix, tag, or HTTP method',
      promptSnippet: 'Get codesight routes filtered by prefix, tag, or method',
      promptGuidelines: [
        'STEP 2 (structural query). Call this for endpoint questions after orientation.',
        'Do NOT grep for route definitions.',
        'Use prefix/method/tag filters to narrow results instead of reading files.',
      ],
      parameters: ROUTE_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string; prefix?: string; tag?: string; method?: string }) => {
        const result = readRoutes(rootForParams(params), { prefix: params.prefix, tag: params.tag, method: params.method });
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_schema',
      label: 'CodeSight Schema',
      description: 'Get schema or one model summary',
      promptSnippet: 'Get codesight schema or one model summary',
      promptGuidelines: [
        'STEP 2 (structural query). Call this for model/table questions after orientation.',
        'Do NOT grep for model definitions.',
      ],
      parameters: SCHEMA_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string; model?: string }) => {
        const result = readSchema(rootForParams(params), params.model);
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_blast_radius',
      label: 'CodeSight Blast Radius',
      description: 'Analyze impact before changing a file',
      promptSnippet: 'Analyze blast radius for file changes using codesight graph',
      promptGuidelines: [
        'STEP 3 (pre-edit). Call this BEFORE modifying any file with logic or structure changes.',
        'Do not skip this and guess impact.',
        'After blast radius, if the change is safe, verify affected symbols with your language server or symbol search tools.'
      ],
      parameters: BLAST_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string; file: string; depth?: number }) => {
        const root = rootForParams(params);
        const target = resolveProjectPath(root, params.file);
        if (!target) {
          return textResult(
            formatCompactSection('Invalid blast target', [`- file: ${params.file}`, `- root: ${root}`, '- hint: file must stay inside the selected project root']),
            { file: params.file, root, ok: false },
          );
        }

        const args = ['--blast', params.file];
        if (typeof params.depth === 'number') args.push('--depth', String(params.depth));
        const result = await runCodesightImpl(args, root);
        const output = truncateText(result.stdout || result.stderr || 'No output returned.', 4000);
        const header = result.ok ? 'CodeSight blast radius' : 'CodeSight blast radius failed';
        return textResult(
          formatCompactSection(header, [
            `- file: ${params.file}`,
            `- command: ${renderCodesightCommand(args)}`,
            `- status: ${result.ok ? 'ok' : `failed (${result.exitCode})`}`,
            `- output: ${output}`,
          ]),
          { file: params.file, root, command: result.command, ok: result.ok, exitCode: result.exitCode, stderr: result.stderr },
        );
      },
    },
    {
      name: 'codesight_get_env',
      label: 'CodeSight Env',
      description: 'Get environment variables detected by codesight',
      promptSnippet: 'Get environment variables detected by codesight',
      promptGuidelines: [
        'STEP 2 (config). Call this before reading .env files or grepping for env vars.',
        'Do NOT search source code for env vars manually.',
      ],
      parameters: ENV_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string; required_only?: boolean; requiredOnly?: boolean }) => {
        const result = readEnv(rootForParams(params), params.required_only ?? params.requiredOnly ?? false);
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_get_hot_files',
      label: 'CodeSight Hot Files',
      description: 'Get the most imported high-impact files',
      promptSnippet: 'Get most imported high-impact files from codesight',
      promptGuidelines: [
        'STEP 2 (risk assessment). Call this before refactoring or touching shared code.',
        'Cross-reference with codesight_get_blast_radius before editing.',
        'Do NOT rely on gut feel for import frequency.',
      ],
      parameters: HOT_FILES_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string; limit?: number }) => {
        const result = readHotFiles(rootForParams(params), params.limit ?? 10);
        return textResult(result.content, result.details as Record<string, unknown>);
      },
    },
    {
      name: 'codesight_refresh',
      label: 'CodeSight Refresh',
      description: 'Re-scan CodeSight-generated artifacts',
      promptSnippet: 'Refresh codesight-generated repo context files',
      promptGuidelines: [
        'Call this when codesight tools return empty or stale results.',
        'Do NOT fall back to manual exploration if artifacts are missing.',
      ],
      parameters: REFRESH_SCHEMA,
      execute: async (_toolCallId: string, params: { directory?: string }) => {
        const result = await runRefresh(rootForParams(params));
        return textResult(result.content, result.details);
      },
    },
  ] as const;

  for (const definition of toolDefinitions) {
    pi.registerTool({
      name: definition.name,
      label: definition.label,
      description: definition.description,
      promptSnippet: definition.promptSnippet,
      promptGuidelines: definition.promptGuidelines,
      parameters: definition.parameters,
      execute: definition.execute,
    });
  }
}

export function registerCodesightCommands(pi: any) {
  pi.registerCommand('codesight-refresh', {
    description: 'Re-scan CodeSight-generated artifacts',
    handler: async (_args: string, ctx: any) => {
      const result = await runRefresh(projectRoot('.'));
      ctx.ui.notify(result.content, result.details.ok ? 'info' : 'warning');
      emitSessionMessage(pi, 'refresh', result.content, result.details);
    },
  });

  pi.registerCommand('codesight-init', {
    description: 'Generate CodeSight wiki and AI context artifacts',
    handler: async (_args: string, ctx: any) => {
      const result = await runInitSetup(projectRoot('.'));
      ctx.ui.notify(result.content, result.details.ok ? 'info' : 'warning');
      emitSessionMessage(pi, 'init', result.content, result.details);
    },
  });

  pi.registerCommand('wiki', {
    description: 'Read the CodeSight wiki index or article',
    handler: async (args: string, ctx: any) => {
      const article = args.trim();
      const result = article ? normalizeQueryResult(readWikiArticle(projectRoot('.'), article)) : normalizeQueryResult(readWikiIndex(projectRoot('.')));
      ctx.ui.notify(result.content, 'info');
      emitSessionMessage(pi, 'wiki', result.content, result.details);
    },
  });

  pi.registerCommand('blast', {
    description: 'Run a CodeSight blast-radius query for a file',
    handler: async (args: string, ctx: any) => {
      const file = args.trim();
      if (!file) {
        ctx.ui.notify('Usage: /blast <file>', 'warning');
        return;
      }

      const root = projectRoot('.');
      const target = resolveProjectPath(root, file);
      if (!target) {
        ctx.ui.notify('Blast target must stay inside the project root', 'warning');
        return;
      }

      const result = await runCodesightImpl(['--blast', file], root);
      const text = truncateText(result.stdout || result.stderr || 'No output returned.', 4000);
      ctx.ui.notify(text, result.ok ? 'info' : 'warning');
      emitSessionMessage(pi, 'blast', text, { file, command: result.command, ok: result.ok, exitCode: result.exitCode });
    },
  });
}

export function registerSessionNotice(pi: any) {
  pi.on('session_start', async (_event: unknown, ctx: any) => {
    const status = getArtifactStatusImpl(projectRoot('.'));
    if (status.missing.length > 0) {
      const needsInit = status.missing.some((path) => path.endsWith('AGENTS.md'));
      ctx.ui.notify(
        needsInit
          ? 'CodeSight setup incomplete: AGENTS.md missing. Use /codesight-init.'
          : `CodeSight artifacts missing: ${status.missing.join(', ')}. Use /codesight-refresh.`,
        'warning',
      );
      return;
    }

    if (!onboardingPromptSeen()) {
      const confirmed = ctx.ui.confirm
        ? await ctx.ui.confirm(
          'Generate CodeSight artifacts?',
          'Run `npx codesight --wiki`, `npx codesight --init`, and `npx codesight --hook` for this project now?',
        )
        : false;
      markOnboardingPromptSeen();
      if (confirmed) {
        const result = await runInitialSetup(projectRoot('.'));
        ctx.ui.notify(result.content, result.details.ok ? 'info' : 'warning');
        emitSessionMessage(pi, 'onboarding', result.content, result.details);
      }
      return;
    }

    if (status.stale) {
      ctx.ui.notify('CodeSight artifacts may be stale. Use /codesight-refresh when the repo changes.', 'warning');
    }
  });
}
