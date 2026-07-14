# Owner Courses Workspace — UI/UX Enhancement Plan

Status: Ready for implementation
Scope: Visual and structural refinement of the existing owner course workspace
Primary route: `/{locale}/owner/courses`
Last updated: 2026-07-14

## 1. Objective

Improve the visual hierarchy, scanability, responsiveness, and interaction quality of the existing Owner Courses Workspace while preserving its current business behavior.

The finished workspace should feel premium because it is precise, calm, dense, and predictable—not because it contains more decoration. It must follow the current `DESIGN.md` contract:

- semantic color only;
- Bangla-first bilingual layouts;
- one clear primary action per workflow region;
- compact owner-portal density;
- 44px mobile interaction targets;
- restrained transitions for state feedback only;
- no gradients, floating-card effects, decorative motion, or icon-only ambiguity.

## 2. Locked implementation boundaries

### Production files in scope

- `src/components/portal/courses/CoursesWorkspace.tsx`
- `src/components/portal/courses/CourseOperations.tsx`
- `src/app/globals.css`, limited to the `/* Course operational workspace */` section and directly associated responsive rules

### Recommended test files

- Add `src/components/portal/courses/CoursesWorkspace.test.tsx`
- Add `src/components/portal/courses/CourseOperations.test.tsx`
- Extend `src/components/portal/courses/courseWorkspaceState.test.ts` only if a pure display/state helper is extracted

### Behavior that must remain unchanged

- Existing Convex queries and mutation references.
- Mutation argument shapes and submission order.
- Readiness and activation authority.
- Current URL query parameters and browser-history behavior.
- Existing course/session selection boundaries.
- Course creation, batch lifecycle, subject linking, teacher assignment, routine creation/cancellation, activation, completion, and archive behavior.
- Website CMS ownership of public course configuration.

### Explicit non-goals

- No Convex schema, query, mutation, or generated API changes.
- No new course capabilities.
- No new analytics or calculated readiness model.
- No route or navigation changes.
- No room fields or room UI.
- No Website CMS redesign.
- No broad redesign of shared buttons, forms, drawers, tables, or badges outside this workspace.

## 3. Corrections to the original proposal

The following refinements are required to stay aligned with `DESIGN.md` and the current backend contract.

### 3.1 Icons must remain supportive

Use Lucide icons to speed recognition, but never replace essential text. Do not add a unique icon to every label or value. A dense operational screen becomes slower when every line has equal visual emphasis.

Rules:

- Default icon size: 16px.
- Page/major empty-state icon: maximum 20px.
- Default stroke width: `1.75`.
- Icons beside visible text use `aria-hidden="true"` and `focusable="false"`.
- Icon-only buttons retain an explicit localized `aria-label` and 44px touch target.
- Use one icon per tab, summary header, status, or compact metric group—not one per sentence.
- Use `Archive`, not `Trash`, for archive actions. `Trash` communicates deletion and is incorrect for the current lifecycle.
- Do not use `Unlock` for an active course; use the existing localized status text and a semantic status icon.

### 3.2 Do not fabricate a readiness percentage

The current authoritative payload provides unresolved readiness issues and activation permission. It does not provide a complete scored checklist with a trustworthy denominator.

Therefore:

- Do not add a percentage progress bar.
- Show `N setup items remaining` when issues exist.
- Show the actionable issue rows beneath the count.
- Show the existing completion panel when no issues remain.
- A progress bar can be reconsidered only if the server later provides an explicit completed/total contract.

This prevents the client from implying readiness independently of Convex.

### 3.3 Motion must communicate state

Allowed:

- Chevron rotation when a native `<details>` element opens or closes.
- Active-tab underline/color transition.
- Border/background transition for hover, focus, and selected states.
- Loading-to-success/error feedback transition if already present.

Not allowed:

- Card lift or translate-on-hover.
- Bounce, pulse, shimmer, spring, or decorative entrance animation.
- Animated progress values.
- Multiple simultaneous color/scale/shadow effects.

