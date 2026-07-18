---
version: "1.0"
name: dhrubok-design-system
description: >
  Design system for Dhrubok Portal — a bilingual (Bangla / English) coaching
  management platform. Clean, operational aesthetic for dense data tables,
  financial clarity, rapid attendance entry, and printable receipts.

colors:
  # ── Brand ──────────────────────────────────────────────────────────────
  brand: "#3ecf8e"
  brand-deep: "#24b47e"
  brand-soft: "#a7f3d0"
  brand-muted: "#ecfdf5"

  # ── Semantic ───────────────────────────────────────────────────────────
  success: "#16a34a"
  success-deep: "#15803d"
  success-soft: "#dcfce7"
  success-muted: "#f0fdf4"
  warning: "#d97706"
  warning-deep: "#b45309"
  warning-soft: "#fef3c7"
  warning-muted: "#fffbeb"
  danger: "#dc2626"
  danger-deep: "#b91c1c"
  danger-soft: "#fee2e2"
  danger-muted: "#fef2f2"
  info: "#2563eb"
  info-deep: "#1d4ed8"
  info-soft: "#dbeafe"
  info-muted: "#eff6ff"

  # ── Text ───────────────────────────────────────────────────────────────
  ink: "#171717"
  ink-secondary: "#404040"
  ink-mute: "#737373"
  ink-faint: "#a3a3a3"
  ink-disabled: "#d4d4d4"
  on-brand: "#171717"
  on-dark: "#fafafa"
  on-success: "#ffffff"
  on-warning: "#171717"
  on-danger: "#ffffff"
  on-info: "#ffffff"

  # ── Surface ────────────────────────────────────────────────────────────
  canvas: "#ffffff"
  canvas-soft: "#fafafa"
  canvas-subtle: "#f5f5f5"
  canvas-dark: "#171717"
  canvas-dark-soft: "#262626"

  # ── Border ─────────────────────────────────────────────────────────────
  border: "#e5e5e5"
  border-strong: "#d4d4d4"
  border-muted: "#f0f0f0"
  border-focus: "#3ecf8e"
  border-danger: "#dc2626"

typography:
  display-xxl:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.4px
  display-xl:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 42px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -1.05px
  display-lg:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.64px
  display-md:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.36px
  heading-lg:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  heading-md:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body-lg:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  label-md:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  label-sm:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption:
    fontFamily: "Inter, 'Noto Sans Bengali', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  mono:
    fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  mono-sm:
    fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px

elevation:
  0: "none"
  1: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
  2: "0 4px 12px rgba(0,0,0,0.08)"
  3: "0 12px 32px rgba(0,0,0,0.12)"

breakpoints:
  sm: 640px
  md: 768px
  lg: 1024px
  xl: 1280px
---

## Overview

Dhrubok Portal is a bilingual coaching management system serving one coaching
centre. The design system prioritises **operational clarity**, **financial
precision**, **rapid data entry**, and **bilingual readability** (Bangla and
English). The aesthetic is clean and restrained — white canvas, near-black
typography, minimal chrome — with colour reserved for semantic meaning: status
indicators, financial states, and actionable CTAs. The interface must feel
reliable, modern, and fast. It must never feel decorative or ambiguous.

The system serves four distinct product surfaces that share the same tokens but
apply them at different densities:

- **Public website** — spacious, editorial, emerald CTAs, real portal
  screenshots as social proof.
- **Owner portal** — compact data tables, financial dashboards, strong global
  search, rich filtering.
- **Teacher portal** — session-oriented, quick attendance and marks entry,
  focused on assigned batches.
- **Student portal** — calmer, card-based, personal schedule, attendance, fees,
  results.
- **Print surfaces** — monochrome, A4-optimised, deterministic layout.

---

## Design Principles

1. **Semantic colour over decorative colour.** Every non-greyscale colour
   communicates a specific meaning: success, warning, danger, info, or brand
   action. Never use colour for decoration in operational flows.

2. **Bangla-first, bilingual-always.** Bangla is the default locale. Typography,
   line-heights, and vertical spacing must be tested in Bangla first. English
   layout must not break when Bangla text is substituted and vice versa.

3. **One-action clarity.** Every screen has a clear primary action. Avoid
   competing primary buttons within the same panel or decision point. Secondary
   and tertiary actions are visually subordinate.

4. **Data density without clutter.** Portal screens show data-dense tables,
   summaries, and forms. Use whitespace and hairline borders to separate
   content — never background fills, gradients, or decorative dividers.

5. **Irreversible actions feel irreversible.** Attendance submission, payment
   posting, and result publication use visually stronger confirmation than
   ordinary saves. The confirmation must state what happens, what cannot be
   undone, and any side-effects (SMS, financial changes).

6. **Touch-ready everywhere.** All interactive elements must meet 44×44 CSS
   pixel minimum on mobile. Attendance marking and payment entry are phone-first
   workflows.

7. **Print is a first-class surface.** Receipts and reports must produce clean
   A4 output with no dependency on screen styles, colour, or interactive
   elements.

8. **No decorative animation.** Transitions may be used for state changes
   (loading → success) and micro-feedback (hover, focus), but never for
   aesthetic flair in operational flows.

---

## Colours

### Brand

