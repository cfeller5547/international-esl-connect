# Screen Contracts (MVP)

## 1. Purpose

Define route-level behavior so implementation agents can build screens with low ambiguity and consistent UX.

This document translates product and UX principles into concrete, testable screen contracts.

## 2. Global Screen Rules

1. Each screen must have exactly one visually dominant primary CTA.
2. Every screen must define loading, empty, and error behavior.
3. Any interruption (auth, paywall, refresh) must return the user to the interrupted task.
4. Top-level navigation labels must stay fixed: `Home`, `Learn`, `Speak`, `Tools`, `Progress`.
5. Learn is curriculum-only; helper utilities do not live there.
6. Mobile-first behavior is required; desktop can add richer layout, not different logic.
7. All actionable controls must be keyboard reachable and have visible focus states.
8. Home must expose persistent urgent homework quick action.
9. Profile, Settings, Billing, and Help must remain reachable from a compact account/utility menu.

## 3. Route Contracts

## 3.1 Public and Onboarding

### `/`
- Goal: explain value and start activation.
- Primary CTA: `Start assessment`.
- Secondary actions: `Log in`, `See how it works`.
- Required components: value proposition, three-step flow preview, trust/support cues.
- Loading/empty/error: if session bootstrap fails, show retry CTA.
- Exit transition: create guest onboarding session and route to `/onboarding/profile`.
- Instrumentation: `landing_viewed`, `landing_primary_cta_clicked`.

### `/onboarding/profile`
- Goal: collect minimal profile context for personalization.
- Primary CTA: `Continue to assessment`.
- Secondary actions: optional `Back` only when returning into the flow.
- Required components: stepper header, profile form, inline validation, one clear primary CTA.
- Loading/empty/error: preserve typed inputs on recoverable errors.
- Exit transition: route to `/onboarding/assessment` when required fields are valid.
- Instrumentation: `onboarding_started`, `onboarding_profile_saved`.

### `/onboarding/assessment`
- Goal: complete baseline assessment before signup.
- Primary CTA: `Complete quick baseline` (becomes active only when required parts complete).
- Secondary actions: `Back`, text fallback for voice inputs.
- Required components:
  - pre-signup stepper header
  - guided assessment shell with one primary task at a time
  - objective questions
  - required short AI conversation responses
  - section status summary
  - overall progress bar
- Loading/empty/error: autosave progress; recover session if refreshed.
- Exit transition: submit assessment and route to `/onboarding/results`.
- Instrumentation: `assessment_started`, `assessment_completed`.

### `/onboarding/results`
- Goal: show high-value report preview and convert to signup.
- Primary CTA: `Create account to save report`.
- Secondary actions: none required beyond inline review of chart and skill cards.
- Required components: quick baseline report header, radar chart, six skill cards, clear statement that full diagnostic unlocks deeper analysis.
- Loading/empty/error: if report generation is delayed, show progress state with polling.
- Exit transition: route to signup flow and migrate guest report after success.
- Instrumentation: `onboarding_results_viewed`, `signup_completed`, `baseline_report_persisted`.

### `/signup` and `/login`
- Goal: complete auth with minimal friction.
- Primary CTA: `Create account` or `Log in`.
- Secondary actions: switch auth mode.
- Required components: auth form, validation feedback, mode switch, contextual support panel.
- Additional rule: `/signup` should preserve pre-signup continuity with the same four-step language used in onboarding.
- Loading/empty/error: explicit errors for existing account, invalid credentials, rate-limit.
- Exit transition: return to intended target (`/app/home` or interrupted task).
- Instrumentation: `signup_completed`, `login_completed`.

### `/app/assessment/full`
- Goal: complete full diagnostic soon after signup.
- Primary CTA: `Complete full diagnostic`.
- Secondary actions: `Back`; resume later is handled by autosave.
- Required components:
  - guided assessment shell
  - expanded objective items
  - full AI conversation segment
  - writing prompt stage
  - section status summary
  - overall progress indicator
- Loading/empty/error: autosave and resume support required.
- Exit transition: generate `baseline_full` report and route to `/app/progress/reports/:reportId`.
- Instrumentation: `full_diagnostic_started`, `full_diagnostic_completed`, `celebration_milestone_viewed`.

## 3.2 Authenticated App Shell

### `/app/*` (shared shell)
- Goal: provide persistent app navigation and consistent page frame.
- Primary CTA: page-specific, not shell-level.
- Secondary actions: global notifications/help access (if included).
- Required components: bottom nav on mobile, sidebar/top nav on larger screens, safe area handling.
- Loading/empty/error: skeleton for route content; shell remains stable.
- Exit transition: tab changes preserve in-progress state where possible.
- Instrumentation: `app_shell_viewed`.
- Implementation note: `nav_tab_clicked` is reserved and is not emitted by the current shell implementation.

## 3.3 Home

