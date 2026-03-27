# QA and Acceptance Test Plan

## 1. Goal

Ensure the built app matches documented behavior and delivers a clean, continuous learning flow.

## 2. Test Scope

Critical domains:
- onboarding and assessment
- Home/Learn/Speak/Tools/Progress navigation flow
- Homework Help behavior
- curriculum progression and level promotion behavior
- report generation and historical comparison
- subscription gating and upgrade return behavior

## 3. Acceptance Tests (Core)

## 3.1 Onboarding and Baseline Report

1. Start onboarding without account.
2. Complete profile step.
3. Complete the full diagnostic assessment in the guided one-task-at-a-time flow.
4. Refresh or navigate away mid-assessment and confirm autosave restores progress.
5. Confirm onboarding completion routes directly to signup rather than a public report preview.
6. Signup and confirm the first authenticated screen is the saved report view in the app.
7. Confirm the report persisted in Progress with the assigned level.
8. Confirm Home does not require another first-time full diagnostic after signup.
9. Validate overall score equals rounded mean of six skill scores.
10. In the diagnostic conversation, verify one tap starts the live voice interview, the AI introduces itself first, and the user does not need to press record between turns.
11. Verify the AI opening audio is the actual live AI voice and not browser text-to-speech playback.
12. Ask for clarification with a short reply such as `why?` and verify the AI rephrases without increasing the captured-reply count.

Pass condition:
- no repeated data entry
- report stays hidden until authenticated
- first authenticated experience shows real value immediately
- diagnostic voice interview feels continuous rather than turn-by-turn recorded
- diagnostic voice interview sounds like a real AI conversation rather than local robot playback

## 3.2 Home and Learn Flow

1. Login as active student.
2. Verify Home displays one dynamic primary CTA.
3. Verify persistent `Homework Help now` quick action is present on Home.
4. Open Learn and verify only the assigned curriculum is shown.
5. Verify the current unlocked unit and one next required activity are clear.
6. Complete the current activity and continue automatically into the next required unit activity.
7. Complete all six required activities and verify the next unit unlocks immediately.

Pass condition:
- no forced return to hub between chain steps

## 3.2.1 Learn Game Activity

1. Open `/app/learn/unit/:unitSlug/game` after completing the unit practice step.
2. Verify the screen opens in `Brief` with the unit-linked vocabulary focus, richer themed scene/map presentation, and one dominant `Start game` CTA.
3. Start the game and verify the UI progresses through `Brief` -> `Game` -> `Summary`.
4. On a Pro account with mic access available, complete the voice-helpful stage(s) in voice mode and verify each such stage returns one coaching note with at most one retry.
5. Deny mic access or simulate voice-evaluation failure on a voice-enabled stage and verify the game switches to fallback without losing completion progress.
6. Verify fallback uses the same authored stage items, keeps the game moving, and preserves the richer scene/map layout.
7. Verify the current `very_basic`, `basic`, `intermediate`, and `advanced` games use authored Stage 3 mechanics rather than falling back to repeated plain multiple choice or the generic game scaffold.
8. Verify `Map Route`, `Scene Scan`, `Weather Switch`, and `Deadline Dash` visibly behave like their names imply.
9. Verify active play uses the compact in-flow game strip rather than the large Learn unit header, while the richer unit header still appears in `Brief` and `Summary`.
10. Verify `Name Tag Mixer` Stage 2 no longer renders a large mostly empty board and instead uses a tighter reply-pick layout.
11. Verify the stage CTA copy is authored for the current board and does not fall back to generic text like `Check stage`.
12. Verify a correct first-pass result never shows `Retry` in the stage header or result state.
13. Verify voice-enabled stages show `Say it` and `Quick backup` together and that backup remains usable without losing progress.
14. Verify the summary shows completion confirmation, one authored strength pattern, one authored next focus, one authored bridge into speaking, and a dominant `Continue to speaking` CTA.
15. Complete the underlying game activity and verify `speaking` unlocks immediately.
16. Confirm no visible numeric score or pass/fail threshold is shown anywhere in the game flow.
17. Confirm there is no separate Games tab or standalone game route outside `/app/learn/unit/:unitSlug/game`.