`{colors.brand}` (#3ecf8e) is Dhrubok's signature emerald. It appears on
primary CTAs, the logo accent, and active navigation indicators. It is **not**
used for success/status indication — that role belongs to `{colors.success}`.

| Token         | Hex     | Use                                                 |
| ------------- | ------- | --------------------------------------------------- |
| `brand`       | #3ecf8e | Primary CTA fill, logo accent, active nav indicator |
| `brand-deep`  | #24b47e | CTA hover / pressed state                           |
| `brand-soft`  | #a7f3d0 | Light brand tint on selected rows, active tab bg    |
| `brand-muted` | #ecfdf5 | Subtle brand wash on highlighted cards              |

### Semantic

Semantic colours communicate operational state. They are system colours — they
never appear merely as decoration.

| Token                            | Hex               | States                                                        |
| -------------------------------- | ----------------- | ------------------------------------------------------------- |
| `success` / `success-deep`       | #16a34a / #15803d | Present, paid, active, accepted, delivered                    |
| `success-soft` / `success-muted` | #dcfce7 / #f0fdf4 | Badge bg, row highlight, soft indicator                       |
| `warning` / `warning-deep`       | #d97706 / #b45309 | Late, due soon, pending review, under review                  |
| `warning-soft` / `warning-muted` | #fef3c7 / #fffbeb | Badge bg, row highlight                                       |
| `danger` / `danger-deep`         | #dc2626 / #b91c1c | Absent, overdue, failed, rejected, voided, destructive action |
| `danger-soft` / `danger-muted`   | #fee2e2 / #fef2f2 | Badge bg, row highlight                                       |
| `info` / `info-deep`             | #2563eb / #1d4ed8 | Published, informational, new, queued                         |
| `info-soft` / `info-muted`       | #dbeafe / #eff6ff | Badge bg, row highlight                                       |

### Semantic mapping for Dhrubok domain states

| Domain     | State             | Colour                      |
| ---------- | ----------------- | --------------------------- |
| Attendance | Present           | `success`                   |
| Attendance | Late              | `warning`                   |
| Attendance | Absent            | `danger`                    |
| Finance    | Paid              | `success`                   |
| Finance    | Partially paid    | `warning`                   |
| Finance    | Due / Upcoming    | `ink-mute` (neutral)        |
| Finance    | Overdue           | `danger`                    |
| Finance    | Voided            | `ink-faint` + strikethrough |
| Admission  | New               | `info`                      |
| Admission  | Under review      | `warning`                   |
| Admission  | Accepted          | `success`                   |
| Admission  | Rejected          | `danger`                    |
| Admission  | Withdrawn         | `ink-mute` (neutral)        |
| Exam       | Scheduled         | `ink-mute` (neutral)        |
| Exam       | Marks in progress | `info`                      |
| Exam       | Ready for review  | `warning`                   |
| Exam       | Published         | `info`                      |
| Student    | Active            | `success`                   |
| Student    | Paused            | `warning`                   |
| Student    | Completed         | `info`                      |
| Student    | Left / Archived   | `ink-mute` (neutral)        |
| SMS        | Queued            | `info`                      |
| SMS        | Sending           | `info`                      |
| SMS        | Accepted / Sent   | `info`                      |
| SMS        | Delivered         | `success`                   |
| SMS        | Failed            | `danger`                    |
| SMS        | Retrying          | `warning`                   |
| Enrolment  | Active            | `success`                   |
| Enrolment  | Completed         | `info`                      |
| Enrolment  | Withdrawn         | `danger`                    |
| Account    | Active            | `success`                   |
| Account    | Reserved          | `warning`                   |
| Account    | Suspended         | `danger`                    |

### Text

| Token           | Hex     | Use                                              |
| --------------- | ------- | ------------------------------------------------ |
| `ink`           | #171717 | Primary body text — near-black, never pure black |
| `ink-secondary` | #404040 | Secondary emphasis, subheadings within cards     |
| `ink-mute`      | #737373 | Labels, helper text, timestamps                  |
| `ink-faint`     | #a3a3a3 | Placeholder text, disabled labels                |
| `ink-disabled`  | #d4d4d4 | Disabled interactive element text                |
| `on-brand`      | #171717 | Text on `brand` fill — dark on green, not white  |
| `on-dark`       | #fafafa | Text on `canvas-dark` surfaces                   |
| `on-success`    | #ffffff | Text on `success` fill                           |
| `on-warning`    | #171717 | Text on `warning` fill — dark on amber           |
| `on-danger`     | #ffffff | Text on `danger` fill                            |
| `on-info`       | #ffffff | Text on `info` fill                              |

### Surface

| Token              | Hex     | Use                                           |
| ------------------ | ------- | --------------------------------------------- |
| `canvas`           | #ffffff | Primary page background                       |
| `canvas-soft`      | #fafafa | Sidebar, alternating table rows, inset panels |
| `canvas-subtle`    | #f5f5f5 | Input disabled bg, skeleton loading bg        |
| `canvas-dark`      | #171717 | Inverted panels (future dark mode base)       |
| `canvas-dark-soft` | #262626 | Nested chrome on dark panels                  |

### Border

| Token           | Hex     | Use                                     |
| --------------- | ------- | --------------------------------------- |
| `border`        | #e5e5e5 | Default card/table/input borders        |
| `border-strong` | #d4d4d4 | Emphasised borders, table header bottom |
| `border-muted`  | #f0f0f0 | Subtle separators within cards          |
| `border-focus`  | #3ecf8e | Focus ring colour (brand emerald)       |
| `border-danger` | #dc2626 | Error state input borders               |

---

## Typography

### Font Stack

**Primary:** Inter (Google Fonts, weight 400–600).

**Bangla:** Noto Sans Bengali (Google Fonts, weight 400–600).

**Monospace:** System monospace (`ui-monospace`, Cascadia Code, Consolas).

The CSS `font-family` stack is always `Inter, 'Noto Sans Bengali', sans-serif`.
The browser automatically selects Noto Sans Bengali for Bengali glyphs and Inter
for Latin glyphs. Both fonts must be loaded at weights 400, 500, and 600.

### Hierarchy

| Token         | Size | Weight | Line-height | Letter-spacing | Use                                  |
| ------------- | ---- | ------ | ----------- | -------------- | ------------------------------------ |
| `display-xxl` | 56px | 600    | 1.1         | -1.4px         | Public hero headline                 |
| `display-xl`  | 42px | 600    | 1.15        | -1.05px        | Public section opener                |
| `display-lg`  | 32px | 600    | 1.2         | -0.64px        | Page title (portal)                  |
| `display-md`  | 24px | 600    | 1.25        | -0.36px        | Card title, dialog title             |
| `heading-lg`  | 20px | 600    | 1.3         | 0              | Section heading                      |
| `heading-md`  | 16px | 600    | 1.4         | 0              | Sub-section, table group             |
| `body-lg`     | 16px | 400    | 1.6         | 0              | Public body lead, form descriptions  |
| `body-md`     | 14px | 400    | 1.5         | 0              | Default portal body                  |
| `body-sm`     | 13px | 400    | 1.5         | 0              | Compact body, table help text        |
| `label-md`    | 14px | 500    | 1.0         | 0              | Form labels, button text             |
| `label-sm`    | 12px | 500    | 1.0         | 0              | Small labels, column headers         |
| `caption`     | 12px | 400    | 1.5         | 0              | Helper text, timestamps, footnotes   |
| `mono`        | 14px | 400    | 1.5         | 0              | Monetary values, IDs, codes          |
| `mono-sm`     | 12px | 400    | 1.5         | 0              | Compact monetary, receipt line items |

### Bangla Typography Rules

Bengali glyphs render taller than Latin glyphs at the same font size. Complex
conjunct characters (যুক্তবর্ণ) require additional vertical space.

- **Line-height for Bangla body text:** use at least 1.6 (the `body-lg` and
  `body-md` tokens already accommodate this). Never go below 1.5 for any text
  that may contain Bangla.
- **Table cells with Bangla content:** add 4px extra vertical padding compared
  to English-only tables (use `{spacing.md}` 12px vertical padding instead of
  `{spacing.sm}` 8px).
- **Form labels in Bangla:** test that labels do not clip descenders. Noto Sans
  Bengali at 14px needs at least 20px label height.
- **Display text in Bangla:** display tiers (`display-xxl` through `display-md`)
  can use the same line-heights as English at large sizes, but always test
  visually.
- **Negative letter-spacing and Bangla:** the negative tracking on display tiers
  (-1.4px to -0.36px) is designed for Latin glyphs. When rendering Bangla
  display text, set `letter-spacing: 0` to preserve conjunct readability. Use
  a CSS class or locale-aware rule to disable tracking for Bangla headings.
- **Mixed-language content:** when Bangla and English appear in the same line
  (common in student names, course names), the taller Bangla glyphs determine
  the line height. Never force a fixed height that clips Bangla.
- **Print:** Noto Sans Bengali must be embedded or loaded for print stylesheets.
  System Bengali fonts are unreliable across devices.

### Monetary Typography

All monetary values use `{typography.mono}` or `{typography.mono-sm}`. This
ensures digit alignment in columns. The Bangladeshi Taka symbol (৳) is placed
before the amount with a thin space: `৳ 1,500`. Amounts are always
right-aligned in table columns.

---

## Layout and Spacing

### Spacing Scale

Base unit is 8px with sub-tokens for fine work:

| Token | Value | Common use                                 |
| ----- | ----- | ------------------------------------------ |
| `xxs` | 2px   | Hairline gaps, icon–text micro spacing     |
| `xs`  | 4px   | Tight padding inside pills and badges      |
| `sm`  | 8px   | Default inner padding, compact gaps        |
| `md`  | 12px  | Table cell padding, form field gap         |
| `lg`  | 16px  | Card padding, section gap in compact views |
| `xl`  | 24px  | Section padding, comfortable card body     |
| `2xl` | 32px  | Card padding on public pages, modal body   |
| `3xl` | 48px  | Page section gap                           |
| `4xl` | 64px  | Public page section padding                |

### Container and Grid

- Portal pages use a fluid layout within a sidebar. Content area has 16–24px
  horizontal padding.
- Public pages center content in a 1200px max-width container with 24px
  edge padding.
- Data tables stretch to full container width and scroll horizontally on narrow
  screens.

### Whitespace Philosophy

Use whitespace and hairline borders to create hierarchy — never coloured
section bands, decorative dividers, or gradient fills. The white canvas is
the design.

---

## Elevation and Depth

| Level | Treatment                   | Use                                         |
| ----- | --------------------------- | ------------------------------------------- |
| 0     | Flat, 1px `{colors.border}` | Default cards, table containers             |
| 1     | `{elevation.1}`             | Subtle card lift on hover, dropdowns        |
| 2     | `{elevation.2}`             | Floating elements, popovers, search results |
| 3     | `{elevation.3}`             | Modals, drawers, command palette            |

Elevation is used sparingly. Most portal content sits at Level 0. Only floating
and overlay elements use shadows.

---

## Shapes and Borders

### Border Radius Scale

| Token  | Value  | Use                                        |
| ------ | ------ | ------------------------------------------ |
| `xs`   | 4px    | Form inputs, inline tags                   |
| `sm`   | 6px    | Buttons, compact cards                     |
| `md`   | 8px    | Standard cards, alerts                     |
| `lg`   | 12px   | Feature cards, modal dialogs, public cards |
| `xl`   | 16px   | Large containers, hero sections            |
| `full` | 9999px | Pill badges, avatars, status dots          |

Buttons use `{rounded.sm}` (6px). Never pill-shaped buttons — the aesthetic is
square-ish and technical.

---

## Responsive Behaviour

### Breakpoints

| Name         | Width       | Key Changes                                     |
| ------------ | ----------- | ----------------------------------------------- |
| Mobile       | < 640px     | Single column, stacked cards, hamburger nav     |
| Small tablet | 640–767px   | Two-column where useful, still mobile nav       |
| Tablet       | 768–1023px  | Sidebar visible, tables may scroll horizontally |
| Desktop      | 1024–1279px | Full sidebar, all columns visible               |
| Wide         | ≥ 1280px    | Maximum content width, comfortable tables       |

### Touch Targets

- **Minimum 44×44 CSS pixels** for all interactive elements on mobile.
- **Minimum 40×40 CSS pixels** on desktop.
- Attendance status controls are always 44px minimum on all screen sizes.
- Extra separation (8px minimum) around irreversible action buttons.

### Display Typography Scaling

Display tiers stair-step down on smaller screens:

| Token         | Wide/Desktop | Tablet | Mobile |
| ------------- | ------------ | ------ | ------ |
| `display-xxl` | 56px         | 42px   | 32px   |
| `display-xl`  | 42px         | 32px   | 24px   |
| `display-lg`  | 32px         | 24px   | 20px   |
| `display-md`  | 24px         | 20px   | 18px   |

### Table Collapsing

- Desktop: full table with all columns.
- Tablet: horizontal scroll when columns exceed available width. Freeze the
  first identifier column (student name, ID) when scrolling.
- Mobile: tables collapse into labelled record cards. Each card shows the key
  fields as label–value pairs. Alternatively, use horizontal scroll with frozen
  first column if the user explicitly prefers tabular view.

---

## Interaction States

### Dark-mode component previews

- Shared components must be reviewed against both the light operational canvas
  and the neutral dark canvas before workflow migration.
- Dark mode remaps neutral surfaces, borders, text, and elevation through design
  tokens. Brand and semantic meanings do not change between themes.
- Focused form controls use one emerald border only. Do not add an outer halo,
  stack outlines, or change control size. Invalid controls keep one danger
  border while focused rather than combining danger and emerald treatments.
- Destructive buttons retain white text and use `danger-deep` on hover; dark
  mode must not weaken their destructive meaning or contrast.
- The development component showcase is the approval surface for theme parity.
  A component is not approved when its dark state is only an inverted light
  screenshot or when Bangla text loses contrast.

Every interactive component must define all applicable states. Do not ship a
component with only default and hover.

| State                | Visual Treatment                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Default**          | Base styling as defined by the component                                                                     |
| **Hover**            | Subtle background shift or border emphasis. No jarring colour change.                                        |
| **Focus-visible**    | One `{colors.border-focus}` component border. Do not add a second outer border to form controls.             |
| **Pressed / Active** | Darker fill or slight scale reduction (scale 0.98).                                                          |
| **Selected**         | `{colors.brand-muted}` bg, `{colors.brand}` left border or check.                                            |
| **Disabled**         | `{colors.canvas-subtle}` bg, `{colors.ink-disabled}` text, `cursor: not-allowed`, reduced opacity (0.5–0.6). |
| **Loading**          | Spinner or skeleton replacing content. Maintain element dimensions.                                          |
| **Error**            | `{colors.border-danger}` border, `{colors.danger}` helper text below.                                        |
| **Success**          | Brief `{colors.success}` check animation or text, then return to default.                                    |

General controls use `outline: 2px solid {colors.border-focus}; outline-offset: 2px;`.
Form controls are the exception: their border itself changes to `border-focus`
so the field retains one border. Never remove focus visibility without an
equivalent visible indicator.

---

## Components

### Navigation

#### Portal Sidebar (Desktop)

- Width: 240px, fixed.
- Background: `{colors.canvas-soft}`.
- Logo and coaching name at top.
- Navigation items: `{typography.label-md}`, `{colors.ink-mute}` default,
  `{colors.ink}` on hover, `{colors.brand}` text + `{colors.brand-muted}`
  background when active.
- Active item has a 3px `{colors.brand}` left border.
- Section dividers: 1px `{colors.border-muted}`.
- Bottom: user avatar, name, role badge, sign-out.
- Collapsible to icon-only (48px) on tablet.

#### Mobile Navigation

- Bottom tab bar for primary sections (max 5 items).
- Hamburger menu (slide-in drawer from left) for full navigation.
- 44px minimum touch targets on all items.
- Active tab: `{colors.brand}` icon and label.
- Inactive tab: `{colors.ink-mute}`.

#### Global Search

- Triggered by a persistent search icon in the top bar, or keyboard shortcut.
- Opens a command-palette-style overlay (`{elevation.3}`).
- Searches across student name, ID, email, phone, guardian name, guardian phone.
- Results grouped by type (students, payments, applications).
- `{typography.body-md}` for results, `{typography.caption}` for metadata.
- Recent searches shown when the input is empty.

### Buttons and Actions

#### Primary Button

- Background: `{colors.brand}`, text: `{colors.on-brand}` (near-black on
  green).
- Type: `{typography.label-md}`, padding: 10px 16px, rounded: `{rounded.sm}`.
- Hover: `{colors.brand-deep}`.
- Minimum height: 40px desktop, 44px mobile.

#### Destructive / Danger Button

- Background: `{colors.danger}`, text: `{colors.on-danger}` (white).
- Same dimensions as primary.
- Used only for void, reject, cancel actions.

#### Secondary Button

- Background: `{colors.canvas}`, text: `{colors.ink}`, 1px `{colors.border-strong}` border.
- Same dimensions as primary.

#### Ghost Button

- Background: transparent, text: `{colors.ink-secondary}`.
- Hover: `{colors.canvas-subtle}` background.

#### Link Button

- Text-only, `{colors.brand}` or `{colors.ink-secondary}`, underline on hover.
- No padding, inline with text.

#### Button Rules

- Use one dominant primary action per workflow region. Multiple primary buttons
  may exist on a long page if they belong to separate panels or decision points.
- Destructive buttons never sit next to primary buttons without visual
  separation (at least 16px gap or a divider).
- Loading state replaces the label with a spinner. Button dimensions must not
  change during loading.

### Forms and Inputs

#### Text Input

- Height: 40px desktop, 44px mobile.
- Background: `{colors.canvas}`, border: 1px `{colors.border}`.
- Rounded: `{rounded.xs}` (4px).
- Padding: 8px 12px.
- Text: `{typography.body-md}`.
- Focus: one `{colors.border-focus}` border, with no outer ring.
- Error: `{colors.border-danger}` border, `{colors.danger}` helper text below.
- Disabled: `{colors.canvas-subtle}` bg, `{colors.ink-disabled}` text.

#### Select / Dropdown

Same chrome as text input. Chevron icon in `{colors.ink-mute}`.

#### Textarea

Same chrome as text input but taller. Minimum height: 80px. Resizable
vertically.

#### Checkbox and Radio

- Size: 20px × 20px (meets 44px touch target with padding/margin).
- Checked: `{colors.brand}` fill, white check mark.
- Unchecked: `{colors.canvas}` bg, 1px `{colors.border}`.
- Focus ring on keyboard focus.

#### Form Labels

- `{typography.label-md}`, `{colors.ink-secondary}`.
- Position: above the input, with `{spacing.xs}` (4px) gap.
- Required indicator: `*` in `{colors.danger}`.

#### Bilingual Form Fields

When a form captures both Bangla and English values (e.g., course name),
display two stacked inputs with clear language labels (বাংলা / English) rather
than side-by-side inputs that compress on mobile. If only one name is required
and the alternate is optional, place the optional field in a collapsible
"Add alternate name" section.

#### Inline Validation

- Validate on blur for required/format rules.
- Show `{colors.danger}` text + icon below the field immediately.
- Do not block typing — never use alert() or modal validation.
- Submit button stays enabled but shows a validation summary if errors exist.

#### Form Grid Layouts

- **`.form-grid`** — 2-column grid for standard labels and inputs. Collapses to 1-column on mobile viewports.
- **`.form-grid-thirds`** — 3-column responsive layout grid for settings and small inputs. Collapses to 2-columns on tablet, and 1-column on mobile.
- **`.feature-option-card`** — 2-column layout wrapper card (natively mapped via `<label>` elements) for accessible checkbox/radio settings with description text. Support hover state, `:focus-within` outlines, checked active states (`brand-muted` background + `brand` border), and disabled states.

### Data Display

#### Data Table

- Container: 1px `{colors.border}`, `{rounded.md}` corners.
- Header row: `{colors.canvas-soft}` bg, `{typography.label-sm}` in
  `{colors.ink-mute}`, normal case (Bangla has no uppercase concept), bottom
  border: 1px `{colors.border-strong}`. Use uppercase only for deliberately
  English-only micro labels where appropriate.
- Body rows: `{colors.canvas}` bg, alternating `{colors.canvas-soft}` on dense
  tables (optional).
- Row border: 1px `{colors.border-muted}`.
- Cell padding: 12px horizontal, 10px vertical (add 4px vertical for
  Bangla-heavy tables).
- Hover row: `{colors.canvas-subtle}` bg.
- Selected row: `{colors.brand-muted}` bg.
- Sortable columns: show sort direction icon in `{colors.ink-faint}`, active
  sort in `{colors.ink}`.
- Empty state: centred illustration-free message in `{colors.ink-mute}` with
  an action link or button.

#### Stat Card

- Background: `{colors.canvas}`, 1px `{colors.border}`, `{rounded.md}`.
- Padding: `{spacing.xl}`.
- Value: `{typography.display-md}` in `{colors.ink}`.
- Label: `{typography.caption}` in `{colors.ink-mute}`, above or below value.
- Optional trend indicator: small arrow + percentage in `{colors.success}` or
  `{colors.danger}`.
- Dashboard uses 2–4 stat cards in a responsive grid.

#### Mobile Record Card

When tables collapse on mobile, each row becomes a card:

- Background: `{colors.canvas}`, 1px `{colors.border}`, `{rounded.md}`.
- Padding: `{spacing.lg}`.
- Primary identifier (student name, payment number) in `{typography.heading-md}`.
- Key–value pairs in `{typography.body-md}` label + `{typography.body-md}` value.
- Status badge aligned to the top-right.
- Tap the entire card to navigate to the detail view.

#### Pagination

- Position: bottom of the table, right-aligned.
- Shows: "Showing 1–20 of 156" in `{typography.caption}`.
- Page buttons: 40px minimum height on desktop, 44px on mobile.
  `{colors.ink-mute}` text, active page in `{colors.brand}` text +
  `{colors.brand-muted}` bg.
- "Previous" and "Next" as text buttons with the same minimum touch targets.

#### Filters

- Horizontal bar above the table.
- Filter chips: `{colors.canvas-soft}` bg, `{colors.ink}` text,
  `{rounded.full}`, `{typography.label-sm}`.
- Active filter: `{colors.brand-muted}` bg, `{colors.brand-deep}` text.
- Clear filters link in `{colors.ink-mute}`.
- Complex filters open a popover or side panel.

### Status Badges and Pills

#### Status Badge

- Inline element, `{rounded.full}`, padding: 2px 10px.
- Text: `{typography.label-sm}`.
- Background and text colour determined by semantic state.
- No border. Status badges are labels, not selectable filter chips.

| State                            | Background      | Text           | CSS Classes                                                                     |
| -------------------------------- | --------------- | -------------- | ------------------------------------------------------------------------------- |
| Success (present, paid, active)  | `success-soft`  | `success-deep` | `.status-pill.active` (Accounts), `.status-pill.present` (Attendance), etc.     |
| Warning (late, due, pending)     | `warning-soft`  | `warning-deep` | `.status-pill.reserved` (Accounts), `.status-pill.late` / `.status-pill.queued` |
| Danger (absent, overdue, failed) | `danger-soft`   | `danger-deep`  | `.status-pill.suspended` / `.status-pill.revoked`, `.status-pill.absent`        |
| Info (published, new, queued)    | `info-soft`     | `info-deep`    | `.status-pill.info` / `.status-pill.published` / `.status-pill.new`             |
| Neutral (draft, archived)        | `canvas-subtle` | `ink-mute`     | `.status-pill` (default)                                                        |

#### Status Dot

A small 8px circle used inline with text to indicate status at a glance. Uses
the `{colors.success}`, `{colors.warning}`, `{colors.danger}`, or
`{colors.info}` fill colour.

### Attendance Components

#### Attendance Status Selector

For each student in a roster, three toggle buttons in a group:

- **Present** — `{colors.success-soft}` bg, `{colors.success}` border + text
  when selected. Unselected: `{colors.canvas}` bg, `{colors.border}`.
- **Late** — `{colors.warning-soft}` bg, `{colors.warning}` border + text
  when selected.
- **Absent** — `{colors.danger-soft}` bg, `{colors.danger}` border + text
  when selected.
- Minimum touch target: 44×44px on all screen sizes.
- Unselected state clearly distinct from selected.
- No default selection — every student starts unmarked.

#### Attendance Summary Bar

Shown above the roster and updated in real time:

- Three counters: Present (green), Late (amber), Absent (red).
- Remaining (unmarked) count in `{colors.ink-mute}`.
- Progress indicator showing completion fraction.

#### Immutable Attendance Confirmation

When the teacher presses "Submit Attendance":

- Full-screen overlay or blocking modal, `{elevation.3}`.
- Background: `{colors.canvas}` with strong border.
- Title: `{typography.heading-lg}`, e.g., "Submit Attendance — Batch 2A".
- Summary: present/late/absent counts.
- Late and absent student names listed explicitly.
- Warning text in `{colors.danger}`:
  "এই উপস্থিতি জমা দেওয়ার পর পরিবর্তন করা যাবে না। অনুপস্থিত ও বিলম্বিত
  শিক্ষার্থীদের অভিভাবকদের SMS পাঠানো হবে।"
  / "This attendance cannot be changed after submission. SMS will be sent to
  guardians of late and absent students."
- An acknowledgement checkbox: "I understand this cannot be changed" — must be
  checked before the submit button becomes enabled. This is more accessible
  than hold-to-submit or double-confirmation gestures.
- Two buttons: "Cancel" (secondary) and "Submit permanently" (danger button,
  not primary green). The submit button is disabled until the acknowledgement
  checkbox is checked.

### Financial Components

#### Monetary Display

- All amounts in `{typography.mono}`, right-aligned.
- Currency: ৳ (Taka symbol) before the amount with thin space.
- Thousands separator: comma (৳ 1,500).
- Negative amounts or credits: parentheses, e.g., (৳ 500).
- Overdue amounts: `{colors.danger}` text.
- Paid amounts: `{colors.success}` text.
- Partial: `{colors.warning}` text.
- Due/upcoming: `{colors.ink}` text (neutral).
- Voided: `{colors.ink-faint}`, strikethrough.

#### Student Financial Summary Card

- Total charged, total paid, outstanding, advance credit.
- Outstanding in `{colors.danger}` if overdue, `{colors.ink}` otherwise.
- Advance credit in `{colors.info}`.
- Compact layout for embedding in student profile header.

#### Payment Collection Form

- Default to Monthly fee, with Other fee as the only alternative.
- Monthly collection shows whole month snapshots with checkboxes. Partial
  monthly payments and editable monthly amounts are never shown.
- Other fee requires an exact free-text fee name and a positive amount.
- Payment method is fixed to Cash and is not presented as a choice.
- Collection date defaults to today. A past date is allowed only when the
  confirmation clearly calls out the backdate.
- The confirmation previews student, every selected month or exact fee name,
  and the authoritative total before posting.
- Success provides the generated receipt number and an immediate receipt action.
  Payment SMS is intentionally absent until the SMS workflow is implemented.

#### Printable Receipt

See "Print Design" section below.

### Exam and Result Components

#### Marks Entry Grid

- Spreadsheet-style layout: students in rows, mark components in columns.
- Columns vary by exam mode:
  - MCQ-only: Student, MCQ marks, Total, Pass/Fail, Entry status.
  - Written-only: Student, Written marks, Total, Pass/Fail, Entry status.
  - Combined: Student, MCQ marks, Written marks, Total, Pass/Fail, Entry status.
- Subjects are exam metadata only — they do not produce separate mark columns.
- Cell input: `{typography.mono}`, right-aligned, auto-selects content on focus.
- Tab key moves between cells.
- Total column is auto-computed by the backend, read-only,
  `{colors.canvas-subtle}` bg.
- Pass/fail indicator using status dot in the corresponding column.
- Row highlight on hover.
- "Mark ready for review" button per teacher assignment.

#### Merit List

- Ranked table: position, student name, total marks, full marks, pass/fail.
- Equal scores share the same competition rank (1, 2, 2, 4).
- Position column: `{typography.label-md}`, left-aligned.
- Pass: `{colors.success}` badge. Fail: `{colors.danger}` badge.

### Modals, Drawers, and Overlays

#### Modal Dialog

- Centred on screen, `{elevation.3}`.
- Backdrop: `rgba(0, 0, 0, 0.5)`.
- Max width: 480px for standard, 640px for forms, 800px for complex.
- Rounded: `{rounded.lg}`.
- Padding: `{spacing.xl}`.
- Title: `{typography.heading-lg}`.
- Close button: top-right, `{colors.ink-mute}`, 44px touch target.
- Action buttons: bottom-right, primary + secondary.
- Keyboard: Escape closes. Focus is trapped inside the modal.

#### Drawer / Side Panel

- Slides in from the right, `{elevation.3}`.
- Width: 400–560px on desktop, full-width on mobile.
- Same padding and typography as modals.
- Used for detail views, filter panels, and quick-edit forms.

#### Toast / Notification

- Position: bottom-right on desktop, bottom-centre on mobile.
- Auto-dismiss: 5 seconds for success, manual dismiss for errors.
- Types:
  - Success: `{colors.success}` left border or icon.
  - Error: `{colors.danger}` left border or icon.
  - Warning: `{colors.warning}` left border or icon.
  - Info: `{colors.info}` left border or icon.
- Text: `{typography.body-md}`.
- Max width: 400px.

### Content Components

#### Notice Card

- Background: `{colors.canvas}`, 1px `{colors.border}`, `{rounded.md}`.
- Title: `{typography.heading-md}`.
- Date/author: `{typography.caption}`, `{colors.ink-mute}`.
- Body preview: `{typography.body-md}`, max 3 lines, truncated.

#### Empty State

- Centred in the content area.
- Icon or simple line illustration (optional, no decorative illustration).
- Heading: `{typography.heading-md}`, `{colors.ink-mute}`.
- Description: `{typography.body-md}`, `{colors.ink-mute}`.
- Action: primary or secondary button below.

### SMS and Communication

#### SMS Preview Card

- Shows rendered message text with character/segment count.
- Bangla segment warning: Bangla SMS uses UCS-2 encoding (70 chars/segment vs
  160 for Latin). Display segment count prominently in `{colors.warning}` when
  segments exceed 2.
- Recipient count.
- Estimated cost in `{typography.mono}`.

#### SMS Status Indicator

- Inline status badge per message. SMS.BD distinguishes request acceptance from
  final delivery, so the full lifecycle is:
  - Queued → `info`
  - Sending → `info`
  - Accepted / Sent → `info` (provider accepted, delivery not confirmed)
  - Delivered → `success` (final confirmed delivery)
  - Failed → `danger`
  - Retrying → `warning`
- Only "Delivered" uses `success`; "Sent" alone does not confirm delivery.
- Delivery timestamp in `{typography.caption}`.
- Failed messages show a "Retry" action link.

### Public Website Components

#### Course Card

- Background: `{colors.canvas}`, 1px `{colors.border}`, `{rounded.lg}`.
- Cover image: aspect ratio 16:9, top of card, `{rounded.lg}` top corners.
- Course name: `{typography.heading-lg}`.
- Short description: `{typography.body-md}`, `{colors.ink-mute}`.
- Batch count / admission status as pill badge.
- CTA: "View details" link button.

#### Teacher Profile Card

- Photo: 80×80px circle avatar, `{rounded.full}`.
- Name: `{typography.heading-md}`.
- Qualifications: `{typography.body-md}`, `{colors.ink-mute}`.
- Bio preview: max 2 lines.

#### Public Navigation

- Background: `{colors.canvas}`, bottom border: 1px `{colors.border}`.
- Logo + coaching name left.
- Nav links centre: `{typography.label-md}`, `{colors.ink-mute}`, hover
  `{colors.ink}`.
- Language switcher + "Sign In" link + "Apply Now" primary button right.
- Mobile: hamburger with slide-in drawer.

#### Footer

- Background: `{colors.canvas-soft}`, top border: 1px `{colors.border}`.
- Text: `{typography.caption}`, `{colors.ink-mute}`.
- Coaching name, address, phone, email.
- Link groups for quick navigation.
- Social icons if applicable.

---

## Portal-Specific Guidelines

### Owner Portal

#### Course Operational Workspace

- Use a master-detail layout: a compact searchable course list beside one selected course workspace. Collapse to a single column below tablet width.
- The workspace header combines identity, lifecycle, academic readiness, fee readiness, and website publication; status must use text as well as semantic colour.
- Readiness checklists use one actionable row per server-owned issue and link to the exact resolving section. Clients never infer activation permission.
- Coverage matrices place subjects on rows and qualifying batches on columns. Every cell names assigned teachers or says `Missing`; narrow screens use horizontally scrollable or linear cards without shrinking touch targets.
- Weekly agendas lead with weekday and time, then batch, subject, and teacher. Schedule conflicts use an icon, text, the colliding resource, time, and effective range.
- Operational drawers are right-aligned, trap focus, restore focus on close, and warn before discarding dirty input. Drawer footer actions remain visible on long forms.

- **Density:** compact. Tables show 20 rows by default with tight row height.
- **Quick actions:** persistent toolbar or floating action button for the five
  quick actions (add student, collect payment, take attendance, create exam,
  send due reminders).
- **Dashboard:** stat cards for total students, today's attendance, overdue
  amount, pending applications. Below: recent payments, upcoming sessions,
  unread SMS failures.
- **Financial screens:** use `{typography.mono}` for all amounts. Clear visual
  distinction between overdue (danger), due (neutral), paid (success).

### Teacher Portal

- **Density:** moderate. Focused on assigned batches and sessions.
- **Primary workflow:** attendance entry. The attendance grid should be the
  first action from any session card.
- **Marks entry:** spreadsheet-style with minimal chrome. Tab navigation
  between cells. Auto-save drafts.
- **No financial data visible** — the teacher portal never shows fee or payment
  information.

### Student Portal

- **Density:** comfortable. Card-based layout with generous spacing.
- **Dashboard:** upcoming class, attendance summary (present/late/absent
  counts), current balance and next due, latest result.
- **Read-heavy:** most screens are view-only. Profile editing is limited to
  permitted fields with change requests for restricted fields.
- **Receipt viewing:** accessible from fees screen, opens in print-ready view.

### Public Website

- **Density:** spacious. Marketing layout with editorial typography.
- **Brand CTA (emerald):** used for "Apply Now" and key actions.
- **Content:** courses, teachers, notices, about, contact, admission form.
- **Screenshots:** use actual portal screenshots as proof of the product (cards,
  tables, dashboards) composited in `{rounded.lg}` containers with
  `{elevation.2}` shadows.

---

## Print Design

### General Print Rules

- **Paper:** A4 portrait (210 × 297mm).
- **Margins:** 15mm all sides.
- **Colours:** monochrome-safe. All semantic colours must be readable in
  greyscale. Use borders, bold text, and icons/symbols instead of colour for
  status in print.
- **Hidden elements:** navigation, sidebar, interactive controls, tooltips,
  hover states — all hidden via `@media print`.
- **Page breaks:** avoid breaking inside a table row, card, or address block.
  Use `break-inside: avoid` on key containers.
- **Table headers:** repeat on every page (`thead { display: table-header-group }`).

### Receipt Layout

- **Header:** coaching centre name (Bangla and English), address, phone, logo.
- **Receipt number and date:** right-aligned, `{typography.mono}`.
- **Student details:** name, ID, course, batch — left-aligned block.
- **Line items table:** description, amount columns. Right-aligned amounts in
  `{typography.mono}`. Borders on all cells.
- **Totals:** bold bottom row. Total paid, advance credit if any.
- **Payment method:** method + reference below the table.
- **Footer:** configurable footer text (receiptFooterBn / receiptFooterEn from
  settings). Signature line with label.
- **Default size:** A5 (half A4, 148 × 210mm) for payment receipts.
- **Full A4:** reserved for student statements and reports.
- If the coaching centre later requests full-A4 receipts, provide it as an
  option — but default to A5.

### Report Layout

- **Header:** coaching centre name, report title, date range.
- **Tables:** borders on all cells, header row bold, repeated on page break.
- **Summary row:** bold, top-bordered.
- **Amounts:** `{typography.mono}`, right-aligned, monochrome.
- **Page numbers:** bottom-centre.

---

## Do's and Don'ts

### Do

- Reserve `{colors.brand}` for CTAs and navigation accents — it is the brand
  action colour, not a status colour.
- Use semantic colours consistently — the mapping table above is authoritative.
- Render all monetary values in `{typography.mono}`, right-aligned.
- Test every screen in Bangla before English. Bangla is the default locale.
- Use `{rounded.sm}` (6px) for buttons — square-ish, not pill-shaped.
- Provide all 9 interaction states for interactive components.
- Use 44px minimum touch targets on mobile.
- Design print layouts alongside screen layouts — not as an afterthought.
- Use one dominant primary action per workflow region. A long operational page
  may have multiple primary buttons if they belong to separate panels.
- Use dark type (`{colors.on-brand}`) on the emerald button — the green reads
  as a "lit" surface.

### Don't

- Don't use `{colors.brand}` for success/status indication. Use
  `{colors.success}` instead.
- Don't use colour as the only differentiator — pair colour with text labels,
  icons, or patterns for accessibility.
- Don't use decorative animation in operational flows (attendance, payment,
  marks entry).
