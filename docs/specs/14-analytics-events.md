# Analytics and Event Taxonomy (MVP)

## 1. Purpose

Define a canonical event model so product effectiveness can be measured from day one and agents instrument behavior consistently.

This document is the source of truth for event names, trigger points, payload requirements, and KPI mapping.

## 2. Event Design Rules

1. Event names use `snake_case`.
2. Names are action-oriented and explicit (for example `assessment_completed`).
3. Events should represent business/UX milestones, not low-value clicks.
4. Do not emit duplicate completion events for one logical completion.
5. Include context needed to compute funnel metrics without reprocessing full logs.

## 3. Common Event Envelope

Every event must include:

```json
{
  "eventId": "uuid",
  "eventName": "string",
  "occurredAt": "iso-datetime",
  "userId": "uuid-or-null",
  "guestSessionToken": "string-or-null",
  "sessionId": "string",
  "route": "/app/home",
  "platform": "web",
  "appVersion": "string",
  "properties": {}
}
```

Rules:
- pre-signup events must include `guestSessionToken`.
- post-signup events must include `userId`.
- during guest-to-user migration, keep both identifiers for linkage when possible.

## 4. Canonical Event Catalog

## 4.1 Acquisition and Onboarding

1. `landing_viewed`
   - trigger: landing page view
   - properties: `utm_source`, `utm_campaign`
2. `landing_primary_cta_clicked`
   - trigger: user taps start CTA
3. `onboarding_started`
   - trigger: onboarding profile step first view
   - properties: `target_language`
4. `onboarding_profile_saved`
   - trigger: profile step submit success
   - properties: `age_band`, `school_level`, `is_taking_class`
5. `assessment_started`
   - trigger: assessment session start
   - properties: `context` (`onboarding_quick` | `onboarding_full` | `reassessment` | `mini_mock`)
6. `assessment_completed`
   - trigger: full assessment completion
   - properties: `attempt_id`, `duration_seconds`
7. `full_diagnostic_started`
   - trigger: full diagnostic started from onboarding or legacy authenticated resume
8. `full_diagnostic_completed`
   - trigger: full diagnostic completed from onboarding or legacy authenticated resume
   - properties: `attempt_id`, `report_id`, `duration_seconds`
9. `onboarding_results_viewed`
   - legacy only; no longer emitted in the current onboarding flow
10. `signup_completed`
   - trigger: account created successfully
   - properties: `conversion_source` (expected `onboarding_assessment`)
11. `baseline_report_persisted`
   - trigger: guest report successfully attached to new user
12. `login_completed`
   - trigger: login success
   - properties: `entry_route`

Implementation note:
- `assessment_conversation_turn_submitted` is reserved for future streamed turn-by-turn assessment capture and is not emitted in the current guided form implementation.
- `signup_started` is not emitted in the current server-rendered CTA flow; use `onboarding_results_viewed` and `signup_completed` for the active onboarding conversion funnel.

## 4.2 Home, Learn, and Curriculum

1. `home_primary_cta_rendered`
   - trigger: home primary card render
   - properties: `action_type`, `target_url`, `reason_code`
2. `home_primary_cta_clicked`
   - trigger: user taps home primary CTA
   - properties: `action_type`, `target_url`, `reason_code`
3. `homework_quick_action_clicked`
   - trigger: user taps persistent urgent homework action on Home
   - properties: `target_url`
4. `class_context_submitted`
   - trigger: syllabus upload, manual topics save, or class profile save
5. `learn_recommendation_rendered`
   - trigger: learn recommendation card render
   - properties: `recommendation_type`, `weakest_skill`
6. `learn_recommendation_clicked`
   - trigger: user starts recommended activity
7. `curriculum_viewed`
   - trigger: Learn curriculum landing rendered
   - properties: `level`, `current_unit_slug`, `current_activity_type`
8. `unit_started`
   - trigger: curriculum unit overview opened
   - properties: `unit_slug`
9. `unit_activity_completed`
   - trigger: curriculum unit activity completed
   - properties: `unit_slug`, `activity_type`, `score`
10. `unit_completed`
   - trigger: all required unit activities are complete
   - properties: `unit_slug`
11. `learn_game_started`
   - trigger: user starts the first stage of a Learn game
   - properties: `unit_slug`, `game_kind`, `stage_kind`, `layout_variant`, `input_mode`
12. `learn_game_retry_used`
   - trigger: user uses the retry on a Learn game stage
   - properties: `unit_slug`, `stage_id`, `game_kind`, `stage_kind`, `layout_variant`, `input_mode`
13. `learn_game_fallback_used`
   - trigger: Learn game falls back from voice to structural fallback, or the learner explicitly uses the fallback path
   - properties: `unit_slug`, `stage_id`, `reason`, `game_kind`, `stage_kind`, `layout_variant`, `input_mode`
14. `learn_game_completed`
   - trigger: required Learn game activity is completed through curriculum activity completion
   - properties: `unit_slug`, `score`, `game_kind`, `layout_variant`, `completion_path`
