// Smoke test against a real Claude Code session on disk.
// Not a unit test — a reality check that the parser survives real data
// and returns numbers consistent with what the spike observed.

import { parseSession } from "../src/parser.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: node --experimental-strip-types scripts/smoke.ts <path-to-jsonl>");
  process.exit(2);
}

const t0 = performance.now();
const s = parseSession(path);
const ms = (performance.now() - t0).toFixed(1);

console.log(`session: ${s.sessionId}`);
console.log(`parsed in ${ms}ms`);
console.log(`records:            ${s.totals.records}`);
console.log(`user records:       ${s.totals.userRecords} (incl. tool_result)`);
console.log(`human prompts:      ${s.totals.humanPrompts}`);
console.log(`assistant turns:    ${s.totals.assistantTurns}`);
console.log(`input tokens:       ${s.totals.inputTokens.toLocaleString()}`);
console.log(`output tokens:      ${s.totals.outputTokens.toLocaleString()}`);
console.log(`cache read tokens:  ${s.totals.cacheReadTokens.toLocaleString()}`);
console.log(`cache creation:     ${s.totals.cacheCreationTokens.toLocaleString()}`);
console.log(`prompts:            ${s.prompts.length} (${s.prompts.filter((p) => p.isWrapper).length} wrapper)`);
console.log(`file touches:       ${s.fileTouches.length}`);
console.log(`tool invocations:   ${s.toolInvocations.length}`);

const goal = s.prompts.find((p) => !p.isWrapper);
console.log(`\nfirst real prompt (goal candidate):`);
console.log(`  ${(goal?.text ?? "(none)").slice(0, 120)}`);

// Top 5 files by touch count
const counts = new Map<string, number>();
for (const t of s.fileTouches) counts.set(t.filePath, (counts.get(t.filePath) ?? 0) + 1);
const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`\ntop touched files:`);
for (const [f, n] of top) console.log(`  ${n}  ${f}`);
