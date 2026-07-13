# watchduck

**Show, don't judge.** Every number is measured, not guessed. It never acts on your behalf, never interrupts, and never claims to know what you meant.

Watchduck is a local, read-only observability tool for Claude Code sessions. It reads two things — `~/.claude/projects/**/*.jsonl` (session transcripts) and `.mcp.json` (declared tools) — and tells you what actually happened.

> Karpathy's rules tell your agent how to behave.
> Watchduck tells you whether it did.

## What it does (v1)

- **`watchduck brief`** — a handoff artifact for the current session. Goal, prompts, file touches attributed to the prompt that triggered them, tokens, tool invocations. Copy-paste it into a fresh session and pick up where you left off.

## What it refuses to do

The refusals are the product.

- No fork of Claude Code
- No runtime interception (Tool Search already does that, better)
- No auto-fixing, auto-reverting, or auto-anything
- No cloud, no account, no telemetry
- No intent-guessing ("this looked wrong")
- No VS Code extension in v1
- No LLM calls in v1 (zero hallucination surface, zero cost)

## The honesty rule

A number is either **measured** or **derived**. The type system enforces the distinction — `Measured<T>` and `Derived<T>` are distinct brands, and derived numbers render with a leading `≈`. Intent-guessing ("scope drift", "over-engineering") does not exist in the codebase. Watchduck reports facts like _"middleware.ts: 6 edits, not named in your prompts"_ — the interpretation is yours.

## Install & run

Requires Node 22.6+ (uses native TypeScript type stripping).

```bash
git clone <this-repo> watchduck
cd watchduck
node --experimental-strip-types src/cli.ts brief
```

With no argument, `brief` resolves the current working directory to a Claude Code project dir under `~/.claude/projects/` and briefs its newest session. Pass a `.jsonl` path or a project slug to target a specific session.

## Tests

```bash
node --experimental-strip-types --test test/*.test.ts
```

Test coverage focuses on the parser: fixture-driven, with a deliberately malformed line to prove the parser survives bad data. Coverage percentage is not the point — presence and shape of tests are.

## License

MIT.
