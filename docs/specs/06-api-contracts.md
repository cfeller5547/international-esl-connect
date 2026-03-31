# API Contracts (MVP)

All contracts below are JSON over HTTPS.

Recommended route namespace:
- `/api/v1/*`

## 1. Auth and User

### `POST /api/v1/auth/signup`
Request:
```json
{
  "email": "user@example.com",
  "password": "string",
  "ageConfirmed13Plus": true,
  "guestSessionToken": "optional-string"
}
```
Behavior:
- creates user
- if `guestSessionToken` present, migrates onboarding/assessment/report

Response:
```json
{
  "userId": "uuid",
  "redirectTo": "/app/progress/reports/:reportId"
}
```

### `POST /api/v1/auth/login`
Request:
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

Response:
```json
{
  "userId": "uuid",
  "redirectTo": "/app/home"
}
```

## 1.1 Plan and Usage Limits

### `GET /api/v1/usage/limits`
Response:
```json
{
  "plan": "free",
  "limits": {
    "speakTextTurnsPerDay": 120,
    "speakVoiceSecondsLifetimeTrial": 180,
    "homeworkUploadsPerDay": 3,
    "reassessmentsPer30Days": 1,
    "testPrepPlansPer30Days": 2
  },
  "usage": {
    "speakTextTurnsToday": 24,
    "speakVoiceSecondsLifetime": 60,
    "homeworkUploadsToday": 1,
    "reassessmentsLast30Days": 0,
    "testPrepPlansLast30Days": 1
  }
}
```

Limit behavior:
- on limit breach, return `PLAN_LIMIT_REACHED` with structured `limitKey` and `resetAt`.
- for free users requesting voice beyond trial, return `VOICE_MODE_UPGRADE_REQUIRED`.

## 2. Pre-signup Onboarding

### `POST /api/v1/onboarding/session`
Creates guest onboarding session.

Response:
```json
{
  "guestSessionToken": "string",
  "expiresAt": "iso-datetime"
}
```

### `PUT /api/v1/onboarding/session/profile`
Request:
```json
{
  "guestSessionToken": "string",
  "firstName": "string",
  "ageBand": "13-15",
  "targetLanguage": "english",
  "nativeLanguage": "english",
  "isTakingClass": true,
  "schoolLevel": "high_school"
}
```

### `POST /api/v1/onboarding/session/assessment/start`
Request:
```json
{
  "guestSessionToken": "string",
  "phase": "full_diagnostic"
}
```
Response:
```json
{
  "assessmentAttemptId": "uuid",
  "phase": "full_diagnostic"
}
```

### `POST /api/v1/onboarding/session/assessment/complete`
Request:
```json
{
  "guestSessionToken": "string",
  "assessmentAttemptId": "uuid"
}
```
Behavior:
- computes six skill scores
- creates guest `baseline_full` report and level placement before signup

Response:
```json
{
  "reportPreviewId": "uuid",
  "overallScore": 64,
  "levelLabel": "intermediate",
  "redirectTo": "/signup"
}
```

### `POST /api/v1/onboarding/session/assessment/conversation/turn`
Behavior:
- legacy non-realtime mirror of the assessment conversation contract
- not the primary UI path for the shipped onboarding diagnostic, which uses the realtime client-secret endpoint below

Request:
```json
{
  "assessmentAttemptId": "uuid",
  "transcript": [
    { "speaker": "ai", "text": "Hi, I'm Maya..." }
  ],
  "studentInput": {
    "text": "I'm Ana, and I'm taking biology.",
    "voiceCaptured": true,
    "durationSeconds": 3
  }
}
```
Response:
```json
{
  "attemptId": "uuid",
  "openingTurn": "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
  "studentTranscriptText": "I'm Ana, and I'm taking biology.",
  "aiResponseText": "Nice to meet you, Ana. What do you usually do in your biology class?",
  "replyCount": 1,
  "responseTarget": 4,
  "canAdvance": false,
  "countsTowardProgress": true,
  "disposition": "accepted_answer",
  "reasonCode": "accepted",
  "durationSeconds": 0
}
```
Behavior note:
- this route remains available for non-realtime or service-side continuation logic; `voiceCaptured: true` means the learner spoke through the browser mic even when no raw audio blob is uploaded
- if the learner sends a clarification turn such as `why?` or `what do you mean?`, the API returns a rephrased coach question and `countsTowardProgress: false`
- the same repair-first rule applies to acknowledgement-only, noisy, or unintelligible turns; those turns return a non-accepted `disposition` and do not count toward captured evidence

### `POST /api/v1/onboarding/session/assessment/conversation/realtime`
Creates a short-lived OpenAI Realtime client secret for the active guest full-diagnostic interview.

