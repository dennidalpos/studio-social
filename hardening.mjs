import { execFileSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { chmodSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

const windows = process.platform === 'win32';

/**
 * Resolves a program using only absolute PATH entries, never the current directory.
 * On Windows, Node searches the working directory first, so a planted executable
 * there would otherwise run in place of the real tool.
 */
export function findExecutable(name) {
  const here = resolve(process.cwd()).toLowerCase();
  const extensions = windows ? ['.exe', '.com'] : [''];
  for (const entry of (process.env.PATH ?? process.env.Path ?? '').split(delimiter)) {
    const directory = entry.replace(/^"|"$/g, '');
    if (!directory || !isAbsolute(directory) || (windows ? resolve(directory).toLowerCase() : resolve(directory)) === (windows ? here : resolve(process.cwd()))) continue;
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
    // Children inherit from the folder: reset them first, then lock only the folder itself.
    icacls([target, '/reset', '/T', '/C', '/Q']);
    icacls([target, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '/C', '/Q']);
    return true;
  } catch { return false; }
}
