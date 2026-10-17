---
name: Isoline
description: A blue, layered glass workspace for corporate and sustainability reporting where every result arrives with its source attached.
colors:
  navy-deep: "#0e1a46"
  navy: "#172a6e"
  cobalt-deep: "#2140b8"
  cobalt: "#2f4fe0"
  cobalt-soft: "#4f6ef0"
  periwinkle: "#7f9cff"
  periwinkle-pale: "#a9bcff"
  ice: "#cfdaff"
  ice-wash: "#e6ecff"
  ice-mist: "#f4f7ff"
  ground: "#d9e2fd"
  accent-ink: "#2443c9"
  paper: "#ffffff"
  ink: "#0e1a46"
  ink-2: "#3b4a78"
  ink-3: "#5c6894"
  rule: "#dbe3f7"
  th-climate: "#9b3a0c"
  th-climate-2: "#c26542"
  th-climate-3: "#f9cab9"
  th-climate-wash: "#fef1ed"
  th-climate-ink: "#9b3a0c"
  th-energy: "#bb8b3f"
  th-energy-2: "#dfb16c"
  th-energy-3: "#e8d2b5"
  th-energy-wash: "#fbf3e9"
  th-energy-ink: "#8b5e00"
  th-water: "#2e9cbf"
  th-water-2: "#68c4e6"
  th-water-3: "#b7ddec"
  th-water-wash: "#eaf7fc"
  th-water-ink: "#00718e"
  th-nature: "#1f5a3a"
  th-nature-2: "#4b7f5f"
  th-nature-3: "#c5ddcd"
  th-nature-wash: "#eef7f1"
  th-nature-ink: "#1f5a3a"
  th-circularity: "#637942"
  th-circularity-2: "#8aa06c"
  th-circularity-3: "#d0dbc2"
  th-circularity-wash: "#f2f6ee"
  th-circularity-ink: "#556a34"
  th-pollution: "#988778"
  th-pollution-2: "#c0afa1"
  th-pollution-3: "#e5d2c2"
  th-pollution-wash: "#fbf3ec"
  th-pollution-ink: "#776658"
  th-people: "#c06092"
  th-people-2: "#e88bb9"
  th-people-3: "#f4c7dc"
  th-people-wash: "#fef0f6"
  th-people-ink: "#a5487a"
  th-valuechain: "#36786e"
  th-valuechain-2: "#639e94"
  th-valuechain-3: "#c1ddd7"
  th-valuechain-wash: "#ecf7f5"
  th-valuechain-ink: "#36786e"
  th-governance: "#704488"
  th-governance-2: "#956cad"
  th-governance-3: "#e1cded"
  th-governance-wash: "#f8f1fd"
  th-governance-ink: "#704488"
  th-economy: "#293a45"
  th-economy-2: "#4c5d68"
  th-economy-3: "#c4d9e8"
  th-economy-wash: "#edf6fc"
  th-economy-ink: "#293a45"
  data-other: "#a6a6a6"
  data-other-3: "#e4e4e4"
  sheet: "rgba(255, 255, 255, 0.94)"
  warn: "#9a5a06"
  warn-wash: "#fdf3e2"
  crit: "#c0302e"
  crit-wash: "#fdeceb"
  ok: "#157a4a"
typography:
  display:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(26px, 2.4vw, 34px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  lede:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"lnum\""
  small:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  mark: "8px"
  field: "10px"
  button: "12px"
  callout: "14px"
  chrome: "16px"
  tile: "18px"
  rail: "20px"
  band: "24px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-deep}"
  button-quiet:
    backgroundColor: "rgba(255, 255, 255, 0.8)"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-quiet-hover:
    backgroundColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.button}"
    padding: "0 10px"
    height: "32px"
  button-on-band-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  field-input:
    backgroundColor: "rgba(255, 255, 255, 0.78)"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "7px 10px"
  analysis-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "20px"
  theme-chip:
    backgroundColor: "{colors.th-climate-wash}"
    textColor: "{colors.th-climate-ink}"
    rounded: "{rounded.mark}"
    size: "22px / 28px / 40px"
  group-row:
    backgroundColor: "{colors.th-nature-wash}"
    textColor: "{colors.th-nature-ink}"
    rounded: "10px"
    padding: "7px 8px"
  glass-tile:
    backgroundColor: "rgba(255, 255, 255, 0.58)"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "20px"
  lead-figure-climate:
    backgroundColor: "{colors.th-climate-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tile}"
    padding: "20px"
  result-band:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.paper}"
    typography: "{typography.display}"
    rounded: "{rounded.band}"
    padding: "32px"
  import-preview:
    backgroundColor: "rgba(255, 255, 255, 0.8)"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "11px"
    padding: "7px 10px"