Request:
```json
{
  "assessmentAttemptId": "uuid"
}
```

Response:
```json
{
  "clientSecret": "string",
  "expiresAt": 1770000000,
  "model": "gpt-realtime"
}
```

Rules:
- attempt must belong to the current guest session
- attempt must be `context = onboarding_full`
- attempt must still be active

### `GET /api/v1/onboarding/session/results`
Query:
- `guestSessionToken`

Response:
```json
{
  "reportId": "uuid",
  "reportType": "baseline_full",
  "overallScore": 64,
  "levelLabel": "intermediate",
  "skills": [
    { "skill": "listening", "score": 70 },
    { "skill": "speaking", "score": 58 },
    { "skill": "reading", "score": 66 },
    { "skill": "writing", "score": 55 },
    { "skill": "vocabulary", "score": 68 },
    { "skill": "grammar", "score": 61 }
  ]
}
```

Behavior note:
- public onboarding does not render the report preview; successful diagnostic completion routes to signup, and the report is first shown inside the authenticated app after signup.

## 2.1 Post-signup Full Diagnostic / Legacy Resume

### `POST /api/v1/assessment/full/start`
Request:
```json
{
  "context": "onboarding_full"
}
```
Response:
```json
{
  "assessmentAttemptId": "uuid"
}
```

### `POST /api/v1/assessment/full/complete`
Request:
```json
{
  "assessmentAttemptId": "uuid"
}
```
Response:
```json
{
  "reportId": "uuid",
  "reportType": "baseline_full",
  "overallScore": 68,
  "levelLabel": "intermediate"
}
```

### `POST /api/v1/assessment/full/conversation/turn`
Behavior:
- authenticated mirror of the onboarding assessment conversation turn endpoint
- uses the same placement-coach conversation contract, voice-captured request shape, and reply payload

### `POST /api/v1/assessment/full/conversation/realtime`
Creates a short-lived OpenAI Realtime client secret for the authenticated full-diagnostic interview.

Request:
```json
{
  "assessmentAttemptId": "uuid"
}
```

Response:
```json
{
  "clientSecret": "string",
  "expiresAt": 1770000000,
  "model": "gpt-realtime"
}
```

Rules:
- attempt must belong to the current user
- attempt must still be active

## 3. Learn and Recommendations

### `GET /api/v1/home/primary-action`
Response:
```json
{
  "actionType": "continue_curriculum",
  "title": "Continue curriculum",
  "targetUrl": "/app/learn/unit/basic-past-events-and-weekend-stories/practice",
  "reason": "You are one activity away from finishing Unit 2",
  "reasonCode": "continue_curriculum",
  "sourceType": "teacher_provided",
  "weakestSkill": null
}
```

Reason codes (MVP):
- `complete_full_diagnostic`
- `resume_homework_help`
- `start_homework_help`
- `continue_test_prep`
- `continue_curriculum`

Action types (MVP):
- `complete_full_diagnostic`
- `resume_homework_help`
- `start_homework_help`
- `continue_test_prep`
- `continue_curriculum`

### `GET /api/v1/home/quick-actions`
Response:
```json
{
  "quickActions": [
    {
      "key": "homework_help",
      "title": "Homework Help",
      "targetUrl": "/app/tools/homework",
      "persistent": true
    },
    {
      "key": "test_prep_sprint",
      "title": "Test Prep Sprint",
      "targetUrl": "/app/tools/test-prep",
      "persistent": false
    }
  ]
}
```

### `GET /api/v1/learn/recommendation`
Response:
```json
{
  "title": "Continue curriculum",
  "targetUrl": "/app/learn/unit/basic-past-events-and-weekend-stories/practice",
  "reason": "Continue your next required curriculum activity",
  "reasonCode": "continue_curriculum",
  "contextSignals": ["curriculum:basic", "unit:basic-past-events-and-weekend-stories"],
  "contentSourceType": "teacher_provided"
}
```

### `GET /api/v1/learn/curriculum`
Returns the assigned curriculum, ordered units, current unlocked unit, archived prior curriculum history, and per-activity progress.

