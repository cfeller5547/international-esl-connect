# Agent Handoff Guide

## 1. Purpose

This document exists so a fresh coding agent can become productive quickly on ESL International Connect and so outgoing agents leave behind useful, compact, verifiable handoffs.

Use it for:
- fresh-start project orientation
- multi-agent coordination
- end-of-task handoff summaries
- reducing repeated context rebuilding across sessions

## 2. Research Basis

This guide is built around a small set of patterns that show up consistently in official agent and coding-assistant guidance:

1. Keep handoffs explicit and deliberate.
   - Effective agent systems treat handoffs as structured state transfer, not as "read the whole transcript and guess."
2. Pass only the context the next agent actually needs.
   - Compact summaries, clear state, and explicit next actions work better than dumping raw history.
3. Keep agents focused and specialized.
   - Narrow scopes produce better execution and cleaner resumability.
4. Store durable repo instructions in versioned files.
   - Repo-local instructions and doc links scale better than re-explaining the project in every prompt.
5. Make work traceable and reproducible.
   - A good handoff includes files changed, validations run, blockers, and the next recommended step.

Primary references:
- OpenAI Agents SDK, `handoffs`: https://openai.github.io/openai-agents-js/guides/handoffs
- OpenAI, practical guide to building agents: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- OpenAI, voice agent handoffs: https://openai.github.io/openai-agents-python/voice/quickstart/#agent-handoffs
- GitHub Copilot CLI best practices: https://docs.github.com/en/copilot/tutorials/copilot-chat-cookbook/debug-errors/use-copilot-cli-in-github-actions-to-troubleshoot-and-resolve-errors#best-practices
- GitHub custom instructions for coding agents: https://docs.github.com/en/copilot/how-tos/custom-instructions/adding-repository-custom-instructions-for-github-copilot

## 3. Project Snapshot

### Product

ESL International Connect is an English-learning web app with:
- pre-signup quick baseline assessment
- post-signup full diagnostic
- curriculum-led Learn
- tactical Tools for Homework Help and Test Prep Sprint
- Speak practice
- Progress with reports, timeline, and reassessment

### Current information architecture

Primary app pillars:
- `Home`
- `Learn`
- `Speak`
- `Tools`
- `Progress`

Secondary utilities:
- `Profile`
- `Settings`
- `Billing`
- `Help`

These utilities live under `/app/more/*` but are reached through the account menu, not primary nav.

### Current curriculum model

- MVP curriculum is English-only.
- There are 4 levels:
  - `very_basic`
  - `basic`
  - `intermediate`
  - `advanced`
- `User.currentLevel` is canonical.
- Only qualifying assessments may set or promote level:
  - `baseline_quick`
  - `baseline_full`
  - `reassessment`
- `mini_mock` never changes curriculum level.
- Promotion is upward-only. No demotion.
- Learn shows only the assigned curriculum.
- Each unit has exactly 5 required activities:
  - `lesson`
  - `practice`
  - `speaking`
  - `writing`
  - `checkpoint`

### Current stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- shadcn/ui
- Prisma + PostgreSQL
- Vitest

