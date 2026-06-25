## Runtime Logo Set

This folder contains only the logo files the app currently uses.

Important:
- The app does not render assets from this folder directly.
- The runtime source remains `public/brand/*`.
- These files are a curated copy so it is easy to see which logo assets are actually required.

## Files

### `logo-lockup-color.svg`
- Runtime file: `public/brand/logo-lockup-color.svg`
- Used by: `src/components/ui-kit/logo.tsx`
- Rendered as: the default full lockup logo on light backgrounds
- Current surfaces:
  - authenticated app shell
  - public landing/auth layouts
  - pre-signup stepper

### `logo-lockup-on-primary.svg`
- Runtime file: `public/brand/logo-lockup-on-primary.svg`
- Used by: `src/components/ui-kit/logo.tsx`
- Rendered as: the full lockup logo for primary/darker colored backgrounds when `variant="onPrimary"`

### `logo-icon-color.svg`
- Runtime file: `public/brand/logo-icon-color.svg`
- Used by: `src/components/ui-kit/logo.tsx`
- Rendered as: the standalone icon mark when `kind="icon"`

### `logo-icon-favicon.svg`
- Runtime file: `public/brand/logo-icon-favicon.svg`
- Used by: `src/app/layout.tsx`
- Rendered as: the app icon / favicon in Next metadata

## Current Source References

- `src/components/ui-kit/logo.tsx`
- `src/app/layout.tsx`
- `src/components/ui-kit/app-shell.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(public)/page.tsx`
- `src/components/ui-kit/pre-signup-stepper.tsx`

## Note

If you want to remove unused logo clutter later, `logo/` can be reduced around this set, while keeping `public/brand/*` intact for the actual app runtime.
