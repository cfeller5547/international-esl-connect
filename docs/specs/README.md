# ESL International Connect Documentation Hub

This folder is the implementation-ready documentation set for specification-driven development.

Primary product and architecture specs now live entirely in this folder.

This folder provides layered documents by audience.

## Document Map

### Non-technical stakeholder docs
- `00-executive-overview.md`
- `01-product-prd.md`
- `02-ux-architecture-and-flow.md`
- `03-visual-and-interaction-guidelines.md`

### Technical implementation docs
- `04-technical-architecture.md`
- `05-data-model.md`
- `06-api-contracts.md`
- `07-ai-assessment-and-reporting-spec.md`
- `08-non-functional-security-compliance.md`
- `12-screen-contracts.md`
- `13-ai-prompts-and-evals.md`
- `14-analytics-events.md`
- `11-theme-tokens-and-implementation.md`

### Delivery and execution docs
- `09-agent-implementation-runbook.md`
- `10-qa-acceptance-test-plan.md`
- `15-agent-handoff-guide.md`

## Recommended Reading Order

### For founders and non-technical collaborators
1. `00-executive-overview.md`
2. `01-product-prd.md`
3. `02-ux-architecture-and-flow.md`
4. `03-visual-and-interaction-guidelines.md`

### For engineers and coding agents
1. `15-agent-handoff-guide.md`
2. `01-product-prd.md`
3. `02-ux-architecture-and-flow.md`
4. `12-screen-contracts.md`
5. `03-visual-and-interaction-guidelines.md`
6. `11-theme-tokens-and-implementation.md`
7. `04-technical-architecture.md`
8. `05-data-model.md`
9. `06-api-contracts.md`
10. `07-ai-assessment-and-reporting-spec.md`
11. `13-ai-prompts-and-evals.md`
12. `14-analytics-events.md`
13. `08-non-functional-security-compliance.md`
14. `09-agent-implementation-runbook.md`
15. `10-qa-acceptance-test-plan.md`

## Source of Truth Policy

- Route architecture, user flows, and feature behavior are controlled by:
  - `01-product-prd.md`
  - `02-ux-architecture-and-flow.md`
  - `12-screen-contracts.md`
- Visual system is controlled by:
  - `03-visual-and-interaction-guidelines.md`
  - `11-theme-tokens-and-implementation.md`
- AI behavior is controlled by:
  - `07-ai-assessment-and-reporting-spec.md`
  - `13-ai-prompts-and-evals.md`
- Product analytics is controlled by:
  - `14-analytics-events.md`
- Content sourcing and contracts are controlled by:
  - `01-product-prd.md`
  - `04-technical-architecture.md`
  - `05-data-model.md`
  - `06-api-contracts.md`
- If conflicts appear between docs, resolve in this folder only.

## Change Management

When adding or changing any major behavior:
1. Update `01-product-prd.md` and `02-ux-architecture-and-flow.md`
2. Update `12-screen-contracts.md` if route-level UX behavior changes
3. Update technical contracts (`05` and `06`) if data/API changes
4. Update AI contracts (`07` and `13`) for prompt/scoring behavior changes
5. Update analytics contract (`14`) for instrumentation or KPI changes
6. Update content contracts (`04`, `05`, `06`) if content source/ingestion changes
7. Update visual/theme docs (`03` and `11`) if UI system changes
8. Update runbook (`09`) and test plan (`10`)
9. Update the handoff guide (`15`) if collaboration flow, startup context, or project invariants change