---

# Design System: Isoline

## Overview

**Creative North Star: "The Blue Survey Table"**

Isoline is a working table seen through frosted glass: a soft, grain-washed blue ground, translucent bento tiles floating above it, and one saturated cobalt band per page that states the result in a sentence. Blue is the world: navy, cobalt, periwinkle and ice carry the chrome, the band, actions, focus and text. The data is drawn in map layers over that world, but never in its blue: a thematic palette of ten hues (climate, energy, water, nature, circularity, pollution, people, value chain, governance, economy), each with a line icon and a five-tone ramp, says which subject a figure, bar, row or series belongs to. The palette was chosen by optimisation so every pair stays apart under normal vision and simulated protanopia, deuteranopia and tritanopia, and away from cobalt (2026-10-18; see docs/arastirma/F_gorsel_dil.md). Charts and tables sit on near-opaque analysis sheets so the blue ground never tints the data.

The density is that of a consultant's analysis desk: 15px body, compact controls, charts that are presentation-grade the moment they render. Numbers are the heroes and are set large and light (Geist 300, tabular, tight tracking), never bold. Trust is built by provenance rather than decoration: every data tile ends in a ruled source-note collar, and data status is drawn as line form (solid verified, dashed estimated, dotted review) in marks, chart strokes, journey nodes and flags alike.

The system is light only (user decision 2026-10-17): there is no dark theme, no `prefers-color-scheme` or `data-theme` variant, and an OS set to dark still renders the light app (`color-scheme: light`). The category default (white rounded cards with an emerald accent and leaf icons) and the plain grey dashboard are the confirmed rejections.

**Key Characteristics:**
- Frosted glass tiles (58% white, 14px blur, 1.4 saturate, white hairline, blue-tinted shadow, 18px radius) on a grain-washed radial blue ground.
- One cobalt-to-periwinkle grain band per page, carrying title, one-sentence result and actions; the band stays cobalt on every family.
- Blue for the world, ten theme ramps for the data (families scoped by `data-family` take one of them), state colours (warn, crit, ok) for meaning only, always with an arrow, icon or line form.
- Analysis sheets (94% paper) under every chart and table; theme chips, tinted group rows, in-cell bars and segmented score scales inside tables (pattern from the Paragon +Impact reference).
- Short enter-once motion: bars grow, lines draw, points pop, rows rise, figures count up, theme icons move on hover; all off under reduced motion.
- Large light tabular numerals in Geist; uppercase tracked labels only for functional metadata.
- Source-note collar on every data tile; solid/dashed/dotted line language for data status.
- Light only (user decision 2026-10-17).

## Colors

Three layers, never mixed in role: a blue hierarchy from deep navy to ice mist for the world, four map-layer family ramps for data, three state colours for meaning.

### Primary
- **Survey Cobalt** (`cobalt`): the action colour. Primary buttons, selected segmented radios, toggle on-state, focus rings, the band's starting stop, verified/required status marks, active journey paths and particles.
- **Deep Cobalt** (`cobalt-deep`): primary button hover.
- **Accent Ink** (`accent-ink`): cobalt tuned for text on light glass. Active tab text, inline "+n / more" source toggles, step numbers, tile arrow icons, on-band primary button text, upcoming-date figures.

### Secondary
- **Periwinkle** (`periwinkle`) and **Pale Periwinkle** (`periwinkle-pale`): the band's end stop, dashed estimated/indirect status marks, scrollbar thumb, field hover border, the 35% focus halo on inputs, table header and total rules.
- **Ice** (`ice`), **Ice Wash** (`ice-wash`), **Ice Mist** (`ice-mist`): selection highlight, the source-note collar rule (ice), segmented-control and icon-chip wells (ice wash at 70-80%), table row hover, quiet fills.

