# Theme Tokens and Implementation (Next.js + Tailwind + shadcn)

## 1. Locked Palette

Official palette (Option 1):
- Primary: `#1F4E79`
- Secondary: `#2A9D8F`
- Accent: `#F4A261`
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text: `#0F172A`
- Muted Text: `#64748B`
- Border: `#E2E8F0`

Status:
- Success: `#16A34A`
- Warning: `#D97706`
- Error: `#DC2626`
- Info: `#2563EB`

## 2. shadcn Semantic Token Mapping

Map palette to shadcn-style semantic variables:
- `--background` -> Background
- `--foreground` -> Text
- `--card` -> Surface
- `--card-foreground` -> Text
- `--popover` -> Surface
- `--popover-foreground` -> Text
- `--primary` -> Primary
- `--primary-foreground` -> `#FFFFFF`
- `--secondary` -> Secondary
- `--secondary-foreground` -> `#FFFFFF`
- `--accent` -> Accent
- `--accent-foreground` -> Text
- `--muted` -> `#F1F5F9` (derived neutral surface-2)
- `--muted-foreground` -> Muted Text
- `--border` -> Border
- `--input` -> Border
- `--ring` -> Secondary
- `--destructive` -> Error
- `--destructive-foreground` -> `#FFFFFF`

## 3. Example `app/globals.css` Tokens

```css
:root {
  --background: 210 40% 98%;        /* #F8FAFC */
  --foreground: 222 47% 11%;        /* #0F172A */

  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 222 47% 11%;   /* #0F172A */

  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;

  --primary: 208 59% 30%;           /* #1F4E79 */
  --primary-foreground: 0 0% 100%;

  --secondary: 173 58% 39%;         /* #2A9D8F */
  --secondary-foreground: 0 0% 100%;

  --accent: 27 87% 67%;             /* #F4A261 */
  --accent-foreground: 222 47% 11%;

  --muted: 210 40% 96%;             /* #F1F5F9 */
  --muted-foreground: 215 16% 47%;  /* #64748B */

  --destructive: 0 73% 51%;         /* #DC2626 */
  --destructive-foreground: 0 0% 100%;

  --border: 214 32% 91%;            /* #E2E8F0 */
  --input: 214 32% 91%;
  --ring: 173 58% 39%;              /* #2A9D8F */

  --radius: 0.75rem;
}
```

## 4. Tailwind Usage Rules

Use semantic classes:
- `bg-background`, `text-foreground`
- `bg-card`, `text-card-foreground`
- `bg-primary`, `text-primary-foreground`
- `bg-secondary`, `text-secondary-foreground`
- `bg-accent`, `text-accent-foreground`
- `border-border`

Avoid:
- direct feature-level hex classes (for example `bg-[#1F4E79]`) in product components.

## 5. shadcn Component Usage Guidance

Recommended component color intent:
- Primary action button: `variant="default"` -> primary
- Secondary utility button: `variant="secondary"` -> secondary
- Conversion CTA: custom `accent` variant (defined once in UI kit)
- Destructive action: `variant="destructive"` -> error color

## 6. QA Theme Checklist

Before release:
1. Confirm no non-token hex colors in feature components.
2. Confirm contrast for body text and button text.
3. Confirm status colors used only for status semantics.
4. Confirm nav active states use Primary consistently.