15. `curriculum_level_promoted`
   - trigger: qualifying assessment promotes the learner into a higher curriculum
   - properties: `previous_level`, `new_level`
16. `learn_speaking_mission_started`
   - trigger: user starts a Learn speaking mission
   - properties: `unit_slug`, `interaction_mode`, `delivery_mode`, `is_benchmark`
17. `learn_speaking_mission_completed`
   - trigger: Learn speaking mission review is generated
   - properties: `unit_slug`, `interaction_mode`, `delivery_mode`, `is_benchmark`, `score`, `evidence_covered_count`, `evidence_missing_count`, `follow_up_objectives_met`
18. `learn_speaking_feedback_viewed`
   - trigger: Learn speaking review state rendered
   - properties: `unit_slug`, `status`
19. `learn_speaking_retry_started`
   - trigger: user starts a retry of the same Learn speaking mission
   - properties: `unit_slug`, `interaction_mode`, `delivery_mode`, `is_benchmark`
20. `learn_speaking_phrase_saved`
   - trigger: user saves a phrase from Learn speaking review
   - properties: `session_id`
21. `recommendation_content_source_selected`
   - trigger: recommendation payload finalized
   - properties: `content_id`, `source_type`, `content_type`
22. `recommendation_rule_applied`
   - trigger: deterministic recommendation rule selected
   - properties: `reason_code`

Implementation note:
- `learn_recommendation_rendered` and `learn_recommendation_clicked` are reserved from the earlier recommendation-card Learn surface and are not emitted by the current curriculum-led Learn UI.
- `recommendation_content_source_selected` is still not emitted in the current build.

## 4.3 Homework Help

1. `homework_upload_started`
   - trigger: upload submission initiated
   - properties: `input_type`
2. `homework_upload_parsed`
   - trigger: parse success
   - properties: `homework_upload_id`, `detected_question_count`
3. `homework_parse_needs_review`
   - trigger: parse completed below confidence threshold
   - properties: `homework_upload_id`, `parse_confidence`
4. `homework_parse_failed`
   - trigger: parse failed and fallback UI shown
   - properties: `homework_upload_id`, `error_code`
5. `homework_session_started`
   - trigger: guided homework session start
6. `homework_step_submitted`
   - trigger: answer step submit
   - properties: `question_index`, `result`
7. `homework_hint_requested`
   - trigger: hint request
   - properties: `current_hint_level`
8. `homework_session_completed`
   - trigger: session completion
   - properties: `questions_completed`, `avg_hint_level`

## 4.4 Speak

1. `speak_landing_viewed`
   - trigger: speak landing view
2. `speak_recommendation_viewed`
   - trigger: recommendation-led Speak launch surface rendered
   - properties: `mode`, `scenario_key`
3. `speak_recommendation_started`
   - trigger: user starts the recommended Speak session
   - properties: `mode`, `scenario_key`
4. `speak_session_started`
   - trigger: speak session start
   - properties: `mode`, `scenario_key`
5. `speak_starter_selected`
   - trigger: free-speech quick-start lane chosen
   - properties: `starter_key`
6. `speak_turn_submitted`
   - trigger: student submits turn
   - properties: `turn_index`, `input_mode`
7. `speak_turn_coaching_shown`
   - trigger: learner-turn coaching rendered after a turn lands
   - properties: `input_mode`
8. `speak_help_requested`
   - trigger: learner opens the in-session `Help me` hint
   - properties: `input_mode`
9. `speak_session_completed`
   - trigger: session complete
   - properties: `mode`, `duration_seconds`, `turn_count`
10. `voice_mode_upgrade_prompt_shown`
   - trigger: free-tier user requests voice mode requiring upgrade
11. `transcript_phrase_saved`
   - trigger: phrase saved from transcript review
   - properties: `session_id`

Implementation note:
- the current Pro voice path uses OpenAI Realtime in-browser.
- live voice continues to roll up into the existing `speak_session_started`, `speak_turn_submitted`, and `speak_session_completed` contract.
- in-session coaching and `Help me` analytics apply to both text and voice sessions.

## 4.5 Progress and Reporting

1. `progress_library_viewed`
   - trigger: progress page view
2. `progress_report_viewed`
   - trigger: specific report detail opened
   - properties: `report_id`, `report_type`
3. `report_comparison_viewed`
   - trigger: comparison panel opened
   - properties: `report_id`, `previous_report_id`
4. `reassessment_started`
   - trigger: reassessment flow start
5. `reassessment_completed`
   - trigger: reassessment complete
   - properties: `report_id`, `overall_score`
6. `share_card_generated`
   - trigger: shareable card generated from report or milestone
   - properties: `card_type`, `report_id`
7. `celebration_milestone_viewed`
   - trigger: milestone celebration state shown
   - properties: `milestone_type`
8. `streak_updated`
   - trigger: streak values recalculated for user
   - properties: `current_streak_days`, `longest_streak_days`
