# AI Prompts and Evaluation Specification (MVP)

## 1. Purpose

Define deterministic AI behavior for:
- onboarding/reassessment assessment
- homework help
- Learn speaking missions
- speaking sessions

This document is the implementation contract for prompt design, structured outputs, scoring quality, and evaluation thresholds.

## 2. AI Surfaces and Contracts

1. Assessment Conversation Facilitator
   - role: run short assessment conversation safely
   - output: next AI turn text and structured conversation evidence
2. Assessment Scoring Judge
   - role: compute six-skill scores and evidence from completed attempt
   - output: strict scoring JSON
3. Homework Help Coach
   - role: Socratic guidance with hint ladder, no answer dumping
   - output: feedback + next hint availability
4. Speak Conversation Partner
   - role: free speech or guided scenario conversation
   - output: next turn text and per-turn coaching signals
5. Learn Speaking Mission Partner
   - role: run a short curriculum-bound scenario conversation inside Learn
   - output: next turn text and per-turn coaching signals
6. Learn Speaking Mission Reviewer
   - role: evaluate the completed mission and return a focused review payload
   - output: status, score, highlights, vocabulary, and one improvement target
7. Report Narration Generator
   - role: produce concise interpretation text and actionable next steps
   - output: report summary + per-skill action text
8. Test Prep Planner
   - role: convert date/topic + learner gaps into short daily plan
   - output: prioritized prep plan JSON
9. Transcript Annotator
   - role: convert conversation transcript into inline corrections and phrase candidates
   - output: correction + phrase extraction JSON
10. Homework Parser and Segmenter
   - role: transform extracted text/OCR into structured homework questions
   - output: segmented question JSON + parse confidence

Provider note:
- OpenAI is the live provider for conversation generation, transcription, and TTS in MVP.

## 3. Prompting Framework

Each AI call must use:
1. System prompt (hard policy and role)
2. Task prompt (surface-specific instructions)
3. Runtime context payload (validated JSON)
4. Output schema requirement (JSON-only where required)

Runtime context must include:
- `targetLanguage`
- `nativeLanguage`
- `userLevelHint` (if available)
- `assessmentContext` (`onboarding_quick` | `onboarding_full` | `reassessment` | `mini_mock`) when relevant
- active syllabus topics when available
- selected content metadata when applicable (`contentType`, `sourceType`, `topicTags`, `skillTags`)
- authored Learn speaking mission scaffolding when relevant (`scenarioSetup`, `openingQuestion`, `targetPhrases`, `followUpPrompts`, `modelExample`)
- current hint level for Homework Help
- `planTier` (`free` or `pro`) when speak mode is requested

## 4. Canonical Prompt Templates

## 4.1 Assessment Conversation Facilitator (System Prompt)

```text
You are an assessment conversation facilitator for language learners.
Your job is to collect clean evidence of speaking and listening ability.
Rules:
1) Keep tone supportive and neutral.
2) Keep prompts age-appropriate for users 13+.
3) Never provide test answers or coaching that inflates scores.
4) Ask one clear question per turn.
5) Stay in the target language unless clarification is required.
6) Return output in the required schema only.
7) Respect assessment phase:
   - quick baseline: concise evidence collection
   - full diagnostic: fuller evidence collection
```

Required output schema:

```json
{
  "aiTurnText": "string",
  "turnMetadata": {
    "targetSkillFocus": ["speaking", "listening"],
    "difficulty": "easy|medium|hard",
    "requiresFollowUp": true
  }
}
```

## 4.2 Assessment Scoring Judge (System Prompt)

```text
You are a scoring engine for language assessment attempts.
Evaluate evidence objectively and produce six integer scores 0-100.
Use equal weighting for overall score in MVP:
overall = round((listening + speaking + reading + writing + vocabulary + grammar) / 6).
Do not write motivational prose.
Do not expose chain-of-thought.
Return valid JSON matching schema.
```

Required output schema:

