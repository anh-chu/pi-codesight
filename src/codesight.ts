import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export function projectRoot(directory = '.') {
  return resolve(process.cwd(), directory);
}

export function codesightArtifactsRoot() {
  return '.codesight';
}

export function artifactPath(root: string, ...parts: string[]) {
  return join(root, codesightArtifactsRoot(), ...parts);
}

export function readTextIfExists(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function quoteShellArg(value: string) {
  if (!value) return "''";
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `\\'`)}'`;
}

export function renderCodesightCommand(args: string[]) {
  return ['npx', 'codesight', ...args].map(quoteShellArg).join(' ');
}

export interface CodesightRunResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  ok: boolean;
  error?: string;
}

export function isInsideRoot(root: string, candidate: string) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !rel.includes(':'));
}

export function resolveProjectPath(root: string, inputPath: string) {
  const resolved = resolve(root, inputPath);
  return isInsideRoot(root, resolved) ? resolved : null;
}

export async function runCodesight(args: string[], cwd = process.cwd()): Promise<CodesightRunResult> {
  const command = renderCodesightCommand(args);

  return await new Promise((resolveResult) => {
    const child = spawn('npx', ['codesight', ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolveResult({
        command,
        cwd,
        exitCode: -1,
        stdout,
        stderr,
        ok: false,
        error: error.message,
      });
    });

    child.on('close', (exitCode) => {
      resolveResult({
        command,
        cwd,
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        ok: exitCode === 0,
      });
    });
  });
}
