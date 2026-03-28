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
- onboarding and full-diagnostic placement interviews are voice-required and use OpenAI Realtime live audio with a one-tap continuous mic flow rather than browser TTS or per-turn recording
- current preview-mode subscription rule auto-provisions all accounts on `pro`

Current fixed curriculum system:
- 4 levels:
  - `very_basic`
  - `basic`
  - `intermediate`
  - `advanced`
- 1 fixed curriculum per level
- 6 units per curriculum
- 6 required activities per unit:
  - `lesson`
  - `practice`
  - `game`
  - `speaking`
  - `writing`
  - `checkpoint`
- all four curriculum levels are fully hand-authored across all six required activities

Current Learn UX shape:
- Learn landing emphasizes the current unit and next required step
- unit overview is optional, not the primary path
- activity execution is in focus mode
- lesson flow is:
  - lesson overview
  - short quick check
- activity completion shows a short transition state before routing forward
- game flow is:
  - brief
  - focused game challenge
  - focused summary
- game is a required warm-up between practice and speaking
- game uses richer authored payloads with `theme`, `assetRefs`, `layoutVariant`, stage presentation metadata, and authored summary copy
- the current `very_basic`, `basic`, `intermediate`, and `advanced` games now use the richer Stage 3 game system:
  - `assemble`
  - `spotlight`
  - `state_switch`
  - `priority_board`
  - plus the existing `choice`, `match`, `sequence`, `map`, and `voice_prompt` where they still fit the unit
- voice is used only where it materially helps; the game remains completable through structural fallback when mic access or voice evaluation fails
- preview mode currently means signed-in users land on the Pro game voice-capable path by default when voice is available
- game feedback is coaching-first with no visible numeric score
- there is no separate Games tab or standalone game route; game remains inside Learn
- speaking flow is:
  - brief
  - focused conversation
  - focused review
  - optional retry
- `very_basic` benchmark speaking missions now require 4 turns and 1 substantive follow-up response before feedback opens
- `basic` benchmark speaking missions now require 5 turns and 2 substantive follow-up responses before feedback opens
- `intermediate` benchmark speaking missions now require 6 turns and 2 substantive follow-up responses before feedback opens
- `advanced` benchmark speaking missions now require 7 turns and 3 substantive follow-up responses before feedback opens
- Learn speaking review now includes a compact evidence summary (`observed`, `missing`, `nextFocus`, optional benchmark focus)
- preview mode currently means signed-in users land on the Pro Learn speaking path by default
- the text-first Learn speaking path still exists as the fallback shape when voice is unavailable or when plan gating is re-enabled later
- Learn speaking hides visible turn-count mechanics from the main conversation body
- shared realtime voice now uses patient turn-taking:
  - `semantic_vad` with low eagerness
  - no eager interruption while the learner is likely still speaking
  - only accepted learner turns count toward feedback unlocks and benchmark thresholds
  - rejected turns show repair rather than normal coaching

Current Speak UX shape:
- Speak launch is recommendation-led rather than setup-led
- preview mode currently means signed-in users land on the Pro-capable Speak path by default
- the text-first Speak path still exists as the fallback shape when voice is unavailable or when plan gating is re-enabled later
- active voice sessions live on `/app/speak/session/:sessionId`
- `free_speech` and `guided` are intentionally different products now:
  - `free_speech` is topic-led, one-tap, and skips the mission brief
  - `guided` keeps the structured role-play brief / task / target-phrase framing
- the Speak launch now uses a compact top-level mode switch, and only one primary mode surface should be shown at a time
- avoid stacking a large introductory mode card above a second large launch card; Speak should read as one clean decision path
- keep recommendation treatment quiet on Speak launch: prefer default selections over multiple visible `Recommended` badges and helper callouts
- free-speech launch now uses 4 quick-start lanes:
  - `Something from today`
  - `Something I'm learning`
  - `Something I want to say better`
  - `Surprise me`
- guided sessions open with a short mission brief before the first learner turn:
  - role / scenario
  - speaking goal
  - target phrases
  - why-now context