Pass condition:
- game feels like a required Learn warm-up, not a detached game surface
- learners can always complete game even when voice is unavailable

## 3.2.2 Content Source Precedence

1. Seed both teacher-provided and placeholder items for same topic.
2. Request Learn recommendation for that topic.
3. Verify selected recommendation uses teacher-provided content.
4. Remove/disable teacher item and request recommendation again.
5. Verify placeholder content is served as fallback.

Pass condition:
- recommendation order enforces `teacher_provided` before `placeholder`

## 3.2.3 Recommendation Rule Determinism

1. Set up user with active homework session.
2. Request Home primary action and verify `resume_homework_help`.
3. Close homework session; create active test-prep plan due in <= 7 days.
4. Request Home primary action and verify `continue_test_prep`.
5. Clear tool interruptions and verify the primary learning recommendation resolves to `continue_curriculum`.

Pass condition:
- reason codes follow documented priority order without ambiguity

## 3.2.4 Curriculum Level and Promotion

1. Seed a learner with no `currentLevel` and a legacy qualifying report labeled `foundation`.
2. Load Learn and verify `currentLevel` backfills to `very_basic`.
3. Complete a qualifying reassessment with score band `basic`.
4. Verify `currentLevel` promotes to `basic`.
5. Complete a lower-scoring reassessment afterward.
6. Verify `currentLevel` does not demote.
7. Complete a `mini_mock`.
8. Verify report is created but `currentLevel` is unchanged.

Pass condition:
- level assignment is deterministic and upward-only

## 3.2.5 Learn Speaking Missions

1. Open `/app/learn/unit/:unitSlug/speaking` on a free account.
2. Verify the speaking activity opens in `Brief` with scenario, goal, and text-first start path.
3. Start the mission and complete it end-to-end in text mode without leaving Learn.
4. Verify the active conversation state uses compact speaking-specific chrome rather than the full generic Learn activity header.
5. Verify only one dominant response action is visible at a time during the conversation.
6. Verify the active conversation state does not show mechanic-heavy copy such as explicit reply quotas or `unlock feedback` language.
7. Verify `See feedback` does not appear until the required learner replies are complete.
8. Verify the first AI turn is a natural scenario opener and does not use text such as `Let's practice` or `Start with this`.
9. Verify AI follow-up turns acknowledge the learner's last point and ask one short next question.
10. Verify the feedback state shows one outcome label, one strength, one improvement, and 2-3 highlighted transcript moments by default.
11. Open full transcript and verify it is optional rather than the default review surface.
12. Save a phrase from the Learn review and verify it persists to the shared phrase bank.
13. Retry the same mission and verify the new session links back to the prior attempt cleanly.
14. Open unit `3` or `6` in any curriculum and verify the speaking mission renders benchmark-mode copy and requires the longer turn count.
15. Open `very_basic` unit `3` or `6` and verify the speaking mission does not unlock feedback until the learner reaches 4 turns and answers at least 1 substantive follow-up question.
16. Open `basic` unit `3` or `6` and verify the speaking mission does not unlock feedback until the learner reaches 5 turns and answers at least 2 substantive follow-up questions.
17. Verify all four levels use authored lesson/practice/game/writing/checkpoint content instead of the shared generic scaffold strings.
18. Open `intermediate` unit `3` or `6` and verify the speaking mission does not unlock feedback until the learner reaches 6 turns and answers at least 2 substantive follow-up questions.
19. Open `advanced` unit `3` or `6` and verify the speaking mission does not unlock feedback until the learner reaches 7 turns and answers at least 3 substantive follow-up questions.
20. Verify all six `intermediate` and all six `advanced` speaking missions include authored evidence targets, follow-up objectives, and benchmark focus where appropriate.
21. Verify Learn speaking review includes an evidence summary with observed evidence, missing evidence, and one next focus.
22. Confirm mission completion alone does not change `currentLevel` and does not create a Progress report entry.
23. On a Pro account, verify the speaking activity opens voice-first with a single `Start conversation` CTA.
24. On a Pro account, start the Learn voice mission and verify the page opens a bounded live voice conversation inside Learn rather than the full Speak session shell.
25. On a Pro account, confirm transcript snapshots sync while the Learn voice conversation is active and that `See feedback` becomes available after the hidden participation threshold is met.
26. On a Pro account, confirm mic-denied or unavailable cases fall back cleanly to text without losing mission state.
27. Attempt to open `/app/learn/unit/:unitSlug/speaking` before completing game and verify the standard locked-state recovery path is shown.