- Don't use display weight above 600 — the system's calibrated mid-weight
  breaks at 700+.
- Don't use pill-shaped buttons (the button radius is `{rounded.sm}` 6px).
- Don't add atmospheric gradients or full-bleed photography to portal screens.
- Don't show financial data in the teacher portal.
- Don't use floating-point for money — always integer minor units in code,
  formatted with Taka symbol in display.
- Don't clip Bangla text — always test line-height and container height with
  complex Bengali conjuncts.
- Don't use alert() or browser-native confirm() for destructive actions — use
  the custom modal confirmation pattern.
- Don't remove the coaching centre name from SMS previews and receipts.

---

## Exam Operations Patterns

- Owner exam creation uses four numbered client-local steps: batch and schedule,
  subjects/marks/teachers, student inclusion, and read-only review. Nothing is
  persisted until the final atomic create action; a complete exam is immediately
  `scheduled`, with one batch and a frozen included/excluded roster.
- The owner exam workspace keeps Overview, Marks, Review and publish, and Results
  as URL-synced tabs on one route. Selecting the exam is sufficient context for
  marks entry; subject navigation stays inside the Marks tab.
- Required date, start time, and duration surface the exam in the weekly owner
  Schedule. Same-batch class or exam overlap is an inline blocking validation.
- Dense marks tables keep the student identity column sticky, use compact 40px
  desktop cells, show a visible focus ring, and retain 44px toolbar and mobile
  controls. Mobile may scroll the table horizontally; never compress Bangla
  student names or mark inputs below a usable width.