Response:
```json
{
  "level": "basic",
  "curriculum": {
    "id": "uuid",
    "level": "basic",
    "title": "Basic English Curriculum",
    "description": "Everyday communication and short connected language.",
    "targetLanguage": "english"
  },
  "currentUnit": {
    "id": "uuid",
    "slug": "basic-past-events-and-weekend-stories",
    "title": "Past Events and Weekend Stories"
  },
  "currentActivity": {
    "id": "uuid",
    "activityType": "game",
    "title": "Unit Game",
    "href": "/app/learn/unit/basic-past-events-and-weekend-stories/game"
  },
  "units": [
    {
      "id": "uuid",
      "slug": "basic-habits-and-routines-in-more-detail",
      "title": "Habits and Routines in More Detail",
      "status": "completed",
      "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail",
      "activities": [
        { "activityType": "lesson", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/lesson" },
        { "activityType": "practice", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/practice" },
        { "activityType": "game", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/game" },
        { "activityType": "speaking", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/speaking" },
        { "activityType": "writing", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/writing" },
        { "activityType": "checkpoint", "status": "completed", "href": "/app/learn/unit/basic-habits-and-routines-in-more-detail/checkpoint" }
      ]
    }
  ],
  "archivedCurricula": [
    {
      "id": "uuid",
      "level": "very_basic",
      "title": "Very Basic English Curriculum",
      "completedUnits": 6
    }
  ]
}
```

Rules:
- each unit exposes six required ordered activities: `lesson`, `practice`, `game`, `speaking`, `writing`, `checkpoint`
- clients should use `orderIndex` from the activity payloads and activity list length to render step position
- `game` is required for unit completion and for unlocking `speaking`
- current `very_basic` and `basic` Learn game payloads now require the Stage 9 arcade metadata on every arcade stage, and Stage 10 keeps the same contract while deepening the top 4 current-12 showcase games:
  - `interactionModel`
  - `spriteRefs`
    - use `spriteRefs.neutral` for pre-answer decision states when the learner should not infer correctness yet
  - `motionRules`
  - `hitBoxes`
  - `spawnTimeline`
  - `failWindowMs`
  - `rewardFx`
  - `transitionFx`
- `intermediate` and `advanced` continue to use the authored board-first stage shapes and are not required to provide Stage 9 arcade-only payload fields.

### `POST /api/v1/learn/curriculum/activity/complete`
Request:
```json
{
  "unitSlug": "very-basic-introductions-and-personal-information",
  "activityType": "game",
  "score": 100,
  "responsePayload": {
    "gameReview": {
      "gameId": "very_basic-1-game",
      "gameTitle": "Name Tag Mixer",
      "gameKind": "name_tag_mixer",
      "strength": "You built a fast, clean first-meeting intro and kept the replies natural instead of random.",
      "nextFocus": "Keep your opener short enough that the other person can answer easily.",
      "bridgeToSpeaking": "Open the speaking mission with the same short intro burst and let the other person in quickly.",
      "replayStageIds": ["very_basic-1-game-runner"],
      "stages": [
        {
          "stageId": "very_basic-1-game-runner",
          "stageKind": "lane_runner",
          "stageTitle": "Hallway dash",
          "challengeProfile": "arcade",
          "attemptNumber": 1,
          "nextAllowedAction": "advance",
          "medalCap": "gold",
          "failureReason": null,
          "timeExpired": false,
          "outcome": "strong",
          "coachNote": "Good. You crossed cleanly and picked up the full intro line in order.",
          "transcriptText": null,
          "resolvedInputMode": null,
          "scoreDelta": 698,
          "combo": 4,
          "livesRemaining": 2,
          "stageResult": "cleared",
          "completionPath": "arcade",
          "medal": "gold"
        }
      ]
    }
  }
}
```

Behavior:
- marks the activity complete
- unlocks the next required activity in the unit or the next unit when all six required activities are complete
- updates the active curriculum progress summary
- returns explicit next-step metadata so the client can render a completion transition before navigation

Response:
```json
{
  "nextActionHref": "/app/learn/unit/very-basic-introductions-and-personal-information/speaking",
  "unitCompleted": false,
  "nextAction": {
    "href": "/app/learn/unit/very-basic-introductions-and-personal-information/speaking",
    "label": "Continue to speaking",
    "title": "Speaking application",
    "description": "Use the unit language in your own words.",
    "unitTitle": "Introductions and Personal Information",
    "activityType": "speaking",
    "stepIndex": 4,
    "totalSteps": 6
  }
}
```

### `POST /api/v1/learn/curriculum/game/evaluate`
Evaluates one Learn game stage and returns coaching-first feedback. This route is used by the required Learn game activity and does not replace final activity completion.

Request:
```json
{
  "unitSlug": "very-basic-introductions-and-personal-information",
  "stageId": "very_basic-1-game-runner",
  "attemptNumber": 1,
  "answer": {
    "collectedIds": ["token-hi", "token-ana", "token-brazil", "token-question"],
    "arcadeMetrics": {
      "mistakeCount": 0,
      "timeRemainingMs": 9200,
      "comboPeak": 4,
      "livesRemaining": 2,
      "completionPath": "arcade",
      "timeExpired": false,
      "muteEnabled": false,
      "interactionModel": "cross_dash"
    }
  }
}
```

