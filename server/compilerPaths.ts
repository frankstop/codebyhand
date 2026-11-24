import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnWithTimeout } from './processRunner';

const EXTRA_BIN_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.cargo', 'bin'),
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

export function augmentSystemPath(currentPath?: string): string {
  const existing = (currentPath ?? process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const seen = new Set(existing);

  for (const dir of EXTRA_BIN_DIRS) {
    if (!seen.has(dir)) {
      existing.push(dir);
      seen.add(dir);
    }
  }

  return existing.join(path.delimiter);
}

function isExecutableFile(candidate: string): boolean {
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) return false;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findOnPath(binName: string, searchPath: string): string | null {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, binName);
    if (isExecutableFile(full)) {
      return full;
    }
  }
  return null;
}

export function resolveRustcBinary(): string {
  const envOverride = process.env.RUSTC_BIN?.trim();
  if (envOverride) {
    if (isExecutableFile(envOverride)) return envOverride;
    const viaPath = findOnPath(envOverride, augmentSystemPath());
    if (viaPath) return viaPath;
    return envOverride;
  }

  const fromPath = findOnPath('rustc', augmentSystemPath());
  if (fromPath) return fromPath;

  const fallbacks = [
    '/opt/homebrew/bin/rustc',
    path.join(os.homedir(), '.cargo', 'bin', 'rustc'),
    '/usr/local/bin/rustc',
    '/usr/bin/rustc',
  ];
  for (const candidate of fallbacks) {
    if (isExecutableFile(candidate)) return candidate;
  }

  return 'rustc';
}

export function resolveCobcBinary(): string {
  const envOverride = process.env.COBC_BIN?.trim();
  if (envOverride) {
    if (isExecutableFile(envOverride)) return envOverride;
    const viaPath = findOnPath(envOverride, augmentSystemPath());
    if (viaPath) return viaPath;
    return envOverride;
  }

  const fromPath = findOnPath('cobc', augmentSystemPath());
  if (fromPath) return fromPath;

  const fallbacks = [
    '/opt/homebrew/bin/cobc',
    '/usr/local/bin/cobc',
    '/usr/bin/cobc',
  ];
  for (const candidate of fallbacks) {
    if (isExecutableFile(candidate)) return candidate;
  }

  return 'cobc';
}

export async function getCompilerVersion(binPath: string): Promise<string | null> {
  try {
    const res = await spawnWithTimeout(binPath, ['--version'], {
      timeoutMs: 3000,
    });
    if (res.exitCode !== 0 && !res.stdout.trim()) {
      return null;
    }
    const firstLine = (res.stdout || res.stderr).split(/\r?\n/)[0]?.trim();
    return firstLine || null;
  } catch {
    return null;
  }
}