- Progress matrices lead with missing and invalid work. Counts must open or sit
  beside the scope that owns the problem; colour is always paired with text.
- Publication uses an amber bordered summary panel containing version, result
  counts, merit population, recipient count, exact bilingual SMS previews, and
  an explicit acknowledgement. It is never a browser confirmation dialog.
- Published merit is academic metadata. Do not introduce podiums, confetti,
  celebratory animation, or decorative rank treatments.

### Finance Operations

- Keep one owner-navigation entry for Finance. Inside it, use a horizontally
  scrollable workspace tab list on narrow screens; never add a second sidebar.
- Its visible tabs are Monthly fees (`/owner/finance`) and Receipts
  (`/owner/finance/receipts`). Manual collection is a contextual student
  workspace at `/owner/finance/students/[studentId]`, opened by selecting a
  student row; it is never shown as a general navigation tab.
- Monthly fees become due on the first day of their month. The worklist exposes
  only Due now and Future paid; do not reintroduce ageing buckets, partial,
  credit, promise, campaign, import, cashier-session, or adjustment surfaces.
- One-click collection previews every due month and amount, then pays all of
  those months in full in one cash collection.
- Manual monthly collection may include older dues and any future month in the
  current calendar year. The preview lists all selected months.
- A posted collection creates an immutable English receipt snapshot. Corrections
  use an audited void with a required reason; voiding monthly fees restores the
  affected months to unpaid.
- Money columns are right-aligned with tabular numerals. Integer minor units are
  authoritative; formatted BDT values are display-only.
- Desktop uses the readable student worklist table; mobile cards preserve
  student, course/batch, due amount, due months, future-paid months, and the
  collection action.

---

## Iteration Guide

1. Focus on one component at a time. Reference tokens by name.
2. Default body text to `{typography.body-md}`. Use `{typography.mono}` for
   amounts and IDs.
3. Test in Bangla first, English second.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
5. When a new reusable pattern is needed, add it here before implementing —
   this file is the source of truth.
6. Keep emerald for actions, semantic colours for states. When in doubt, check
   the semantic mapping table.
