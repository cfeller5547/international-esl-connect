# Coding Agent Implementation Runbook

## 1. Objective

Provide a deterministic execution plan for coding agents to build the app end-to-end using current specs.

## 2. Hard Technical Constraints

Must use:
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui

## 3. Required Context Package (Read Before Coding)

1. `README.md` (this folder)
2. `01-product-prd.md`
3. `02-ux-architecture-and-flow.md`
4. `12-screen-contracts.md`
5. `03-visual-and-interaction-guidelines.md`
6. `11-theme-tokens-and-implementation.md`
7. `04-technical-architecture.md`
8. `05-data-model.md`
9. `06-api-contracts.md`
10. `07-ai-assessment-and-reporting-spec.md`
11. `13-ai-prompts-and-evals.md`
12. `14-analytics-events.md`
13. `08-non-functional-security-compliance.md`
14. `10-qa-acceptance-test-plan.md`
15. `15-agent-handoff-guide.md`

## 4. Delivery Milestones

## Milestone 1: Foundation

Deliver:
- Next.js project baseline
- Tailwind setup
- shadcn setup and shared component primitives
- app route skeleton:
  - `/onboarding/*`
  - `/app/assessment/full`
  - `/app/home`
  - `/app/learn/*`
  - `/app/speak/*`
  - `/app/tools/*`
  - `/app/progress/*`
  - `/app/more/*`

Definition of done:
- route shell renders
- consistent layout and nav

## Milestone 2: Onboarding and Baseline Report

Deliver:
- pre-signup onboarding stepper
- guest session persistence
- pre-signup full diagnostic flow with objective items, writing, and required AI conversation
- signup migration from guest session to user diagnostic report
- authenticated report unlock immediately after signup

Definition of done:
- user can complete onboarding end-to-end, sign up, and see the report only after entering the authenticated app

## Milestone 3: Curriculum Learn and Tools

Deliver:
- Home 3-tier layout with one dynamic primary CTA
- persistent `Homework Help now` quick action on Home
- canonical `currentLevel` persistence and level backfill from qualifying reports
- fixed curriculum seed data: 4 English curricula, 6 units each, 6 required activities each
- Learn landing with assigned curriculum, current unlocked unit, activity progress, archived prior-level progress
- deterministic recommendation priority logic with documented reason codes
- unit activity chain via seamless Continue (`lesson` -> `practice` -> `game` -> `speaking` -> `writing` -> `checkpoint`)
- required Learn game activity in every unit:
  - current `very_basic` and `basic` games use the Stage 9 direct-playfield micro-arcade set with `answerRevealMode`, `ambientSet`, `celebrationVariant`, `interactionModel`, `spriteRefs`, `motionRules`, `hitBoxes`, `spawnTimeline`, `failWindowMs`, `rewardFx`, and `transitionFx`
  - `intermediate` and `advanced` remain on the authored Stage 3 board-first mechanic set for now
  - voice is used only on 6 selected current-12 games, with guaranteed non-voice fallback on voice-enabled stages
  - current 12 arcade games use local score, combo, hearts, timer, and medal, but no global currency or leaderboard
  - all Learn games now share the compact game-feel layer: targeted motion, basic game audio, neutral or themed ambient audio, and a short completion celebration
  - game completion unlocks speaking
- Tools landing with Homework Help and Test Prep Sprint
- Homework Help inside Tools with upload and hint ladder
- homework parse pipeline state handling (`extracting_text` -> `parsed/needs_review/failed`)
- class context capture: syllabus upload or manual weekly topics
- Test Prep Sprint plan and mini mock flow inside Tools
- old Learn homework/test-prep routes redirect to Tools
- curriculum content seed so Learn flows are functional before teacher import

Definition of done:
- user can complete a curriculum unit continuously across all six required activities with inline progress updates
- user can switch to Tools for homework and test prep without polluting Learn IA

## Milestone 4: Speak and Progress

Deliver:
- Speak free and guided session flows with plan-aware mode behavior
- explicit Speak mode switch with only one launch surface visible at a time
- free-tier text-first + pro voice gating behavior
- shared realtime voice reliability layer across Learn, Speak, and full diagnostic:
  - patient turn-taking
  - accepted-vs-repair turn handling
  - ambient-noise awareness
  - accepted-turn coaching only
- free-tier quota enforcement with deterministic limit keys
- free-speech quick-start lanes and first-run default lane
- transcript learning layer (inline corrections + phrase save)
- Progress report library
- reassessment flow producing new reports and comparisons
- share-card generation from progress and milestone states
- streak persistence and milestone-triggered celebration behavior

Definition of done:
- user can generate at least two reports and compare deltas

## Milestone 5: Subscription and Hardening

Deliver:
- plan gating and upgrade flow
- return-to-interrupted-task behavior after upgrade
- instrumentation hooks and quality checks

Definition of done:
- acceptance tests pass from `10-qa-acceptance-test-plan.md`

## 5. Agent Task Sequencing Rules

1. Build routes and layout before feature internals.
2. Build data contracts before UI that depends on them.
3. Keep feature flags or stubs for unfinished AI integrations.
4. Never block key UX flows on non-critical async processing.

## 6. Prompting Template for Sub-Agents

Use this when delegating:

```
You are implementing [milestone/feature] for ESL International Connect.
Stack is fixed: Next.js App Router + Tailwind + shadcn/ui.
Follow these docs:
- docs/specs/01-product-prd.md
- docs/specs/02-ux-architecture-and-flow.md
- docs/specs/12-screen-contracts.md
- docs/specs/03-visual-and-interaction-guidelines.md
- docs/specs/11-theme-tokens-and-implementation.md
- docs/specs/04-technical-architecture.md
- docs/specs/05-data-model.md
- docs/specs/06-api-contracts.md
- docs/specs/13-ai-prompts-and-evals.md
- docs/specs/14-analytics-events.md

Constraints:
- Do not change route architecture.
- Keep Home/Learn/Speak/Tools/Progress pillar model.
- Keep Learn curriculum-only and Tools utility-only.
- Preserve seamless curriculum activity chaining.
- Preserve onboarding pre-signup full diagnostic with writing and required AI conversation.
- Show the report only after signup inside the authenticated app.
- Enforce locked Option 1 palette through semantic tokens only.
- Follow screen-level CTA/state contracts.
- Emit analytics events exactly as specified.
- Keep AI prompts and scoring contracts aligned to docs.
- Keep free-tier voice economics constraints enforced.
- Prefer teacher-provided content whenever available; placeholder only as fallback.
- Implement fixed free-tier limits exactly as documented (do not invent new thresholds).

Output:
- code changes
- schema changes if needed
- tests
- concise change summary
```

## 7. Common Failure Modes to Avoid

1. Reintroducing Homework as top-level nav
2. Multiple equal-primary CTAs on Home
3. Learn opening as a mixed mode menu instead of curriculum progression
4. Breaking guest-to-user onboarding migration
5. Failing to persist and compare reports
6. Allowing mini-mock results to change curriculum level

## 8. Handoff Checklist

Any agent completion must include:
- updated route list (if changed)
- updated API contract (if changed)
- updated data model (if changed)
- tests added/updated
- acceptance criteria status mapping
- a structured handoff that follows `15-agent-handoff-guide.md`