Pass condition:
- speaking missions feel like one bounded curriculum task, not a generic Speak detour
- review stays focused and actionable

## 3.2.6 Learn Game Migration and Backfill

1. Seed a learner with no curriculum progress and verify every unit now includes a locked or unlocked `game` activity row.
2. Seed a learner mid-unit before `practice` completion and verify the next required step remains unchanged until `practice` is done.
3. Seed a learner with `speaking`, `writing`, or `checkpoint` already completed under the old five-step contract but with no game completion.
4. Run the progress reconciliation/bootstrap path and verify the learner is routed back to the missing `game` step as the earliest incomplete required activity.
5. Verify the later historical completions remain stored and visible after reconciliation.
6. Verify the unit remains incomplete until game is completed, even when later activities were already completed historically.
7. Complete the missing game and verify the unit and next-unit progression recover cleanly under the six-step contract.

Pass condition:
- the game backfill is retroactive without wiping historical downstream progress

## 3.3 Homework Help

1. Open Homework Help from Home quick action or Tools.
2. Upload homework file.
3. Enter incorrect answer and request hints.
4. Verify hint ladder behavior and non-answer-dumping.
5. Validate first useful response latency is within NFR target.
6. Test image/PDF OCR upload path and verify parse status transitions.
7. Force low-confidence parse and verify `needs_review` fallback state.

Pass condition:
- guidance is progressive and Socratic

## 3.4 Progress and Reassessment

1. Open Progress report library.
2. Verify overall score timeline renders with clickable report points.
3. Switch between `Last 90 days` and `All time` and confirm data updates deterministically.
4. Verify six skill trend cards/sparklines render for the visible range.
5. Open a report from the timeline or report list.
6. Verify compact report history is visible on detail page.
7. Run new assessment.
8. Verify new report is created.
9. Verify comparison against prior report exists.
10. Generate a share card from report and verify redaction-safe output.

Pass condition:
- six skills show score + visual + interpretation
- progress over time is understandable without reading every report card

## 3.5 Subscription Flow

1. Hit free-tier limit.
2. Upgrade via subscription flow.
3. Confirm user returns to interrupted task.
4. Validate free-tier Speak defaults to text mode and pro unlocks voice mode.
5. Exceed each free-tier limit and verify deterministic paywall/limit response.

Pass condition:
- no lost context

## 3.6 Transcript and Phrase Bank

1. Complete a Speak session.
2. Open transcript detail.
3. Validate inline corrections are visible.
4. Save phrase to phrase bank.
5. Verify phrase appears in saved items.

Pass condition:
- transcript is actionable learning material, not plain log text

## 3.6.1 Speak Starter Experience

1. Open Speak as first-time user.
2. Verify the top of the page shows an explicit `Free speech / Guided scenario` mode switch.
3. Verify only one mode launch surface is visible at a time.
4. Verify free-speech quick-start lanes are visible and one default lane is preselected.
5. Start session from a free-speech lane in one tap.
6. Verify a free-speech text session skips the mission brief and opens directly into the conversation surface.

Pass condition:
- no empty-state confusion before first message
- launch page reads as one decision path rather than stacked intro cards

## 3.6.2 Speak Realtime Voice

1. Log in as a Pro user.
2. Open Speak and switch interaction mode to `Voice (Pro)`.
3. Start a new Speak session.
4. Verify guided voice sessions show `Start live conversation` before the mic becomes active.
5. Start the live conversation and verify the browser negotiates the realtime voice session successfully.
6. Speak for multiple turns and verify:
   - transcript updates while the conversation is live
   - the AI responds in real time
   - transcript sync requests remain successful
