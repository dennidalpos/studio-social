import { execFileSync } from 'node:child_process';
import { accessSync, chmodSync, constants, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

const windows = process.platform === 'win32';

/**
 * Resolves a program using only absolute PATH entries.
 * On Windows, Node looks in the working directory first for a bare command name, so a planted
 * executable there would run in place of the real tool. Entries the user put in PATH are trusted.
 */
export function findExecutable(name) {
  const extensions = windows ? ['.exe', '.com'] : [''];
  for (const entry of (process.env.PATH ?? '').split(delimiter)) {
    const directory = entry.replace(/^"|"$/g, '');
    if (!directory || !isAbsolute(directory)) continue;
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (!windows) accessSync(candidate, constants.X_OK);
        return candidate;
      } catch { /* Try the next candidate. */ }
    }
  }
  return null;
}

/** Limits a data folder to the current user (and SYSTEM on Windows). Returns false on failure. */
export function restrictToCurrentUser(directory) {
  const target = resolve(directory);
  try {
    if (!windows) {
      chmodSync(target, 0o700);
      return true;
    }
    const system = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    const identity = execFileSync(join(system, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const sid = /"(S-1-[\d-]+)"\s*$/m.exec(identity)?.[1];
    if (!sid) return false;
    const icacls = (args) => execFileSync(join(system, 'icacls.exe'), args, { stdio: 'ignore', windowsHide: true, timeout: 30000 });
    // Lock the folder itself first, in one call: it stops inheriting from its parent without a
    // moment in which it is readable by others. Anything created later inherits from it.
    icacls([target, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '/C', '/Q']);
    // Files that already existed keep their old ACLs: reset them once, then remember that we did.
    const marker = join(target, '.acl-hardened');
    if (!existsSync(marker)) {
      if (readdirSync(target).length) icacls([join(target, '*'), '/reset', '/T', '/C', '/Q']);
      writeFileSync(marker, '');
    }
    return true;
  } catch { return false; }
}

/** Returns the login key kept in the data folder, creating it on first use. */
export function loadAccessKey(directory) {
  const path = join(directory, 'access.key');
  try {
    const value = readFileSync(path, 'utf8').trim();
    if (/^[a-f0-9]{64}$/.test(value)) return value;
  } catch { /* Create a new key below. */ }
  const value = randomBytes(32).toString('hex');
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  return value;
}
