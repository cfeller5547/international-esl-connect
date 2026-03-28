# AI Assessment and Reporting Specification

## 1. Purpose

Define how assessment is run, scored, and transformed into high-value progress reports.

## 2. Assessment Composition

Assessment has one required onboarding phase for first-time users:

1. Full diagnostic (pre-signup, required)
   - adaptive objective items
   - short writing prompt
   - required live AI voice conversation
   - determines initial level placement and assigned curriculum before app entry

## 3. AI Conversation Assessment Rules

Conversation must be:
- level-safe and non-intimidating
- neutral in topic for onboarding
- measurable in speaking and listening evidence
- voice-required in the UI, with one-tap start and continuous turn-taking rather than manual record/stop cycles
- delivered as actual AI audio through the live Realtime session, not browser text-to-speech playback of static text
- patient with pauses so ESL learners are not cut off mid-thought
- repair-first when audio is unclear, noisy, or only a clarification request

Required measured signals:
- pronunciation quality
- fluency rhythm and hesitation patterns
- grammatical usage quality
- listening response relevance

Phase rule:
- the onboarding full diagnostic must collect enough conversation and writing evidence to support confident initial placement.
- clarification turns may keep the interview moving, but they do not count toward the captured evidence target.
- acknowledgement-only, noisy, unintelligible, or off-task-short turns also do not count toward the captured evidence target.

## 4. Skill Scoring Model

Skills:
- listening
- speaking
- reading
- writing
- vocabulary
- grammar

Each skill score:
- integer `0-100`

Overall score:
- weighted average of six skill scores

MVP weighting (explicit):
- listening: `1/6`
- speaking: `1/6`
- reading: `1/6`
- writing: `1/6`
- vocabulary: `1/6`
- grammar: `1/6`

Formula:
- `overall_score = round((listening + speaking + reading + writing + vocabulary + grammar) / 6)`

Rounding rule:
- standard rounding to nearest integer (`0-100` bounds preserved)

Level mapping:
- `0-25` very_basic
- `26-50` basic
- `51-75` intermediate
- `76-100` advanced

Curriculum level rules:
- qualifying assessments are `baseline_full` and `reassessment`
- qualifying assessments may initialize or promote the user's canonical `currentLevel`
- reassessment may never demote `currentLevel`
- `mini_mock` can create a report but must never change `currentLevel`

## 5. Report Generation Contract

Each completed assessment must generate one formal report object.

Report includes:
- metadata (date, language, level, context)
- overall score
- six skill snapshots
- strengths summary
- risks summary
- recommended next 7-day plan
- comparison against prior report (if exists)

Report depth levels:
- Full diagnostic report (generated before signup, first shown after signup inside the authenticated app)

## 6. Skill Card Contract (Per Skill)

Each skill card must contain:
- skill name
- score
- level-band interpretation
- visual
- one concrete next action

Allowed visuals:
- horizontal progress bar
- radial mini chart
- sparkline with trend indicator

## 7. Report UX Value Rules

1. User should see what improved in under 10 seconds.
2. User should see what to do next without opening another page.
3. Report must balance summary and detail:
   - summary first
   - deep drill-down second

Shareability rule:
- report system must support safe shareable cards without exposing sensitive raw learner content.

## 8. Reassessment Contract

From Progress, user may run reassessment anytime.

Reassessment must:
- reuse same full assessment process
- create a new report
- compare new report to previous report
- update trend views immediately
- promote the user into the next curriculum immediately when the new score crosses a higher level threshold

Test Prep relation:
- reassessment and mini mock checks can be tied to upcoming test-prep plans to estimate readiness.

## 9. Comparison Algorithm (MVP)

For each skill:
- `delta_abs = current_score - previous_score`
- `delta_pct = (delta_abs / max(previous_score, 1)) * 100`

Comparison output categories:
- improved
- unchanged
- declined

## 10. AI Guardrails

Assessment AI must:
- avoid giving test-like answer hints during assessment
- stay within configured assessment prompts
- produce deterministic scoring envelopes where possible
- log scoring evidence payloads for auditability

Homework Help AI must:
- use Socratic guidance
- avoid direct full-answer completion

## 11. Quality Monitoring

Track:
- assessment completion rate
- AI conversation failure rate
- score distribution anomalies
- report generation failure rate
- onboarding diagnostic to signup conversion
- share-card generation rate

Alert if:
- report creation latency exceeds threshold
- conversation scoring fails
- comparison payload missing for reassessment runs