Use approximately 160ms state transitions and disable nonessential transitions under `prefers-reduced-motion: reduce`.

### 3.4 Follow exact visual tokens

The current course CSS contains values such as 10px radii and font weights of 650/700. The refinement should normalize these to the design system:

- button radius: 6px;
- card/row radius: 8px;
- large container/drawer radius where applicable: 12px;
- font weights: 400, 500, or 600 only;
- spacing: 4, 8, 12, 16, 24, or 32px where possible;
- shadows only when required for overlays/drawers, not ordinary course cards.

## 4. Visual hierarchy

The workspace should preserve this attention order:

1. Page title and `New course` primary action.
2. Session/search/status filters.
3. Selected course identity and lifecycle/readiness state.
4. Section navigation.
5. Current section content.
6. Secondary creation and maintenance accordions.
7. Destructive or lifecycle actions.

Icons, fills, and borders must reinforce this order rather than compete with it.

## 5. `CoursesWorkspace.tsx` implementation plan

### 5.1 Imports and icon map

Import only the icons actually used. Recommended mapping:

| UI element | Icon |
| --- | --- |
| Page/course identity | `BookOpen` |
| Search | `Search` |
| New course | `Plus` |
| Overview tab | `LayoutDashboard` |
| Batches tab / batch count | `Layers` |
| Subjects & teachers tab | `Users` |
| Schedule tab / next class | `CalendarDays` |
| Website tab/status | `Globe2` |
| Academic ready | `CheckCircle2` |
| Setup required | `AlertCircle` |
| Fee status | `CircleDollarSign` |
| Archived/read-only | `Lock` |
| Archive action | `Archive` |
| Close drawer | `X` |

Do not import icons speculatively.

### 5.2 Page heading and toolbar

- Add a small `BookOpen` icon beside the eyebrow or page identity, not inside the main heading text.
- Add `Plus` to the visible `New course` button.
- Add `Search` inside the search field wrapper while preserving the `<label>` and accessible name.
- Keep session and search fields visually primary; lifecycle chips remain the third toolbar region.
- Use localized lifecycle labels instead of raw values such as `active`, `draft`, and `completed`.
- Keep lifecycle filter buttons horizontally scrollable without hiding the focus ring.

### 5.3 Course list cards

Restructure each `.course-list-card` into three compact regions:

1. Identity: localized course name and monospace code.
2. Lifecycle: localized semantic status badge.
3. Operational summary: student count plus readiness state.

Enhancements:

- Use `BookOpen` once at the identity level only if the card remains readable at the current width.
- Use `Users` for the student count and `CheckCircle2`/`AlertCircle` for readiness.
- Use `aria-current="true"` on the selected card in addition to the selected class.
- Selected state: brand border, brand-muted background, and a stable left indicator or inset border. Do not lift or scale the card.
- Hover state: border/background change only.
- Keep the course name on one line with ellipsis; allow Bangla code/status metadata to wrap instead of clipping.
- Use semantic status colors only for the status they describe.
- `Calculating…` remains neutral and must not show a warning icon.

### 5.4 Course header

- Place course identity and code in one clear group.
- Keep the lifecycle badge close to the identity.
- Render Academic, Fees, and Website status as compact labeled items with one semantic icon each.
- Do not turn all three status items into large cards.
- Keep the contextual next action as the only primary button.
- Secondary complete/archive actions remain visually subordinate; archive uses the `Archive` icon and danger styling only inside its confirmation state.
- Archived courses display a neutral `Lock` indicator and read-only text.

### 5.5 Section tabs

Add a stable icon map to `courseViews`:

- Overview — `LayoutDashboard`
- Batches — `Layers`
- Subjects & teachers — `Users`
- Schedule — `CalendarDays`
- Website — `Globe2`

Tab requirements:

- Keep visible localized labels at all widths.
- Preserve the current Arrow Left/Right, Home, and End behavior.
- Icon and text use a 6–8px gap.
- Active state uses brand text/underline only; icons inherit current color.
- Horizontal overflow remains available on narrow screens.
- Do not convert tabs into pill buttons or large cards.

### 5.6 Readiness checklist

Replace the plain circle character with semantic icons:

- unresolved issue: `AlertCircle` in warning color;
- complete state: `CheckCircle2` in success color.

Checklist header:

- Title.
- Neutral/warning badge: `N setup items remaining`.
- No percentage progress bar.

Issue row:

- 4px semantic left border plus a subtle warning-muted background only for unresolved issues.
- Icon, localized issue label, optional compact issue code, and `Resolve` action.
- Keep the code visually secondary and consider hiding it from normal users if it adds no operational value; tests and error reporting can still use it in the DOM or accessible description.
- `Resolve` remains tertiary and uses the existing destination logic.
- Do not color the entire card with a saturated fill.

Complete state:

- Existing success panel with `CheckCircle2`.
- Success color must not be replaced with brand emerald.

### 5.7 Overview and archive blockers

- Use icons only on the major readiness/fee/website status summary and blocker heading.
- Preserve blocker counts and exact resolving destination.
- Use `AlertTriangle` or `AlertCircle` plus warning text for archive blockers.
- Archive blockers remain warning, not danger, until the user enters the actual archive confirmation.
- Keep batch and dependency counts aligned with tabular numerals.

### 5.8 Batch cards

- Use `.course-record-card` as a compact operational card with consistent header, status badge, and definition-list metrics.
- Localize batch status values.
- Use `Users` for enrolment count and `CircleDollarSign` for fee configuration only if those values already exist in the current projection.
- Do not add new metrics or infer missing data.
- On mobile, keep status top-right and metrics in a two-column key/value grid where space allows.

### 5.9 Teacher coverage matrix

The CSS already reads `--coverage-columns`; add the missing JSX value to `.coverage-matrix`:

```tsx
style={
  {
    "--coverage-columns": Math.max(coverage.batches.length, 1),
  } as React.CSSProperties
}
```

Requirements:

- The first column remains sticky on horizontal scroll if it can be implemented without obscuring focus/hover content.
- Column count must match the rendered batch headers exactly.
- `CheckCircle2` plus teacher name for covered cells.
- `AlertCircle` plus localized `Missing` for uncovered cells.
- Preserve visible text; color is never the only difference.
- Header and row borders stay hairline and neutral.
- At mobile widths, horizontal scrolling is acceptable; do not shrink Bangla subject/batch names below a usable width.

### 5.10 Website status

- Use `Globe2` and a localized Published/Not published label.
- Retain the existing Website CMS link/action and current data source.
- Do not add Website CMS controls here.

### 5.11 Drawer polish

- Replace the text multiplication sign with the shared `X` icon while retaining the localized close label.
- Keep the title, step label, form, and sticky actions visually separated by existing tokens.
- Style the nested Advanced `<details>` consistently but more quietly than operational action accordions.
- Ensure the focus outline is not clipped by the drawer or sticky footer.
- Preserve the current dirty-state behavior.

## 6. `CourseOperations.tsx` implementation plan

### 6.1 Restructure for readability

The current component is compressed into very long JSX lines. Reformat it into named blocks without changing behavior.

Recommended local helpers:

- `WorkspaceActionSummary`
- `LifecycleStatus`
- `ActionFeedback`
- localized weekday formatter, if it can remain a pure presentation helper

These helpers stay in `CourseOperations.tsx` unless they become reused outside the file.

### 6.2 Accordion summary contract

Every `<details className="workspace-action">` summary should use the same structure:

```text
[leading icon] [title + optional helper text] [optional count/status] [chevron]
```

Rules:

- Use `Plus`, `UserPlus`, `Link2`, `UserMinus`, `Unlink`, `CalendarPlus`, or `CalendarX2` only where the meaning is exact.
- Use an explicit `ChevronDown` element under `.workspace-action-chevron`.
- Keep native `<details>/<summary>` keyboard and disclosure behavior.
- Hide the browser's default marker with CSS only after the custom chevron is present.
- Rotate the chevron under `details[open]`; the title and leading icon do not animate.
- Minimum summary height: 44px desktop and mobile.
- Open state uses a stronger neutral/brand border, not a large colored background.
- Do not move or scale the accordion on hover.

### 6.3 Accordion content and forms

- Separate the summary and content with a hairline border only when open.
- Give forms 16px padding and consistent 16px vertical gaps.
- Use two columns where fields are naturally paired and collapse to one column on narrow screens.
- Preserve native label/input relationships and required indicators.
- Keep primary submit actions at the end of each form.
- Full-width primary buttons are allowed on mobile only.
- Inputs use the established focus ring; do not add shadows or colored glows.
- Busy state must continue disabling the relevant action.

### 6.4 Batch actions

- `Create batch`: use `Plus` or `Layers` in the summary, not a raw `+` character.
- `Batch lifecycle`: show localized planned/active/completed/archived status badges.
- Keep Activate, Complete, and Archive actions visually distinct by meaning:
  - Activate: primary/brand only when it is the row's clear next action.
  - Complete: secondary/neutral or info semantics.
  - Archive: tertiary until confirmation, then danger.
- Use `Archive`, never `Trash`.

### 6.5 Subject and teacher actions

- `Link subject`: `Link2`.
- `Assign teacher`: `UserPlus`.
- `End assignments`: `UserMinus` with a neutral/warning treatment, not danger.
- `Unlink subject`: `Unlink` with a warning treatment until confirmed.
- Show batch and subject context for assignments instead of teacher + subject alone when the data is already available.
- Preserve the same Convex mutations and current date behavior.

### 6.6 Schedule actions

- `Add routine`: `CalendarPlus`.
- `Cancel routines`: `CalendarX2`.
- Replace numeric weekday display with localized weekday names using the existing numeric value; this is display-only.
- Keep time values aligned with tabular numerals.
- Conflict panel uses danger icon, text, conflicting type, and time. It must remain `role="alert"`.
- No-conflict state uses success icon/text and must not visually overpower the submit action.
- Keep submit disabled while authoritative preview conflicts exist.

### 6.7 Confirmations

The current components use `window.confirm`, which conflicts with `DESIGN.md`.

Within this UI-only scope:

- Reuse the repository's existing custom dialog component for batch archive, subject unlink, course complete/archive, and dirty-discard confirmation where practical.
- Preserve the same mutations and confirm/cancel branches.
- Do not use a native browser confirmation in the final polished workspace.
- Confirmation copy must state what will happen and what dependencies may block the action.

If replacing every confirmation would materially expand the implementation beyond the three production files, record it as a required follow-up rather than introducing another modal pattern.

### 6.8 Feedback

- Success feedback: success icon, success text/border, `role="status"`.
- Mutation error: danger icon, danger text/border, `role="alert"`.
- Do not render success and error through the same untyped visual style.
- Keep messages in the user's locale when the code already supplies localized text; backend errors remain safely readable.

## 7. `globals.css` implementation plan

Limit changes to course-workspace selectors and responsive extensions.

### 7.1 Shared icon alignment

Add scoped classes such as:

- `.course-icon-label`
- `.course-metric`
- `.course-status-item`
- `.workspace-action-summary-icon`
- `.workspace-action-chevron`

Use `display: inline-flex`, `align-items: center`, and a token-based gap. Icons use `flex: 0 0 auto` so Bangla labels wrap independently.

### 7.2 Course cards

- Normalize border radius to 8px.
- Selected state: `border-color: var(--brand-deep)` and `background: var(--brand-muted)` plus a stable inset/left indicator.
- Hover: neutral-to-brand border transition only.
- Focus-visible: existing 3px focus outline with sufficient offset.
- Remove font weights above 600.
- Use monospace style for course codes if it improves alignment.
- Avoid ordinary card shadows.

