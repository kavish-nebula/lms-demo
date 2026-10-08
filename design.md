# design.md — Design system

The visual language of Nebula KnowLab: the **"Frosted Aura"** system — warm paper neutrals, a frosted-glass elevation model, and an indigo-led accent palette measured from the *Forma* Figma template (`forma/index.html` is the token reference).

> Where things live: all tokens and component CSS are in `lms-feature/src/index.css`. Shared primitives in `src/ui/bits.jsx`, `GlassCard.jsx`, `TopNav.jsx`. Motion variants in `src/motion.js`.

---

## 1. Principles

1. **Paper, not dark-mode tech.** Background is warm off-white (`#F5F6F1`) with two fixed, very soft radial color washes (indigo top-right, coral left) — the "aura".
2. **Frosted elevation.** Surfaces are white cards with hairline borders and soft, low-opacity shadows; the sticky nav is `rgba(255,255,255,.92)` + `backdrop-filter: blur(8px)`.
3. **One accent, functional color elsewhere.** Indigo is the only brand accent; teal/coral/amber/ok/err/info carry meaning (status, highlights), never decoration.
4. **Motion is optional.** Every animation respects the learner's reduced-motion setting (`MotionConfig`), and page transitions are subtle (`motion.js`).
5. **Accessibility floor.** Muted inks are contrast-tested (e.g. `--faint` carries 11.5px mono text at 4.6:1); visible focus rings; text scale setting.

## 2. Design tokens (`:root` in `index.css`)

### Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F5F6F1` | app background (warm paper) |
| `--bg2` / `--panel` | `#FFFFFF` | card surfaces |
| `--panel2` | `#EDEDE8` | subtle fills, hover chips |
| `--line` | `#E4E5DE` | hairline borders |
| `--text` | `#20201D` | primary ink |
| `--muted` | `#55554E` | secondary text |
| `--faint` | `#6E6E67` | tertiary/mono small text (4.6:1) |
| `--accent` / `--accent-ink` / `--accent-deep` | `#7D6CFF` / `#574BD8` / `#4F46E5` | brand indigo: glow / text-safe / solid |
| `--accent-soft` / `--accent-line` | `#EFEFFB` / `#C9C4F5` | accent fills / accent borders |
| `--coral` | `#EF795E` | secondary highlight (hooks, alerts) |
| `--teal` / `--amber` / `--plum` | `#8ED0C3` / `#D97706` / `#282334` | supporting hues (node canvas, warnings, dark panels) |
| `--ok` / `--err` / `--info` / `--warn-ink` | `#2f8f6b` / `#c0564e` / `#4a7d96` / `#a0651a` | status inks, each with `-soft` (10% fill) and `-line` (40% border) companions |

**Rule:** components must use tokens, never raw hex. Status colors always pair `-soft` fill + `-line` border + `-ink` text.

### Typography

| Token | Value |
|---|---|
| `--font` | `'DM Sans', system-ui, -apple-system, sans-serif` |
| `--mono` | `'JetBrains Mono', ui-monospace, monospace` |
| Scale | `--fs-xs 13.5 · --fs-sm 15.5 · --fs-base 17 · --fs-md 19.5 · --fs-lg 24 · --fs-xl 32 · --fs-2xl 43.5` (px) |

Headings use `-0.02em` letter-spacing; body line-height 1.55. The mono face is reserved for code, workflow expressions and node labels.

### Space, radius, elevation, nav

| Group | Tokens |
|---|---|
| Spacing | `--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 24 · --s6 32 · --s7 48` (px) |
| Radius | `--r-sm 10px · --r 16px · --r-lg 20px` |
| Shadows | `--shadow-sm/md/lg` — soft, large-blur, low-opacity (frosted feel) |
| Nav height | `--nav-h 64px` (106px under 900px) |

## 3. Core primitives

Defined once in `index.css`, reused everywhere:

- **`.glass`** — the card: white surface, `--line` border, 20px padding, `--shadow-sm`. Variants: `.pad-lg`, `.hover` (lifts on hover with accent border).
- **`.btn`** — 11px-radius pill-ish button, 600 weight, hover lift + accent border; `.btn.primary` uses accent-deep.
- **`.chip`** — small pill label (nav meta, statuses).
- **`.topnav`** — sticky frosted bar; `.topnav-links a.active` gets a `.nav-pill` (accent-soft fill + accent-line border) behind the label.
- **Inputs, tables, dialogs** (`QuestionDialog.jsx`), progress rings (`ProgressRing.jsx`) follow the same token pattern.

## 4. Component inventory (`src/ui/`)

| Component | Purpose |
|---|---|
| `TopNav.jsx` | frosted sticky nav + logo mark (orbit SVG from `bits.jsx`) |
| `GlassCard.jsx`, `bits.jsx` | card + primitives (`Btn`, `Chip`, `NebulaMark`, …) |
| `ProgressRing.jsx` | circular progress for dashboard/course cards |
| `ModuleRail.jsx`, `ModuleSteps.jsx` | module navigation rail + stage step list in the player |
| `AdaptedStrip.jsx`, `AdaptationList.jsx` | the "this lesson is adapted because…" explanations (product rule: every adaptation is visible) |
| `QuestionDialog.jsx` | quiz/scenario question modal |
| `CredentialCard.jsx` | earned-certificate card (portfolio/complete) |
| `DemoPanel.jsx` | demo jump-points panel (top bar **Demo** menu) |
| `ErrorBoundary.jsx` | top-level crash guard |

## 5. Motion

- Variants centralized in `src/motion.js` (e.g. `page` for route fades/slides).
- Route transitions via `AnimatePresence mode="wait"` keyed by pathname.
- `MotionConfig reducedMotion={adapt.reduceMotion ? 'always' : 'user'}` — the learner's Profile setting wins.
- Canvas narration beats use `useAudioBeat` for node highlight pulses; keep pulses gentle (opacity/scale ≤ 1.05).

## 6. Accessibility

- Focus: global `:focus-visible` = 2px `--accent-ink` outline, 2px offset, rounded.
- Contrast: muted/faint inks tested against `--bg`/`--panel` (see token comments in `index.css`).
- Text scale: Profile setting adds a root `.text-lg` class; sizes should flow from `--fs-*` so scale propagates.
- Reduced motion: honored for page transitions, canvas pulses, and micro-interactions.
- Touch/nav: nav links horizontally scrollable under 900px; primary actions ≥ 40px hit height.

## 7. Layout & responsive behavior

- App shell: full-width with `clamp(16px, 3vw, 44px)` side padding; content max-widths set per page (readable ~70ch for prose).
- Breakpoint: single soft breakpoint at **900px** — nav wraps to two rows (`--nav-h` 106px), rails collapse above content.
- The workflow canvas is horizontally scrollable on small screens; nodes keep minimum readable size.

## 8. The `forma/` reference

`forma/index.html` is a static, light-theme LMS template whose tokens were **measured** into this app's `:root` (comment in `index.css`: "Forma palette — warm neutrals + indigo"). Treat it as the source of truth for palette heritage and inspiration for future surfaces — but the live tokens in `index.css` always win. Small divergences (e.g. `--muted`, accent names) are intentional.

## 9. Adding new UI (checklist)

1. Use existing tokens (`--fs-*`, `--s*`, `--r*`, color inks); no raw hex, no new shadows.
2. Compose from `.glass` / `.btn` / `.chip` before inventing new classes.
3. Add CSS to `index.css` under a commented section header (`/* ---------- xxx ---------- */`), matching file organization.
4. Check both motion paths (normal + reduced), focus states, and the 900px breakpoint.
5. Reusable? Promote to `ui/bits.jsx` rather than duplicating markup.
