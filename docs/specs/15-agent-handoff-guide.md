# Agent Handoff Guide

## 1. Purpose

This document is the fast-start handoff for a fresh coding agent joining ESL International Connect.

Use it to:
- understand the current app shape quickly
- avoid breaking non-negotiable product rules
- find the right code landmarks
- start work with minimal rediscovery
- hand off cleanly to the next agent

## 2. Current Product Snapshot

ESL International Connect is a student-focused English-learning app with 5 primary pillars:
- `Home`
- `Learn`
- `Speak`
- `Tools`
- `Progress`

Current core model:
- `Learn` is curriculum-only
- `Tools` contains `Homework Help` and `Test Prep Sprint`
- `User.currentLevel` is the canonical level assignment
- `currentLevel` can only stay the same or be promoted
- only qualifying assessments can change level:
  - `baseline_quick`
  - `baseline_full`
  - `reassessment`
- `mini_mock` never changes level
- curriculum MVP is English-only

Current fixed curriculum system:
- 4 levels:
  - `very_basic`
  - `basic`
  - `intermediate`
  - `advanced`
- 1 fixed curriculum per level
- 6 units per curriculum
- 5 required activities per unit:
  - `lesson`
  - `practice`
  - `speaking`
  - `writing`
  - `checkpoint`

Current Learn UX shape:
- Learn landing emphasizes the current unit and next required step
- unit overview is optional, not the primary path
- activity execution is in focus mode
- lesson flow is:
  - lesson overview
  - short quick check
- activity completion shows a short transition state before routing forward

## 3. Read First

Read in this order before changing behavior:
1. `docs/specs/README.md`
2. `docs/specs/01-product-prd.md`
3. `docs/specs/02-ux-architecture-and-flow.md`
4. `docs/specs/12-screen-contracts.md`
5. `docs/specs/03-visual-and-interaction-guidelines.md`
6. `docs/specs/11-theme-tokens-and-implementation.md`
7. `docs/specs/04-technical-architecture.md`
8. `docs/specs/05-data-model.md`
9. `docs/specs/06-api-contracts.md`
10. `docs/specs/07-ai-assessment-and-reporting-spec.md`
11. `docs/specs/13-ai-prompts-and-evals.md`
12. `docs/specs/14-analytics-events.md`
13. `docs/specs/08-non-functional-security-compliance.md`
14. `docs/specs/09-agent-implementation-runbook.md`
15. `docs/specs/10-qa-acceptance-test-plan.md`

Rule:
- `docs/specs/*` is the source of truth
- if implementation and docs diverge, update docs in the same task

## 4. Hard Non-Negotiables

Do not casually change these:
- Stack stays `Next.js App Router + Tailwind + shadcn/ui`
- top-level IA stays `Home / Learn / Speak / Tools / Progress`
- `Learn` must remain curriculum-only
- `Tools` must remain utility-only
- `Profile`, `Settings`, `Billing`, and `Help` stay in the account/utility menu, not top nav
- curriculum level is driven by assessment, not by unit completion
- reassessment can promote, never demote
- `mini_mock` can never change `currentLevel`
- fixed free-tier limits must stay aligned with docs
- semantic tokens must drive UI colors, not ad hoc raw palette usage

## 5. Key Code Landmarks

### App shell and navigation
- `src/components/ui-kit/app-shell.tsx`
- `src/components/ui-kit/account-menu.tsx`
- `src/lib/constants.ts`

### Onboarding and assessment
- `src/app/onboarding/*`
- `src/app/app/assessment/full/*`
- `src/features/assessment/assessment-form.tsx`
- `src/server/services/onboarding-service.ts`
- `src/server/services/assessment-service.ts`

### Curriculum Learn
- `src/app/app/learn/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/[activityType]/page.tsx`
- `src/features/learn/learn-activity-shell.tsx`
- `src/features/learn/lesson-player.tsx`
- `src/features/learn/worksheet-player.tsx`
- `src/features/learn/structured-response-activity.tsx`
- `src/features/learn/checkpoint-player.tsx`
- `src/features/learn/learn-activity-transition.tsx`
- `src/features/learn/learn-flow.ts`
- `src/server/services/curriculum-service.ts`
- `src/server/curriculum-blueprint.ts`

