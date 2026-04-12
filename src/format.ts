export function formatCompactSection(title: string, lines: string[]) {
  const body = lines.filter(Boolean).join('\n');
  return body ? `${title}\n${body}` : title;
}

export function formatKeyValueList(title: string, entries: Array<{ key: string; value: string }>) {
  return formatCompactSection(
    title,
    entries.map(({ key, value }) => `- ${key}: ${value}`),
  );
}

export function truncateText(text: string, max = 4000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\n…`;
}

export function toTextLines(value: string | string[]) {
  return Array.isArray(value) ? value : value.split(/\r?\n/);
}

export function bulletize(lines: string[]) {
  return lines.map((line) => (line.startsWith('- ') ? line : `- ${line}`));
}
