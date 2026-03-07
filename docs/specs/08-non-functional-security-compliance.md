# Non-Functional, Security, and Compliance Requirements

## 1. Performance Targets

UI targets:
- Core route load under 2.5s on typical broadband
- First interactive action under 3.0s on mid-tier mobile

Service targets:
- API p95 latency under 500ms for standard endpoints
- report generation p95 under 4s for normal load
- homework quick-help time-to-first-useful-response:
  - p50 <= 15s
  - p95 <= 30s
- homework parsing lifecycle:
  - p95 <= 20s for text PDFs
  - p95 <= 35s for image/PDF OCR flows

## 2. Reliability Targets

- graceful error handling for all critical workflows
- automatic retry strategy for transient AI/API failures
- autosave for in-progress onboarding and homework sessions
- preserved `returnTo` context after paywall or auth interruption
- parse pipeline must expose explicit status (`extracting_text`, `segmenting_questions`, `parsed`, `needs_review`, `failed`)

## 3. Accessibility Targets

Minimum:
- WCAG 2.2 AA
- keyboard navigation support
- semantic headings and labels
- transcripts/captions for audio outputs

## 4. Security Requirements

Data protection:
- TLS in transit
- encryption at rest
- principle of least privilege for service access

Auth:
- secure password hashing
- CSRF and session hardening
- brute-force and abuse protections on auth endpoints

File handling:
- virus/malware scanning pipeline for uploads
- type validation and size limits

## 5. Privacy Requirements

Data minimization:
- collect only required student learning data
- avoid unnecessary long-term raw audio retention

User control:
- clear data retention policy
- deletion request capability
- export capability for user reports/history
- share cards must be explicit opt-in and redact sensitive raw content by default

## 6. Compliance Baseline (MVP)

MVP audience:
- 13+ direct signup

Compliance trajectory:
- architecture should stay FERPA/COPPA-ready
- no targeted ad-tracker behavior in student product
- clear privacy policy and terms references in product

## 7. Observability and Auditability

Must log:
- onboarding progression events
- assessment attempts and completions
- report generation lifecycle
- homework help session lifecycle
- upgrade and billing transitions
- free-tier to voice-upgrade gating outcomes
- test-prep plan creation and completion
- share-card generation lifecycle
- content import lifecycle and content-source selection events
- streak update and milestone emission lifecycle

Sensitive logs:
- never log secrets
- avoid logging full student submitted content when not required

## 8. Operational Readiness Checklist

Before production:
1. Secrets management configured
2. Environment parity across staging/production
3. Error and latency dashboards in place
4. Alert routing configured
5. Incident playbook for AI dependency outage
6. AI cost guardrails configured (voice quota, per-tier limits, fallback behavior)

## 9. Cost and Tier Guardrails

1. Free tier Speak default: text interaction with optional AI audio playback.
2. Pro tier unlocks full voice input and pronunciation scoring.
3. Voice usage must be metered by tier with hard and soft limits.
4. When limits are reached:
   - preserve user context
   - offer upgrade
   - provide text-mode fallback path.
5. Free tier limits (MVP fixed values):
   - `speakTextTurnsPerDay`: 120
   - `speakVoiceSecondsLifetimeTrial`: 180
   - `homeworkUploadsPerDay`: 3
   - `reassessmentsPer30Days`: 1
   - `testPrepPlansPer30Days`: 2
6. Limit events must fire with machine-readable limit keys for paywall logic.

## 10. Homework Parse Quality Guardrails

1. OCR/text extraction + segmentation confidence must be captured as `parse_confidence`.
2. If `parse_confidence < 0.65`, set `needs_review` and require manual review fallback.
3. If extraction fails entirely, return parse error code and preserve retry path.
