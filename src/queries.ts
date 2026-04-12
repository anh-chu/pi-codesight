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
  return {
    content: formatCompactSection('Hot files', hits.map((line) => `- ${line}`)),
    details: { limit, count: hits.length },
  };
}