Voice request example:
```json
{
  "unitSlug": "very-basic-introductions-and-personal-information",
  "stageId": "very_basic-1-game-voice-burst",
  "inputMode": "fallback",
  "attemptNumber": 1,
  "answer": {
    "fallbackOptionId": "good",
    "arcadeMetrics": {
      "mistakeCount": 0,
      "timeRemainingMs": 7600,
      "comboPeak": 2,
      "livesRemaining": 2,
      "completionPath": "fallback",
      "timeExpired": false,
      "muteEnabled": false,
      "interactionModel": "burst_callout"
    }
  }
}
```

Structural request example:
```json
{
  "unitSlug": "intermediate-tell-stories-clearly",
  "stageId": "intermediate-3-game-sequence",
  "attemptNumber": 2,
  "answer": {
    "orderedIds": ["hook", "problem", "turning-point", "ending"],
    "structuralMetrics": {
      "timeRemainingMs": null,
      "livesRemaining": 2,
      "timeExpired": false
    }
  }
}
```

Response:
```json
{
  "stageId": "very_basic-1-game-runner",
  "stageKind": "lane_runner",
  "stageTitle": "Hallway dash",
  "challengeProfile": "arcade",
  "attemptNumber": 1,
  "nextAllowedAction": "advance",
  "medalCap": "gold",
  "failureReason": null,
  "timeExpired": false,
  "resolvedInputMode": null,
  "transcriptText": null,
  "outcome": "strong",
  "coachNote": "Good. You crossed cleanly and picked up the full intro line in order.",
  "retryAllowed": false,
  "fallbackRecommended": false,
  "scoreDelta": 698,
  "combo": 4,
  "livesRemaining": 2,
  "stageResult": "cleared",
  "completionPath": "arcade",
  "medal": "gold"
}
```

Rules:
- `game` is required before `speaking`
- stage evaluation may accept `muteEnabled` and `interactionModel` inside `arcadeMetrics` so the saved review can emit accurate Stage 9 analytics
- stage evaluation may accept `structuralMetrics` for timed and untimed non-arcade stages
- game completion returns the same coaching-first review contract as before, plus the arcade review fields already used by the current 12 games
- Learn game payloads now support the Stage 9 direct-playfield arcade kinds `lane_runner`, `sort_rush`, `route_race`, `reaction_pick`, and `voice_burst`, while older authored board-first kinds remain valid for non-arcade levels
- the current `very_basic` and `basic` games use the Stage 9 arcade kinds; `intermediate` and `advanced` remain on the older authored board-first set for now
- every stage now carries `challengeProfile` plus shared `challenge` config that governs timer/lives/medal behavior
- challenge difficulty scales by curriculum level through `challenge.difficultyBand` rather than one global timer rule
- default challenge profiles in this pass are:
  - `arcade`: `lane_runner`, `sort_rush`, `route_race`, `reaction_pick`, `voice_burst`
  - `recall`: `choice`, `match`, `spotlight`, `map`
  - `construction`: `assemble`, `priority_board`, `state_switch`, `sequence`
  - `voice`: `voice_prompt`
- game evaluation may accept `collectedIds`, `sortAssignments`, `pathIds`, `reactionSelections`, `arcadeMetrics`, and `structuralMetrics` depending on stage kind
- `voice_burst` is the current arcade voice stage; voice should be used only on selected games where it materially helps the learning moment
- the current voice set remains `Name Tag Mixer`, `Snack Counter`, `Story Chain`, `Scene Scan`, `Station Help`, and `Choice Showdown`
- Stage 9 authored Learn game payloads may also include `answerRevealMode` and optional `resolvedSpeechText` on stage presentation plus `ambientSet` and `celebrationVariant` on the game payload
- stage evaluation returns challenge-aware review fields (`attemptNumber`, `nextAllowedAction`, `medalCap`, `failureReason`, `timeExpired`, `scoreDelta`, `combo`, `livesRemaining`, `stageResult`, `completionPath`, `medal`, `nearMiss`) in addition to coaching-first feedback
- the client may only advance when `nextAllowedAction = "advance"`; failed stages must remain on the current stage and offer retry instead
- retries are stage-local and reset only the current stage runtime state; already-cleared earlier stages remain cleared
- `completionRule.maxRetriesPerStage` now defines the medal window instead of a hard retry ceiling:
  - attempt `1` may earn `gold`
  - attempt `2` may earn up to `silver`
  - attempt `3+` may earn up to `bronze`
