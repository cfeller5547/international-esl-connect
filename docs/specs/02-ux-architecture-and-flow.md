# UX Architecture and Flow Specification

## 1. UX Objective

Deliver a continuous, low-friction learning experience that feels like one guided study session, not a set of disconnected pages.

## 2. Structural UX Model

### 2.1 Home
Purpose:
- Show exactly one highest-priority action

Layout contract:
- Tier 1: one dynamic primary CTA card
- Tier 2: one slim support strip for current focus and learning rhythm
- Tier 2b: 1-2 compact secondary actions
- Tier 3: collapsible learning summary
- Keep Home oriented around a coach briefing, not a dashboard of equal-weight modules

Urgent-help rule:
- A persistent `Homework Help now` quick action must be available from Home without extra navigation.

Class-context rule:
- Class context should still be captured early in the product, but it should not occupy prime Home real estate in this pass.

### 2.2 Learn
Purpose:
- Execute the assigned curriculum with the lowest possible cognitive load

Landing contract:
- Primary: one next required curriculum activity
- Secondary: current-unit detail, completed-unit review, archived prior-level progress

Structure:
- exactly one active curriculum based on `currentLevel`
- sequential unit unlocks
- each unit uses the same activity pattern:
  - lesson
  - practice
  - speaking mission
  - writing
  - checkpoint

Content sourcing behavior:
- Use teacher-authored or placeholder curriculum activities for the assigned level.
- Do not mix Homework Help or Test Prep into Learn entry IA.
- Learn landing should emphasize the current unit and next step, not render all units with equal visual weight.
- Unit overview remains available as an optional detail/review route, not a required stop before activity execution.
- Speaking missions stay inside Learn and are scenario-bound to the unit can-do goal.
- Learn speaking should feel like a mini conversation experience, not a worksheet step with a mic attached.
- The first counterpart turn must be a concrete scene opener that makes sense on its own, not an abstract prompt such as `Can you answer that in your own words?`.
- Each unit speaking mission must include authored phrase support, authored follow-up directions, and a real model answer rather than generic placeholder scaffolding.
- Units `3` and `6` use stronger benchmark-mode speaking missions, but those benchmark results stay inside Learn and do not affect `currentLevel` or create Progress entries.

### 2.3 Speak
Purpose:
- Build spoken confidence and application

Modes:
- Free Speech sandbox
- Guided scenario conversations

Plan behavior:
- Free tier defaults to text-first conversation with optional AI voice playback.
- Pro tier unlocks full live voice conversation input through the browser microphone.
- Active Pro voice sessions should feel like real-time back-and-forth, not clip upload plus delayed playback.
- Voice review still happens after the session, not during the live exchange.

First-run behavior:
- Free Speech must present starter prompts (not an empty input state).
- One starter is preselected by default so users can begin in one tap.
- Voice sessions should open with one explicit `Start live conversation` moment so the user understands when the mic becomes active.

### 2.4 Progress
Purpose:
- Report history, overall score timeline, per-skill trend analysis, reassessment

Rule:
- Most feedback should appear inline during activity completion.
- Progress page is for deliberate deep dives.
- Progress should surface one primary longitudinal visual first (overall score over time), then lightweight per-skill trend detail.

### 2.5 Tools
Purpose:
- House high-frequency helper utilities that are not part of the fixed curriculum

Information architecture guardrail:
- Tools contains `Homework Help` and `Test Prep Sprint`.
- Tools is a first-class pillar because these flows are frequent and task-oriented.

### 2.6 Account Utilities
Purpose:
- House lower-frequency utilities: profile, settings, billing, help

Information architecture guardrail:
- These utilities should stay out of the primary navigation.
- They must remain reachable from a compact account/utility menu in the authenticated shell.

## 3. Navigation UX Rules

1. No sixth hidden primary function.
2. No top-level overlap:
   - Learn for curriculum execution
   - Speak for conversation execution
   - Tools for helper utilities and test prep workflows
   - Progress for historical analysis
3. Any "upload homework" entry should route into Tools -> Homework Help workflow.
4. Persistent urgent homework entry from Home is required to minimize panic-flow friction.
5. Speak voice must stay inside Speak. Curriculum speaking stays inside Learn even when both use shared conversation infrastructure.
6. Home should not duplicate the primary recommendation inside the secondary-action row.

## 4. Continuous Activity Chaining

After a lesson:
- Present one `Continue` button
- Move automatically to the next required unit activity
- Show inline progress updates after each step
- Show a short completion state with the next-step preview before navigation continues
- During activity execution, keep the surface in focus mode:
  - compressed header chrome
  - one lesson overview or one current question at a time
  - collapsed supporting context by default
- Avoid competing progress languages. Unit progress and in-activity progress must be clearly distinguished, and low-value click-through mini-steps should be collapsed.
- The Learn speaking activity uses three user-facing states:
  - `Brief`
  - `Conversation`
  - `Feedback`
