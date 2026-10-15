# Prompt for the Instinct agent: UI assets and animations (no personal info)

Copy everything below the line into Instinct.

---

You are a senior product designer and motion designer. Create a complete, original set of UI assets and animations for a small Windows 11 desktop productivity companion called **"Hub"**. It is a slim floating sidebar that sits on the right edge of the screen, always on top, with tasks, a focus timer, health-habit reminders and quick-launch shortcuts. Everything must feel like it was designed by Apple for iOS 26 ("Liquid Glass"): calm, premium, tactile, minimal. Everything must be original work, with no copyrighted logos, no stock art and no assets lifted from other products.

## 1. Design language (follow exactly)
- **Style**: iOS 26 Liquid Glass. Frosted translucent panels, soft inner top highlight (1px, white at 25-30% opacity), hairline borders (1px, 12-14% opacity), very large continuous corner radii (panel 36px, cards 26px, buttons fully round, app tiles 22% squircle).
- **Typography**: SF Pro (fallback Segoe UI Variable, Inter). Title 28/800 with -0.7px tracking; body 15/400; captions 12-13/600 in muted colour; timer digits tabular, 30/700.
- **Colour (two themes, must both be delivered)**
  - Light "Mint": background glass rgba(244,252,248,.975), text #10332A, muted #58796D, accent #00A878, accent-2 #0AA5C7, accent-3 #F2A900, ring track rgba(16,51,42,.12).
  - Dark: glass rgba(20,24,28,.97), text #EEF6F2, muted #93AAA1, accent #2FD9A4, accent-2 #4CC9F0, accent-3 #FFB938, ring track rgba(255,255,255,.13).
  - A faint mint radial glow in the top-left of the panel (16% opacity).
- **Iconography**: 24px grid, 2px stroke, round caps and joins, optical balance, no fills except where stated, consistent corner radius of 3px. Provide each icon in two weights: outline (default) and filled (selected/active).
- **Depth**: no heavy drop shadows. Use layered translucency, subtle gradients (max 8% luminance change) and specular edge highlights.

## 2. Screens and components the assets must support
1. **Collapsed pill** (64x300, vertically centred on the right edge): check-mark with a task-count badge, a Claude-style sparkle shortcut, three tiny habit progress bars, and a mm:ss label when a focus block is running.
2. **Expanded panel** (392 wide, full height minus 14px margin): greeting header with date and a summary line ("3 tasks to do · 2 focus blocks today"), three small circular buttons (settings, pin, collapse).
3. **Focus card**: large circular progress ring (132px, 9px stroke, round cap) with time in the centre, Start/Pause and Reset pills, goal text field, duration segmented control (15, 25, 45, 60, 90).
4. **Today card**: add-task field, task rows with round checkboxes, strike-through on done, hover actions (focus-on, delete), empty state.
5. **Health habits card**: three activity-style rings (water, walk, stretch), each with a glyph in the centre and a "3/8" caption.
6. **Quick launch card**: 4-column grid of squircle app tiles with glyph and label, plus a wide "Open terminal assistant" button.
7. **Settings card**: toggles, number steppers, link list with remove buttons.
8. **Notification banner** (400x92, top-centre of the screen): large rounded glass capsule with an icon tile, title, one-line body and Snooze / Done pills. Variants: water, walk, stretch, focus-block-done.
9. **App icon / tray icon**: mint gradient squircle with a white check mark inside a subtle ring.

## 3. Deliverables (produce all of these)
A. **Icon set** (outline + filled, light + dark): check, check-circle, plus, close, gear, pin, chevron-right, chevron-left, sparkle, mail, github-style code-branch (generic, not the real logo), chat-bubble, terminal, link, trash, pencil, play, pause, reset, clock, target, water-drop, walking-figure, stretching-figure, flame (streak), bell, moon, sun. Export as clean optimised **SVG** (viewBox 0 0 24 24, `currentColor`, no inline styles, no IDs that could clash) plus 256px PNG previews.
B. **App icon**: SVG master + PNG at 16, 24, 32, 48, 64, 128, 256 px and a multi-size .ico. Also a monochrome tray-icon variant (16 and 32 px).
C. **Illustrations** (flat-glass, mint palette, 320x200 SVG each, light + dark): empty tasks, all tasks done (calm celebration), focus-block complete, hydration reminder, walk reminder, stretch reminder. Friendly and abstract, no faces, no text.
D. **Animations** (see section 4) as **Lottie JSON** where possible and **pure CSS/SVG** fallbacks (no JS), each with a `prefers-reduced-motion` static alternative.
E. **Design tokens** file (`tokens.json` and `tokens.css`) covering colour, radius, spacing (4px base), type scale, shadow/blur, duration and easing, for both themes.
F. **Component sheet**: one HTML page that shows every component in light and dark with live animations, so the whole system can be reviewed at a glance. It must work offline (no external requests, no web fonts that need a network).
G. **README** listing every file, its purpose, sizes and how to use it.