- timed arcade and recall stages must resolve immediately when `timeExpired = true`; untimed construction and voice stages omit countdown pressure
- `voice_burst` and `voice_prompt` fallback remain valid completion paths, fallback may earn up to `silver`, and `gold` requires real voice completion
- Active arcade timer displays must remain trustworthy on the client: once stage time expires, the UI should lock interaction and resolve immediately rather than leaving a live `0:00` state visible.
- `POST /api/v1/learn/curriculum/game/speech` accepts `{ "text": string }` for authenticated, premium-quality Learn game speech playback and returns `audio/mpeg`; the client should use this for stage-clear and explicit replay moments instead of browser `speechSynthesis`
- if voice evaluation is unavailable, the API may return `resolvedInputMode = fallback` and `fallbackRecommended = true` so the client can continue without losing progress

### `POST /api/v1/learn/curriculum/game/speech`
Generates high-quality spoken playback for Learn game preview and stage-clear moments.

Request:
```json
{
  "text": "Hi, I'm Ana. I'm from Brazil. What about you?"
}
```

Behavior:
- requires an authenticated user
- returns `audio/mpeg` on success
- uses the configured OpenAI TTS model with clear, learner-friendly pronunciation instructions
- should be used for authored stage-clear reward lines and explicit replay buttons
- should not fall back to browser `speechSynthesis` for the premium Learn game path

### `POST /api/v1/learn/curriculum/speaking/start`
Starts or retries the scenario-bound Learn speaking mission for the current unit after the required game is complete.

Request:
```json
{
  "unitSlug": "intermediate-tell-stories-clearly",
  "interactionMode": "text",
  "retryOfSessionId": null
}
```

Response:
```json
{
  "sessionId": "uuid",
  "deliveryMode": "text_chat",
  "openingTurn": "What happened?",
  "resumeState": {
    "status": "active",
    "interactionMode": "text",
    "turns": [
      {
        "speaker": "ai",
        "text": "What happened?"
      }
    ]
  },
  "canFinish": false
}
```

Rules:
- free users may start only `interactionMode = text`
- pro users may use `text` or `voice`
- if voice is requested without availability, return the documented plan/availability error

### `POST /api/v1/learn/curriculum/speaking/turn`
Submits one learner turn in the active Learn speaking mission.

Request:
```json
{
  "sessionId": "uuid",
  "studentInput": {
    "text": "First I missed the bus, so I walked to school.",
    "audioDataUrl": "optional-data-url",
    "audioMimeType": "audio/webm",
    "durationSeconds": 8
  }
}
```

Response:
```json
{
  "aiResponseText": "That makes sense. What happened after that?",
  "studentTranscriptText": "First I missed the bus, so I walked to school.",
  "deliveryMode": "text_chat",
  "canFinish": false
}
```

### `POST /api/v1/learn/curriculum/speaking/:sessionId/realtime`
Creates a short-lived OpenAI Realtime client secret for an active Pro Learn speaking voice session.

Response:
```json
{
  "clientSecret": "string",
  "expiresAt": 1770000000,
  "model": "gpt-realtime"
}
```

Rules:
- session must belong to the current user
- session must be `surface = learn`
- session must be `interactionMode = voice`
- session must still be active

### `POST /api/v1/learn/curriculum/speaking/:sessionId/sync`
Persists the current realtime transcript snapshot while the Learn voice mission is active.

Request:
```json
{
  "turns": [
    { "speaker": "ai", "text": "What do you think, and why?" },
    { "speaker": "student", "text": "I think uniforms can help because students feel equal." }
  ]
}
```

Response:
```json
{
  "studentTurnCount": 1,
  "canFinish": false,
  "lastStudentTurn": {
    "disposition": "accepted_answer",
    "countsTowardProgress": true,
    "coachLabel": "Strong follow-up",
    "coachNote": "You answered the question directly and added one reason.",
    "reasonCode": "accepted"
  }
}
```

Behavior note:
- `studentTurnCount` counts only accepted learner turns.
- `lastStudentTurn` is returned for the most recent learner turn so the client can render accepted-turn coaching or repair without waiting for session completion.

### `POST /api/v1/learn/curriculum/speaking/complete`
Completes the current Learn speaking mission and returns a focused review payload.

Request:
```json
{
  "unitSlug": "intermediate-tell-stories-clearly",
  "sessionId": "uuid"
}
```