- free-speech sessions start directly in the conversation surface with only light topic/context framing
- once the mission starts, the transcript is the dominant surface
- once the session ends, Speak switches into a review-first mode instead of leaving the live transcript as the primary surface
- completed sessions now show:
  - completion summary card
  - guided review summary (`What to keep`, `Next focus`, `Key moments`)
  - free-speech review summary (`What sounded natural`, `Next thing to try`, `Phrases to reuse`)
  - secondary expandable `Conversation snapshot`
  - phrase bank items filtered toward reusable multi-word chunks
- live coaching is subtle and transcript-native:
  - one coach label per learner turn
  - one concise coaching note per learner turn
  - one minimal `Help me` action
- free-speech visible coaching is quieter than guided and should not surface vocab-only coaching chips
- Speak should teach mostly through natural recasts and level-aware follow-up questions, not loud correction chrome
- realtime transcript snapshots sync back through the app before the session is completed
- non-realtime fallback Speak panels are read-only for voice sessions so the app does not regress to per-turn recording UX
- Learn voice missions use parallel Learn-scoped realtime routes under `/api/v1/learn/curriculum/speaking/:sessionId/*`
- shared live voice states across Learn, Speak, and assessment now include:
  - `Listening`
  - `Still listening`
  - `Thinking`
  - `Speaking`
  - `Didn't catch that`
  - `Noisy room`

## 3. Read First

Read in this order before changing behavior:
1. `docs/specs/15-agent-handoff-guide.md`
2. `docs/specs/README.md`
3. `docs/specs/01-product-prd.md`
4. `docs/specs/02-ux-architecture-and-flow.md`
5. `docs/specs/12-screen-contracts.md`
6. `docs/specs/03-visual-and-interaction-guidelines.md`
7. `docs/specs/11-theme-tokens-and-implementation.md`
8. `docs/specs/04-technical-architecture.md`
9. `docs/specs/05-data-model.md`
10. `docs/specs/06-api-contracts.md`
11. `docs/specs/07-ai-assessment-and-reporting-spec.md`
12. `docs/specs/13-ai-prompts-and-evals.md`
13. `docs/specs/14-analytics-events.md`
14. `docs/specs/08-non-functional-security-compliance.md`
15. `docs/specs/09-agent-implementation-runbook.md`
16. `docs/specs/10-qa-acceptance-test-plan.md`

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
- free-tier limits still exist in code and docs, but preview mode currently auto-upgrades all accounts to `pro`
- semantic tokens must drive UI colors, not ad hoc raw palette usage

## 5. Key Code Landmarks

### App shell and navigation
- `src/components/ui-kit/app-shell.tsx`
- `src/components/ui-kit/account-menu.tsx`
- `src/lib/constants.ts`

### Home and recommendations
- `src/app/app/home/page.tsx`
- `src/features/home/home-view-model.ts`
- `src/server/services/recommendation-service.ts`
- `src/server/services/context-service.ts`
- `src/components/ui-kit/tracked-link.tsx`
- `src/lib/client-analytics.ts`

### Onboarding and assessment
- `src/app/api/v1/onboarding/session/route.ts`
- `src/app/onboarding/*`
- `src/app/app/assessment/full/*`
- `src/app/api/v1/onboarding/session/assessment/conversation/realtime/route.ts`
- `src/app/api/v1/assessment/full/conversation/realtime/route.ts`
- `src/features/assessment/assessment-form.tsx`
- `src/features/assessment/use-assessment-live-voice.ts`
- `src/features/voice/live-voice-audio.ts`
- `src/server/services/onboarding-service.ts`
- `src/server/services/assessment-service.ts`
- `src/server/services/assessment-conversation-service.ts`
- `src/server/realtime-voice-policy.ts`
- `src/lib/conversation-utils.ts`

### Curriculum Learn
- `src/app/app/learn/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/page.tsx`
- `src/app/app/learn/unit/[unitSlug]/[activityType]/page.tsx`
- `src/features/learn/learn-activity-shell.tsx`
- `src/features/learn/lesson-player.tsx`
- `src/features/learn/worksheet-player.tsx`
- `src/features/learn/structured-response-activity.tsx`
- `src/features/learn/learn-game-player.tsx`
- `src/features/learn/learn-speaking-mission.tsx`
- `src/features/learn/use-learn-realtime-conversation.ts`
- `src/features/learn/checkpoint-player.tsx`
- `src/features/learn/learn-activity-transition.tsx`
- `src/features/learn/learn-flow.ts`
- `src/server/services/curriculum-service.ts`
- `src/server/services/learn-game-service.ts`
- `src/server/services/learn-speaking-service.ts`
- `src/server/curriculum-blueprint.ts`
- `src/app/api/v1/learn/curriculum/game/evaluate/route.ts`

