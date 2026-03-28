# Visual and Interaction Guidelines

## 1. Visual Direction

Design goals:
- Clean
- Elegant
- Professional
- Minimal
- Consistent

The app should feel credible for both high school and college users.

## 2. Design Tokens (Initial)

### Color system (locked palette: Option 1)

This palette is the official app palette and should be treated as design contract.

Core colors:
- Primary: `#1F4E79` (Academic Blue)
- Secondary: `#2A9D8F` (Teal)
- Accent / CTA: `#F4A261` (Warm Amber)
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text: `#0F172A`
- Muted Text: `#64748B`
- Border: `#E2E8F0`

Status colors:
- Success: `#16A34A`
- Warning: `#D97706`
- Error: `#DC2626`
- Info: `#2563EB`

Role mapping:
- Primary buttons and active nav: Primary
- Secondary emphasis and highlights: Secondary
- Conversion CTAs and key prompts: Accent
- Base app canvas: Background
- Cards/modals/inputs: Surface
- Main copy: Text
- Supporting labels and helper text: Muted Text
- Dividers and control outlines: Border

### Typography
- One modern sans-serif family
- Clear scale for:
  - Display
  - Heading
  - Body
  - Caption

### Spacing
- 8px base scale
- Consistent card and section rhythm

## 3. Interaction Principles

1. One primary action per screen
2. Immediate feedback for user actions
3. No punitive language for mistakes
4. Predictable component behavior across contexts
5. Preserve context after any interruption (auth, paywall, refresh)

Navigation hierarchy:
- `Learn` should only surface the assigned curriculum and its next required activity.
- There is no separate Games tab or standalone game area outside Learn.
- `Tools` should house Homework Help and Test Prep Sprint.
- Profile, Settings, Billing, and Help should stay in the account menu, not the primary nav.

## 4. Component Behavior Standards

### Buttons
- Primary: one per section
- Secondary: supportive actions only
- Disabled states must explain why action is disabled
- Primary button colors:
  - bg: Primary
  - text: white
- Accent CTA colors (for selective conversion moments):
  - bg: Accent
  - text: Text

### Cards
- Must have:
  - clear title
  - concise purpose text
  - single primary action
- Card visual contract:
  - bg: Surface
  - border: Border
  - default text: Text
  - metadata text: Muted Text

### Forms
- Inline validation
- Plain-language error messages
- Preserve typed input on recoverable failures

### Steppers
- Show current step, total steps, and completion status
- Allow backward navigation without data loss
- Use distinct current vs completed styling
- Pre-signup stepper should show the full persisted path:
  - Profile
  - Full diagnostic
  - Signup

## 5. Progress Visualization Standards

Progress library should use one clear hierarchy:
1. Overall score over time as the primary chart
2. Selected-report summary beside or below the chart
3. Per-skill trends as lightweight secondary visuals

Overall timeline rules:
- prefer a single line chart with clickable report points
- allow a simple range switch such as `Last 90 days` and `All time`
- highlight milestone report types without forcing legend-heavy decoding
- avoid multi-line charts that make users compare six skills in one dense plot

For each skill visualization:
- score number
- comparable visual (bar/ring/sparkline)
- directionality when compared to previous report or visible range baseline
- short interpretation text

Avoid charts that require legend lookup to understand improvement.
Avoid equal visual weight between overall trend and per-skill detail.

## 6. Voice Interaction UX

- Mic-first controls should always have text fallback
- Display live transcript where possible
- Show clear listening/speaking states
- Handle mic permission denial gracefully
- Realtime voice status should use a compact shared state set:
  - `Listening`
  - `Still listening`
  - `Thinking`
  - `Speaking`
  - `Didn't catch that`
  - `Noisy room`
- Show one quiet ambient-noise badge during active voice sessions.
- Keep repair notices in-line with the transcript and anchor the last valid question when the learner needs to try again.
- Accepted-turn coaching should be visually quieter than the AI reply; rejected-turn repair should be distinct from normal coaching.

### 6.1 Learn Game Treatment

- The Learn game step should feel more authored and visually distinct than the rest of the curriculum flow.
- Use the game `theme` and `layoutVariant` to drive a stronger visual hierarchy, not just a different title.
- Surface authored board metadata so the game reads like a designed learning moment, not a plain quiz card.
- During active play, the game should use a compact in-flow progress strip instead of the full large Learn activity header.
- Keep the richer unit header only for the game `brief` and `summary` phases.
- The current `very_basic`, `basic`, `intermediate`, and `advanced` games should rely primarily on tap-first mechanics:
  - `assemble`
  - `spotlight`
  - `state_switch`
  - `priority_board`
- The current `very_basic` and `basic` games should use richer Stage 4 layout variants where appropriate:
  - `slot_strip`
  - `dialogue_pick`
  - `voice_focus`
  - `planner_dense`
  - `scene_focus`
  - `map_focus`
- On pointer devices, slot-and-board stages may add drag-and-drop as an enhancement, but tap/select must remain the canonical path for touch, keyboard, and accessibility coverage.
- Do not let every game collapse back to a repeated `quiz card + CTA` rhythm. The board, helper copy, and interaction should change with the game kind.
- Keep the dominant action clear even when the visual treatment is richer.
- Use voice only on stages where it materially helps the learning task; do not force voice chrome across every stage.
- On voice-enabled game stages, `Say it` and `Quick backup` should both be visible at the top of the board. Backup must not look like a degraded path.
- Stage-complete feedback should feel resolved and specific:
  - compact success pulse
  - one short coaching note
  - one clear next-stage CTA

## 7. Home Screen Hierarchy Contract

- Primary card: full-width, top priority
- Urgent action: a persistent but visually subordinate `Homework Help now` action in the same zone as the primary card
- Support strip: one compact row for current focus and learning rhythm
- Secondary row: 1-2 compact fast actions that do not duplicate the primary recommendation
- Collapsible informational content: lower visual weight and tucked below the fold
- Class-context setup should not sit as a large always-open form on Home

## 8. Copy and Tone Guidelines

Tone:
- Supportive
- Specific
- Direct
- Non-judgmental

Home copy rules:
- no meta-product labels like `Primary next step`
- one short recommendation title
- one short reason sentence
- secondary actions should stay one line and action-oriented

Use:
- "Try this next"
- "You improved in listening"
- "Focus on tense agreement in this sentence"

Avoid:
- "Wrong"
- "Fail"
- vague generic praise with no coaching value

## 9. Motion Guidelines

Use subtle motion for:
- transitions between chained activities
- completion confirmations
- report score reveals
- milestone celebrations (short and meaningful)

Do not use decorative motion that competes with content.

## 10. Positive Reinforcement Standards

Required celebration triggers:
1. full diagnostic completed
2. report unlocked after signup
3. first conversation completed
4. streak milestones
5. level-up and meaningful score improvements

Each trigger should include:
- one-line achievement statement
- short visual reward treatment (<= 1.2s)
- clear next action CTA
- optional `Share` action when applicable

## 11. Shareable Card Standards

Supported card types:
- level card
- conversation milestone card
- improvement card
- level-up card

Design constraints:
- clean static export format (portrait and square)
- score and context clarity at a glance
- no private raw transcript content on share cards
- explicit user confirmation before share/export

## 12. Theme Consistency Rules

1. Do not introduce new hex colors in feature code without updating token docs.
2. Do not use status colors for brand CTAs.
3. Keep contrast standards for all text/interactive combinations.
4. Use the same semantic token names across design and code.