### Tertiary (thematic data palette)
Ten themes, defined once in `web/src/data/themes.ts` and mirrored as `--th-<id>`, `--th-<id>-2`, `--th-<id>-3`, `--th-<id>-wash`, `--th-<id>-ink` in `globals.css`. Tones: strong (primary series, icon), mid (secondary series), light (remainder, bands), wash (row and header ground), ink (text and icons on the wash, at least 4.5:1).

| Theme | Strong | Icon | Pillar | Used for |
|---|---|---|---|---|
| Climate and carbon | `#9b3a0c` | Thermometer | E | GHG, CBAM, ETS, pathway |
| Energy | `#bb8b3f` | Zap | E | energy use, renewable share |
| Water | `#2e9cbf` | Droplets | E | withdrawal, consumption, discharge |
| Nature and biodiversity | `#1f5a3a` | Trees | E | biodiversity, land, target corridors, taxonomy alignment; E pillar |
| Circularity and waste | `#637942` | Recycle | E | waste, recovery, materials |
| Pollution | `#988778` | CloudFog | E | ESRS E2 |
| People and society | `#c06092` | Users | S | workforce, OHS, equality, communities; S pillar |
| Value chain | `#36786e` | Truck | S | suppliers, value-chain workers, Scope 3 |
| Governance | `#704488` | Landmark | G | governance bodies, business conduct; G pillar |
| Economy and finance | `#293a45` | Coins | X | financial figures, annual report, taxonomy amounts |

Verified separation (CIEDE2000, smallest pair): normal at least 13.5; protanopia, deuteranopia and tritanopia at least 10; every strong tone at least 15 from cobalt, accent ink, navy, periwinkle and muted ink; every strong tone at least 3:1 on white. `web/src/lib/color.test.ts` enforces these limits and checks the CSS matches the TS source; the Themes and colours page (`/[lang]/themes`) recomputes them live.

Categories that are not themes (abatement measures, sites) take `CATEGORICAL` (water, climate, value chain, people, energy, governance, nature, circularity, economy), which alternates dark and light. At most six colours per chart.

