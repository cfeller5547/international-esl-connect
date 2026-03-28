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
- Secondary actions: `Log in`, `Get started`, `See how it works`.
- Required components: value proposition, three-step flow preview, trust/support cues.
- Loading/empty/error: if session bootstrap fails, show retry CTA.
- Exit transition: create guest onboarding session and route to `/onboarding/profile`.
- Instrumentation: `landing_viewed`, `landing_primary_cta_clicked`.

### `/get-started`
- Goal: create or resume the guest onboarding flow from the correct step.
- Primary CTA: none; this route immediately redirects.
- Secondary actions: none.
- Required behavior:
  - if no valid guest session exists, create one and route to `/onboarding/profile`
  - if a valid guest session exists, resume the correct onboarding step without skipping ahead
- Loading/empty/error:
  - show a short loading state while the guest session is being created or resumed
  - on guest-session failure, render a visible failure state on `/get-started` with retry, safe exit, error code, stage, and request ID instead of a blank 500
- Exit transition: route to `/onboarding/profile`, `/onboarding/assessment`, or `/signup` depending on guest progress.

### `/onboarding/profile`
- Goal: collect minimal profile context for personalization.
- Primary CTA: `Continue to assessment`.
- Secondary actions: optional `Back` only when returning into the flow.
- Required components: stepper header, profile form, inline validation, one clear primary CTA.
- Loading/empty/error: preserve typed inputs on recoverable errors.
- Exit transition: route to `/onboarding/assessment` when required fields are valid.
- Instrumentation: `onboarding_started`, `onboarding_profile_saved`.

### `/onboarding/assessment`
- Goal: complete the full diagnostic before signup.
- Primary CTA: `Continue to signup` (becomes active only when required parts complete).
- Secondary actions: `Back`.
- Required components:
  - pre-signup stepper header
  - guided assessment shell with one primary task at a time
  - expanded objective questions
  - one transcript-first AI conversation stage with a one-tap continuous live voice loop, actual AI audio, and hidden helper content
  - writing sample prompt
  - section status summary
  - overall progress bar
- Conversation rules:
  - the first AI turn must introduce the placement coach before asking the first question
  - the AI must respond like a real person in a short placement interview, not like a scripted worksheet
  - the main conversation surface should show a growing transcript and one dominant live-voice control, not a per-turn record button
  - once started, the mic loop should continue through the interview without requiring another tap for every answer
  - the live interview must use realtime AI audio, not browser text-to-speech replay
  - typing is disabled for this diagnostic conversation
  - clarification turns must rephrase the last question and must not increment captured-reply progress
  - the voice surface must show compact shared live states (`Listening`, `Still listening`, `Thinking`, `Speaking`, `Didn't catch that`, `Noisy room`)
  - noisy or unintelligible turns must render repair and must not increment captured-reply progress
- Loading/empty/error: autosave progress; recover session if refreshed.
- Exit transition: submit assessment and route to `/signup`.
- Instrumentation: `assessment_started`, `full_diagnostic_completed`.

### `/onboarding/results`
- Goal: legacy compatibility only.
- Required behavior: if a guest diagnostic report exists, redirect to `/signup`; otherwise redirect back to `/onboarding/assessment`.

### `/signup` and `/login`
- Goal: complete auth with minimal friction.
- Primary CTA: `Create account` or `Log in`.
- Secondary actions: switch auth mode.
- Required components: auth form, validation feedback, mode switch, contextual support panel.
- Additional rules:
  - `/signup` should preserve pre-signup continuity with the same three-step language used in onboarding.
  - Cold-start public signup entry must route through `/get-started`; brand-new users should never land directly on the account-creation step.
  - If a guest reaches `/signup` before results exist, redirect them back to the correct onboarding step.
- Loading/empty/error: explicit errors for existing account, invalid credentials, rate-limit.
- Exit transition: onboarding signup should route directly to the authenticated report view; login and other auth interruptions should return to the intended task.
- Instrumentation: `signup_completed`, `login_completed`.

### `/app/assessment/full`
- Goal: legacy recovery path for unfinished or older full-diagnostic flows.
- Primary CTA: `Complete full diagnostic`.
- Secondary actions: `Back`; resume later is handled by autosave.
- Required components:
  - guided assessment shell
  - expanded objective items
  - the same transcript-first continuous live-voice interview pattern used in onboarding
  - writing prompt stage
  - section status summary
  - overall progress indicator
- Additional rules:
  - this route should only appear when a full diagnostic is genuinely unfinished
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
- Instrumentation note: `nav_tab_clicked` is emitted by the current client shell tabs.

## 3.3 Home