## 4. Motion specification
General: 60fps, GPU-friendly properties only (transform, opacity, stroke-dashoffset), no layout thrash. Provide the exact timings below as CSS custom properties.
- **Easing**: spring-like `cubic-bezier(0.2, 0.9, 0.25, 1)` for entrances and size changes; `cubic-bezier(0.4, 0, 0.2, 1)` for fades; linear for timers.
- **Panel expand / collapse** (320ms): pill grows to full panel with the corner radius morphing 32px to 36px; content fades in 80ms after the size change starts (200ms), fades out in 80ms on collapse. Provide as a CSS keyframe/transition recipe and a Lottie.
- **Card entrance** (350ms, staggered 40ms): translateY 8px to 0 with opacity 0 to 1.
- **Focus ring**: stroke-dashoffset animates linearly once per second; add a gentle 2s breathing glow (opacity 0.85 to 1) while running; on completion the ring does a soft pulse (scale 1 to 1.04 to 1, 450ms) and a ring-shaped ripple expands and fades (600ms).
- **Checkbox complete** (260ms): outline circle fills with accent, check mark draws on (stroke-dashoffset 24 to 0), slight scale 1 to 1.12 to 1, row text strikes through left to right and fades to muted.
- **Habit ring +1** (500ms): ring arc eases to the new value with a small overshoot (2%), the centre glyph bounces (translateY 0, -3px, 0), the caption number rolls up like an odometer.
- **Habit ring goal reached**: arc closes, a soft sparkle burst of 8 tiny particles radiates and fades (700ms), the glyph swaps to a filled variant.
- **Notification banner**: slides down from -120px with spring overshoot (500ms), icon tile does a single gentle wiggle, auto-dismisses by sliding up (300ms). Variants: a droplet that fills, a footstep pair that alternates, a figure that stretches arms overhead.
- **Button press**: scale 0.96 over 120ms, release back with a slight overshoot.
- **Hover on quick-launch tile**: scale 1.04, brightness +12%, 150ms.
- **Empty states**: slow ambient loops (6-10s) that never distract: a floating check mark, drifting soft blobs.
- **Streak flame** (optional extra): subtle flicker, 3s loop.
- **Reduced motion**: replace all motion with instant state changes or 100ms opacity fades; no parallax, no loops.

## 5. Technical constraints
- Output must be plain files: SVG, CSS, JSON, PNG, ICO, HTML. No frameworks, no build step, no external CDN, no fonts fetched online, no tracking.
- SVGs: optimised, under 4 KB each where possible, accessible (`role="img"` and `<title>` on illustrations, `aria-hidden` on decorative glyphs).
- Contrast: all text and essential icons at least WCAG AA (4.5:1 for text, 3:1 for icons) in both themes; check and state the ratios in the README.
- Everything must render correctly on a transparent background and at 100%, 125%, 150% and 200% scaling (use whole-pixel strokes where it matters).
- Keep the total package under 5 MB.

## 6. Process
1. First reply with a short design rationale (5 bullets) and the file tree you will produce. Do not ask questions; make sensible decisions.
2. Then generate everything, grouped in folders: `/icons`, `/app-icon`, `/illustrations`, `/animations`, `/tokens`, `/sheet`.
3. Finish with a self-review table: each deliverable, done or not, and any compromise you made. Fix anything that fails your own contrast, size or reduced-motion checks before finishing.

Quality bar: it should look like a first-party Apple utility, with restraint and polish. Fewer, better details. If a choice is between "more decorative" and "calmer", choose calmer.
