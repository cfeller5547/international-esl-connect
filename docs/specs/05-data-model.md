# Data Model Specification (MVP)

## 1. Storage Assumptions

Primary data store:
- PostgreSQL

File/object storage:
- assignment uploads
- syllabus uploads
- optional audio artifacts (if retained)

ORM recommendation:
- Prisma

## 2. Core Entities

## 2.1 User and Session

### `users`
- `id` (uuid, pk)
- `email` (unique)
- `password_hash`
- `age_band`
- `native_language`
- `target_language`
- `school_level`
- `current_level` (nullable, canonical assigned curriculum level)
- `full_diagnostic_completed_at` (nullable)
- `created_at`
- `updated_at`

### `user_streaks`
- `id` (uuid, pk)
- `user_id` (unique fk users.id)
- `current_streak_days` (int)
- `longest_streak_days` (int)
- `last_qualifying_activity_date` (date, nullable)
- `last_milestone_emitted` (nullable int)
- `updated_at`

Streak qualifying activity (MVP):
- any completion path that explicitly records a qualifying activity through `StreakService`.
- in the current build this is triggered by completed legacy Learn activities, completed Speak sessions, and completed Homework Help sessions.

### `guest_onboarding_sessions`
- `id` (uuid, pk)
- `session_token` (unique)
- `profile_payload` (jsonb)
- `expires_at`
- `created_at`
- `updated_at`

Purpose:
- hold onboarding and assessment data before signup

## 2.2 Assessment and Scoring

### `assessment_attempts`
- `id` (uuid, pk)
- `user_id` (nullable fk users.id)
- `guest_session_id` (nullable fk guest_onboarding_sessions.id)
- `context` (`onboarding_quick` | `onboarding_full` | `reassessment` | `mini_mock`)
- `test_prep_plan_id` (nullable fk test_prep_plans.id)
- `status` (`in_progress` | `completed` | `abandoned`)
- `started_at`
- `completed_at`

### `assessment_skill_scores`
- `id` (uuid, pk)
- `assessment_attempt_id` (fk)
- `skill` (`listening` | `speaking` | `reading` | `writing` | `vocabulary` | `grammar`)
- `score` (int 0-100)
- `evidence_payload` (jsonb)

### `assessment_conversation_metrics`
- `id` (uuid, pk)
- `assessment_attempt_id` (fk)
- `turn_count`
- `duration_seconds`
- `pronunciation_score`
- `fluency_score`
- `grammar_usage_score`
- `listening_response_score`

## 2.3 Reports

### `reports`
- `id` (uuid, pk)
- `user_id` (fk users.id)
- `assessment_attempt_id` (fk)
- `report_type` (`baseline_quick` | `baseline_full` | `reassessment` | `mini_mock`)
- `overall_score` (int 0-100)
- `level_label` (`very_basic` | `basic` | `intermediate` | `advanced`)
- `summary_payload` (jsonb)
- `created_at`

### `report_skill_snapshots`
- `id` (uuid, pk)
- `report_id` (fk)
- `skill`
- `score`
- `interpretation_text`
- `recommended_action_text`
- `visual_payload` (jsonb)

### `report_comparisons`
- `id` (uuid, pk)
- `report_id` (fk current report)
- `previous_report_id` (fk reports.id)
- `delta_payload` (jsonb)

## 2.4 Curriculum, Learn, and Activity Tracking

### `curricula`
- `id` (uuid, pk)
- `level` (`very_basic` | `basic` | `intermediate` | `advanced`)
- `target_language` (`english` for MVP authored curricula)
- `title`
- `description`
- `active` (boolean)
- `created_at`
- `updated_at`

Rule:
- exactly four fixed English curricula must exist in MVP, one per level.

### `curriculum_units`
- `id` (uuid, pk)
- `curriculum_id` (fk curricula.id)
- `slug`
- `title`
- `summary`
- `can_do_statement`
- `theme`
- `key_vocabulary` (jsonb)
- `language_focus` (jsonb)
- `performance_task`
- `order_index`
- `created_at`
- `updated_at`

### `curriculum_unit_activities`
- `id` (uuid, pk)
- `unit_id` (fk curriculum_units.id)
- `activity_type` (`lesson` | `practice` | `speaking` | `writing` | `checkpoint`)
- `title`
- `description`
- `order_index`
- `content_item_id` (nullable fk content_items.id)
- `required` (boolean, MVP default true)
- `activity_payload` (jsonb)
- `created_at`
- `updated_at`