Response:
```json
{
  "status": "almost_there",
  "score": 74,
  "strength": "You stayed in the scenario and added useful detail.",
  "improvement": "Use one more sequencing phrase in your next attempt.",
  "pronunciationNote": null,
  "evidenceSummary": {
    "observed": ["Summarize the main idea clearly"],
    "missing": ["Include one supporting detail"],
    "nextFocus": "Include one supporting detail",
    "benchmarkFocus": null,
    "followUpResponsesObserved": 1,
    "followUpResponsesRequired": 0
  },
  "highlights": [
    {
      "turnIndex": 3,
      "youSaid": "after I go home",
      "tryInstead": "after I went home",
      "why": "Use past tense to match the rest of your story."
    }
  ],
  "turns": [
    {
      "turnIndex": 1,
      "speaker": "student",
      "text": "string",
      "inlineCorrections": []
    }
  ],
  "vocabulary": [
    {
      "term": "meaningful",
      "definition": "important and memorable",
      "translation": "significant"
    }
  ]
}
```

Rules:
- mission completion unlocks review, not the next curriculum activity by itself
- final speaking activity completion still occurs through `/api/v1/learn/curriculum/activity/complete`
- speaking mission payloads may include `requiredTurns`, `minimumFollowUpResponses`, `evidenceTargets`, `followUpObjectives`, and `benchmarkFocus`
- `very_basic` benchmark missions require 4 learner turns and 1 substantive follow-up response before feedback unlocks
- `basic` benchmark missions require 5 learner turns and 2 substantive follow-up responses before feedback unlocks
- `intermediate` benchmark missions require 6 learner turns and 2 substantive follow-up responses before feedback unlocks
- `advanced` benchmark missions require 7 learner turns and 3 substantive follow-up responses before feedback unlocks
- calling `complete` before the hidden participation threshold is met must return a validation error

### `PUT /api/v1/context/topics`
Request:
```json
{
  "topics": ["introductions", "simple present routines"],
  "activeFrom": "2026-03-05",
  "activeTo": "2026-03-19"
}
```
Behavior:
- creates or updates manual class-topic context when syllabus file is unavailable.

### `PUT /api/v1/context/class-profile`
Request:
```json
{
  "schoolName": "Lincoln High School",
  "className": "ESL Foundations",
  "instructorName": "Ms. Rodriguez",
  "periodLabel": "Period 3"
}
```
Behavior:
- stores lightweight class context for better recommendation relevance and optional cohort messaging later.

### `POST /api/v1/learn/activity/complete`
Request:
```json
{
  "activityType": "lesson",
  "activityId": "abc123",
  "score": 82,
  "metadata": {}
}
```

## 3.1 Content Catalog

### `GET /api/v1/content/items`
Query:
- `contentType` (optional: `lesson` | `worksheet` | `video`)
- `targetLanguage` (optional)
- `topic` (optional)
- `limit` (optional)

Response:
```json
{
  "items": [
    {
      "contentId": "uuid",
      "title": "Introductions Core Practice",
      "contentType": "lesson",
      "sourceType": "teacher_provided",
      "targetLanguage": "english",
      "topicTags": ["introductions"]
    }
  ]
}
```

### `GET /api/v1/content/items/:contentId`
Returns full content metadata and linked assets.

### `POST /api/v1/internal/content/import`
Purpose:
- internal/manual ingestion endpoint for ops use (no teacher portal in MVP UI).

Request:
```json
{
  "sourceType": "teacher_provided",
  "items": [
    {
      "contentType": "worksheet",
      "title": "Introductions Worksheet A",
      "targetLanguage": "english",
      "skillTags": ["grammar", "writing"],
      "topicTags": ["introductions"],
      "assets": [
        { "assetType": "pdf", "assetUrl": "https://..." }
      ]
    }
  ]
}
```

MVP bootstrap rule:
- when teacher-provided items are not yet imported, placeholder items are served.
Response:
```json
{
  "nextAction": {
    "type": "practice",
    "targetUrl": "/app/learn/unit/basic-past-events-and-weekend-stories/practice"
  },
  "inlineProgressDelta": {
    "grammar": 2
  }
}
```

## 4. Homework Help

Implementation note:
- the current UI lives under `/app/tools/*`, but the backend endpoints below remain under `/api/v1/learn/homework/*` in this build.

### `POST /api/v1/learn/homework/upload`
Form-data:
- file or text payload
- prompt type

Behavior:
- text PDFs: native text extraction first
- image PDFs/photos: OCR extraction
- AI question segmentation + confidence scoring
- low-confidence parses return `needs_review` state instead of silent failure

Response:
```json
{
  "homeworkUploadId": "uuid",
  "status": "extracting_text",
  "detectedQuestionCount": 8,
  "parseConfidence": 0.82,
  "requiresReview": false
}
```

