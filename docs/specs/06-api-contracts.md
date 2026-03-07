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
  "redirectTo": "/app/home"
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
  "phase": "quick_baseline"
}
```
Response:
```json
{
  "assessmentAttemptId": "uuid",
  "phase": "quick_baseline"
}
```

### `POST /api/v1/onboarding/session/assessment/complete`
Request:
```json
{
  "guestSessionToken": "string",
  "assessmentAttemptId": "uuid",
  "phase": "quick_baseline"
}
```
Behavior:
- computes six skill scores
- creates guest report preview

Response:
```json
{
  "reportPreviewId": "uuid",
  "overallScore": 64,
  "levelLabel": "intermediate"
}
```

### `GET /api/v1/onboarding/session/results`
Query:
- `guestSessionToken`

Response:
```json
{
  "reportId": "uuid",
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

## 2.1 Post-signup Full Diagnostic

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
    "activityType": "practice",
    "title": "Practice Past Events",
    "href": "/app/learn/unit/basic-past-events-and-weekend-stories/practice"
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

### `POST /api/v1/learn/curriculum/activity/complete`
Request:
```json
{
  "unitSlug": "basic-past-events-and-weekend-stories",
  "activityType": "practice",
  "score": 88,
  "responsePayload": {
    "answers": ["sample"]
  }
}
```

Behavior:
- marks the activity complete
- unlocks the next activity in the unit or the next unit when the unit is finished
- updates the active curriculum progress summary
- returns explicit next-step metadata so the client can render a completion transition before navigation

Response:
```json
{
  "nextActionHref": "/app/learn/unit/basic-past-events-and-weekend-stories/speaking",
  "unitCompleted": false,
  "nextAction": {
    "href": "/app/learn/unit/basic-past-events-and-weekend-stories/speaking",
    "label": "Continue to speaking",
    "title": "Speaking application",
    "description": "Use the unit language in your own words.",
    "unitTitle": "Past Events and Weekend Stories",
    "activityType": "speaking",
    "stepIndex": 3,
    "totalSteps": 5
  }
}
```

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
  "errorCode": null
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
  "requestHintLevel": 1
}
```
Response:
```json
{
  "result": "incorrect",
  "feedback": "Think about which tense shows completed action.",
  "nextHintLevelAvailable": 2
}
```

## 5. Speak

### `POST /api/v1/speak/session/start`
Request:
```json
{
  "mode": "free_speech",
  "interactionMode": "text",
  "starterKey": "school_day",
  "scenarioKey": null
}
```

Behavior:
- free-tier users may request `voice` but must receive plan-aware downgrade or paywall response.

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
    { "key": "school_day", "label": "My school day", "prompt": "Tell me about your classes today." },
    { "key": "homework_help", "label": "Homework talk", "prompt": "Explain one homework question you're unsure about." },
    { "key": "test_prep", "label": "Test prep", "prompt": "Practice a short dialogue using this week's test topics." },
    { "key": "free_topic", "label": "Anything", "prompt": "Choose any topic and start speaking." }
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
    "audioRef": "optional"
  }
}
```
Response:
```json
{
  "aiResponseText": "string",
  "transcriptUpdated": true
}
```

### `POST /api/v1/speak/session/complete`
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