### `/app/home`
- Goal: present exactly one highest-priority next action.
- Primary CTA: dynamic action from recommendation service.
- Secondary actions: two to three compact cards only (for example Continue curriculum, Homework Help, Test Prep Sprint).
- Required components:
  - Tier 1 primary CTA card (full width)
  - Tier 2 secondary action row (2-3 items)
  - Tier 3 collapsible summary (skills snapshot, recent activity)
  - persistent urgent quick action: `Homework Help now`
  - class-context prompt card when missing (`Upload syllabus` or `Add weekly topics`)
  - streak status chip/panel (current streak + next milestone hint)
- Loading/empty/error:
  - Loading: skeleton for primary CTA card
  - Empty: fallback CTA `Start a recommended practice`
  - Error: retry CTA and safe default to Learn recommendation
- Exit transition: CTA routes directly to target activity.
- Instrumentation: `home_primary_cta_rendered`, `class_context_prompt_shown`, `class_context_submitted`.
- Implementation note: `home_primary_cta_clicked` and `homework_quick_action_clicked` are reserved and are not emitted by the current server-rendered Home surface.

## 3.4 Learn

### `/app/learn`
- Goal: start or resume learning with lowest cognitive load.
- Primary CTA: `Continue` on the next required curriculum activity.
- Secondary actions: open the current unit, review completed units, inspect archived prior-level progress.
- Required components:
  - current curriculum hero with one dominant continue CTA
  - current level badge
  - current-unit progress summary
  - detailed current-unit activity list
  - separate completed and later unit sections
  - archived prior-level curriculum summaries when present
- Content sourcing rule: only the assigned curriculum is shown; future levels are not shown as active choices.
- Loading/empty/error:
  - Loading curriculum skeleton
  - Empty fallback: show recoverable curriculum sync state with retry
  - Error fallback: show safe reload path without exposing unrelated tools
- Exit transition: primary CTA routes directly to the next required activity, not to an intermediate overview.
- Instrumentation: `curriculum_viewed`.

### `/app/learn/unit/:unitSlug`
- Goal: provide optional unit context and review without interrupting the default activity flow.
- Primary CTA: `Start unit` or `Continue`.
- Secondary actions: return to Learn.
- Required components:
  - unit title and summary
  - can-do statement
  - unit progress summary
  - activity checklist in fixed order
  - performance task preview
- Loading/empty/error: if unit is still locked, show explicit locked state and return path to Learn.
- Exit transition: route to the first available `/app/learn/unit/:unitSlug/:activityType`.
- Instrumentation: `unit_started`.

### `/app/learn/unit/:unitSlug/:activityType`
- Goal: complete the current required curriculum activity.
- Allowed `activityType` values: `lesson`, `practice`, `speaking`, `writing`, `checkpoint`.
- Primary CTA: `Continue`.
- Secondary actions: `Back to roadmap`, optional `Unit overview`.
- Required components:
  - shared activity shell with compressed unit context
  - fixed progress indicator across the five required activities
  - visible step map / you-are-here treatment
  - collapsed unit-details section by default
  - one lesson overview or one current prompt visible at a time
  - activity-specific body
  - completion feedback and next-step preview
- Loading/empty/error: preserve completed work; locked later activities must not open early.
- Exit transition:
  - if unit not finished, route to the next required activity
  - if unit finished, unlock next unit and route directly to its first activity after the completion transition
- Instrumentation: `unit_activity_completed`, `unit_completed`.

## 3.5 Speak

### `/app/speak`
- Goal: launch conversation practice quickly.
- Primary CTA: `Start practice` (plan-aware default).
- Secondary actions: scenario selector, resume recent session.
- Required components:
  - mode cards
  - scenario list
  - quick mic check
  - free-speech starter chips (at least 4 prompts)
  - first-time default starter preselected to avoid blank state
- Loading/empty/error:
  - free tier defaults to text mode
  - if voice requested but unavailable by plan, show upgrade prompt with text fallback
- Exit transition: route to `/app/speak/session/:sessionId`.
- Instrumentation: `speak_landing_viewed`, `speak_starter_selected`, `speak_session_started`, `voice_mode_upgrade_prompt_shown`.

### `/app/speak/session/:sessionId`
- Goal: complete conversation with live feedback.
- Primary CTA: `Send` / `Finish session`.
- Secondary actions: mic toggle, text fallback, end session.
- Required components:
  - transcript pane
  - input controls
  - speaking/listening state indicator
  - inline corrections in transcript review
  - save-to-phrase-bank action
- Loading/empty/error: resilient reconnect flow for temporary AI failures.
- Exit transition: post-session summary then recommend next Learn step.
- Instrumentation: `speak_turn_submitted`, `speak_session_completed`, `transcript_phrase_saved`.

## 3.6 Progress

### `/app/progress`
- Goal: review report history and trigger reassessment.
- Primary CTA: `Run new assessment`.
- Secondary actions: switch visible history range and open a selected report.
- Required components:
  - overall score timeline
  - selected report summary
  - six skill sparkline cards
  - report list
  - reassessment entry point
- Loading/empty/error:
  - Empty state: show baseline report generation guidance
  - Error: retry data fetch
- Exit transition: to reassessment flow or selected report detail.
- Instrumentation: `progress_library_viewed`, `reassessment_started`.