### `GET /api/v1/learn/homework/upload/:homeworkUploadId`
  Response:
  ```json
  {
    "homeworkUploadId": "uuid",
    "status": "parsed",
    "detectedQuestionCount": 8,
    "parseConfidence": 0.82,
    "requiresReview": false,
    "errorCode": null,
    "assignmentTitle": "string",
    "assignmentSummary": "string",
    "subject": "string",
    "difficultyLevel": "light|moderate|challenging",
    "reviewNotes": ["string"],
    "extractionNotes": ["string"],
    "rawText": "string",
    "questions": [
      {
        "index": 1,
        "promptText": "string",
        "questionType": "string",
        "focusSkill": "string",
        "studentGoal": "string",
        "answerFormat": "string",
        "successCriteria": ["string"],
        "planSteps": ["string"],
        "commonPitfalls": ["string"]
      }
    ]
  }
  ```

### `POST /api/v1/learn/homework/session/start`
Request:
```json
{
  "homeworkUploadId": "uuid"
}
```

### `POST /api/v1/learn/homework/session/step`
  Request:
  ```json
  {
    "sessionId": "uuid",
    "questionIndex": 2,
    "studentAnswer": "string",
    "action": "explain"
  }
  ```
  Response:
  ```json
  {
    "action": "explain",
    "result": "keep_working",
    "coachTitle": "What this question wants",
    "coachMessage": "string",
    "checklist": ["string"],
    "suggestedStarter": "string or null",
    "shouldAdvance": false,
    "readyToSubmit": false,
    "nextHintLevelAvailable": 2,
    "sessionCompleted": false
  }
  ```
  Notes:
  - supported action values are `explain`, `plan`, `hint`, `check`, and `submit`
  - `submit` is the only action that may advance to the next question
  - `check` may return `readyToSubmit: true` without advancing, so the learner can choose when to move on

## 5. Speak

### `POST /api/v1/speak/session/start`
Request:
```json
{
  "mode": "free_speech",
  "interactionMode": "text",
  "starterKey": "learning",
  "scenarioKey": null
}
```

Behavior:
- free-tier users may request `voice` but must receive plan-aware downgrade or paywall response.
- `interactionMode = voice` creates a Speak session that is completed through the realtime browser flow, not through `/api/v1/speak/session/turn`.
- `mode = free_speech` is typically started from one-tap quick-start lanes.
- `mode = guided` keeps the structured scenario picker.

Response:
```json
{
  "sessionId": "uuid",
  "starterPrompt": "Tell me about one thing that happened in class today."
}
```

### `GET /api/v1/speak/starters`
Response:
```json
{
  "starters": [
    { "key": "today", "label": "Something from today", "prompt": "Start with something that happened today." },
    { "key": "learning", "label": "Something I'm learning", "prompt": "Talk about something you are learning in class." },
    { "key": "say_better", "label": "Something I want to say better", "prompt": "Pick one idea you want to explain more clearly." },
    { "key": "surprise_me", "label": "Surprise me", "prompt": "Let the AI choose a good topic from your context." }
  ]
}
```

### `POST /api/v1/speak/session/turn`
Request:
```json
{
  "sessionId": "uuid",
  "studentInput": {
    "text": "optional if voice",
    "audioRef": "optional",
    "audioDataUrl": "optional-data-url",
    "audioMimeType": "audio/webm",
    "durationSeconds": 7
  }
}
```
Response:
```json
{
  "aiResponseText": "string",
  "transcriptUpdated": true,
  "microCoaching": "string",
  "coachLabel": "string",
  "turnSignals": {
    "fluencyIssue": false,
    "grammarIssue": false,
    "vocabOpportunity": false
  },
  "studentTranscriptText": "string or null"
}
```

Notes:
- This route is the text-turn path and the non-realtime fallback path.
- Active Pro voice Speak sessions use `/api/v1/speak/session/:sessionId/realtime` plus transcript sync instead of submitting one uploaded turn at a time.
- Active Pro Learn voice missions use the parallel Learn-scoped realtime routes under `/api/v1/learn/curriculum/speaking/:sessionId/*`.
- `free_speech` may intentionally suppress visible vocab-only coaching even when the AI teaches through recasts in the reply itself.

### `POST /api/v1/speak/session/:sessionId/realtime`
Creates a short-lived OpenAI Realtime client secret for an active Pro voice Speak session.

Response:
```json
{
  "clientSecret": "string",
  "expiresAt": 1770000000,
  "model": "gpt-realtime"
}
```

Rules:
- session must belong to the current user
- session must be `surface = speak`
- session must be `interactionMode = voice`
- session must still be active
- free-tier users receive the documented voice upgrade error

