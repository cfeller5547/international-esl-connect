# Technical Architecture Specification

## 1. Required Stack (Hard Constraint)

The app must be built with:
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui

Recommended defaults:
- TypeScript
- React Server Components where beneficial
- Zod for schema validation

## 2. Architecture Style

Use a modular monolith for MVP:
- one Next.js application
- clear domain modules
- separate logical layers for UI, application logic, and data access

This keeps delivery speed high while preserving clean boundaries.

## 3. High-Level System Components

1. Web App (Next.js routes and UI)
2. Auth and session layer
3. Assessment engine
4. Learn recommendation engine
5. Homework Help orchestration
6. Speak session orchestration
7. Content catalog and ingestion layer (teacher-provided + placeholder)
8. Test prep planning and mini mock orchestration
9. Report generation and comparison service
10. Streak and engagement milestone tracker
11. Persistence layer (database + object storage)

## 4. Proposed Runtime Topology

- Next.js app server handles:
  - UI rendering
  - route handlers / server actions
  - orchestration logic
- Background jobs (optional worker process for MVP) handle:
  - report regeneration
  - heavy parsing tasks
  - async AI post-processing

## 5. Next.js Application Boundaries

Use `app/` routes aligned with product architecture:
- `app/(public)/*`
- `app/onboarding/*`
- `app/app/assessment/full/*`
- `app/app/home/*`
- `app/app/learn/*`
- `app/app/speak/*`
- `app/app/tools/*`
- `app/app/progress/*`
- `app/app/more/*`

Core code organization:
- `src/features/onboarding/*`
- `src/features/learn/*`
- `src/features/speak/*`
- `src/features/progress/*`
- `src/features/homework-help/*`
- `src/features/content/*`
- `src/features/reports/*`
- `src/lib/*` (shared utilities)
- `src/server/*` (server-only modules)

## 6. Tailwind and shadcn UI Contract

Tailwind:
- tokenized spacing/color/typography usage through theme config
- no random ad-hoc inline styles that bypass design tokens

shadcn/ui:
- use shadcn components as base primitives
- create product-level wrappers in `src/components/ui-kit/*`
- avoid duplicating component variants across features

Theme contract:
- implement the locked palette from `11-theme-tokens-and-implementation.md`
- consume colors via semantic tokens (not raw hex classes in feature components)
- enforce token usage in review/lint standards

## 7. Domain Services (Server Layer)

Define service modules:
- `OnboardingService`
- `AssessmentService`
- `CurriculumService`
- `RecommendationService`
- `HomeworkHelpService`
- `SpeakService`
- `ContentService`
- `TestPrepService`
- `ReportService`
- `StreakService`

Each service should:
- accept validated input DTOs
- return typed output DTOs
- avoid direct UI coupling

Speak tier rule:
- `SpeakService` must enforce free-tier text-first defaults and plan-aware voice gating before expensive voice pipeline calls.

Streak rule:
- `StreakService` recomputes streaks on qualifying activity completion and emits milestone events idempotently.

Content source rule:
- `ContentService` must rank teacher-provided content ahead of placeholder content.
- placeholder content must be used only as fallback when canonical teacher content is missing.
- no teacher portal is required in MVP; ingestion can be internal/manual.

## 8. Recommendation Decision Contract (MVP)

Recommendation inputs (minimum set):
- full diagnostic completion status
- recent homework upload/session state
- active test-prep plan state
- canonical `currentLevel`
- active curriculum progress state
- active class/syllabus topics
- recent activity recency and completion
- content availability by source (`teacher_provided` preferred)

Deterministic priority rules (ordered):
1. if full diagnostic incomplete -> return `complete_full_diagnostic`
2. else if active homework help session exists -> return `resume_homework_help`
3. else if homework uploaded in last 24h and not completed -> return `start_homework_help`
4. else if active test-prep plan exists and target date <= 7 days -> return `continue_test_prep`
5. else if assigned curriculum has a next required activity -> return `continue_curriculum`
6. else return first unlocked curriculum activity

Tie-breakers:
- prefer unfinished over new activities
- prefer the earliest required activity in the active unit
- prefer teacher-authored curriculum content over placeholder curriculum content when both exist for the same activity slot

Required output fields from `RecommendationService`:
- `actionType`
- `targetUrl`
- `reasonCode` (from rule list above)
- `sourceType` (`teacher_provided` | `placeholder`)
- `weakestSkill` (nullable for legacy surfaces)
- `contextSignals` (array)

## 9. Data Flow: Primary Sequences

### 9.1 Onboarding to Baseline Report
1. guest profile saved in temporary session
2. assessment attempt created
3. short AI conversation scored
4. report generated in guest context
5. user signs up
6. guest report attached to user account as baseline

### 9.2 Learn Curriculum Flow
1. Home asks RecommendationService for best next action
2. RecommendationService resolves the next required curriculum activity through CurriculumService
3. Learn executes the selected curriculum activity
4. activity completion updates unit and curriculum progress
5. auto-transition to the next required activity in the unit
6. completing the checkpoint unlocks the next unit
7. inline progress update emitted

### 9.3 Reassessment Report Loop
1. user starts new assessment from Progress
2. assessment completed and scored
3. new report generated
4. previous report loaded
5. delta comparisons stored and displayed

## 10. Homework Parse Pipeline Contract (MVP)

Upload parsing stages:
1. file normalization and type validation
2. text extraction:
   - native text extraction for text PDFs
   - OCR for image PDFs and photos
3. AI-assisted question segmentation and classification
4. parse confidence scoring and sanity checks
5. structured payload persistence (`parsed_payload`)

Parse status model:
- `uploaded`
- `extracting_text`
- `segmenting_questions`
- `parsed`
- `needs_review`
- `failed`

Fallback behavior:
- if confidence below threshold, mark `needs_review` and show manual question edit UI path
- if parsing fails, preserve upload and allow retry or text paste fallback

## 11. Cross-Cutting Concerns

- Validation: Zod schemas at all boundaries
- Logging: structured logs with request/session identifiers
- Error handling: typed domain errors mapped to user-safe messages
- Observability: event instrumentation for key product milestones

## 12. Performance Approach

- server components for data-heavy pages
- streaming/suspense for long-running panels
- cache non-user-specific static data
- avoid blocking UI on non-critical async work