### Tools
- `src/app/app/tools/*`
- `src/features/homework-help/*`
- `src/features/learn/test-prep-panel.tsx`
- `src/server/services/homework-help-service.ts`
- `src/server/services/test-prep-service.ts`

### Speak
- `src/app/app/speak/*`
- `src/server/services/speak-service.ts`

### Progress and reports
- `src/app/app/progress/*`
- `src/components/ui-kit/progress-insights-panel.tsx`
- `src/components/ui-kit/report-radar-chart.tsx`
- `src/server/services/report-service.ts`
- `src/lib/progress.ts`

### Data and seed
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/seed-demo-report-history.ts`

### Analytics
- `src/server/analytics.ts`
- `docs/specs/14-analytics-events.md`

### Tests
- `src/test/*`

## 6. Startup Checklist

Typical local startup:

1. Install dependencies
```bash
npm install
```

2. Start Postgres
```bash
npm run db:start
```

3. Sync schema
```bash
npm run db:push
```

4. Seed data
```bash
npm run db:seed
```

5. Validate before editing large features
```bash
npm run typecheck
npm run lint
npm test
```

6. Run the app
```bash
npm run dev
```
or build/start:
```bash
npm run build
npm run start -- --port 3002
```

Environment notes:
- Postgres runs via Docker on `localhost:5434`
- this workspace has commonly used `3002` for production-mode browser testing
- do not assume `3000` is free in this environment

## 7. Verification Standard

For behavior-changing work, the expected minimum is:
- `npm run typecheck`
- `npm run lint`
- `npm test`

Also run `npm run build` when:
- route structure changed
- server/client boundaries changed
- shared shell or layout changed
- large UX refactors changed multiple screens

## 8. How To Approach Changes

Preferred sequence:
1. read the controlling spec docs
2. inspect current implementation in code
3. decide whether the change is:
   - route UX only
   - data/model only
   - service/API only
   - cross-cutting
4. change code
5. update docs/specs if contracts or behavior changed
6. run verification
7. leave a structured handoff

Do not:
- change architecture casually because the current route model is spec-driven
- introduce a new top-level nav concept without spec updates
- let docs/specs drift after feature changes

## 9. Current Implementation Truths Worth Knowing

- the repo entrypoint file is `AGENTS.md`
- this guide exists because fresh agents need a single reliable starting point
- the curriculum and Tools restructure is already implemented
- progress history with trend visualization is already implemented
- auth uses a contextual public/auth shell
- Learn has recently gone through multiple UX simplification passes
- current Learn goal is clarity through a single anchor:
  - `Unit`
  - `current activity`
  - `current question or response`

When touching Learn, preserve that direction.

## 10. Common Failure Modes

Avoid these:
1. Reintroducing mixed Learn + Tools entry points
2. Adding more than one dominant CTA on a screen
3. Reintroducing equal-weight card grids inside active learning flows
4. Breaking `currentLevel` promotion rules
5. Letting `mini_mock` affect curriculum assignment
6. Changing APIs or analytics without updating specs
7. Using UI language that creates competing progress models on the same screen
8. Re-expanding Learn activity surfaces into dashboards

## 11. Multi-Agent Coordination Rules

If multiple agents are working:
- one agent should own route UX per surface
- one agent should own service/data changes for the same feature
- avoid overlapping edits to shared shells unless explicitly coordinated
- if a shared shell changes, note all affected routes in the handoff
- if specs changed, say exactly which files were updated

## 12. Required Handoff Contents

Every handoff should include:
- what changed
- why it changed
- exact files touched
- verification run
- docs/specs updated
- unresolved issues or follow-ups
- browser URL / runtime status if relevant

## 13. Handoff Template

Use this structure:

```md
## Summary
- What was implemented or changed

## Files
- absolute/path/to/file

## Verification
- npm run typecheck
- npm run lint
- npm test
- npm run build

## Spec Updates
- docs/specs/...

## Risks / Follow-ups
- any known limitation, unanswered question, or next best step

## Runtime
- app URL
- server mode if relevant
```

## 14. Research Basis For This Guide

This guide follows the practical pattern that effective AI-agent handoffs should preserve:
- current objective
- state of work completed
- invariants and constraints
- exact code landmarks
- validation status
- explicit next steps

That is the difference between a useful handoff and a vague summary.
