# ESL International Connect — Logo Integration Guide

## Overview

This package contains all production-ready SVG assets for the "Global Flow" logo mark. Every color used is from the locked palette defined in the project's theme tokens. No off-palette colors are used anywhere.

**Concept:** Three orbital paths form an abstract globe — each orbit a language or culture in motion. A warm accent node breaks the symmetry as a progress marker.

**Typography:** The wordmark pairs **Cormorant Garamond** (serif, semibold) for "ESL" with **Outfit** (sans, regular, uppercased, wide tracking) for "INTERNATIONAL CONNECT".

---

## File Structure

```
brand-assets/
├── LOGO-GUIDE.md              ← this file
└── svg/
    ├── icon/
    │   ├── logo-icon-color.svg       ← full-color mark, light backgrounds
    │   ├── logo-icon-dark.svg        ← full-color mark, dark backgrounds
    │   └── logo-icon-favicon.svg     ← simplified, optimized for 16–32px
    ├── lockup/
    │   ├── logo-lockup-color.svg     ← icon + wordmark, light backgrounds
    │   ├── logo-lockup-dark.svg      ← icon + wordmark, dark backgrounds
    │   └── logo-lockup-on-primary.svg← icon + wordmark, on Primary bg
    └── monochrome/
        ├── logo-mono-dark.svg        ← single-color Text (#0F172A) on light
        └── logo-mono-light.svg       ← single-color Background (#F8FAFC) on dark
```

---

## Color Mapping (Locked Palette Only)

Every stroke and fill maps to an official token:

| SVG Color   | Token Name           | Hex       | Usage in Logo                          |
|-------------|----------------------|-----------|----------------------------------------|
| `#1F4E79`   | `--primary`          | Primary   | Outer ring, inner meridian orbit       |
| `#2A9D8F`   | `--secondary`        | Secondary | Tilted orbit, equator line             |
| `#F4A261`   | `--accent`           | Accent    | Node / progress marker                 |
| `#0F172A`   | `--foreground`       | Text      | Wordmark "ESL", mono icon on light     |
| `#64748B`   | `--muted-foreground` | Muted     | Wordmark "INTERNATIONAL CONNECT"       |
| `#F8FAFC`   | `--background`       | Background| Dark-mode strokes, mono icon on dark   |
| `#FFFFFF`   | `--primary-foreground`| Surface  | On-primary variant strokes & text      |

**No other hex values are used.** Dark variants use `#F8FAFC` (Background) and `#2A9D8F` (Secondary) at reduced opacity — never invented lighter/darker shades.

---

## Required Fonts

Add these to your `<head>` or Next.js font config:

```
Cormorant Garamond — weights: 600
Outfit — weights: 400
```

### Next.js (`app/layout.tsx`):

```tsx
import { Cormorant_Garamond, Outfit } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-cormorant',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-outfit',
  display: 'swap',
});

// Add to <body className={`${cormorant.variable} ${outfit.variable}`}>
```

### Tailwind config extension:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        'brand-serif': ['var(--font-cormorant)', 'Georgia', 'serif'],
        'brand-sans': ['var(--font-outfit)', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
};
```

---

## Integration Patterns

### 1. Inline SVG React Component

Create `components/ui/logo.tsx`:

```tsx
import { cn } from '@/lib/utils';

type LogoVariant = 'color' | 'dark' | 'on-primary';
type LogoType = 'icon' | 'lockup';

interface LogoProps {
  type?: LogoType;
  variant?: LogoVariant;
  className?: string;
  size?: number;
}

export function Logo({
  type = 'icon',
  variant = 'color',
  className,
  size,
}: LogoProps) {
  if (type === 'icon') return <LogoIcon variant={variant} className={className} size={size} />;
  return <LogoLockup variant={variant} className={className} />;
}

function LogoIcon({
  variant = 'color',
  className,
  size = 40,
}: {
  variant?: LogoVariant;
  className?: string;
  size?: number;
}) {
  const colors = {
    color: {
      ring: '#1F4E79',        // --primary
      ringOpacity: 1,
      orbit1: '#2A9D8F',      // --secondary
      orbit1Opacity: 0.6,
      orbit2: '#1F4E79',      // --primary
      orbit2Opacity: 0.35,
      equator: '#2A9D8F',     // --secondary
      equatorOpacity: 0.2,
      node: '#F4A261',        // --accent
    },
    dark: {
      ring: '#F8FAFC',        // --background
      ringOpacity: 0.7,
      orbit1: '#2A9D8F',      // --secondary
      orbit1Opacity: 0.5,
      orbit2: '#F8FAFC',      // --background
      orbit2Opacity: 0.2,
      equator: '#2A9D8F',     // --secondary
      equatorOpacity: 0.15,
      node: '#F4A261',        // --accent
    },
    'on-primary': {
      ring: '#FFFFFF',         // --primary-foreground
      ringOpacity: 0.85,
      orbit1: '#FFFFFF',
      orbit1Opacity: 0.3,
      orbit2: '#FFFFFF',
      orbit2Opacity: 0.18,
      equator: '#FFFFFF',
      equatorOpacity: 0.12,
      node: '#F4A261',        // --accent
    },
  };

  const c = colors[variant];

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="ESL International Connect"
      role="img"
    >
      <defs>
        <clipPath id="globe-clip">
          <circle cx="50" cy="50" r="42" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="38" fill="none" stroke={c.ring} strokeWidth="3" opacity={c.ringOpacity} />
      <ellipse cx="50" cy="50" rx="38" ry="14" fill="none" stroke={c.orbit1} strokeWidth="2.5" opacity={c.orbit1Opacity} transform="rotate(-25 50 50)" clipPath="url(#globe-clip)" />
      <ellipse cx="50" cy="50" rx="14" ry="38" fill="none" stroke={c.orbit2} strokeWidth="2.5" opacity={c.orbit2Opacity} transform="rotate(-25 50 50)" clipPath="url(#globe-clip)" />
      <ellipse cx="50" cy="50" rx="38" ry="5.5" fill="none" stroke={c.equator} strokeWidth="1.3" opacity={c.equatorOpacity} transform="rotate(8 50 50)" clipPath="url(#globe-clip)" />
      <circle cx="80" cy="26" r="7.5" fill={c.node} />
    </svg>
  );
}

