// `watchduck brief` — the handoff artifact.
//
// Pure function: ParsedSession → markdown string. No I/O, no clock, no LLM.
// Every number rendered here is Measured; nothing is guessed.

import type { FileTouch, ParsedSession, Prompt } from "./types.ts";

// A "substantive" prompt is what we call the Goal candidate. Trivial prompts
// (a single "." to unstick a crashed session, "ok", punctuation-only) are
// excluded. This is a display heuristic, not a claim about intent.
const isSubstantive = (p: Prompt): boolean => {
  if (p.isWrapper) return false;
  const stripped = p.text.replace(/\s+/g, "");
  if (stripped.length < 6) return false;
  if (/^[\W_]+$/.test(stripped)) return false;
  return true;
};

// Group each file touch under the prompt that preceded it. Both arrays are
// sorted by turnIndex (insertion order in the JSONL). One pass through each.
export type AttributedPrompt = {
  prompt: Prompt;
  touches: FileTouch[];
};

export const attributeTouches = (
  prompts: Prompt[],
  touches: FileTouch[],
): AttributedPrompt[] => {
  const result: AttributedPrompt[] = prompts.map((prompt) => ({ prompt, touches: [] }));
  if (prompts.length === 0) return result;

  let cursor = 0;
  for (const touch of touches) {
    while (
      cursor + 1 < prompts.length &&
      (prompts[cursor + 1]!.turnIndex as number) <= (touch.turnIndex as number)
    ) {
      cursor++;
    }
    // Touches before any prompt (rare — usually system setup) are dropped.
    if ((prompts[cursor]!.turnIndex as number) <= (touch.turnIndex as number)) {
      result[cursor]!.touches.push(touch);
    }
  }
  return result;
};

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : s.slice(0, n - 1) + "…";

const shortenPath = (p: string): string => {
  // Strip everything up to and including the last drive letter / repo prefix.
  // Not perfect — deliberately conservative. We show the tail that identifies
  // the file among siblings.
  const parts = p.split(/[\\/]/);
  return parts.slice(-3).join("/");
};

export const buildBrief = (s: ParsedSession): string => {
  const goal = s.prompts.find(isSubstantive);
  const attributed = attributeTouches(s.prompts, s.fileTouches);

  const fileCounts = new Map<string, number>();
  for (const t of s.fileTouches) {
    fileCounts.set(t.filePath, (fileCounts.get(t.filePath) ?? 0) + 1);
  }
  const topFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const toolCounts = new Map<string, number>();
  for (const t of s.toolInvocations) {
    toolCounts.set(t.name, (toolCounts.get(t.name) ?? 0) + 1);
  }
  const topTools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  lines.push(`# Brief: ${s.sessionId ?? "(no session id)"}`);
  lines.push("");
  lines.push(`_source: \`${s.path}\`_`);
  lines.push("");

  lines.push("## Goal");
  if (goal) {
    lines.push("");
    lines.push("> " + truncate(goal.text.replace(/\n+/g, " "), 400));
  } else {
    lines.push("");
    lines.push("_No substantive prompt found. All prompts were wrappers or trivial._");
  }
  lines.push("");

  lines.push("## By the numbers");
  lines.push("");
  lines.push(`- records: **${s.totals.records}**`);
  lines.push(`- assistant turns: **${s.totals.assistantTurns}**`);
  lines.push(
    `- human prompts: **${s.totals.humanPrompts}** ` +
      `(${s.totals.userRecords} user-role records incl. tool_result)`,
  );
  lines.push(`- input tokens: **${(s.totals.inputTokens as number).toLocaleString()}**`);
  lines.push(`- output tokens: **${(s.totals.outputTokens as number).toLocaleString()}**`);
  lines.push(
    `- cache read: **${(s.totals.cacheReadTokens as number).toLocaleString()}** · ` +
      `cache creation: **${(s.totals.cacheCreationTokens as number).toLocaleString()}**`,
  );
  lines.push(`- file touches: **${s.fileTouches.length}** across **${fileCounts.size}** files`);
  lines.push("");

  lines.push("## Prompts and what followed");
  lines.push("");
  for (const [i, ap] of attributed.entries()) {
    const p = ap.prompt;
    const label = p.isWrapper ? "[wrapper]" : isSubstantive(p) ? "[human]" : "[trivial]";
    const preview = truncate(p.text.replace(/\n+/g, " "), 160);
    lines.push(`### ${i + 1}. ${label} ${preview}`);
    if (ap.touches.length === 0) {
      lines.push("_no file touches followed this prompt_");
    } else {
      const perFile = new Map<string, string[]>();
      for (const t of ap.touches) {
        const arr = perFile.get(t.filePath) ?? [];
        arr.push(t.tool);
        perFile.set(t.filePath, arr);
      }
      for (const [fp, tools] of perFile) {
        lines.push(`- \`${shortenPath(fp)}\` — ${tools.join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push("## Top touched files");
  lines.push("");
  if (topFiles.length === 0) {
    lines.push("_none_");
  } else {
    for (const [fp, n] of topFiles) {
      lines.push(`- **${n}** — \`${shortenPath(fp)}\``);
    }
  }
  lines.push("");

  lines.push("## Tool invocations");
  lines.push("");
  if (topTools.length === 0) {
    lines.push("_none_");
  } else {
    for (const [name, n] of topTools) {
      lines.push(`- **${n}** — ${name}`);
    }
  }
  lines.push("");

  lines.push("---");
  lines.push("_All numbers above are measured from the JSONL. Watchduck shows, doesn't judge._");

  return lines.join("\n");
};