### 7.3 Tabs

- Icon/text layout with 6–8px gap.
- Active underline and text transition approximately 160ms.
- Keep neutral inactive text and brand-deep active text.
- Preserve horizontal overflow and focus visibility.

### 7.4 Readiness rows

- Three-column layout: icon, content, action.
- Warning state: 4px warning side border and warning-muted background.
- Complete state: success icon/panel; do not render unnecessary completed rows if the payload only contains issues.
- Responsive collapse keeps the action aligned under content on mobile.
- Use semantic modifier classes such as `.is-warning` and `.is-complete`; avoid positional selectors for meaning.

### 7.5 Coverage matrix

- Keep the dynamic `repeat(var(--coverage-columns), ...)` rule.
- Add sticky first column only with matching backgrounds and z-index.
- Ensure all generated cells share identical column definitions.
- Covered cell: neutral background with success icon/text.
- Missing cell: danger-muted background plus danger icon/text.
- Preserve a minimum width and horizontal scrolling.
- Remove weights above 600.

### 7.6 Operational accordions

- Normalize to 8px radius and neutral canvas background.
- Custom summary marker and chevron.
- `details[open]` uses border-focus/brand-deep and a hairline content divider.
- Hover changes border/background only.
- Chevron rotation is the only transform.
- Form controls retain existing global dimensions and focus states.

### 7.7 Responsive behavior

Desktop ≥ 901px:

- Sticky course list.
- Two-column master/detail.
- Two-column record cards/forms where appropriate.

Tablet 641–900px:

- Single-column master/detail.
- Course cards in two columns only if each remains at least 280px wide; otherwise one column.
- Tabs scroll horizontally.

Mobile ≤ 640px:

- One-column course cards and forms.
- Full-width primary actions where needed.
- 44px targets.
- No clipped focus outlines.
- Coverage matrix scrolls horizontally.
- Bangla labels may wrap to two or more lines; no fixed text height.

### 7.8 Reduced motion

Add a scoped rule:

```css
@media (prefers-reduced-motion: reduce) {
  .course-list-card,
  .course-tabs button,
  .workspace-action,
  .workspace-action-chevron {
    transition: none;
  }
}
```

## 8. Accessibility acceptance requirements

- All icons paired with text are hidden from the accessibility tree.
- Icon-only controls have localized accessible names.
- Current course uses both visual selected state and `aria-current`.
- Tabs keep correct `role`, `aria-selected`, roving `tabIndex`, and keyboard navigation.
- Native details elements remain keyboard-operable.
- Custom chevrons do not become separate focus targets.
- Success, warning, danger, and neutral states always include text.
- Mutation errors use `role="alert"`; nonurgent success uses `role="status"`.
- Focus indicators meet the existing 3px rule and are never clipped.
- Touch targets meet 44×44px on mobile.
- The coverage matrix retains row/column semantics after styling.
- Bangla content is verified for line-height, wrapping, and zero negative tracking in headings.

## 9. Implementation sequence

### Step 1 — structural cleanup

- Reformat `CourseOperations.tsx` into maintainable JSX blocks.
- Add local icon maps and small presentation helpers.
- Preserve all existing data calls and event behavior.
- Add missing `--coverage-columns` JSX assignment.

### Step 2 — semantic presentation

- Localize raw lifecycle/status labels.
- Add restrained icons to heading, filters, cards, tabs, readiness, actions, and feedback.
- Replace raw `+`, `○`, `✓`, and `×` glyphs where Lucide improves consistency.
- Ensure icon usage follows Section 3.1.

### Step 3 — scoped CSS refinement

- Normalize tokens, radii, font weights, gaps, borders, and transitions.
- Style course cards, readiness rows, matrix cells, accordions, and feedback states.
- Add responsive and reduced-motion behavior.

### Step 4 — confirmation and accessibility pass

- Reuse the existing dialog for browser confirmations where feasible within scope.
- Verify focus, announcements, keyboard interactions, and accessible names.

