# Inkling Unified Design System

This file is the default source of truth for UI work in this project unless a task explicitly says otherwise. Theme-specific prompt guidelines in `src/themes/*/prompt-guidelines.md` still win for color mood and visual flavor.

## Visual Principles

- Build quiet reading software: calm, dense enough to scan, and low-distraction.
- Use theme tokens instead of one-off colors. Prefer `var(--surface-container-*)`, `var(--primary)`, `var(--on-surface)`, `var(--muted)`, `var(--ghost-border)`, and `var(--card-surface)`.
- Before designing or adding UI, read the active theme's `src/themes/*/prompt-guidelines.md` and let those instructions override generic layout instincts.
- Do not add explanatory in-app copy for new buttons or features. Use short direct button text when it is naturally one or two words; otherwise use numbered `[PLACEHOLDER n]` copy until final product wording is provided.
- The default dashboard theme is `default`; the old parchment theme is now `vintage`. Legacy saved `comic` theme IDs should resolve to `default`.
- Default dashboard backgrounds use neutral Main1 shades; keep non-premium surfaces flat. Premium may use the theme's saturated color blend; Quills stays saturated yellow.
- Keep panels rectangular and disciplined. Default radius is `8px`; use `12px` for overlays and major shells only.
- Avoid nested card visuals. A panel can contain rows or cards, but do not put floating card styling inside another floating card unless it is a modal or repeated item.
- Clickable items must show `cursor: pointer`, a border or outline change on hover, and a visible focus state.
- Measurements intended for hands-on tuning should be mirrored in `control.json`.

## Typography

- Page and panel headings: `Newsreader`, serif, for editorial emphasis.
- Operational headings and compact dashboard labels: `Space Grotesk`, sans.
- Body and controls: `Manrope`, sans.
- Numeric/stat values: `Space Grotesk`, sans, bold.
- Monospace counters or tiny technical values: `IBM Plex Mono`.

## Type Scale

- Main screen title: `clamp(1.9rem, 4vw, 3rem)`, line-height `0.96`.
- Section heading: `1.15rem` to `1.35rem`, line-height `1.1`.
- Card heading: `0.94rem` to `1rem`, line-height `1.15`.
- Body text: `0.86rem` to `0.98rem`, line-height `1.45`.
- Supporting/meta text: `0.72rem` to `0.78rem`, line-height `1.3`.
- Large stat value: `clamp(2rem, 4vw, 3.3rem)`, line-height `0.9`.
- Do not scale font size directly with viewport width outside existing clamp patterns.

## Spacing

- Page shell gap: `1rem`.
- Panel padding: `clamp(0.82rem, 1.5vw, 1.1rem)`.
- Card padding: `0.72rem` to `0.86rem`.
- Row padding: `0.56rem` to `0.72rem`.
- Tight grid gap: `0.48rem` to `0.62rem`.
- Standard grid gap: `0.82rem` to `1rem`.
- Keep fixed-format controls stable with explicit min-heights and grid tracks.

## Layout

- Dashboard sections use `dash-grid` with 12 columns.
- Primary dashboard panels span all 12 columns.
- Side rails should be visually quieter than main content and separated with one border, not stacked shadows.
- Desktop side rails with divider lines may expose draggable resize handles; hide those handles on phone layouts.
- At `1013px` wide and below, primary dashboard navigation lives in a fixed bottom icon bar. Utility actions belong in the top-right hamburger menu.
- Landing pages may use a comic-store cover layout when requested: black first viewport, large condensed red headline, blue outer page field, clean comic cover rack, and palette tokens from `control.json`.
- Comic landing flow cards may overlay the current viewport and slide right-to-left on scroll; keep the cards functional-looking only when they actually perform an action.
- Repeated lists use compact rows with icon/initial, content, and value/action columns.
- Timeline, calendar, and data views must have bounded scroll containers so parent panels do not jump.

## Components

- Buttons: `min-height: 40px` desktop, `44px` mobile. Use `action` for primary commands and `ghost` for secondary commands.
- Icon buttons: square or circular, stable dimensions, no text when an icon is enough.
- Reading tabs should look like browser tabs: rounded top corners, square bottom corners, one visual tab body, and a close affordance that darkens as its own circular target on hover.
- Cards: 8px radius, one border, muted background, restrained shadow only on top-level panels.
- Forms: labels above fields or row labels at left; inputs use `var(--surface-container-low)` and `var(--input-border)`.
- Popovers/tooltips: compact, high contrast, no long instructions unless the feature truly needs it.
- FAQ/onboarding popups are modal overlays with compact question rows; they may contain direct explanatory copy because they are the help content itself.

## Motion

- Use `140ms` to `240ms` transitions.
- Prefer opacity, border-color, background-color, or small translate changes.
- Avoid bouncing, pulsing, or looping motion except loading indicators.

## Dashboard Rules

- Overview should read as an operational dashboard, not a landing page.
- Stat cards use the same heading/value/meta structure.
- Main dashboard rows use the same row geometry: initial badge, text stack, compact value.
- Library progress and weekly pages should sit as paired overview panels on desktop and stack on tablet/phone layouts.
- Calendar and timeline panels use the same header and border treatment.
- Accent customization applies to time indicators and timeline emphasis only unless a task explicitly expands the scope.

## Reader Loading Rules

- Opening a PDF must restore the remembered page first.
- PDF preloading is limited to the active page plus 3 pages before and 3 pages after.
- Do not generate thumbnails or unrelated previews while the reader tab is loading.
- Reader progress controls may show the full page map when a task calls for complete book navigation.
