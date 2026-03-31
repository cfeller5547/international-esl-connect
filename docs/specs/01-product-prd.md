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
8. Sustainable economics: billing and plan limits remain modeled, but the current preview mode provisions all accounts on Pro by default
9. Content authenticity: teacher-provided academic content is the primary curriculum source

## 4. In-Scope (MVP)

- Pre-signup onboarding stepper
- Full diagnostic assessment pre-signup including objective items, writing, and required live AI voice conversation
- Shared realtime voice policy across Learn, Speak, and full-diagnostic assessment:
  - hands-free continuous mic flow remains the product model
  - the AI should wait through short learner pauses instead of cutting in quickly
  - unclear, noisy, fragmentary, or clarification turns must not count as normal learner progress
  - accepted learner turns keep compact visible coaching; rejected turns show repair instead
- Signup after the diagnostic to unlock the saved report inside the authenticated app
- Formal report generation and persistence over time
- Home as a coach-briefing surface with one dynamic primary CTA
- Home persistent "Homework Help now" quick action for urgent use
- Learn with one assigned fixed curriculum based on `currentLevel`
- sequential unit unlocks and required unit activities (`lesson`, `practice`, `game`, `speaking`, `writing`, `checkpoint`)
- required Learn game activity in every unit:
  - Learn game uses authored payloads with `theme`, `assetRefs`, `layoutVariant`, stage presentation metadata, and authored summary copy
  - the current `very_basic` and `basic` games now use the Stage 9 direct-playfield foundation built from `lane_runner`, `sort_rush`, `route_race`, `reaction_pick`, and `voice_burst`, and Stage 10 gives `Name Tag Mixer`, `Map Route`, `Story Chain`, and `Scene Scan` a deeper showcase pass
  - Stage 9 keeps the arcade contract and Stage 10 keeps the same contract while tightening learning-value guardrails: `answerRevealMode`, `ambientSet`, and `celebrationVariant` are part of the authored game contract, while `interactionModel`, `spriteRefs`, `motionRules`, `hitBoxes`, `spawnTimeline`, `failWindowMs`, `rewardFx`, and `transitionFx` must drive real playfield interaction, feedback, and transitions
  - the showcase games should use game-specific board/sprite art where needed so they read like distinct scenes rather than the same arcade shell with different copy
  - current-12 arcade games show one metrics HUD only during active play; the outer Learn shell keeps navigation, unit context, stage progress, and attempt context only
  - current-12 arcade timers must stay trustworthy: an active stage should never visibly sit at `0:00`; once time expires, input locks and the stage resolves immediately
  - current-12 arcade decision states should use neutral pre-answer iconography and only reveal rationale after answer lock-in
  - `intermediate` and `advanced` remain on the authored Stage 3 board-first mechanic set for now
  - only 6 selected current-12 arcade games use speech overall: `Name Tag Mixer`, `Snack Counter`, `Story Chain`, `Scene Scan`, `Station Help`, and `Choice Showdown`
  - the current 12 arcade games show visible local score, combo, hearts, timer, and medal inside the game, but do not use global currency, XP, or leaderboards
  - current-12 arcade stage resolution should use a short stage-clear interstitial with medal, score delta, combo carry-over where applicable, one why-it-worked note, and one clear next-stage CTA
  - showcase `voice_burst` stages should keep mode choice and primary action in one compact decision area so the capstone reads like one move, not a tall form
  - all Learn games now share a baseline feel layer: targeted motion, basic game audio, neutral or themed ambient audio, animated stage swaps, and a compact completion celebration before the summary
  - voice-enabled arcade stages keep guaranteed fallback
  - game completion unlocks `speaking`
- Learn speaking activity as a structured `Speaking Mission`:
  - prep
  - short guided conversation
  - focused transcript review
  - optional retry
- Learn speaking live voice quality rules:
  - realtime voice should feel like a patient real person, not a fast interruption loop
  - brief acknowledgements, background speech, or unclear audio must trigger repair rather than normal progress
  - repair stays in simpler English and does not answer for the learner
- all four curriculum levels are fully hand-authored across all six required Learn activities
- unit speaking missions support:
  - default account access currently includes the Pro voice path in preview mode
  - text fallback remains available when voice is unavailable
- units `3` and `6` in each curriculum act as stronger speaking benchmarks inside Learn without affecting level assignment
- units `3` and `6` in all four curriculum levels are evidence-aware benchmark missions:
  - benchmark review is feedback-only
  - benchmark completion never changes `currentLevel`
  - benchmark follow-ups are driven by missing task evidence rather than static prompt rotation
  - `very_basic` benchmark missions require 4 learner turns and 1 substantive follow-up response before feedback unlocks
  - `basic` benchmark missions require 5 learner turns and 2 substantive follow-up responses before feedback unlocks
  - `intermediate` benchmark missions require 6 learner turns and 2 substantive follow-up responses before feedback unlocks
  - `advanced` benchmark missions require 7 learner turns and 3 substantive follow-up responses before feedback unlocks
- Teacher-provided lesson content pipeline (lessons, worksheets, videos) as canonical source
- Placeholder content library for pre-content MVP bootstrap
- Homework Help inside Tools
- Strong early class-context capture (syllabus upload or "what are you studying this week?"), but not as prime Home content
- Speak free-talk + guided scenarios with:
  - default account access currently includes the Pro voice path in preview mode
  - text fallback remains available when voice is unavailable
- Speak live voice should preserve one continuous human-feeling exchange:
  - quiet ambient-noise awareness
  - accepted-turn coaching only
  - repair-first handling for unclear turns
- Interactive conversation transcript (review, phrase save, vocab extraction)
- Progress with report history, overall trend timeline, per-skill trend views, and reassessment entry point
- Shareable progress artifacts (level card, improvement card, milestone card)
- Test Prep Sprint inside Tools (date/topic based focused plan + mini mock check)
- Subscription and billing flows
- Explicit free-tier usage limits and paywall triggers remain implemented, but they are temporarily suspended because all accounts are auto-provisioned on Pro

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
- No separate Games tab or standalone game route is introduced; game remains a required step inside the existing Learn unit flow.
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
4. Learn unit activity chain (`lesson` -> `practice` -> `game` -> `speaking mission` -> `writing` -> `checkpoint`)
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

Temporary preview-mode rule:
- all existing accounts are normalized to `pro`
- all new accounts are created on `pro`
- these limits remain documented for later billing reactivation, but they are not expected to gate users right now

- `speakTextTurnsPerDay`: 120
- `speakVoiceSecondsLifetimeTrial`: 180
- `homeworkUploadsPerDay`: 3
- `reassessmentsPer30Days`: 1
- `testPrepPlansPer30Days`: 2