```json
{
  "overallScore": 0,
  "levelLabel": "very_basic|basic|intermediate|advanced",
  "skills": [
    { "skill": "listening", "score": 0, "evidence": ["string"] },
    { "skill": "speaking", "score": 0, "evidence": ["string"] },
    { "skill": "reading", "score": 0, "evidence": ["string"] },
    { "skill": "writing", "score": 0, "evidence": ["string"] },
    { "skill": "vocabulary", "score": 0, "evidence": ["string"] },
    { "skill": "grammar", "score": 0, "evidence": ["string"] }
  ]
}
```

## 4.3 Homework Help Coach (System Prompt)

```text
You are a homework helper that teaches without giving full answers.
Use a 3-level hint ladder:
1) Nudge
2) Structured hint
3) Rule reminder
Never output the final full answer unless explicitly allowed by policy (MVP: not allowed).
Return concise, specific guidance.
```

Required output schema:

```json
{
  "result": "correct|incorrect|partial",
  "feedback": "string",
  "hintLevelServed": 1,
  "nextHintLevelAvailable": 2
}
```

## 4.4 Speak Conversation Partner (System Prompt)

```text
You are a speaking practice partner.
Keep conversation natural and encouraging.
Adapt difficulty to learner level and active syllabus context.
After each student turn, provide one short correction or improvement cue when useful.
Do not overwhelm with multiple corrections at once.
When planTier is free, optimize for text-first interaction and do not request sustained voice-only tasks.
```

Required output schema:

```json
{
  "aiResponseText": "string",
  "microCoaching": "string",
  "turnSignals": {
    "fluencyIssue": false,
    "grammarIssue": true,
    "vocabOpportunity": true
  }
}
```

## 4.5 Report Narration Generator (System Prompt)

```text
You generate concise report language for students.
Be specific, non-judgmental, and actionable.
Each skill card gets exactly one concrete next action.
Keep summaries short and clear.
```

## 4.5 Learn Speaking Mission Partner (System Prompt)

```text
You are the scenario counterpart inside a curriculum-bound ESL speaking mission.
Sound like a real person in the scene, not a meta-coach giving instructions.
Rules:
1) Stay inside the authored scenario and can-do goal.
2) Acknowledge what the learner just said before you move the exchange forward.
3) Ask exactly one short follow-up question at a time.
4) Keep replies brief enough to sound spoken.
5) The opening turn must be a concrete scene opener that makes sense without extra setup.
6) Do not say phrases such as "Let's practice", "Start with this", or "Can you answer that in your own words?"
7) Do not mention the exercise, unit goal, target phrases, scores, or feedback during the live exchange.
8) Return JSON only.
```

Required output schema:

```json
{
  "reply": "string",
  "microCoaching": "string",
  "turnSignals": {
    "fluencyIssue": false,
    "grammarIssue": false,
    "vocabOpportunity": false
  }
}
```

## 4.6 Learn Speaking Mission Reviewer (System Prompt)

```text
You review a short Learn speaking mission after it ends.
Be concise, supportive, and concrete.
Return only the most important 2-3 learning moments.
Do not produce long-form grading commentary.
Return JSON only.
```

Required output schema:

```json
{
  "status": "ready|almost_there|practice_once_more",
  "score": 0,
  "strength": "string",
  "improvement": "string",
  "pronunciationNote": "string|null",
  "highlights": [
    {
      "turnIndex": 1,
      "youSaid": "string",
      "tryInstead": "string",
      "why": "string"
    }
  ],
  "vocabulary": [
    { "term": "string", "definition": "string", "translation": "string" }
  ]
}
```

## 4.7 Test Prep Planner (System Prompt)

```text
You generate focused short-term test prep plans.
Input includes test date, topics, and learner weaknesses.
Output must prioritize highest-impact practice first and stay realistic for available days.
Return JSON only.
```

Required output schema:

```json
{
  "days": [
    {
      "dayIndex": 1,
      "focusSkills": ["grammar", "speaking"],
      "recommendedActivities": [
        { "type": "lesson", "targetId": "string" }
      ]
    }
  ],
  "miniMockRecommendedAt": "iso-datetime"
}
```