### Step 5 — tests and visual QA

- Add component tests before final styling cleanup.
- Run the complete automated gate.
- Perform bilingual responsive verification.

## 10. Automated verification plan

### Component tests

`CoursesWorkspace.test.tsx` should verify:

- Search input and New course action retain accessible names after icons.
- Selected course exposes `aria-current`.
- Section tabs retain labels, roles, selected state, and keyboard navigation.
- Readiness issue count and Resolve actions render without a client-calculated percentage.
- Archived course exposes read-only status.
- Coverage matrix receives the correct CSS custom-property value for zero, one, and multiple batches.
- Icons paired with labels are `aria-hidden`.

`CourseOperations.test.tsx` should verify:

- Each action panel remains a native details/summary disclosure.
- Summary titles are accessible and chevrons are not focusable.
- Existing mutation references receive the same arguments after restructuring.
- Submit buttons retain disabled/busy/conflict behavior.
- Conflict output remains an alert.
- Success feedback remains a status message.
- Lifecycle actions remain available only for their current statuses.

### Existing tests

Retain and run `courseWorkspaceState.test.ts` to ensure the visual work does not alter URL/session helper behavior.

### Commands

Run targeted tests during implementation, then:

```text
npm run typecheck
npm test
npm run lint
git diff --check
```

Because these are client-component changes on a Next.js 16 application, also run before final handoff:

```text
npm run build
npm run test:e2e
```

## 11. Manual verification matrix

Run the local application and verify both `/bn/owner/courses` and `/en/owner/courses`.

### Viewports

- Desktop: approximately 1440px.
- Tablet: approximately 768px.
- Mobile: approximately 390px.

### Course states

- No course selected.
- Draft with multiple readiness issues.
- Ready draft.
- Active course.
- Completed course.
- Archived read-only course.
- Missing snapshot / Calculating state.

### Data-density cases

- Long Bangla and English course names.
- Zero batches.
- One batch.
- Six or more batches in the coverage matrix.
- Several subjects and multiple assigned teachers.
- Schedule conflict and no-conflict states.
- Long mutation error text.

### Interaction walkthroughs

- Search and lifecycle filters.
- Course selection and keyboard tab navigation.
- Course creation drawer and dirty-discard warning.
- Batch creation and lifecycle actions.
- Subject linking/unlinking.
- Teacher assignment/end.
- Routine creation, conflict preview, and cancellation.
- Course activation and archive-blocker resolution.

### Visual checks

- No gradients or decorative shadows.
- No button or card uses an unintended pill shape.
- No text weight exceeds 600.
- Brand emerald is used for action/navigation, not success.
- Status colors match the semantic mapping.
- Icons do not dominate text or repeat unnecessarily.
- Focus indicators remain visible.
- No clipped Bangla conjuncts.
- No horizontal page overflow; only intended tab/matrix regions scroll.
- Reduced-motion preference disables transitions.

## 12. Completion criteria

The enhancement is complete when:

- The three production files remain the only functional implementation scope.
- Existing Convex calls and URL/page-state behavior are unchanged.
- Course cards, header, tabs, readiness, batches, coverage, schedules, website status, and action panels share one restrained visual language.
- Lifecycle and readiness labels are localized rather than exposing raw backend values.
- Icon use improves scanning without replacing text or increasing clutter.
- No fabricated readiness percentage is shown.
- Coverage columns align for any rendered batch count.
- Native disclosures remain accessible and use only a state-driven chevron rotation.
- Browser-native confirmations are removed or documented as a specific follow-up if shared-dialog reuse cannot fit the agreed scope.
- English and Bangla pass desktop, tablet, and mobile checks.
- Typecheck, tests, lint, build, E2E tests, and `git diff --check` pass.

## 13. Expected outcome

After implementation, the Owner Courses Workspace should feel faster to read and safer to operate while remaining recognizably Dhrubok: compact, bilingual, semantic, minimally animated, and focused on the owner's next operational decision.
