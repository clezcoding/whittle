# Whittle — design system

> Whittle: to carve something down, one shaving at a time.

## Concept card

| | |
|---|---|
| **Idea** | Your Mac is a block of wood. Whittle takes off only what is not part of the shape, and shows every shaving as it leaves. |
| **Metaphor** | Whittling: knife, blade angle, the cut, the curl that rolls off the board. |
| **Anchor** | The name. A shaving is the one object that is both *waste* (what you remove) and *proof* (how much you removed). That is exactly what a cleaner reports. |
| **Signature** | **The curl.** The logo shaving is also the progress indicator: while a scan runs it unrolls along its own centerline. When you apply a plan, every cleaned category peels off its bar along the blade angle and rolls into the total at the top. |
| **Emotion** | A sharp tool you trust. Calm, exact, no drama. |
| **Motion verb** | **Peel.** Things leave along a 28° bevel (clip-path wipes at the blade angle), then settle. Nothing bounces. |
| **Screenshot frame** | The dashboard: one huge number (reclaimable space) in Switzer 600 with the red cut beside it, the curl above it half unrolled. |

Swap test: *"The app is a block you carve down"* does not survive a move to a photo editor or a
password manager; it is specific to deleting, trimming and tidying. That is the point.

## Palette

Tech-precise archetype, with the accent taken from the object (the red of a Swiss pocket knife),
not from a trend. Red is **only ever the cut**: the logo sliver, the i-dot, the primary button's
bevel, destructive confirmation, focus ring. Never decoration.

| Role | Dark (default) | Light | Use |
|---|---|---|---|
| `ground` | `#0E1012` graphite | `#F1F1EE` | window background |
| `surface` | `#15181B` | `#E8E8E4` | panels |
| `raised` | `#1B1F23` | `#FFFFFF` | rows, popovers |
| `ink` | `#ECEEF0` blade steel | `#0E1012` | text |
| `muted` | `#8B939B` | `#5B6168` | secondary text (AA on ground) |
| `line` | `ink @ 10%` | `ink @ 12%` | hairlines |
| `cut` (accent) | `#FF3B2F` | `#E5281C` | the cut, focus, destructive |
| `shaving` | `#E8D2AE` birch | `#9A7B45` | reclaimed / saved values |

Avoided on purpose: green-on-black "terminal" accent, purple gradients, cream + terracotta.

## Type

- **Switzer** (Fontshare, free for commercial use): the whole UI. Neutral Swiss grotesk; weights
  400, 500, 600, 700. Display numbers at 600 with tracking −0.045em, leading 0.85.
- **Geist Mono** (Google, OFL): sizes, paths, counts. `font-variant-numeric: tabular-nums` always.
- Scale (px): 12 / 13 / 15 / 20 / 32 / 56 / 168 (the one hero number).
- Sizes are always set in mono with the unit in `muted`: `12.4 GB`.

## Layout

- 8 px base grid, 12-column content area, 24 px gutter, 56 px window chrome (title bar overlay).
- Left rail 232 px (modules), content max 1040 px, review list is a dense table (40 px rows).
- Alignment rule: numbers right-aligned on the same baseline column across all sections.

## Shape

- One radius: **10 px**. Panels 10, controls 8 (nested radius = outer − padding), pills full.
- One bevel: **28°**. Used for the primary button's left edge (with the red sliver), the
  progress wipe, and the peel animation. Nowhere else.

## Motion

- One easing family: `cubic-bezier(.2, .7, .1, 1)`; 120 ms hover, 240 ms state, 520 ms peel.
- Hover on primary targets moves the *inner* text (a 4 px slide) and advances the red sliver.
  Utility links change colour only.
- Idle: the dashboard curl breathes (±1.5° rotation, 9 s). Off under `prefers-reduced-motion`.
- Reduced motion: the peel becomes a 120 ms opacity change, the scan curl becomes a determinate bar.

## Composition (GUI)

```
┌────────┬──────────────────────────────────────────────┐
│ ⟲ mark │  Scan                              ● idle    │
│        │                                              │
│ Clean  │  48.2 GB          ← 168px, birch value       │
│ Apps   │  can be removed   ← 15px muted               │
│ Dev    │                                              │
│ Tidy   │  ▌████████ Caches        21.4 GB   Safe      │
│ Dupes  │  ▌█████    Dev           17.9 GB   Safe      │
│ ────── │  ▌███      App leftovers  6.1 GB   Review    │
│ History│  ▌█        Installers     2.8 GB   Safe      │
│        │                                              │
│        │  [ Review & clean ]  Quarantine · 30 days    │
└────────┴──────────────────────────────────────────────┘
```

Each section uses a different layout family (hero number, bar table, dense review list, tree
diff for tidy, history timeline). No equal-card grids.

### Analysis pages (Insights, Apps, Rules, Quarantine)

- **One data colour.** Charts use birch fading into the surface (`--t1` … `--t6`). Red stays "the
  cut": it marks only *manual* risk (an outlined tile or segment) and focus.
- **Risk is a shape and a word.** Safe is solid, review is hatched, manual is outlined, in every
  chart (risk bar, treemap tiles, legends). Never colour alone.
- **A donut is allowed as data, not as a verdict.** It shows share by category in one hue. There is
  no score, no gradient ring and no "health" number anywhere.
- **Numbers carry the chart.** Every bar, tile and segment has its size printed next to it, in
  mono, right-aligned.
- **Motion is the same verb.** Bars and arcs grow along the 28° wipe, tiles settle in with a
  stagger, the drawer slides 36 px. Under reduced motion everything is instant.
- **Palette and drawer** are the only overlays besides dialogs: Escape closes, focus stays inside
  and returns to where it came from.

## Genericness test

*"Would a generic model land here for 'beautiful macOS cleaner'?"* It would: translucent
sidebar, gradient ring chart, green/blue "health score". Changed: no ring chart, no score, no
gradients; one number, one red cut, one curl, and a dense honest table.

## Honest status

Concept, tokens, logo and the GUI's first two screens are done. The full Awwwards-style QA loop
(production build, audits, critic scoring) is meant for a *marketing site*; a landing page for
`whittle.app` is on the roadmap and will run through it.
