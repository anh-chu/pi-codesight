import { artifactPath, readTextIfExists } from './codesight.ts';
import { bulletize, formatCompactSection, truncateText } from './format.ts';

function lines(text: string) {
  return text.split(/\r?\n/).map((line) => line.trimEnd());
}

function headingLevel(line: string) {
  const match = line.match(/^(#{1,6})\s+/);
  return match ? match[1].length : 0;
}

function extractSection(text: string, titlePattern: RegExp) {
  const all = lines(text);
  let start = -1;
  let level = 0;

  for (let index = 0; index < all.length; index += 1) {
    const line = all[index];
    if (/^#{1,6}\s+/.test(line) && titlePattern.test(line)) {
      start = index;
      level = headingLevel(line);
      break;
    }
  }

  if (start < 0) return [];

  const section: string[] = [];
  for (let index = start + 1; index < all.length; index += 1) {
    const line = all[index];
    const nextLevel = headingLevel(line);
    if (nextLevel && nextLevel <= level) break;
    section.push(line);
  }

  return section;
}

function readMissingMessage(kind: string, path: string, hint: string) {
  return formatCompactSection(`Missing codesight ${kind}`, [`- path: ${path}`, `- hint: ${hint}`]);
}

function bulletLinesFromSection(section: string[]) {
  return section.filter((line) => /^-\s+/.test(line)).map((line) => line.replace(/^-\s+/, '').trim());
}

function sectionOrFallback(content: string, patterns: RegExp[], fallback: (allLines: string[]) => string[]) {
  for (const pattern of patterns) {
    const section = extractSection(content, pattern);
    if (section.length > 0) return section;
  }
  return fallback(lines(content));
}

export function readWikiIndex(root = '.') {
  const path = artifactPath(root, 'wiki', 'index.md');
  const content = readTextIfExists(path);
  return {
    content: content ?? readMissingMessage('wiki index', path, 'run `npx codesight --wiki`'),
    details: { path, exists: Boolean(content) },
  };
}

export function readWikiArticle(root = '.', article: string) {
  const path = artifactPath(root, 'wiki', `${article}.md`);
  const content = readTextIfExists(path);
  return {
    content: content ?? readMissingMessage('wiki article', path, 'run `npx codesight --wiki`'),
    details: { article, path, exists: Boolean(content) },
  };
}

export function readSummary(root = '.') {
  const overviewPath = artifactPath(root, 'wiki', 'overview.md');
  const overview = readTextIfExists(overviewPath);
  if (overview) {
    return { content: truncateText(overview, 3000), details: { source: 'wiki/overview.md', path: overviewPath } };
  }

  const summaryPath = artifactPath(root, 'CODESIGHT.md');
  const summary = readTextIfExists(summaryPath);
  if (summary) {
    return { content: truncateText(summary, 3000), details: { source: 'CODESIGHT.md', path: summaryPath } };
  }

  return {
    content: formatCompactSection('Missing codesight artifacts', [
      `- looked for: ${overviewPath}`,
      `- looked for: ${summaryPath}`,
      '- hint: run `npx codesight --wiki` or `npx codesight`',
    ]),
    details: { source: 'missing', path: summaryPath },
  };
}

export function readRoutes(root = '.', filters: { prefix?: string; tag?: string; method?: string } = {}) {
  const path = artifactPath(root, 'routes.md');
  const content = readTextIfExists(path);
  if (!content) {
    return { content: readMissingMessage('routes', path, 'run `npx codesight`'), details: { filters, count: 0 } };
  }

  const section = extractSection(content, /^#\s+Routes$/i);
  const routes: string[] = [];
  for (const line of section) {
    if (/^#{1,6}\s+/.test(line)) break;
    if (!/^-[\s\t]+`[A-Z]+`\s+`[^`]+`/.test(line)) continue;
    const route = line.replace(/^-\s+/, '').trim();
    const method = filters.method?.toUpperCase();
    const methodOk = !method || route.includes(`\`${method}\``);
    const prefixOk = !filters.prefix || route.includes(`\`${filters.prefix}\``) || route.includes(filters.prefix);
    const tagOk = !filters.tag || route.toLowerCase().includes(filters.tag.toLowerCase());
    if (methodOk && prefixOk && tagOk) routes.push(route);
  }

  return {
    content: formatCompactSection('Routes', routes.slice(0, 25).map((route) => `- ${route}`)),
    details: { filters, count: routes.length },
  };
}

export function readSchema(root = '.', model?: string) {
  const path = artifactPath(root, 'CODESIGHT.md');
  const content = readTextIfExists(path);
  if (!content) {
    return { content: readMissingMessage('schema', path, 'run `npx codesight`'), details: { model, count: 0 } };
  }

  const section = sectionOrFallback(
    content,
    [/^#\s+Schema$/i, /^##\s+Models$/i, /^##\s+Tables$/i, /^##\s+Database$/i],
    (allLines) => allLines.filter((line) => /\b(schema|model|table|field|relation)\b/i.test(line)),
  );

  const filtered = model
    ? section.filter((line) => line.toLowerCase().includes(model.toLowerCase()))
    : section;

  const payload = filtered.length > 0 ? filtered : section.slice(0, 30);
  return {
    content: formatCompactSection('Schema', bulletize(payload.slice(0, 30))),
    details: { model, count: payload.length },
  };
}

export function readEnv(root = '.', requiredOnly = false) {
  const configPath = artifactPath(root, 'config.md');
  const overviewPath = artifactPath(root, 'wiki', 'overview.md');
  const config = readTextIfExists(configPath) ?? readTextIfExists(overviewPath);
  if (!config) {
    return { content: readMissingMessage('env', configPath, 'run `npx codesight`'), details: { requiredOnly, count: 0 } };
  }

  const section = sectionOrFallback(
    config,
    [/^##\s+Environment Variables$/i, /^##\s+Required Environment Variables$/i],
    (allLines) => allLines.filter((line) => /\b[A-Z][A-Z0-9_]+\b/.test(line) && /required|default/i.test(line)),
  );

  const envs = bulletLinesFromSection(section).filter((line) => !requiredOnly || /required/i.test(line));
  return {
    content: formatCompactSection('Environment variables', envs.slice(0, 40).map((line) => `- ${line}`)),
    details: { requiredOnly, count: envs.length },
  };
}

type ImportGraph = {
  dependents: Map<string, string[]>;
  dependencies: Map<string, string[]>;
  omittedDependents: Map<string, number>;
  files: Set<string>;
};

function parseImportMap(content: string): ImportGraph {
  const section = sectionOrFallback(
    content,
    [/^##\s+Import Map.*$/i, /^###\s+Import Map.*$/i],
    () => [],
  );

  const dependents = new Map<string, string[]>();
  const dependencies = new Map<string, string[]>();
  const omittedDependents = new Map<string, number>();
  const files = new Set<string>();

  for (const line of section) {
    // - `src/a.ts` ← `src/b.ts`, `src/c.ts` +1 more
    const match = line.match(/^-\s+`([^`]+)`\s+←\s+(.+)$/);
    if (!match) continue;

    const target = match[1].trim();
    const rhs = match[2];
    files.add(target);

    // Parse dependents: backtick-wrapped filenames, optionally followed by +N more
    const importers = Array.from(rhs.matchAll(/`([^`]+)`/g), (m) => m[1].trim());
    const omitted = Number(rhs.match(/\+\s*(\d+)\s*more/i)?.[1] ?? 0);

    dependents.set(target, [...new Set(importers)]);
    if (omitted > 0) omittedDependents.set(target, omitted);
    for (const dep of importers) {
      files.add(dep);
      const depsOfDep = dependencies.get(dep) ?? [];
      if (!depsOfDep.includes(target)) {
        depsOfDep.push(target);
        dependencies.set(dep, depsOfDep);
      }
    }
  }

  // Ensure every file has an entry in both maps
  for (const file of files) {
    if (!dependents.has(file)) dependents.set(file, []);
    if (!dependencies.has(file)) dependencies.set(file, []);
  }

  return { dependents, dependencies, omittedDependents, files };
}

function buildImportGraph(root: string): ImportGraph | null {
  const graphPath = artifactPath(root, 'graph.md');
  const codesightPath = artifactPath(root, 'CODESIGHT.md');
  const content = readTextIfExists(graphPath) ?? readTextIfExists(codesightPath);
  if (!content) return null;
  return parseImportMap(content);
}

function transitive(graph: Map<string, string[]>, start: string, depth: number): string[] {
  if (depth <= 1) return [];
  const direct = new Set(graph.get(start) ?? []);
  const visited = new Set<string>();
  const queue: Array<{ file: string; dist: number }> = [{ file: start, dist: 0 }];
  while (queue.length > 0) {
    const { file, dist } = queue.shift()!;
    if (dist >= depth) continue;
    for (const neighbor of graph.get(file) ?? []) {
      if (neighbor === start || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ file: neighbor, dist: dist + 1 });
    }
  }
  // Return only nodes beyond direct neighbors
  return Array.from(visited).filter((f) => !direct.has(f));
}

export function readImportGraph(root = '.', file?: string, depth = 1) {
  const graph = buildImportGraph(root);
  if (!graph) {
    const path = artifactPath(root, 'graph.md');
    return {
      content: readMissingMessage('import graph', path, 'run `npx codesight`'),
      details: { file, depth, count: 0 },
    };
  }

  const { dependents, dependencies, omittedDependents, files } = graph;
  const hubThreshold = 3;

  if (file) {
    const normalized = file.replace(/^\.\//, '');
    if (!files.has(normalized)) {
      return {
        content: formatCompactSection(`Import graph: ${normalized}`, [
          '- file not present in the parsed CodeSight import map',
          '- note: CodeSight graph.md is truncated to high-impact targets',
          '- hint: run codesight_get_blast_radius for file-specific impact',
        ]),
        details: { file: normalized, depth, found: false, count: 0 },
      };
    }

    const directDeps = dependencies.get(normalized) ?? [];
    const directDependents = dependents.get(normalized) ?? [];
    const omitted = omittedDependents.get(normalized) ?? 0;
    const transitiveDeps = depth > 1 ? transitive(dependencies, normalized, depth) : [];
    const transitiveDependents = depth > 1 ? transitive(dependents, normalized, depth) : [];

    const depLabel = omitted > 0 ? `${directDependents.length} + ${omitted} omitted` : `${directDependents.length}`;
    const lines = [
      `direct deps (${directDeps.length}): ${directDeps.join(', ') || 'none'}`,
      `direct dependents (${depLabel}): ${directDependents.join(', ') || 'none'}`,
    ];
    if (depth > 1) {
      lines.push(`transitive deps (${transitiveDeps.length}): ${transitiveDeps.join(', ') || 'none'}`);
      lines.push(`transitive dependents (${transitiveDependents.length}): ${transitiveDependents.join(', ') || 'none'}`);
    }
    if (omitted > 0) lines.push('- note: some importers omitted by upstream truncation');

    return {
      content: formatCompactSection(`Import graph: ${normalized}`, lines.map((l) => `- ${l}`)),
      details: { file: normalized, depth, directDeps, directDependents, transitiveDeps, transitiveDependents, omittedDependents: omitted, found: true },
    };
  }

  const orphanFiles = Array.from(files).filter((f) => (dependents.get(f)?.length ?? 0) === 0);
  const hubFiles = Array.from(files).filter((f) => (dependents.get(f)?.length ?? 0) >= hubThreshold);

  return {
    content: formatCompactSection('Import graph', [
      `- files in graph: ${files.size}`,
      `- orphan files (imported by nothing): ${orphanFiles.join(', ') || 'none'}`,
      `- hub files (imported by ≥${hubThreshold}): ${hubFiles.join(', ') || 'none'}`,
    ]),
    details: { file, depth, fileCount: files.size, orphanFiles, hubFiles },
  };
}

type SymbolEntry = {
  symbol: string;
  file: string;
  kind: string;
};

const EXPORT_PATTERN = /\b(function|interface|class|type|const)\s+([A-Za-z_$][\w$]*)/g;

function parseLibraries(content: string): SymbolEntry[] {
  const section = sectionOrFallback(
    content,
    [/^#\s+Libraries$/i, /^##\s+Libraries$/i],
    () => [],
  );

  const entries: SymbolEntry[] = [];
  let currentFile = '';

  for (const line of section) {
    // Inline: - `src/commands.ts` — function registerCommands: (pi) => void
    // Multiline header: - `src/codesight.ts`
    const fileMatch = line.match(/^-\s+`([^`]+)`(?:\s+—\s+(.+))?/);
    if (fileMatch) {
      currentFile = fileMatch[1].trim();
      // Parse inline exports on the same line
      if (fileMatch[2]) {
        for (const match of fileMatch[2].matchAll(EXPORT_PATTERN)) {
          entries.push({ kind: match[1], symbol: match[2], file: currentFile });
        }
      }
      continue;
    }

    // Multiline indented: `  - function name: ...`
    if (currentFile) {
      for (const match of line.matchAll(EXPORT_PATTERN)) {
        entries.push({ kind: match[1], symbol: match[2], file: currentFile });
      }
    }
  }

  return entries;
}

function buildSymbolIndex(root: string): SymbolEntry[] | null {
  const libsPath = artifactPath(root, 'libs.md');
  const codesightPath = artifactPath(root, 'CODESIGHT.md');
  const content = readTextIfExists(libsPath) ?? readTextIfExists(codesightPath);
  if (!content) return null;
  return parseLibraries(content);
}

export function readSymbolIndex(root = '.', query?: string, kind?: string) {
  const index = buildSymbolIndex(root);
  if (!index) {
    const path = artifactPath(root, 'libs.md');
    return {
      content: readMissingMessage('symbol index', path, 'run `npx codesight`'),
      details: { query, kind, count: 0 },
    };
  }

  const q = query?.toLowerCase();
  const normalizedKind = kind?.toLowerCase();
  const matches = index.filter((entry) => {
    const kindOk = !normalizedKind || entry.kind === normalizedKind;
    const queryOk = !q || entry.symbol.toLowerCase().includes(q) || entry.file.toLowerCase().includes(q);
    return kindOk && queryOk;
  });

  const lines = matches.slice(0, 25).map((entry) => `- \`${entry.symbol}\` (${entry.kind}) in \`${entry.file}\``);
  return {
    content: formatCompactSection(`Symbols${q ? ` matching "${query}"` : ''}`, lines),
    details: { query, kind, count: matches.length, matches: matches.slice(0, 25) },
  };
}

export function readChangeImpact(root = '.', file: string) {
  const normalized = file.replace(/^\.\//, '');
  const graph = buildImportGraph(root);
  const directlyAffected = graph?.dependents.get(normalized) ?? [];
  const omitted = graph?.omittedDependents.get(normalized) ?? 0;

  // Coverage
  const coveragePath = artifactPath(root, 'coverage.md');
  const coverageContent = readTextIfExists(coveragePath);
  let testCoverage: 'full' | 'partial' | 'none' = 'none';
  let testFiles: string[] = [];
  if (coverageContent) {
    const pctMatch = coverageContent.match(/\*\*(\d+)%\*\*/);
    const pct = pctMatch ? parseInt(pctMatch[1], 10) : 0;
    testCoverage = pct >= 80 ? 'full' : pct >= 30 ? 'partial' : 'none';
    const tfMatch = coverageContent.match(/(\d+)\s+test\s+file/i);
    if (tfMatch) testFiles.push(`${tfMatch[1]} test file(s)`);
  }

  // Risk level
  const depCount = directlyAffected.length + omitted;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (depCount >= 5 && testCoverage !== 'full') riskLevel = 'high';
  else if (depCount >= 2 || testCoverage === 'none') riskLevel = 'medium';

  const depLabel = omitted > 0 ? `${directlyAffected.length} + ${omitted} omitted` : `${directlyAffected.length}`;
  const confidence = omitted > 0 ? 'partial' : 'high';

  const lines = [
    `directly affected: ${depLabel}`,
    `test coverage: ${testCoverage}${testFiles.length ? ` (${testFiles.join(', ')})` : ''}`,
    `risk level: ${riskLevel}`,
    `confidence: ${confidence}`,
  ];
  if (omitted > 0) lines.push('- note: some dependents omitted by upstream truncation');
  lines.push('- hint: run codesight_get_blast_radius for authoritative impact');

  return {
    content: formatCompactSection(`Change impact: ${normalized}`, lines.map((l) => `- ${l}`)),
    details: { file: normalized, directlyAffected, omittedDependents: omitted, testCoverage, testFiles, riskLevel, confidence },
  };
}

export function readHotFiles(root = '.', limit = 10) {
  const path = artifactPath(root, 'wiki', 'overview.md');
  const content = readTextIfExists(path);
  if (!content) {
    return { content: readMissingMessage('hot files', path, 'run `npx codesight --wiki`'), details: { limit, count: 0 } };
  }

  const section = sectionOrFallback(
    content,
    [/^##\s+High-Impact Files$/i, /^##\s+Hot Files$/i],
    (allLines) => allLines.filter((line) => /imported by|high-impact|blast radius/i.test(line)),
  );

  const hits = bulletLinesFromSection(section).slice(0, limit);
  const graph = buildImportGraph(root);

  const enriched = hits.map((line) => {
    const pathMatch = line.match(/`([^`]+)`/);
    if (!pathMatch || !graph) return line;
    const filePath = pathMatch[1];
    const callers = graph.dependents.get(filePath) ?? [];
    return callers.length > 0 ? `${line} ← ${callers.map((c) => `\`${c}\``).join(', ')}` : line;
  });

  return {
    content: formatCompactSection('Hot files', enriched.map((line) => `- ${line}`)),
    details: { limit, count: hits.length },
  };
}