- Pro users enter the speaking brief in voice-first mode by default with one primary CTA: `Start conversation`.
- Starting a Pro Learn mission opens a shorter, curriculum-bound live voice conversation inside Learn; it is smaller and more bounded than Speak.
- Free users enter the speaking brief in text-first mode by default and continue in a transcript-first chat surface with optional coach playback.
- The active conversation surface should use speaking-specific compact chrome rather than the full generic Learn activity header.
- The transcript must be the dominant surface in conversation state.
- Hints, phrase support, and examples stay collapsed by default during the speaking flow.
- The AI should behave like the scenario counterpart during the live exchange, not like a meta-coach giving instructions.
- Visible mechanic-heavy copy such as explicit reply quotas or `unlock feedback` language should stay out of the main conversation surface.
- `See feedback` appears only after the hidden participation threshold is complete.
- If live voice is unavailable or mic permission is denied, the active Learn mission must fall back cleanly to text without losing progress.
- Speaking review should default to a small number of highlighted transcript moments, not a dense correction wall.

The user should not need to return to a hub between chain steps.

## 5. Syllabus-Aware Experience

Syllabus content is global context, not a separate island.

It should influence:
- Home primary CTA priority
- Learn recommendation weighting
- Speak scenario ranking

Activation rule:
- Syllabus upload is strongly prompted in early post-signup onboarding.
- If no syllabus exists, require a low-friction fallback: "What are you studying this week?" topic input.

## 6. Onboarding UX Contract

Pre-signup stepper:
1. Profile
2. Full diagnostic assessment (required objective items + AI conversation + writing sample)
3. Signup to unlock and persist report inside the app

Rules:
- Show clear step progress
- No repeated data entry after signup
- Persist state in temporary guest session
- Cold-start public signup entry must begin at step 1, not step 4. Public `Get started` entry should create or resume the guest session and route to the correct in-progress onboarding step.
- The `Get started` bootstrap should never fail as a blank server error. If session creation/resume fails, show a recovery screen with retry plus a traceable error code and request ID.
- `/signup` is reserved for guests who have completed the onboarding diagnostic. If a guest reaches `/signup` early, redirect them back to the correct onboarding step.
- The diagnostic should feel guided, not split into competing equal-weight columns.
- Within the assessment route, present one primary task at a time:
  - objective question
  - one transcript-first AI conversation stage with a human introduction, natural follow-up questions, and a required continuous OpenAI Realtime live voice reply
  - writing sample
  - final submit state
- The assessment conversation must feel like a short interview with a real person, not a worksheet:
  - first AI turn introduces the speaker before asking the opening question
  - the AI voice must come from the live Realtime session itself, not browser text-to-speech playback of scripted text
  - follow-up turns acknowledge the learner's answer and ask one short next question
  - learner starts the conversation once and then keeps talking; the UI must not require a new `Record answer` press for every turn
  - typing is not a fallback path for the onboarding or full-diagnostic placement interview
  - no robotic copy such as `answer in your own words` or meta references to scoring during the live exchange
  - clarification turns such as `why?` or `what do you mean?` must trigger a rephrase and must not count as captured assessment evidence

Post-signup completion rule:
- Successful signup from onboarding should route directly into the authenticated report view, not expose the report on the public side.
- The onboarding full diagnostic is the initial placement assessment that determines the learner's starting curriculum.
- After the authenticated report view, the learner should enter Home with a real next-step recommendation rather than another required assessment.
- Qualifying assessments determine `currentLevel`.
- Reassessments can promote immediately but must never demote.
- `mini_mock` reports do not change curriculum level.

## 7. Report UX Contract

Each report must include:
- report header (date, language, level)
- radar chart
- six skill cards with score + visual + interpretation + next action
- comparison to previous report
- history context showing where the current report sits in the broader score timeline
- optional share artifact actions (level card, improvement card, milestone card)

Readability rule:
- user should understand "what improved" in under 10 seconds.
- Progress library should make overall movement understandable in under 10 seconds via:
  - one primary overall-score timeline
  - one compact selected-report summary
  - six lightweight per-skill trend views

Transcript learning layer:
- conversation reports should provide transcript review with inline corrections and phrase-saving affordances.

## 8. UX Anti-Patterns to Avoid

1. Equal-weight menus with too many first-step choices
2. Multiple primary CTAs on one screen
3. Hard separation between class context and practice recommendations
4. Progress hidden until users manually search for it
5. Dead-end completion screens with no next action
6. Hiding urgent homework help behind multiple taps
7. Requiring syllabus-only context with no manual topic fallback
8. Mixing placeholder and teacher content without clear ranking logic
9. Mixing curriculum progression and helper tools into one flat Learn entry point

## 9. Positive Reinforcement UX

Define explicit reward moments:
1. first full diagnostic completed
2. first report unlocked after signup
3. first conversation completed
4. streak milestones (3, 7, 14 days)
5. meaningful skill delta improvement
6. level-up transition

Reward treatment:
- short celebration state
- clear statement of earned progress
- one next best action CTA
- optional share card generation

Streak contract:
- streak milestones are computed from persisted daily qualifying activity.
- milestone triggers: 3, 7, 14 day streaks (extensible later).

## 10. Accessibility and Inclusivity UX

- Keyboard-first operability
- Text fallback for voice interactions
- Captions and transcripts for audio features
- Color-independent status communication