7. Finish the session.
8. Verify no late transcript-sync failures occur after completion.
9. Verify the review surface loads with summary feedback and phrase-bank save actions.
10. Repeat with a free-speech voice session and verify it skips the guided mission brief while still waiting for `Start live conversation`.

Pass condition:
- the live voice path feels like an actual back-and-forth conversation
- no duplicate-turn sync failures occur under normal browser use
- teardown to review is clean

## 3.7 Test Prep Sprint

1. Create test prep plan with date and topics.
2. Verify generated daily priorities align with weakest skills.
3. Run mini mock check.
4. Verify readiness result links to focused practice.
5. Verify mini-mock attempt is linked to the originating test prep plan in data.

Pass condition:
- test prep flow yields concrete, date-bound plan and follow-up action

## 3.7.1 Tools IA

1. Open primary navigation on desktop and mobile.
2. Verify `Tools` is present and `More` is not a primary tab.
3. Open `/app/tools` and verify Homework Help and Test Prep Sprint are first-class entries.
4. Navigate to legacy user-facing routes `/app/learn/homework` and `/app/learn/test-prep`.
5. Verify both redirect to the matching Tools routes.
6. Open the account menu and verify `Profile`, `Settings`, `Billing`, and `Help` remain reachable.

Pass condition:
- helper tools are easy to find without polluting Learn IA

## 3.8 Streak Persistence and Milestones

1. Complete qualifying activities over 3 consecutive days.
2. Verify `current_streak_days = 3` and milestone celebration fires once.
3. Skip one day and complete activity next day.
4. Verify streak resets correctly and longest streak remains preserved.

Pass condition:
- streak state is persisted and milestone triggers are data-driven

## 4. UX Quality Checks

- Home not visually overloaded
- Learn not presenting flat equal-weight choices on entry
- terminology consistency (`Home`, `Learn`, `Speak`, `Tools`, `Progress`)
- clear primary CTA on all major screens
- celebration moments appear on key milestone triggers without interrupting flow
- Learn remains curriculum-only
- account utilities remain secondary and out of the primary nav

## 5. Accessibility Checks

- keyboard-only navigation for core journeys
- labels and focus states for all inputs
- transcript availability for voice interactions
- sufficient color contrast

## 6. Performance Checks

- route transition responsiveness
- API p95 targets for key workflows
- report generation latency within target

## 7. Event Instrumentation Validation

Use `14-analytics-events.md` as the contract for event names and payload requirements.

Verify events fire for:
- `onboarding_started`
- `assessment_started`
- `assessment_completed`
- `baseline_report_persisted`
- `curriculum_viewed`
- `unit_started`
- `unit_activity_completed`
- `unit_completed`
- `curriculum_level_promoted`
- `speak_session_completed`
- `homework_session_completed`
- `upgrade_completed`
- `full_diagnostic_completed`
- `share_card_generated`
- `test_prep_plan_created`
- `test_prep_mini_mock_completed`
- `class_context_submitted`
- `celebration_milestone_viewed`
- `content_import_completed`
- `recommendation_rule_applied`
- `speak_starter_selected`
- `streak_updated`
- `streak_milestone_reached`
- `homework_parse_needs_review`
- `homework_parse_failed`
- `plan_limit_reached`
- `tools_viewed`
- `homework_help_opened_from_tools`
- `test_prep_opened_from_tools`
- `learn_speaking_mission_started`
- `learn_speaking_mission_completed`
- `learn_speaking_feedback_viewed`
- `learn_speaking_retry_started`
- `learn_speaking_phrase_saved`

Reserved and not currently required in the shipped build:
- `homework_quick_action_clicked`
- `recommendation_content_source_selected`
- `home_primary_cta_clicked`
- `nav_tab_clicked`

## 8. Regression Checklist

Before each release:
1. Onboarding baseline report flow
2. Learn curriculum continuity and unit unlock logic
3. Homework Help hint behavior
4. Reassessment report comparison
5. Upgrade return-to-task behavior

## 9. Release Gate

Release only when:
- all core acceptance tests pass
- no critical defects in onboarding, curriculum progression, or reporting
- NFR checks meet agreed thresholds