### `POST /api/v1/speak/session/:sessionId/sync`
Persists the current realtime transcript snapshot while the live session is active.

Request:
```json
{
  "turns": [
    { "speaker": "ai", "text": "Hi there. Tell me about your classes today." },
    { "speaker": "student", "text": "I had math and English today." }
  ]
}
```

Response:
```json
{
  "turnCount": 2,
  "studentTurnCount": 1,
  "newStudentTurns": 1,
  "lastStudentTurn": {
    "disposition": "accepted_answer",
    "countsTowardProgress": true,
    "coachLabel": "Clear answer",
    "coachNote": "Keep the same idea and add one short detail next time.",
    "reasonCode": "accepted"
  }
}
```

Behavior note:
- `studentTurnCount` counts only accepted learner turns.
- `lastStudentTurn` lets the client distinguish accepted-turn coaching from repair-only turns in the live transcript.

### `POST /api/v1/speak/session/complete`
Request:
```json
{
  "sessionId": "uuid",
  "durationSeconds": 94
}
```

Response:
```json
{
  "summary": {
    "strengths": ["Good pronunciation of common phrases"],
    "improvements": ["Practice past tense consistency"]
  }
}
```

### `GET /api/v1/speak/session/:sessionId/transcript`
Response:
```json
{
  "sessionId": "uuid",
  "turns": [
    {
      "turnIndex": 1,
      "speaker": "student",
      "text": "string",
      "inlineCorrections": [
        { "span": "went", "suggestion": "go", "reason": "tense agreement" }
      ]
    }
  ],
  "vocabulary": [
    { "term": "string", "definition": "string", "translation": "string" }
  ]
}
```

### `POST /api/v1/speak/session/:sessionId/phrases`
Request:
```json
{
  "phraseText": "string",
  "translationText": "string"
}
```

### `GET /api/v1/speak/phrases`
Returns saved phrase bank items for review.

## 6. Reports and Reassessment

### `GET /api/v1/progress/streak`
Response:
```json
{
  "currentStreakDays": 4,
  "longestStreakDays": 9,
  "lastQualifyingActivityDate": "2026-03-05",
  "nextMilestoneDays": 7
}
```

Update behavior:
- streak values are recalculated on qualifying activity completion endpoints.

### `GET /api/v1/progress/reports`
Response:
```json
{
  "reports": [
    {
      "reportId": "uuid",
      "createdAt": "iso-datetime",
      "overallScore": 64,
      "levelLabel": "intermediate",
      "reportType": "baseline_full"
    }
  ]
}
```

Level behavior contract:
- qualifying assessments (`baseline_quick`, `baseline_full`, `reassessment`) may initialize or promote `currentLevel`
- `mini_mock` never changes `currentLevel`

### `GET /api/v1/progress/reports/:reportId`
Returns full report detail including skill visuals and comparison payload.

### `POST /api/v1/progress/reports/:reportId/share-card`
Request:
```json
{
  "cardType": "improvement"
}
```
Response:
```json
{
  "shareCardId": "uuid",
  "assetUrl": "https://..."
}
```

### `POST /api/v1/progress/reassessment/start`
Creates a reassessment attempt for logged-in user.

### `POST /api/v1/progress/reassessment/complete`
Completes reassessment, creates new report, stores comparison.

## 6.1 Test Prep

### `POST /api/v1/test-prep/plans`
Request:
```json
{
  "targetDate": "2026-03-12",
  "topics": ["simple past stories", "school vocabulary"]
}
```
Response:
```json
{
  "planId": "uuid",
  "summary": "3-day plan created"
}
```

### `GET /api/v1/test-prep/plans/:planId`
Returns plan detail including daily priorities and recommended practice links.

### `POST /api/v1/test-prep/plans/:planId/mini-mock`
Creates a short readiness check linked to the test prep plan.

Response:
```json
{
  "planId": "uuid",
  "assessmentAttemptId": "uuid",
  "reportId": "uuid",
  "readinessScore": 72,
  "recommendedNextActions": [
    {
      "type": "continue_curriculum",
      "targetUrl": "/app/learn/unit/basic-past-events-and-weekend-stories/practice"
    }
  ]
}
```

## 7. Error Contract

All error responses:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Recommended codes:
- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `RATE_LIMITED`
- `AI_SERVICE_UNAVAILABLE`
- `ASSESSMENT_INCOMPLETE`
- `VOICE_MODE_UPGRADE_REQUIRED`
- `PLAN_LIMIT_REACHED`
- `CONTENT_IMPORT_FAILED`
- `HOMEWORK_PARSE_UNREADABLE`
- `HOMEWORK_PARSE_FAILED`