9. `streak_milestone_reached`
   - trigger: streak milestone threshold reached
   - properties: `milestone_days`

Implementation note:
- The current build does not emit separate events for Progress range toggles or timeline point selection.
- Those interactions should resolve into `progress_report_viewed` when a user opens a selected report.

## 4.6 Subscription and Monetization

1. `paywall_shown`
   - trigger: paywall displayed
   - properties: `trigger_surface`, `return_to`
2. `upgrade_started`
   - trigger: checkout initiation
   - properties: `plan`
3. `upgrade_completed`
   - trigger: successful upgrade
   - properties: `plan`, `billing_provider`
4. `upgrade_return_to_task_succeeded`
   - trigger: user returned to interrupted task post-upgrade
   - properties: `return_to`, `task_type`
5. `plan_limit_reached`
   - trigger: free-tier usage threshold exceeded
   - properties: `limit_key`, `used_value`, `limit_value`

## 4.7 Reliability and AI Health

1. `ai_fallback_triggered`
   - trigger: AI output invalid or provider failure fallback path used
   - properties: `surface`, `reason_code`
2. `api_error_surface_shown`
   - trigger: user-visible recoverable error UI rendered
   - properties: `surface`, `error_code`
3. `content_import_completed`
   - trigger: manual content import job succeeds
   - properties: `source_type`, `item_count`

## 4.8 Test Prep

1. `test_prep_plan_created`
   - trigger: plan created from test date + topics
   - properties: `plan_id`, `target_date`, `topic_count`
2. `test_prep_mini_mock_started`
   - trigger: mini mock readiness check start
   - properties: `plan_id`
3. `test_prep_mini_mock_completed`
   - trigger: mini mock readiness check complete
   - properties: `plan_id`, `readiness_score`

## 4.9 Tools

1. `tools_viewed`
   - trigger: tools landing view
2. `homework_help_opened_from_tools`
   - trigger: user opens Homework Help from Tools
3. `test_prep_opened_from_tools`
   - trigger: user opens Test Prep Sprint from Tools

## 4.10 Platform and Account Utilities

1. `app_shell_viewed`
   - trigger: authenticated shell mounted
2. `nav_tab_clicked`
   - trigger: user selects top-level nav tab
   - properties: `tab_name`
3. `profile_updated`
   - trigger: profile save success
4. `settings_updated`
   - trigger: settings save success
5. `billing_viewed`
   - trigger: billing page viewed
6. `help_viewed`
   - trigger: help page viewed
7. `support_contact_started`
   - trigger: support contact flow started

Implementation note:
- `nav_tab_clicked` is emitted by the current client-side shell tabs on desktop and mobile.

## 5. KPI Mapping

Activation:
- onboarding to signup conversion =
  `signup_completed / onboarding_started`
- assessment completion rate =
  `assessment_completed / assessment_started`

Engagement:
- curriculum unit completion rate =
  `unit_completed / unit_started`
- legacy learn-chain completion rate =
  `learn_chain_completed / learn_activity_started` (legacy lesson -> worksheet -> speaking flows only)
- speak completion rate =
  `speak_session_completed / speak_session_started`
- homework help initiation rate =
  `homework_session_started / homework_upload_started`
- streak health =
  users with `current_streak_days >= 3` / weekly active users

Learning:
- report creation cadence = reports per active user per month
- improvement trend = average skill deltas across reassessment events
- full diagnostic completion rate =
  `full_diagnostic_completed / signup_completed`
- teacher-authored recommendation share =
  derive from `recommendation_snapshots.recommendation_payload.sourceType`

Business:
- paywall conversion =
  `upgrade_completed / paywall_shown`
- return-to-task integrity =
  `upgrade_return_to_task_succeeded / upgrade_completed`
- share amplification proxy =
  `share_card_generated / progress_report_viewed`

## 6. Implementation Contract (Next.js + API)

Client-side emit:
- view/render events
- click/start intents

Server-side emit:
- completion events tied to persisted records
- migration/billing/report generation events
- reliability and fallback events

Rules:
1. Prefer server emission for authoritative completion metrics.
2. Use idempotency keys to avoid duplicates on retries.
3. Attach canonical IDs (`attempt_id`, `report_id`, `session_id`) when available.

## 7. Data Governance

1. Do not include raw homework content or full transcripts in analytics payloads.
2. Keep properties minimal and analysis-relevant.
3. Align retention and privacy behavior with `08-non-functional-security-compliance.md`.

## 8. QA Instrumentation Checklist

Before release:
1. Validate all core funnel events emit exactly once per logical completion.
2. Validate guest-to-user identity linking works across signup.
3. Validate `return_to` context is captured for paywall events.
4. Validate event schema in staging against this document.
5. Validate dashboards compute PRD success metrics correctly.

## 9. Versioning and Ownership

1. Event schema version must be tracked (`event_schema_version` property).
2. Any rename or property removal requires migration notes.
3. Product + engineering jointly approve taxonomy changes.
