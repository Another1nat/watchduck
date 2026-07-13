#!/usr/bin/env node
// Minimal CLI. One command in v1: `watchduck brief [path-or-project]`.
//
// If given a path to a .jsonl file, brief that file.
// If given no argument, resolve the current working directory to a Claude Code
// project dir under ~/.claude/projects/<slug>/ and brief its newest .jsonl.
// If given a project-dir slug, brief the newest .jsonl in it.

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseSession } from "./parser.ts";
import { buildBrief } from "./brief.ts";

const projectsRoot = join(homedir(), ".claude", "projects");

// Claude Code uses a slug convention: replace path separators and colons with
// '-', so `C:\Users\v\Documents\watchduck` → `C--Users-v-Documents-watchduck`.
const slugForCwd = (cwd: string): string =>
  cwd.replace(/[\\/:]/g, "-");

const newestJsonl = (dir: string): string | null => {
  let best: { path: string; mtime: number } | null = null;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".jsonl")) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (!s.isFile()) continue;
    if (!best || s.mtimeMs > best.mtime) best = { path: p, mtime: s.mtimeMs };
  }
  return best?.path ?? null;
};

const resolveSessionPath = (arg: string | undefined): string => {
  if (arg && arg.endsWith(".jsonl")) return resolve(arg);
  const projectDir = arg
    ? join(projectsRoot, arg)
    : join(projectsRoot, slugForCwd(process.cwd()));
  const j = newestJsonl(projectDir);
  if (!j) {
    console.error(`no .jsonl found in ${projectDir}`);
    process.exit(1);
  }
  return j;
};

const usage = () => {
  console.error("usage: watchduck brief [path-or-project-slug]");
  process.exit(2);
};

const [, , cmd, arg] = process.argv;

if (cmd === "brief") {
  const path = resolveSessionPath(arg);
  const session = parseSession(path);
  process.stdout.write(buildBrief(session) + "\n");
} else {
  usage();
}
