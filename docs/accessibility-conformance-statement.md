# Accessibility Conformance Statement

## Target conformance level

This project targets **WCAG 2.1 Level AA** for the ILN Frontend application.

## What has been verified

### Automated verification

- Unit and component tests for accessibility behaviors are present under `__tests__/accessibility/`.
- `dark-mode-tokens.test.ts` verifies dark-mode color tokens and contrast token selection for status indicators.
- Linting and CI workflows run on pull requests.

### Manual verification

- Screen-reader passes have been documented in `docs/screen-reader-testing-guide.md`.
- Toast and notification accessibility were audited in `docs/accessibility-audit-toast-notifications.md` and implemented in `docs/accessibility-implementation-summary.md`.
- Keyboard navigation and focus-management checks were performed for core flows including toast notifications, forms, and modal interactions.

## How verification was performed

- Playwright E2E smoke tests cover core journeys (`e2e/testnet-smoke.spec.ts`, `e2e/governance-live.spec.ts`).
- Vitest is used for component and unit coverage.
- Accessibility-focused test suites cover toast announcements, notification center behavior, and missing-route handling.

## Known limitations

- RTL readiness is not yet verified end-to-end; see `docs/i18n.md` for the current RTL assessment and follow-up work.
- Some chart and visual components rely on color alone in places; supplementary text or patterns are recommended where feasible.
- Full WCAG 2.1 AA conformance is a target, not a certified claim. Independent third-party audit is still recommended before public conformance certification.

## Related documentation

- `docs/accessibility-audit-toast-notifications.md`
- `docs/accessibility-implementation-summary.md`
- `docs/screen-reader-testing-guide.md`
- `docs/i18n.md`

## Community feedback

If you identify an accessibility barrier, please open an issue with the label `accessibility` so it can be triaged and addressed.