## 4.8 Transcript Annotator (System Prompt)

```text
You annotate learner conversation transcripts for study review.
Provide minimal, high-value inline corrections and extract reusable phrases.
Avoid excessive corrections that overwhelm the learner.
Return JSON only.
```

## 4.9 Homework Parser and Segmenter (System Prompt)

```text
You segment homework content into clear question units.
Input may come from OCR and include noise.
Output must include:
1) segmented questions
2) question type hints
3) parse confidence score (0-1)
Return JSON only.
```

Required output schema:

```json
{
  "questions": [
    {
      "index": 1,
      "promptText": "string",
      "questionType": "multiple_choice|short_answer|translation|other"
    }
  ],
  "parseConfidence": 0.82
}
```

## 5. Scoring Rubric (MVP)

Skill scoring sources:
- Listening: objective listening items + conversation response relevance
- Speaking: pronunciation, fluency rhythm, grammatical usage during conversation
- Reading: objective reading items
- Writing: short writing prompt quality
- Vocabulary: objective vocab items + in-context lexical range
- Grammar: objective grammar items + usage in writing/speaking

Rules:
1. All skill scores are integers `0-100`.
2. Exactly six skill scores are required.
3. `overallScore` is weighted average of six skills.
4. Level mapping:
   - `0-25` very_basic
   - `26-50` basic
   - `51-75` intermediate
   - `76-100` advanced
5. Clamp all outputs to valid ranges before persistence.

## 6. Determinism and Reliability Controls

1. Use low-variance settings for scoring calls (temperature near deterministic).
2. Enforce schema validation (`zod`) before accepting model output.
3. Retry invalid JSON once with "repair" prompt.
4. If second failure occurs:
   - mark `ai_fallback_triggered`
   - use safe fallback response path
   - never block user flow permanently
5. Log evidence payloads for audit without storing unnecessary sensitive content.
6. Enforce plan-aware Speak constraints before invoking expensive voice pipeline.

## 7. Safety and Product Guardrails

1. Assessment mode:
   - no answer hints
   - no coaching that contaminates score integrity
2. Homework Help mode:
   - no full direct answers
   - progressive hint escalation only
3. Speak mode:
   - no unsafe or inappropriate roleplay
   - no medical/legal/financial authoritative claims
4. All modes:
   - refuse disallowed content safely
   - preserve respectful, student-appropriate tone

## 8. Evaluation Suite (Pre-Release and Regression)

Maintain versioned eval set with:
- level-balanced student examples (very_basic through advanced)
- noisy transcript examples (ASR errors)
- common grammar/vocab mistake patterns
- homework prompts designed to tempt answer dumping
- safety/adversarial prompts
- free-tier speak prompts that attempt to force unsupported voice behavior
- transcript annotation quality fixtures

Minimum release thresholds:
1. JSON schema validity >= 99.5% for structured responses.
2. Assessment completion success >= 97%.
3. Homework no-answer-dump compliance >= 99%.
4. Scoring drift median <= 3 points vs benchmark set.
5. AI hard-failure rate <= 1% on core flows.
6. Test prep plan structural validity >= 99%.
7. Transcript annotation usefulness pass rate >= 95% in rubric checks.
8. Homework parser segmentation validity >= 95% on benchmark fixtures.

## 9. Monitoring and Alerting

Track:
- response parse failures
- fallback invocation rate
- per-surface latency p95
- scoring distribution drift by skill
- safety refusal rate
- transcript annotation generation success
- free-tier voice-downgrade success rate

Alert conditions:
- parse failure spike above threshold
- sudden score distribution shift
- homework policy violation detections

## 10. Versioning and Change Control

1. Each prompt template version must have an ID (for example `assessment_facilitator_v1`).
2. Store prompt version with generated artifacts (reports, session summaries).
3. Any prompt/rubric change requires:
   - eval rerun
   - changelog entry
   - documentation update in this file and related API/data specs if needed.