Neutral data: `--data-other` (#a6a6a6) and `--data-other-3` (#e4e4e4) for "other", "not eligible" and deductions; grey, never blue.

**Families.** A container sets `data-family`: `compass` (cobalt ramp; overview, journey, applicability, regulations, factors, themes), `climate` (climate), `environment` (nature), `people` (people), `reporting` (economy). It exposes `--fam`, `--fam-2`, `--fam-3`, `--fam-wash`, `--fam-ink` and `--fam-solid` (the ink tone, so white text on the lead tile holds 4.5:1). Rail bars and icon chips use the family's ink and wash.

### Neutral
- **Blue Ground** (`ground`): the page base under the radial blooms; never pure white or grey.
- **Paper** (`paper`): active nav item, active tab, input wells (78%), option lists, chart point fills.
- **Navy Ink** (`ink`), **Slate Ink** (`ink-2`), **Muted Ink** (`ink-3`): primary text, secondary text, labels and captions. All three are blue-tinted.
- **Hairline** (`rule`): table rows, input borders, fieldset separators, chart gridlines. The stronger axis rule is navy (`navy`).

### State (meaning only)
- **Amber Review** (`warn`, `warn-wash`): review status, sample-data flags, warn callouts.
- **Signal Red** (`crit`, `crit-wash`): invalid input, critical callouts, per-row import issues, the "today" line on timelines.
- **Ledger Green** (`ok`): positive figures only.
- State never appears by colour alone: deltas carry an arrow (colour means good or bad, not up or down: falling emissions are green), status marks carry line form.

### Named Rules
**The Layer Hierarchy Rule.** Blue is the world, theme ramps are the data, status colours are meaning. Chrome, the band, buttons, focus and text stay blue; series, figures, mini-bars, theme chips and rail chips take a theme ramp; amber, red and ledger green speak only for state. A new tool joins a family and its data takes existing themes rather than receiving a new hue.

**The Same Theme, Same Colour Rule.** A theme keeps its hue and icon on every screen: climate is always brick with a thermometer, water always sky with droplets. In a single-theme chart the series run strong, mid, light; in a multi-theme chart each series takes its theme's strong tone.

**The Sheet Rule.** Every chart, table and data tile sits on an analysis sheet (`.glass.sheet`, 94% paper). Translucent glass is for chrome and inputs only.

**The Meaning-Only Rule.** Amber, red and ledger green appear only when they state review, error/deadline or a positive result. They are never decoration, never a family colour, never a brand accent.

## Typography

**Display Font:** Geist (with Segoe UI, system-ui)
**Body Font:** Geist (with Segoe UI, system-ui)
**Label/Mono Font:** Geist, uppercase and tracked for labels; tabular lining numerals via `font-variant-numeric` instead of a mono face.

**Character:** One geometric grotesk at every level; hierarchy comes from weight and scale contrast, with headline figures set light so the numbers feel engraved rather than shouted.

### Hierarchy
- **Display** (600, 26px mobile / 34px from md, line-height 1.25, -0.025em): the page title inside the result band only.
- **Lede** (400, 16px / 18px from md, 1.375, max 66ch, on-band 84% white): the one-sentence result under the band title.
- **Figure** (300, 28px / 32px / 38px by container width, line-height 1, -0.035em, tabular lining): governing numbers in figure tiles and overview tiles; may take the family strong colour.
- **Headline** (600, 20px, -0.01em): section heads inside detail panels (e.g. the selected journey stage).
- **Title** (600, 14-16px, tight): tile and chart titles; 17px -0.02em for the wordmark.
- **Body** (400, 15px, 1.5, lining numerals; long copy capped at 66-68ch): running text; 14-14.5px in controls and lists.
- **Small** (500, 12-13px): field labels (13px, slate ink), hints, legends, captions, source-note text (12px / 11.5px compact).
- **Label** (600, 11.5px, 0.08em, uppercase, muted ink): functional metadata only: input-group legends, rail group names, source-note keys (source, as of, boundary, unit, status), table headers (0.06em).

### Named Rules
**The Light Numeral Rule.** Headline figures are Geist 300 with tabular lining numerals and -0.035em tracking. Weight never stands in for importance on a number; size, family colour and the lead tile do.

**The Tabular Ledger Rule.** Any number that can be compared (tables, inputs, dates, percentages, chart labels) uses tabular lining numerals.

## Layout

The shell is a floating chrome on the blue ground: a sticky top bar made of three separate glass pills (brand, client switcher with sample flag, clients link plus language select), each 48px tall with 16px radius, inset 16px from the safe-area edges. Below it a 262px glass rail (20px radius) sits sticky at 76px from the top on large screens and becomes an off-canvas drawer below 1024px with a 30% navy scrim and 2px blur. Main content is capped at 1360px with a 24px gap from the rail.

Every page opens on the result band (24px padding, 32px from md, 24px bottom margin), then content in a bento. Tool pages use a two-column split from 1280px: a 340px sticky glass inputs panel on the left (scrolls internally to viewport height) and a results column on the right; below 1280px the results come first and inputs stack after them. The overview is a 12-column bento at xl (6 at md, 1 on mobile) with tiles spanning 3, 4, 5 or 7 columns and the obligations tile spanning two rows. Figure rows are container-queried: 2 columns, 4 from a 48rem container, with figure size stepping up at 28rem and 64rem.

Spacing rhythm: 24px between bento rows and major blocks, 16px between sibling tiles and figure tiles, 20px tile padding (24px from md), 12-14px inside input groups, 8px inside compact clusters.

## Elevation & Depth

Depth is optical rather than structural: a layered ground (radial blooms of periwinkle 66% top right, pale periwinkle 50% left, nature mid 18% at the bottom and ice 45% centre over a 160-degree linear wash from periwinkle-tinted ground to a 12% nature tint, fixed to the viewport, with a 14% fractal-noise grain overlay) shows through frosted glass tiles. Shadows are always blue-tinted and long, soft and negatively spread, so tiles float without hard edges. Selection lifts: active nav items, active tabs and the selected journey node gain a deeper blue shadow and, for the node, a 4px rise and cobalt ring.

### Shadow Vocabulary
- **Glass float** (`box-shadow: 0 18px 40px -22px rgba(31,52,160,0.38), 0 2px 6px -3px rgba(31,52,160,0.12), inset 0 1px 0 rgba(255,255,255,0.9)`): every glass tile, rail and chrome pill.
- **Band glow** (`box-shadow: 0 30px 60px -32px rgba(33,55,157,0.65)`): the result band only.
- **Primary press** (`box-shadow: 0 10px 24px -12px rgba(47,79,224,0.8)`): primary buttons.
- **Selected chip** (`0 6px 16px -10px rgba(31,52,160,0.6)` for tabs, `0 8px 20px -14px rgba(31,52,160,0.7)` for nav): active segmented and rail items.
- **Lifted node** (`0 24px 44px -20px rgba(31,52,160,0.75)`): the selected journey node.

### Named Rules
**The Blue Shadow Rule.** No shadow is grey or black; every shadow is tinted with deep cobalt (`rgba(31,52,160,…)` or `rgba(33,55,157,…)`), including under family-coloured lead tiles.

**The Grain Rule.** Grain lives on two surfaces only: the page ground (14% opacity) and the result band (32%, overlay blend). Tiles stay clean so charts remain legible.

## Shapes

Soft, nested radii that tighten as elements get smaller: band 24px, rail 20px, glass tiles 18px, chrome pills and journey nodes 16px, callouts and the segmented well 14px, buttons and inset panels (import preview) 12px, nav items 11px, inputs and segment buttons 10px, icon chips 8px, mini-bars 2px. Pills (9999px) are reserved for tile link buttons, the sample flag, toggles and progress tracks. Borders are 1px hairlines; a dashed border means "not yet real" (sample flag, disabled input, to-do journey node). Charts round line caps and keep bars square-topped.

## Components

### Buttons
Compact, firm and blue; they never shout louder than the result band and never take a family hue.
- **Shape:** 12px radius; 40px tall with 16px side padding (md), 32px with 12px padding (sm); 14px / 13px semibold text, 8px icon gap.
- **Primary:** cobalt fill, white text, primary-press shadow; hover to deep cobalt.
- **Quiet (default):** 80% white glass fill, hairline border, ink text; hover to paper with pale-periwinkle border.
- **Ghost:** no fill, slate ink, 10px padding; hover to a 70% ice-wash fill. Used for chart toolbars (table toggle, CSV, SVG) and cancel actions.
- **On band / On band primary:** inside the band only. On band is 12% white with a 40% white border and medium blur; on band primary is a white pill-weight button with accent-ink text and a navy shadow.
- **Disabled:** 50% opacity, not-allowed cursor. Focus everywhere is a 2px cobalt outline offset 2px.

### Chips
- **Sample flag:** pill, dashed amber border, 11px uppercase 0.08em amber text; white dashed variant on the band.
- **Status mark:** a 20px line segment (2px) beside 12.5px text: solid cobalt verified/required, dashed periwinkle estimated/indirect, dotted amber review (text also amber), solid red with strikethrough invalid, dotted muted voluntary. Status marks stay in the blue/state layer regardless of family.

### Cards / Containers
- **Corner Style:** 18px glass tiles.
- **Background:** glass (58% white; 80% for the strong variant used by tooltips, active nodes and inset previews) over the ground.
- **Shadow Strategy:** glass float (see Elevation).
- **Border:** 1px 92% white hairline.
- **Internal Padding:** 20px, 24px from md; figure tiles 16px / 20px.
- **Lead figure tile:** the first tile in a figure row drops its border and fills with a 150-degree gradient from the family solid to a 62/38 mix of the family solid with the family strong tone (`--fam`); text turns white and the figure counts up on mount and a 2px white rule draws on under the figure when the result changes.
- **Mini-bar strip:** under each figure, a row of 2px-radius bars; the marked bar is the family solid and the rest are the family solid at 28% (on the lead tile: white and 45% white); bars grow from the baseline on mount. Figure tiles other than the lead sit on analysis sheets.
- **Callouts:** 14px radius, 13.5px relaxed text; note uses glass, warn and crit use their wash with a 35% tinted border.

### Inputs / Fields
- **Style:** 78% paper fill, 1px hairline border, 10px radius, 7px 10px padding, 14.5px tabular text. Selects use the same field with a drawn chevron. Labels above in 13px medium slate ink; units right of the field in 12px muted ink; hints below.
- **Focus:** border turns cobalt with a 3px periwinkle halo at 35%; hover border pale periwinkle.
- **Error / Disabled:** invalid border signal red; disabled border dashed with muted text.
- **Toggle:** 38x22 pill, ice-wash off / cobalt on, 16px white thumb sliding in 150ms.
- **Segmented tabs:** a 14px-radius ice-wash well with a white hairline and 4px padding; segments are 32px, 10px radius, 13.5px medium; the active one is paper with accent-ink text and a selected-chip shadow.

### Bulk Data Import (CSV)
An input group inside the glass inputs panel (GHG inventory): a 12.5px muted hint, then two small quiet buttons with line icons (download template, upload file; the file input itself is hidden). After upload a preview panel appears: 12px radius, hairline border, strong glass (80% white), 12px padding, 13px text; a semibold summary line (file, line count, rows), a 12.5px slate count by category, a scrollable list (max 128px) of per-row issues in signal red, then small actions: primary "add", quiet "replace", ghost "cancel". A confirmation after applying uses the note callout.

### Navigation
- **Rail:** glass, 262px, 20px radius. Groups open with a 3px bar in the family strong colour whose length is proportional to the group's share of tools, then an uppercase label. Items are 14px, 11px radius, with a 28px icon chip (8px radius) tinted 80% ice wash with line icons in the family strong colour; the active item becomes a paper chip with semibold ink and the icon chip fills with the family strong colour and a white icon. Hover is a 60% paper wash.
- **Top bar:** three glass pills; the wordmark sits beside the three-isoline mark (cobalt, periwinkle, navy dot).
- **Mobile:** the rail slides in from the left over a navy scrim with a 200ms transform; the clients link and the sample flag hide at small widths.

### Result Band (signature)
The page's opening statement. 24px radius, a 160-degree gradient holding cobalt to 42% then easing to periwinkle, 32% overlay grain, a 28% white radial glow bleeding off the lower right, band glow shadow. It stays cobalt on every family page. It holds the display title, the one-sentence lede that moves with the data, optional aside (progress, flags) and right-aligned on-band actions that wrap below on narrow screens.

### Source-Note Collar (signature)
Every chart, table and data tile ends in a ruled collar: a 1px ice top rule, 12px slate text, uppercase keys for source, as of, boundary, unit and status, citations linked with hairline underlines, up to three shown with a "+n more" accent-ink toggle. The compact form (overview tiles) is one truncated line: status mark, first citation, "+n". The status mark repeats the line language: solid ink verified, dashed estimated, dotted amber review.

### Figure (chart tile)
A glass figure: 16px semibold title with a 13px muted caption (max 68ch), a ghost-button toolbar (table/chart toggle, CSV, SVG) hidden in print, a 12.5px legend of line, swatch or band keys, the chart (or its table), then the collar. Series are drawn from the family ramp: strong for the primary series, mid for the secondary or default-value series, light for the remainder or comparison; business-as-usual references stay navy ink, dashed. Charts use hairline gridlines, a navy axis rule, rounded 2px lines (dashed 6 5 for estimated or BAU), 12% area fills, paper-filled end points, a 45-degree hatch for estimated stacks, and a strong-glass tooltip (12px radius, 210px).

### Pathway Elevation Bands (signature)
Decarbonisation targets are drawn as stacked tinted layers beneath the lines, like contour elevations: the 1.5°C corridor in `th-nature-3`, the well-below-2°C corridor in `th-nature-wash`, the net-zero reference as a dashed nature line, and the plan ("with measures") as a 2.5px climate line over them. The overview's pathway tile repeats this in short: climate plan over a `th-nature-3` target band. Bands are legended with a 20x12 band key.

### Report Journey Flow (signature)
Stages are 16px-radius nodes on a snaking grid joined by paths with a 6px ice under-stroke. Done nodes are cobalt gradient with white text and a full white progress bar; the doing node is strong glass with a cobalt border and a spinning status icon; to-do nodes are glass with dashed pale-periwinkle borders. Completed paths are a cobalt-to-periwinkle gradient with three cobalt particles travelling along them; pending paths are dashed (6 7) and march. Nodes rise in on load with a 70ms stagger. The journey belongs to the blue world, not a family ramp.

### Analysis Kit (`web/src/components/data.tsx`)
- **Theme chip** (`ThemeIcon`): 22, 28 or 40px tile, 7 to 12px radius, theme wash with an 80% light-tone hairline and the theme's ink line icon (1.8 stroke); `solid` inverts it (ink fill, white icon) for selected rows and wedges. Each theme has its own hover micro-motion (rise, flicker, drip, sway, spin, drift, nudge) that plays once when the chip, its row or its tile (`.group`) is hovered or focused.
- **Group row** (`GroupRow`): a tinted chapter row inside a table: theme wash, ink text, semibold, chip at the start, 10px rounded ends.
- **In-cell bar** (`InlineBar`): 6px track (ice wash) with a theme fill and optional 2px ink target tick; grows from the left on mount.
- **Score scale** (`ScoreScale`): 1 to 5 segments filling up the theme ramp (light, mid, strong) with an ink value chip at the score and a dashed threshold tick.
- **Delta** (`Delta`): arrow and percentage; ok when the change is good, crit when bad, muted when flat.
- **Count-up** (`CountUp`): figures count from zero once on mount (700ms ease-out) in their own formatted shape (decimals, grouping, prefix and suffix kept); screen readers get the final text.
- **Theme ring** (`ThemeRing`, signature): outer pillar ring (E nature, S people, G governance) with curved uppercase labels; inner wedges, one per topic, whose length is the score and colour the topic's theme; material wedges solid, the rest light with a dashed ink edge; a ring of paper icon dots; the centre shows the count or the focused topic.

### Tables
Ruled, inside an analysis sheet. Theme groups open with a group row; the first cell carries a theme chip; shares draw as in-cell bars next to the number; scores as score scales; change as a delta; status as a status mark. Rows rise in with a 24ms stagger on mount. Base rules: 11.5px uppercase headers over a 1.5px pale-periwinkle rule, 8px 12px cell padding, hairline row rules, a 1.5px pale-periwinkle total rule, row hover at 55% ice wash, right-aligned numeric columns, tabular numerals throughout.

## Do's and Don'ts

### Do:
- **Do** open every page with exactly one result band that states the outcome in one sentence, with on-band button variants for its actions.
- **Do** end every chart, table and data tile with the source-note collar, including its status line.
- **Do** draw data status as line form everywhere: solid verified, dashed estimated/default, dotted review.
- **Do** set a `data-family` on any tool surface and take data accents from `--fam*`, so the family's hue ramp follows automatically.
- **Do** order a family's series by ramp step: strong for the primary series, mid for secondary or default values, light for the remainder, wash for bands and zones.
- **Do** set governing figures in Geist 300 tabular with -0.035em tracking, and lead each figure row with the family-gradient tile.
- **Do** tint every shadow with deep cobalt and keep tiles on the 58% glass recipe.
- **Do** honour reduced motion: rule-draw, flow march, spin, rise, particles, bar growth, line draw, point pop, row rise, ring entry, count-up and icon micro-motion all stop, and transitions drop to 0ms.
- **Do** keep motion enter-once and short: bars 520ms with at most 12 x 32ms stagger, lines 900ms draw, points pop after the line, rows 240ms with 24ms stagger, figures count 700ms; never replay on data refresh.
- **Do** put a theme chip on every theme-specific row, tile and card, and a group row on every themed table section.

### Don't:
- **Don't** add a dark theme, a `prefers-color-scheme` block or a `data-theme` switch; the app is light only (user decision 2026-10-17).
- **Don't** invent a hue outside the blue world, the ten theme ramps, the neutral data greys and the three state colours; change a theme hue only after re-running the separation check (`color.test.ts`).
- **Don't** draw data in cobalt, periwinkle or ice, or place a chart or table on translucent glass.
- **Don't** put a theme hue on chrome, the result band, buttons, focus rings or status marks; those stay blue.
- **Don't** fall back to the category default of white rounded cards with an emerald accent and leaf icons, or to a plain grey dashboard.
- **Don't** put grain on tiles or charts; it belongs to the ground and the band.
- **Don't** bold a headline figure or use a grey or black drop shadow.
- **Don't** use uppercase tracked labels as decorative kickers above headings; they are reserved for functional metadata (group legends, note keys, table headers).
