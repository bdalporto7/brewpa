import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ExecError = Error & { stderr?: string };

async function repoRoot(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"]);
  return stdout.trim();
}

/**
 * Stages, commits, and pushes only docs/ — never the whole working tree —
 * so an in-progress code change elsewhere never rides along on a publish.
 * Args are passed to execFile as an array (never through a shell), since
 * the commit message is built from user-entered bean names.
 * Throws git's own stderr on failure (no remote, diverged history, no
 * auth) so a caller can roll back rather than leave the DB claiming
 * something is live that never actually made it to git.
 */
export async function syncGeneratedDocs(commitMessage: string): Promise<void> {
  try {
    const cwd = await repoRoot();
    const git = (args: string[]) => execFileAsync("git", args, { cwd });

    await git(["add", "--", "docs"]);
    const { stdout: status } = await git(["status", "--porcelain", "--", "docs"]);
    if (!status.trim()) return;

    await git(["commit", "-m", commitMessage]);
    await git(["push"]);
  } catch (err) {
    const e = err as ExecError;
    throw new Error(e.stderr?.trim() || e.message);
  }
}