### `/app/home`
- Goal: present exactly one highest-priority next action.
- Primary CTA: dynamic action from recommendation service.
- Secondary actions: one to two compact cards only, and they must not duplicate the primary CTA destination.
- Required components:
  - Tier 1 primary CTA card (full width)
  - persistent urgent quick action: `Homework Help now`
  - Tier 2 support strip for `Current focus` and `Learning rhythm`
  - Tier 2b secondary action row (1-2 items)
  - Tier 3 collapsible learning summary (`Your learning picture`)
- Loading/empty/error:
  - Loading: skeleton for primary CTA card
  - Empty: fallback CTA `Start a recommended practice`
  - Error: retry CTA and safe default to Learn recommendation
- Exit transition: CTA routes directly to target activity.
- Instrumentation: `home_primary_cta_rendered`, `home_primary_cta_clicked`, `homework_quick_action_clicked`.
- Implementation note: class-context capture remains a product capability, but it is no longer a required Home component in this pass.

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
  - activity checklist in fixed order (`lesson`, `practice`, `game`, `speaking`, `writing`, `checkpoint`)
  - performance task preview
- Loading/empty/error: if unit is still locked, show explicit locked state and return path to Learn.
- Exit transition: route to the first available `/app/learn/unit/:unitSlug/:activityType`.
- Instrumentation: `unit_started`.

### `/app/learn/unit/:unitSlug/:activityType`
- Goal: complete the current required curriculum activity.
- Allowed `activityType` values: `lesson`, `practice`, `game`, `speaking`, `writing`, `checkpoint`.
- Primary CTA: `Continue`.
- Secondary actions: `Back to roadmap`, optional `Unit overview`.
- Required components:
  - shared activity shell with compressed unit context
  - fixed progress indicator across the six required activities
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

### `/app/learn/unit/:unitSlug/game`
- Goal: complete the required game warm-up that bridges practice into speaking.
- Primary CTA:
  - `Start game` in brief
  - one active stage control at a time in game
  - `Continue to speaking` in summary
- Secondary actions: `Back`, `Hear the target language`, optional replay of the hardest stages from summary.
- Required components:
  - brief state with:
    - one clear reason the game matters for the current unit
    - unit-linked vocabulary focus
    - themed scene or map presentation linked to the authored payload
    - one dominant `Start game` CTA
  - game state with:
    - compact in-flow progress strip with:
      - back action
      - unit title
      - `Game`
      - `Stage X of Y`
      - slim progress bar
      - attempt label
    - one authored stage at a time
    - stage count / progress treatment across the full game
    - stage visuals driven by `theme`, `layoutVariant`, and presentation metadata
    - distinct board treatment by stage kind (`assemble`, `spotlight`, `state_switch`, `priority_board`, `choice`, `match`, `sequence`, `map`, `voice_prompt`)
    - no persistent large left explainer column during active play; stage context should live inside the board
    - authored board title, helper text, and CTA copy for the active stage
    - richer Stage 4 layout variants for the current `very_basic` and `basic` games, including `slot_strip`, `dialogue_pick`, `voice_focus`, `planner_dense`, `scene_focus`, and `map_focus`
    - pointer-device drag-and-drop may enhance `assemble` and `priority_board`, but tap-first completion must remain fully supported
    - voice-enabled stages must surface `Say it` and `Quick backup` together as equal-weight choices at the top of the stage
    - voice controls only on stages where they materially help the learning moment
    - structural fallback controls on stages that do not need voice
    - one coaching note and at most one retry per stage
    - compact resolved-state feedback before the next stage with:
      - small success pulse
      - one authored why-it-worked note
      - one clear `Next stage` CTA
  - summary state with:
    - completion confirmation
    - one strength pattern
    - one next focus
    - one authored bridge into speaking
    - optional replay list for the hardest stages
    - one dominant `Continue to speaking` CTA
- Current authored scope:
  - all four curriculum levels use authored Stage 3 games
  - the current authored mechanic set is drawn from `assemble`, `spotlight`, `state_switch`, `priority_board`, `choice`, `match`, `sequence`, `map`, and `voice_prompt`
- Loading/empty/error:
  - if game is already completed, reopen in summary state using the saved completion review
  - if mic access is denied or voice evaluation fails on a voice-enabled stage, switch to fallback on the same activity without losing progress
  - if the unit or activity is locked, show the standard locked-state recovery path
  - if scene/map presentation metadata is missing, degrade gracefully to the standard structural layout
- Feedback rules:
  - no visible numeric score
  - no hard pass/fail gate
  - coaching-first feedback only
  - no separate Games tab or standalone game route
- Exit transition:
  - completing game routes into the existing activity-completion transition
  - the next required step must be `speaking`
