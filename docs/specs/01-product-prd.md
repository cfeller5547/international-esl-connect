# Product Requirements Document (PRD)

## 1. Product Goal

Build a student-focused academic language companion that improves assignment performance, speaking confidence, and measurable skill growth.

## 2. Target Users

Primary:
- High school students (13-18)
- College students (18-24)

Language scope for curriculum MVP:
- English (ESL)

Data model note:
- language fields remain extensible, but the fixed curriculum system in MVP is authored for English only

## 3. Product Principles

1. Context-aware: class and syllabus relevance first
2. Guided, not cheating: Socratic help and hint ladders
3. Continuous flow: minimal mode switching and dead ends
4. Measurable value: reports with trend comparisons
5. Professional UX: clean, minimal, predictable navigation
6. Speed-to-value: panic homework help in one tap
7. Emotional reinforcement: celebrate real progress, not empty gamification
8. Sustainable economics: free tier demonstrates value without unbounded AI cost
9. Content authenticity: teacher-provided academic content is the primary curriculum source

## 4. In-Scope (MVP)

- Pre-signup onboarding stepper
- Full diagnostic assessment pre-signup including objective items, writing, and required live AI voice conversation
- Signup after the diagnostic to unlock the saved report inside the authenticated app
- Formal report generation and persistence over time
- Home as a coach-briefing surface with one dynamic primary CTA
- Home persistent "Homework Help now" quick action for urgent use
- Learn with one assigned fixed curriculum based on `currentLevel`
- sequential unit unlocks and required unit activities (`lesson`, `practice`, `speaking`, `writing`, `checkpoint`)
- Learn speaking activity as a structured `Speaking Mission`:
  - prep
  - short guided conversation
  - focused transcript review
  - optional retry
- unit speaking missions support:
  - free tier text-first completion with TTS playback
  - pro tier live voice input with pronunciation/clarity signals
- units `3` and `6` in each curriculum act as stronger speaking benchmarks inside Learn without affecting level assignment
- Teacher-provided lesson content pipeline (lessons, worksheets, videos) as canonical source
- Placeholder content library for pre-content MVP bootstrap
- Homework Help inside Tools
- Strong early class-context capture (syllabus upload or "what are you studying this week?"), but not as prime Home content
- Speak free-talk + guided scenarios with:
  - free tier text-first conversations (with TTS playback)
  - pro tier full voice conversation and pronunciation feedback
- Interactive conversation transcript (review, phrase save, vocab extraction)
- Progress with report history, overall trend timeline, per-skill trend views, and reassessment entry point
- Shareable progress artifacts (level card, improvement card, milestone card)
- Test Prep Sprint inside Tools (date/topic based focused plan + mini mock check)
- Subscription and billing flows
- Explicit free-tier usage limits and paywall triggers

## 5. Out-of-Scope (MVP)

- Teacher portal
- LMS integrations
- Under-13 direct signup flow
- Native mobile apps
- Human tutor marketplace
- Full social network graph and messaging
- Teacher self-serve content authoring portal (manual internal ingestion only for MVP)

## 6. Navigation Contract

Top-level app pillars:
- Home
- Learn
- Speak
- Tools
- Progress

Rule:
- Learn is curriculum-only.
- Homework Help and Test Prep Sprint are top-level tools inside `Tools`.
- Profile, Settings, Billing, and Help live in a compact account/utility menu rather than the primary nav.

## 7. Core User Journeys

### 7.1 New User Activation
1. Landing
2. Onboarding stepper (profile -> full diagnostic assessment)
3. Signup and save diagnostic report
4. Enter authenticated report view with level placement and next-step plan
5. Capture class context (syllabus or weekly topics) in onboarding follow-through or profile flows, not as required Home chrome
6. Continue into the assigned curriculum in Learn

### 7.2 Daily Learning Loop
1. Home primary CTA
2. Compact support strip clarifies current focus and learning rhythm
3. Urgent path available anytime via `Homework Help now`
4. Learn unit activity chain (`lesson` -> `practice` -> `speaking mission` -> `writing` -> `checkpoint`)
5. Inline progress update + celebration moment
6. Optional Progress deep dive and share card generation

Content sourcing rule:
- when teacher-provided content exists for target topic/skill, it must be prioritized over placeholder content.
- placeholder content is allowed only where teacher content is not yet available.

### 7.3 Homework Help Loop
1. Start from Home quick action or Tools -> Homework Help
2. Upload assignment
3. Step-by-step guided solving
4. Weakness tags update recommendations

### 7.3.1 Curriculum Level Rules
1. Full diagnostic and reassessment can set or promote `currentLevel`.
2. `mini_mock` creates a report but never changes `currentLevel`.
3. A learner can stay at the same level or be promoted; reassessment never demotes.
4. The assigned level determines which fixed curriculum appears in Learn.

### 7.4 Progress Loop
1. Progress -> Run new assessment
2. Generate new report
3. Compare against prior report
4. Feed next-week practice priorities
5. Optional shareable improvement artifact

### 7.5 Recommendation Priority (MVP)
1. Active homework session -> `Resume homework help`
2. Recent unfinished homework upload -> `Start homework help`
3. Active near-term test prep plan -> `Continue test prep`
4. Next required curriculum activity -> `Continue curriculum`
5. Fallback -> first unlocked curriculum activity

## 8. Value Drivers (What users feel)

- "I know what to do next."
- "I understand why I got this wrong."
- "I can see real improvement over time."
- "The app reflects what my class is actually teaching."
- "I can get homework help fast when I'm under pressure."
- "This feels rewarding enough to keep coming back."

## 9. Success Metrics

Activation:
- `% users who complete onboarding assessment -> signup -> first activity`

Engagement:
- Weekly active days per active user
- Curriculum unit completion rate
- Speak session completion rate
- Homework help initiation rate
- Full diagnostic completion rate within first 48h after signup
- Users reaching streak milestones (3/7/14 days)
- Teacher-content coverage rate across recommended activities

Learning:
- Six-skill score delta over 4 weeks
- Repeat error reduction rate

Business:
- Free-to-paid conversion
- Retention by cohort
- Share-card generation rate
- Test Prep Sprint usage and conversion uplift

## 10. Free Tier Limits (MVP Fixed)

- `speakTextTurnsPerDay`: 120
- `speakVoiceSecondsLifetimeTrial`: 180
- `homeworkUploadsPerDay`: 3
- `reassessmentsPer30Days`: 1
- `testPrepPlansPer30Days`: 2