Core scripts:
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run db:start`
- `npm run db:push`
- `npm run db:seed`

## 4. Source of Truth

Fresh agents should assume `docs/specs` is authoritative unless a newer implementation-specific correction is made in the same task.

Read in this order:
1. `README.md` in this folder
2. this file
3. `01-product-prd.md`
4. `02-ux-architecture-and-flow.md`
5. `12-screen-contracts.md`
6. `03-visual-and-interaction-guidelines.md`
7. `11-theme-tokens-and-implementation.md`
8. `04-technical-architecture.md`
9. `05-data-model.md`
10. `06-api-contracts.md`
11. `07-ai-assessment-and-reporting-spec.md`
12. `13-ai-prompts-and-evals.md`
13. `14-analytics-events.md`
14. `08-non-functional-security-compliance.md`
15. `10-qa-acceptance-test-plan.md`
16. `09-agent-implementation-runbook.md`

## 5. High-Value Code Landmarks

Fresh agents should inspect these first when they need implementation context:

Product and app shell:
- `package.json`
- `src/lib/constants.ts`
- `src/components/ui-kit/app-shell.tsx`
- `src/components/ui-kit/account-menu.tsx`

Curriculum and level system:
- `prisma/schema.prisma`
- `src/server/curriculum-blueprint.ts`
- `src/server/bootstrap-data.ts`
- `src/server/services/curriculum-service.ts`
- `src/server/services/assessment-service.ts`
- `src/server/services/onboarding-service.ts`
- `src/server/services/recommendation-service.ts`

Key routes:
- `src/app/app/home/page.tsx`
- `src/app/app/learn/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/[activityType]/page.tsx`
- `src/app/app/tools/page.tsx`
- `src/app/app/tools/homework/page.tsx`
- `src/app/app/tools/test-prep/page.tsx`
- `src/app/app/progress/page.tsx`

APIs:
- `src/app/api/v1/home/primary-action/route.ts`
- `src/app/api/v1/learn/curriculum/route.ts`
- `src/app/api/v1/learn/curriculum/activity/complete/route.ts`
- `src/app/api/v1/auth/signup/route.ts`
- `src/app/api/v1/auth/login/route.ts`

Tests:
- `src/test/curriculum-service.test.ts`
- `src/test/content-and-recommendation.test.ts`
- `src/test/assessment-form.test.tsx`
- `src/test/progress-history.test.ts`
- `src/test/streak-and-usage.test.ts`

## 6. Fresh-Agent Startup Checklist

When starting from zero context:

1. Read the source-of-truth docs above.
2. Check the current app shape in:
   - `src/lib/constants.ts`
   - `prisma/schema.prisma`
   - `src/server/services/curriculum-service.ts`
3. Check package scripts in `package.json`.
4. If the task touches data or routes, confirm the real implementation before editing docs.
5. Start local dependencies as needed:
   - `npm run db:start`
   - `npx prisma db push --accept-data-loss` if schema changed
   - `npm run db:seed`
6. Run at least `npm run typecheck` before assuming the repo is healthy.

## 7. Non-Negotiables

Agents should not casually change these:

1. Do not change the primary pillar model unless the specs explicitly change.
   - Current model: `Home`, `Learn`, `Speak`, `Tools`, `Progress`
2. Do not put Homework Help or Test Prep back into Learn.
3. Do not make Learn a flat mode menu again.
4. Do not let `mini_mock` change `currentLevel`.
5. Do not demote `currentLevel` on reassessment.
6. Do not change route architecture or data contracts without updating the relevant specs in the same task.
7. Do not assume documented analytics events are all currently emitted.
   - Some are reserved for future use; check implementation before depending on them.
8. Do not assume language extensibility means multi-language curriculum is implemented.
   - The current curriculum MVP is English-only.

## 8. Verification Standard

Outgoing agents should report exactly what they verified.

Common commands:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

When schema changes are involved:
- `npm run db:start`
- `npx prisma db push --accept-data-loss`
- `npm run db:seed`

If a command was not run, say so explicitly.

## 9. Multi-Agent Coordination Rules

To reduce collisions:

Good parallel boundaries:
- one agent on docs/specs
- one agent on server/service logic
- one agent on UI polish inside a bounded route area
- one agent on tests for a finished feature

High-collision areas that should be coordinated explicitly:
- `prisma/schema.prisma`
- `src/lib/constants.ts`
- `src/components/ui-kit/app-shell.tsx`
- `src/server/services/recommendation-service.ts`
- `src/server/services/curriculum-service.ts`
- `docs/specs/*`

Before starting work, an agent should state:
- the exact task
- the files or subsystems they expect to touch
- whether they plan schema changes
- whether they plan route or analytics changes

## 10. What A Good Handoff Must Contain

Every outgoing handoff should include:

1. `Task`
   - what was being attempted
2. `Status`
   - done, partial, blocked
3. `Why`
   - the product or technical reason for the change
4. `Files changed`
   - concrete paths, not vague areas
5. `Decisions made`
   - especially product, IA, API, schema, or analytics choices
6. `Validation run`
   - exact commands and result
7. `Known blockers or risks`
   - what is still uncertain or broken
8. `Next recommended step`
   - one or two concrete next actions
9. `Spec status`
   - whether docs/specs were updated or still need updates

Optional but useful:
- running local URLs
- active ports
- server PIDs
- log file paths

## 11. What A Bad Handoff Looks Like

Avoid these:
- "Worked on the curriculum stuff"
- "Tests should pass"
- "I changed some backend files"
- "Docs may need updates"
- pasting long raw terminal output with no interpretation
- omitting blockers because the next agent can "figure it out"

## 12. Ready-to-Paste Handoff Template

Use this exact structure when handing off:

```md
Task
- [what I was asked to do]

Status
- [done | partial | blocked]

Context To Keep
- [critical product or technical assumptions]
- [non-negotiable constraints]

Files Changed
- [path]
- [path]

Decisions Made
- [decision and why]
- [decision and why]

Validation Run
- [command] -> [pass/fail/not run]
- [command] -> [pass/fail/not run]

Blockers / Risks
- [issue]
- [issue]

Next Recommended Step
- [next action]
- [next action]

Spec Status
- [updated docs/specs files]
- [remaining spec drift, if any]
```

## 13. Handoff Quality Bar

A handoff is good if a fresh agent can answer these quickly:

1. What is this app?
2. What is the current architecture?
3. What changed?
4. What still needs to happen?
5. What files matter?
6. What commands already passed?
7. What should not be changed casually?

If those answers are not obvious, the handoff is not done.

## 14. Recommended Practice For This Repo

For short tasks:
- use a compact handoff

For medium or large tasks:
- update `docs/specs` if behavior changed
- leave a structured handoff using the template above
- include exact validation status

For cross-cutting tasks:
- add a short "affected systems" note:
  - UI
  - API
  - schema
  - analytics
  - docs

## 15. Maintenance Rule

Update this guide when any of these change:
- primary navigation model
- curriculum architecture
- current level rules
- repo verification commands
- source-of-truth doc order
- multi-agent collaboration expectations