- Instrumentation:
  - `learn_game_started`
  - `learn_game_retry_used`
  - `learn_game_fallback_used`
  - `learn_game_completed`

### `/app/learn/unit/:unitSlug/speaking`
- Goal: complete the unit speaking mission inside Learn without leaving the curriculum flow.
- Primary CTA:
  - `Start conversation` in brief
  - one response action at a time in conversation (`Start live conversation`, `Reconnect live voice`, or `Send`)
  - `See feedback` after the required replies are complete
  - `Try again` or `Continue to writing` in feedback
- Secondary actions: `Back`, `Use keyboard instead`, `Type instead`, optional `See full transcript`.
- Required components:
  - focused speaking shell with compact route chrome, not the full generic Learn activity header
  - brief state with:
    - scenario title
    - one-sentence setup
    - one plain-language goal
    - collapsed helpful phrases authored for that unit mission
    - collapsed example response authored for that unit mission
    - one dominant `Start conversation` CTA
  - conversation state with:
    - one dominant transcript/conversation panel
    - an opening counterpart turn that already sounds like the live scene and does not require extra interpretation from the learner
    - the latest counterpart turn visually anchored
    - mostly hidden progress language with only a soft momentum cue
    - one primary response control at a time
    - collapsed hint support
    - Pro live voice path uses a bounded realtime voice exchange inside Learn
    - free path uses transcript-first text chat
    - active live voice must show:
      - compact voice status (`Listening`, `Still listening`, `Thinking`, `Speaking`, `Didn't catch that`, `Noisy room`)
      - one quiet room-noise badge
      - repair notice + last valid question when the last turn was rejected
      - `Say that again` recovery action after rejected voice turns
    - visible coaching appears only after accepted learner turns; rejected turns use repair instead
  - feedback state with:
    - one simple outcome label
    - one strength
    - one improvement target
    - one compact evidence summary block
    - 2-3 highlighted transcript moments
    - optional full transcript
  - phrase save actions
  - retry CTA
  - benchmark units (`3` and `6`) must use stronger benchmark-mode copy but stay inside Learn
  - `very_basic` benchmark missions must hold feedback until the learner completes 4 turns and 1 substantive follow-up response
  - `basic` benchmark missions must hold feedback until the learner completes 5 turns and 2 substantive follow-up responses
  - `intermediate` benchmark missions must hold feedback until the learner completes 6 turns and 2 substantive follow-up responses
  - `advanced` benchmark missions must hold feedback until the learner completes 7 turns and 3 substantive follow-up responses
- Loading/empty/error:
  - if an active mission already exists, reopen in-progress state instead of restarting
  - if mic access is denied or voice is unavailable, preserve mission state and offer text fallback
  - if the unit or activity is locked, show the standard locked-state recovery path
- Default interaction behavior:
  - Pro is voice-first by default
  - free is text-first by default
- Conversation behavior:
  - the first AI turn must be a natural scenario opener, not procedural setup text such as `Let's practice` or `Start with this`
  - the live exchange must avoid visible `reply count` or `unlock feedback` copy in the main body
  - short pauses mid-answer should keep the session in a listening state rather than causing an early interruption
  - clarification, acknowledgement-only, and noisy turns must not count toward hidden completion thresholds
- Exit transition:
  - completing the conversation moves into feedback first
  - completing the underlying speaking activity routes to writing through the existing activity-completion chain
- Instrumentation:
  - `learn_speaking_mission_started`
  - `learn_speaking_mission_completed`
  - `learn_speaking_feedback_viewed`
  - `learn_speaking_retry_started`
  - `learn_speaking_phrase_saved`

## 3.5 Speak

### `/app/speak`
- Goal: launch conversation practice quickly.
- Primary CTA:
  - guided recommendation: `Start this practice`
  - free-speech recommendation: one-tap topic-lane buttons
- Secondary actions: alternate free-speech lanes or guided scenario picker plus interaction-mode selector.
- Required components:
  - compact top-level mode switch in the page header area:
    - `Free speech`
    - `Guided scenario`
  - only the selected mode's launch surface should be visible at one time
  - one primary launch surface under the mode switch; do not stack a separate introductory mode card above it
  - recommendation should be expressed mainly through default selection and preselected content, not repeated badges or explanatory callouts
  - guided recommendation uses a richer hero with:
    - recommended scenario
    - one speaking goal
    - one short `why now` reason
    - 2-3 target phrases
  - free-speech recommendation uses a lighter quick-start treatment with:
    - one short line like `Pick a topic and start talking`
    - four topic-led quick-start lanes
    - optional small context hint
  - clear interaction-mode selector (`Text-first`, `Voice (Pro)`)
  - free-speech lanes:
    - `Something from today`
    - `Something I'm learning`
    - `Something I want to say better`
    - `Surprise me`
  - first-time default selection preselected to avoid blank state
  - guided scenario picker remains available for non-recommended structured practice