### Tools
- `src/app/app/tools/*`
- `src/features/homework-help/*`
- `src/features/learn/test-prep-panel.tsx`
- `src/server/services/homework-help-service.ts`
- `src/server/services/test-prep-service.ts`

### Speak
- `src/app/app/speak/*`
- `src/features/speak/speak-view-model.ts`
- `src/features/speak/speak-realtime-session-panel.tsx`
- `src/features/speak/speak-session-panel.tsx`
- `src/features/voice/live-voice-audio.ts`
- `src/lib/speak.ts`
- `src/server/services/conversation-service.ts`
- `src/server/services/speak-service.ts`

### AI provider
- `src/server/openai.ts`
- `src/server/ai/openai-conversation.ts`
- `src/server/env.ts`
- `src/server/realtime-client-secret.ts`

### Progress and reports
- `src/app/app/progress/*`
- `src/app/app/progress/reassessment/page.tsx`
- `src/components/ui-kit/progress-insights-panel.tsx`
- `src/components/ui-kit/report-radar-chart.tsx`
- `src/server/services/report-service.ts`
- `src/lib/progress.ts`

### Data and seed
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/seed-demo-report-history.ts`
- `src/server/bootstrap-data.ts`
- `src/server/services/content-service.ts`

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
- OpenAI-backed voice requires local environment values for:
  - `OPENAI_API_KEY`
  - `OPENAI_TEXT_MODEL`
  - `OPENAI_REALTIME_MODEL`
  - `OPENAI_TRANSCRIPTION_MODEL`
  - `OPENAI_TTS_MODEL`
  - `OPENAI_TTS_VOICE`
  - `OPENAI_REALTIME_VOICE`
- server env loading trims surrounding whitespace from env values, which protects production voice flows from newline-tainted model or voice strings

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
- the root `README.md` is still generic Next.js boilerplate and should not be treated as product documentation
- the curriculum and Tools restructure is already implemented
- progress history with trend visualization is already implemented
- auth uses a contextual public/auth shell
- Learn has recently gone through multiple UX simplification passes
- content and curriculum availability are not driven only by one-time seeding:
  - `src/server/bootstrap-data.ts`
  - `src/server/services/content-service.ts`
- Learn and Speak share the same conversation session infrastructure:
  - `speak_sessions`
  - `speak_turns`
  - `src/server/services/conversation-service.ts`
- onboarding diagnostic live voice now depends on the OpenAI Realtime client-secret routes plus `src/server/realtime-client-secret.ts`
- if realtime voice suddenly fails in production, inspect `src/server/env.ts` and the deployed OpenAI env values before assuming the conversation logic is broken
- assessment and Learn UX are currently being pushed toward one dominant action with minimal repeated status chrome
- current Learn goal is clarity through a single anchor:
  - `Unit`
  - `current activity`
  - `current question or response`

When touching Learn, preserve that direction.

Known current gaps / drift:
- `src/app/api/v1/onboarding/session/route.ts` still always creates a fresh guest session instead of resuming an existing in-progress onboarding guest
- `src/app/app/progress/reassessment/page.tsx` still uses the older text-prompt reassessment flow rather than the voice-first full diagnostic path used by onboarding/full placement
- Home no longer uses the older duplicated quick-action dashboard pattern; if it starts drifting back toward equal-weight cards or prime-space class-context forms, treat that as regression

## 10. Common Failure Modes

Avoid these:
1. Reintroducing mixed Learn + Tools entry points
2. Adding more than one dominant CTA on a screen
3. Duplicating the Home primary recommendation in secondary actions
4. Reintroducing large class-context forms into Home
5. Reintroducing equal-weight card grids inside active learning flows
6. Breaking `currentLevel` promotion rules
7. Letting `mini_mock` affect curriculum assignment
8. Changing APIs or analytics without updating specs
9. Using UI language or duplicated status chrome that creates competing progress models on the same screen
10. Re-expanding Learn activity surfaces into dashboards

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