### `/app/progress/reports/:reportId`
- Goal: deep-dive report details and compare changes.
- Primary CTA: `Generate share card`.
- Secondary actions: open another report from the inline history strip, return to Progress.
- Required components:
  - report header
  - radar chart
  - next 7 days plan
  - compact history strip anchored to the current report
  - six skill cards
  - comparison deltas when prior report data exists
- Loading/empty/error: if prior comparison missing, show explicit no-prior-report state.
- Exit transition: back to Progress or direct to Learn recommendation.
- Instrumentation: `progress_report_viewed`, `report_comparison_viewed`, `share_card_generated`.

### `/app/progress/reassessment`
- Goal: run full reassessment using same assessment contract.
- Primary CTA: `Complete reassessment`.
- Secondary actions: `Back`.
- Required components: guided assessment modules, section status summary, overall progress indicator, autosave.
- Loading/empty/error: resume in-progress reassessment when available.
- Exit transition: generate new report and route to report detail.
- Instrumentation: `reassessment_started`, `reassessment_completed`.

## 3.7 Tools

### `/app/tools`
- Goal: provide fast access to high-frequency helper utilities outside the fixed curriculum.
- Primary CTA: page-level cards for `Homework Help` and `Test Prep Sprint`.
- Secondary actions: return to Home or Learn.
- Required components:
  - tools overview header
  - Homework Help card
  - Test Prep Sprint card
  - concise explanation that Learn is curriculum-only
- Loading/empty/error: show safe links to both tools even if recommendation context fails.
- Exit transition: route to selected tool.
- Instrumentation: `tools_viewed`.

### `/app/tools/homework`
- Goal: start assignment assistance inside Tools.
- Primary CTA: `Upload assignment`.
- Secondary actions: `Paste text instead`, `Resume previous session`.
- Required components:
  - upload zone
  - supported format list
  - recent homework sessions
  - parse progress state (`extracting_text` / `segmenting_questions`)
  - parse review fallback UI when status is `needs_review`
- Loading/empty/error: upload validation errors must be explicit and recoverable.
- Exit transition: route to `/app/tools/homework/session/:sessionId`.
- Instrumentation: `homework_help_opened_from_tools`, `homework_upload_started`, `homework_upload_parsed`, `homework_parse_needs_review`, `homework_parse_failed`, `homework_session_started`.

### `/app/tools/test-prep`
- Goal: create and execute short, date-bound exam prep plans.
- Primary CTA: `Create prep plan`.
- Secondary actions: resume active prep plan, edit topics/date.
- Required components: target date input, topic input, generated daily priorities, mini-mock entry.
- Loading/empty/error: show manual fallback recommendations if plan generation fails.
- Exit transition: route to generated plan or mini mock flow.
- Instrumentation: `test_prep_opened_from_tools`, `test_prep_plan_created`, `test_prep_mini_mock_started`, `test_prep_mini_mock_completed`.

### `/app/tools/homework/session/:sessionId`
- Goal: complete homework with guided help, not answer dumping.
- Primary CTA: `Submit step`.
- Secondary actions: `Get hint` (laddered), `Next question`.
- Required components: split panel (source assignment + workspace), hint ladder, question progress.
- Loading/empty/error: autosave responses; recover after refresh.
- Exit transition: return to Tools or Home with updated weakness tags.
- Instrumentation: `homework_step_submitted`, `homework_hint_requested`, `homework_session_completed`.

## 3.8 Account Utilities

### Account menu
- Goal: provide access to profile, settings, billing, help, and sign out without occupying primary navigation.
- Primary CTA: none globally; each list item navigates.
- Secondary actions: `Log out`.
- Required components: compact trigger, sectioned list of utilities, sign-out action.
- Loading/empty/error: safe fallback links if specific modules fail.

### `/app/more/profile`
- Goal: edit profile and learning preferences.
- Primary CTA: `Save changes`.
- Secondary actions: `Cancel`.
- Instrumentation: `profile_updated`.

### `/app/more/settings`
- Goal: manage app behavior preferences.
- Primary CTA: `Save settings`.
- Secondary actions: `Reset defaults`.
- Instrumentation: `settings_updated`.

### `/app/more/billing`
- Goal: manage subscription and payment state.
- Primary CTA: `Upgrade` or `Manage subscription`.
- Secondary actions: `Restore purchase` (if supported).
- Instrumentation: `billing_viewed`, `upgrade_started`, `upgrade_completed`.

### `/app/more/help`
- Goal: provide support and troubleshooting.
- Primary CTA: `Contact support`.
- Secondary actions: browse help topics.
- Instrumentation: `help_viewed`, `support_contact_started`.

## 4. Global Overlay Contracts

### Upgrade Paywall Overlay
- Trigger: free-tier limit reached during task.
- Primary CTA: `Upgrade now`.
- Secondary action: `Not now`.
- Must preserve `returnTo` target and resume exact interrupted context after upgrade.
- Instrumentation: `paywall_shown`, `upgrade_return_to_task_succeeded`.

### Auth Interruption Overlay
- Trigger: expired session during protected action.
- Primary CTA: `Log in to continue`.
- Must preserve in-progress state and route.