Rule:
- every unit must have exactly five required activities in this fixed order:
  1. `lesson`
  2. `practice`
  3. `speaking`
  4. `writing`
  5. `checkpoint`

### `user_curriculum_progress`
- `id` (uuid, pk)
- `user_id` (fk users.id)
- `curriculum_id` (fk curricula.id)
- `current_unit_id` (nullable fk curriculum_units.id)
- `is_active` (boolean)
- `started_at`
- `completed_at` (nullable)
- `archived_at` (nullable)

### `user_unit_progress`
- `id` (uuid, pk)
- `user_id` (fk users.id)
- `curriculum_id` (fk curricula.id)
- `unit_id` (fk curriculum_units.id)
- `status` (`locked` | `unlocked` | `completed`)
- `unlocked_at` (nullable)
- `completed_at` (nullable)
- `created_at`
- `updated_at`

### `user_unit_activity_progress`
- `id` (uuid, pk)
- `user_id` (fk users.id)
- `unit_progress_id` (fk user_unit_progress.id)
- `activity_id` (fk curriculum_unit_activities.id)
- `status` (`locked` | `unlocked` | `completed`)
- `score` (nullable int)
- `response_payload` (nullable jsonb)
- `completed_at` (nullable)
- `created_at`
- `updated_at`

Rules:
- users may have archived progress for prior curricula after promotion.
- only one curriculum progress row may be active per user at a time.
- promotion switches the active curriculum immediately and preserves earlier curriculum history.

### `content_items`
- `id` (uuid, pk)
- `source_type` (`teacher_provided` | `placeholder`)
- `content_type` (`lesson` | `worksheet` | `video`)
- `title`
- `description` (nullable)
- `target_language`
- `skill_tags` (jsonb)
- `topic_tags` (jsonb)
- `difficulty_band` (nullable)
- `status` (`draft` | `published` | `archived`)
- `published_at` (nullable)
- `created_at`
- `updated_at`

### `content_assets`
- `id` (uuid, pk)
- `content_item_id` (fk content_items.id)
- `asset_type` (`video` | `pdf` | `image` | `text` | `external_url`)
- `asset_url` (nullable)
- `text_payload` (nullable jsonb)
- `metadata_payload` (jsonb)
- `created_at`

### `learn_sessions`
- `id` (uuid, pk)
- `user_id` (fk)
- `entry_source` (`home` | `learn` | `homework_help`)
- `started_at`
- `ended_at`

### `activity_attempts`
- `id` (uuid, pk)
- `user_id` (fk)
- `learn_session_id` (nullable fk)
- `activity_type` (string)
  - legacy values include `lesson`, `worksheet`, `speaking_apply`, `daily_challenge`
  - curriculum completions also write activity attempts using `lesson`, `practice`, `speaking`, `writing`, `checkpoint`
- `content_id` (nullable fk content_items.id)
- `score` (nullable int)
- `status`
- `started_at`
- `completed_at`
- `metadata` (jsonb)

## 2.5 Homework Help and Syllabus

### `homework_uploads`
- `id` (uuid, pk)
- `user_id` (fk)
- `file_url`
- `input_type` (`pdf` | `image` | `text`)
- `parsed_payload` (jsonb)
- `status` (`uploaded` | `extracting_text` | `segmenting_questions` | `parsed` | `needs_review` | `failed`)
- `parse_confidence` (nullable numeric)
- `parser_version` (nullable)
- `error_code` (nullable)
- `created_at`

### `homework_parse_jobs`
- `id` (uuid, pk)
- `homework_upload_id` (fk homework_uploads.id)
- `stage` (`extracting_text` | `segmenting_questions` | `confidence_scoring`)
- `status` (`queued` | `running` | `completed` | `failed`)
- `details_payload` (jsonb)
- `started_at` (nullable)
- `completed_at` (nullable)

### `homework_help_sessions`
- `id` (uuid, pk)
- `user_id` (fk)
- `homework_upload_id` (fk)
- `status`
- `created_at`
- `completed_at`

### `homework_help_steps`
- `id` (uuid, pk)
- `session_id` (fk)
- `question_index`
- `student_answer` (text/jsonb)
- `hint_level_used` (int 0-3)
- `result` (`correct` | `incorrect` | `partial`)
- `feedback_payload` (jsonb)

