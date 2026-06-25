# Speak Tutor Implementation Notes

## Summary

Guided Speak missions now use a built-in code-native AI tutor orb named `Maya`.

Current runtime approach:
- no external portrait asset pack is required
- the tutor is rendered directly in code as an animated orb surface
- animation is driven by state plus light motion primitives:
  - idle breathing pulse
  - orbiting particles
  - speaking-reactive energy changes
  - subtle mesh-like ring motion
  - state color shifts for listening, thinking, repair, and success

This replaced the earlier human-avatar attempts because the code-native human character did not achieve the required quality bar.

## Current Product Contract

On guided Speak missions:
- `Maya` lives in a persistent left-side tutor rail on desktop
- `Maya` moves into a compact tutor strip above the control rail on smaller screens
- the tutor and the in-scene counterpart are separate roles
- the tutor owns:
  - hints
  - repair nudges
  - success nudges
  - short active-guide prompts
- the counterpart owns the role-play exchange inside the mission scene

## Current Technical Approach

Core files:
- `src/features/speak/coach-avatar-rail.tsx`
- `src/features/speak/coach-avatar-config.ts`
- `src/features/speak/use-avatar-lipsync.ts`

The tutor rail currently uses:
- a code-native animated orb
- persona-driven color configuration
- `useAvatarLipsync()` as a simple speaking-energy signal
- Framer Motion for idle presence, ring drift, and reactive pulse states
- one orb surface for all tutor states instead of a human face or asset pack

## Why This Is The Default

This approach is the current default because it is:
- reliable
- easy to ship in the existing Next.js stack
- visually cleaner than a low-quality code-drawn human tutor
- reusable across future `Home`, `Learn`, `Tools`, and `Progress` surfaces

It is less human than a rendered avatar, but it is much more credible than an uncanny or low-fidelity character attempt.

## Future Upgrade Path

If a higher-fidelity tutor is needed later, the likely next step is:
- a rendered portrait-state pack or a Rive-based avatar
- still keeping the same tutor-rail layout and role separation

That future upgrade is optional. The current product should assume the built-in animated orb is the canonical implementation.