function LogoLockup({
  variant = 'color',
  className,
}: {
  variant?: LogoVariant;
  className?: string;
}) {
  const text = {
    color: { brand: '#0F172A', sub: '#64748B', subOpacity: 1 },         // --foreground, --muted-foreground
    dark: { brand: '#F8FAFC', sub: '#64748B', subOpacity: 1 },          // --background, --muted-foreground
    'on-primary': { brand: '#FFFFFF', sub: '#F8FAFC', subOpacity: 0.6 }, // --primary-foreground, --background
  };

  const t = text[variant];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoIcon variant={variant} size={40} />
      <div className="flex flex-col gap-0.5">
        <span
          className="font-brand-serif text-[22px] font-bold leading-none"
          style={{ color: t.brand, letterSpacing: '1px' }}
        >
          ESL
        </span>
        <span
          className="font-brand-sans text-[13px] font-medium uppercase leading-none"
          style={{ color: t.sub, letterSpacing: '2px', opacity: t.subOpacity }}
        >
          International Connect
        </span>
      </div>
    </div>
  );
}
```

**Key proportion rules for the lockup:**
- The icon and the two text lines should be vertically centered and span the icon's full height
- "ESL" = `text-[22px]` / `font-bold` (700) / Cormorant Garamond / LS 1px
- "INTERNATIONAL CONNECT" = `text-[13px]` / `font-medium` (500) / Outfit / uppercase / LS 2px
- Icon size in lockup = 40px (matches ~64px navbar height with padding)
- Gap between icon and text = `gap-3` (12px)

**Lockup SVG viewBox:** `0 0 440 80`. "ESL" at 34px/700 (y=33), "INTERNATIONAL CONNECT" at 18px/500 (y=60). Both text lines together span the icon's full 64-unit height.

### 2. Usage Examples

```tsx
// Navbar — light background
<Logo type="lockup" variant="color" />

// Navbar — dark background
<Logo type="lockup" variant="dark" />

// Hero banner with bg-primary
<Logo type="lockup" variant="on-primary" />

// Favicon / mobile tab bar
<Logo type="icon" variant="color" size={24} />

// Footer on dark section
<Logo type="icon" variant="dark" size={32} />
```

### 3. Static SVG Import (alternative)

If you prefer static file imports over inline SVGs:

```tsx
import LogoColor from '@/assets/svg/icon/logo-icon-color.svg';
import LogoLockup from '@/assets/svg/lockup/logo-lockup-color.svg';

// Use with next/image or as component (requires SVGR or similar)
<Image src={LogoColor} alt="ESL International Connect" width={40} height={40} />
```

### 4. Favicon Setup

Use `logo-icon-favicon.svg` for the simplified favicon. In `app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  icons: {
    icon: '/favicon.svg',
  },
};
```

Copy `logo-icon-favicon.svg` → `public/favicon.svg`.

For maximum browser compatibility, also generate a `.ico` from the favicon SVG at 16x16, 32x32, and 48x48.

**Lockup SVG viewBox:** `0 0 420 80` — tighter aspect ratio, text and icon vertically balanced within the 80-unit height. "ESL" at 30px font-size (y=35), "INTERNATIONAL CONNECT" at 15px/weight-500 (y=58). Both text lines span the icon's vertical extent.

---

## Variant Selection Guide

| Context                              | File / Variant         | Background Token   |
|--------------------------------------|------------------------|--------------------|
| Nav bar (default light)              | `lockup-color`         | `--background`     |
| Nav bar (dark mode)                  | `lockup-dark`          | `--foreground`     |
| Hero / CTA with `bg-primary`        | `lockup-on-primary`    | `--primary`        |
| App icon / tab bar                   | `icon-color`           | `--background`     |
| Favicon                              | `icon-favicon`         | Any                |
| Loading spinner / watermark (light)  | `mono-dark`            | `--background`     |
| Loading spinner / watermark (dark)   | `mono-light`           | `--foreground`     |
| Print / fax / single-color contexts  | `mono-dark`            | White paper        |

---

## Clear Space & Minimum Size

- **Clear space:** Maintain padding equal to the accent node diameter (≈15% of icon width) on all sides.
- **Minimum icon size:** 16px (use `logo-icon-favicon.svg` at this size).
- **Minimum lockup width:** 160px.
- **Never** rotate, skew, recolor, or add effects (drop shadow, glow) to the logo.

---

## Do / Don't

**Do:**
- Use the correct variant for the background color
- Maintain clear space around the mark
- Use the provided React component for consistent rendering
- Reference only locked palette tokens — no custom colors

**Don't:**
- Stretch or distort the aspect ratio
- Place the color variant on dark backgrounds (use `dark` or `on-primary`)
- Add outlines, shadows, or gradients
- Swap the accent node color
- Use the lockup below 160px width — switch to icon-only
- Introduce any hex value not in the locked palette