### `syllabus_profiles`
- `id` (uuid, pk)
- `user_id` (fk)
- `source_type` (`upload` | `manual_topics`)
- `source_upload_id` (nullable fk homework_uploads.id)
- `topics_payload` (jsonb)
- `active_from`
- `active_to`
- `updated_at`

### `class_context_profiles`
- `id` (uuid, pk)
- `user_id` (fk)
- `school_name` (nullable)
- `class_name` (nullable)
- `instructor_name` (nullable)
- `period_label` (nullable)
- `course_level` (nullable)
- `updated_at`

### `test_prep_plans`
- `id` (uuid, pk)
- `user_id` (fk)
- `target_date`
- `topics_payload` (jsonb)
- `plan_payload` (jsonb)
- `status` (`active` | `completed` | `abandoned`)
- `created_at`
- `updated_at`

## 2.6 Speak

### `speak_sessions`
- `id` (uuid, pk)
- `user_id` (fk)
- `mode` (`free_speech` | `guided`)
- `interaction_mode` (`text` | `voice`)
- `scenario_key` (nullable)
- `duration_seconds`
- `status`
- `started_at`
- `completed_at`
- `summary_payload` (jsonb)

### `speak_turns`
- `id` (uuid, pk)
- `speak_session_id` (fk)
- `speaker` (`ai` | `student`)
- `turn_index`
- `transcript_text`
- `audio_ref` (nullable)
- `metrics_payload` (jsonb)

### `phrase_bank_items`
- `id` (uuid, pk)
- `user_id` (fk)
- `source_speak_session_id` (nullable fk speak_sessions.id)
- `phrase_text`
- `translation_text` (nullable)
- `context_payload` (jsonb)
- `created_at`

### `share_cards`
- `id` (uuid, pk)
- `user_id` (fk)
- `report_id` (nullable fk reports.id)
- `card_type` (`level` | `conversation_milestone` | `improvement` | `level_up`)
- `asset_url`
- `metadata_payload` (jsonb)
- `created_at`

## 2.7 Recommendations and Subscriptions

### `recommendation_snapshots`
- `id` (uuid, pk)
- `user_id` (fk)
- `surface` (`home` | `learn` | `speak`)
- `recommendation_payload` (jsonb)
- `created_at`

### `subscriptions`
- `id` (uuid, pk)
- `user_id` (fk)
- `plan` (`free` | `pro`)
- `status`
- `started_at`
- `renewal_at`

### `usage_counters`
- `id` (uuid, pk)
- `user_id` (fk users.id)
- `metric_key` (`speak_voice_seconds` | `speak_text_turns` | `homework_uploads` | `reassessments` | `test_prep_plans`)
- `window_type` (`daily` | `weekly` | `monthly` | `lifetime`)
- `window_start` (date or datetime)
- `window_end` (date or datetime)
- `used_value` (int)
- `limit_value` (int)
- `updated_at`

## 3. Key Data Rules

1. Exactly six skill rows per completed assessment attempt.
2. Every completed assessment attempt must map to exactly one report.
3. Baseline onboarding report must exist for any user created via onboarding flow.
4. Full diagnostic report should be completed early post-signup and linked to baseline quick report lineage.
5. Reassessment reports must compare to latest prior report when one exists.
6. `users.current_level` is the source of truth for assigned curriculum.
7. Qualifying reports (`baseline_quick`, `baseline_full`, `reassessment`) may initialize or promote `current_level`.
8. `mini_mock` reports must never change `current_level`.
9. Reassessment may promote immediately but must never demote `current_level`.
10. Recommendation payload generation must consider latest syllabus profile if active.
11. If no syllabus upload exists, at least one manual topic profile should be supported.
12. Free-tier speak sessions default to `interaction_mode = text`.
13. Placeholder items must remain publishable so curriculum and tool flows can run before teacher content is loaded.
14. `assessment_attempts.context = mini_mock` must reference `test_prep_plan_id`.
15. Streak updates are idempotent per user per calendar day.
16. Parse confidence below threshold must set `homework_uploads.status = needs_review`.

## 4. Retention and Cleanup

- Guest onboarding sessions auto-expire (recommend 7 days)
- Temporary artifacts without account conversion are periodically purged
- Audio retention policy must follow privacy settings and legal requirements