- Loading/empty/error:
  - preview mode auto-provisions signed-in accounts on Pro
  - if voice is unavailable for environment or device reasons, fall back cleanly to text
- Exit transition: route to `/app/speak/session/:sessionId`.
- Instrumentation: `speak_landing_viewed`, `speak_recommendation_viewed`, `speak_recommendation_started`, `speak_starter_selected`, `speak_session_started`, `voice_mode_upgrade_prompt_shown`.

### `/app/speak/session/:sessionId`
- Goal: complete conversation with live feedback, then land in a synthesized coach review.
- Primary CTA: `Send` / `Finish session`.
- Secondary actions: `Help me`, reconnect live voice if needed, end session.
- Required components:
  - guided sessions only:
    - pre-session mission card before the first learner turn
    - scenario / counterpart role
    - one clear speaking goal
    - 2-3 target phrases
    - one short `why now` reason
  - free-speech sessions skip the mission card and enter the conversation screen directly with:
    - mode badge
    - topic / lane label
    - optional small context hint
  - shared transcript pane
  - compact mission header after the session starts; no persistent coach sidebar
  - activity-state indicator (`Ready to start`, `Connecting`, `Listening`, `Still listening`, `Thinking`, `Speaking`, `Didn't catch that`, `Noisy room`, `Session complete`, `Connection issue`)
  - text input controls for text-first sessions
  - live voice surface for active Pro voice sessions:
    - explicit `Start live conversation` CTA
    - browser mic handoff
    - transcript that grows as the live session unfolds
    - one visible `Finish session` action
    - quiet ambient-noise badge
    - repair notice with the last valid question when the previous learner turn was rejected
    - one `Say that again` recovery action after rejected turns
  - subtle per-turn coaching on learner turns only:
    - one short coach label derived from turn signals
    - one concise coaching note
    - no numeric scores
    - no large correction boxes during the live exchange
  - rejected learner turns should render repair instead of normal coaching
  - one minimal `Help me` support action that reveals one contextual hint without sending a turn
  - post-session completion mode:
    - dedicated completion summary card
    - guided review uses coach-style labels (`What to keep`, `Next focus`, `Key moments`)
    - free-speech review uses lighter labels (`What sounded natural`, `Next thing to try`, `Phrases to reuse`)
    - transcript moved into a secondary expandable `Conversation snapshot`
    - phrase bank actions biased toward reusable multi-word chunks, not isolated words
- Loading/empty/error: resilient reconnect flow for temporary AI failures.
- Voice rule:
  - active voice sessions should feel like real-time back-and-forth audio, not turn-by-turn upload
  - transcript sync must survive overlapping browser updates without dropping the session
  - accepted-turn coaching appears only after a learner turn lands in the transcript
  - clarification, acknowledgement-only, and noisy turns should not be treated as accepted progress
  - free-speech voice sessions should not display the guided mission brief before `Start live conversation`
- Exit transition: completion summary first, then recommend next Learn step.
- Instrumentation: `speak_turn_submitted`, `speak_turn_coaching_shown`, `speak_help_requested`, `speak_session_completed`, `transcript_phrase_saved`.

## 3.6 Progress

### `/app/progress`
- Goal: review report history and trigger reassessment.
- Primary CTA: `Run new assessment`.
- Secondary actions: switch visible history range and open a selected report.
- Scope rule: this route is report-centric; streak status does not appear here.
- Required components:
  - overall score timeline
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
  - upload zone for screenshot, photo, pasted text, or PDF
  - supported format guidance with clear quality tips
  - recent homework sessions
  - parse progress state (`extracting_text` / `segmenting_questions`)
  - assignment brief preview before session start:
    - assignment title
    - short summary
    - detected question count
    - parse confidence
    - first few detected questions
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
- Secondary actions: `Break it down`, `Make a plan`, `Next hint`, `Check my work`, `Next question`.
- Required components:
  - split panel (workspace + assignment/source panel)
  - question progress map
  - current-question success criteria
  - laddered coaching actions that do not immediately dump full answers
  - visible coach feed showing the latest guided response
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
- Primary CTA: `Continue`.
- Secondary actions: none required during preview mode.
- Required behavior:
  - explain that all accounts are currently auto-provisioned on Pro
  - avoid presenting a primary upsell decision while preview mode is active
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
- Preview-mode note: this overlay is not expected to appear while all accounts are auto-provisioned on Pro.

### Auth Interruption Overlay
- Trigger: expired session during protected action.
- Primary CTA: `Log in to continue`.
- Must preserve in-progress state and route.
