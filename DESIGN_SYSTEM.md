# Pixora — Design System

Source: [Figma — pixora-designathon-codefest](https://www.figma.com/design/6tSLBq0pLLqarbJms4Vhca/pixora-designathon-codefest?node-id=47-81)

Pixora is a smart-home / building-access app (residents of an apartment tower: entry passes, device controls, activity). This doc captures the visual language and component inventory as designed, plus notes on how each maps to buildable frontend components.

> **Style direction (see memory):** monochrome black/white base — color is reserved for status only (locked/unlocked, active/inactive, temperature). Don't introduce arbitrary brand colors; if a new state needs color, ask whether it's a *status* before picking one.

---

## 1. Color

| Token | Value (approx) | Usage |
|---|---|---|
| `color/bg/base` | `#FFFFFF` | App background, card default surface |
| `color/bg/inverse` | `#0A0A0A` – `#141414` | Hero header image overlay, primary "black" cards (Front door, Living room AC, active quick-controls) |
| `color/text/primary` | `#111111` | Body text, headings on white |
| `color/text/inverse` | `#FFFFFF` | Text on black cards/header |
| `color/text/secondary` | `#8A8A8A` / `#9A9A9A` | Labels, timestamps, helper text ("Inside", "6:00 PM", "off") |
| `color/border/subtle` | `#EAEAEA` | Card outlines on white surfaces, list dividers |
| `color/status/success` | `#2ECC71`-ish green | "Locked" pill dot, "Active" pill/badge |
| `color/status/accent` | `#3B82F6`-ish blue | Progress bar fill for a scheduled/in-progress pass ("Uber…", 6:00–?) |
| `color/status/pink` (avatar accents) | pink/magenta chip | Small collaborator/avatar dots in top bar — decorative, not semantic |

**Rule:** black = "on / locked / primary device tile"; white with black text = "off / secondary / neutral"; green = active/positive state; blue = in-progress/time-based state. No other hues appear — keep it that way.

## 2. Typography

Single sans-serif family (system default, e.g. SF Pro / Inter-like).

| Style | Size (approx) | Weight | Usage |
|---|---|---|---|
| Display | 28–32px | Semibold/Bold | Greeting ("Good evening, Maya") |
| Title / Card value | 18–20px | Bold | Card headline values ("Living room AC", stat numbers) |
| Body | 15–16px | Medium/Regular | Primary list/card text ("Amma & Thaththa", pass names) |
| Caption / Label | 12–13px | Regular, often uppercase w/ letter-spacing | Section eyebrows ("EXPECTED TONIGHT", "QUICK CONTROLS"), stat labels ("Inside", "Front door") |
| Micro | 11–12px | Regular | Timestamps, helper text under toggles ("Off", "6:00 PM") |

Section eyebrows use uppercase + wide tracking — a recognizable pattern, reuse it for any new section header rather than inventing a new heading style.

## 3. Spacing & Layout

- Base unit: **4px grid** (8/12/16/24 spacing steps visible between cards and text blocks).
- Screen side padding: **~20px**.
- Card internal padding: **~16px**.
- Card-to-card gap: **~12px** (horizontal in grids, vertical in stacks).
- Corner radius: large and consistent — **~20–24px** on cards/hero, **~999px (pill)** on badges, chips, search bar, and buttons. This pill/rounded-rect duality is the core shape language.
- Grid: quick controls and device cards use a **2-column grid**; horizontal-scroll rows for "Expected tonight" passes.

## 4. Components

Each entry: what it looks like → what it's *for* → how it should map to code.

### Status bar chip (top-left)
Dark pill, dot + "Tower 2 · 1204". **Why:** always-visible location/unit context. **Dev:** `<Chip icon="dot" label />`, dot color bound to a connectivity/status enum.

### Icon buttons (top-right)
Circular dark buttons — notification bell (with unread dot), avatar initials. **Dev:** standard `IconButton` circle, 40px, optional badge dot overlay.

### Hero header
Full-bleed background image + dark gradient scrim, greeting text, 3 stat chips below (Inside temp, Front door lock state, Active devices count). **Why:** gives at-a-glance home status without opening anything. **Dev:** stat chips are a reusable `StatChip{icon, label, value}` — the same component renders 3x with different data; not 3 bespoke components. Requires: current temp reading, door lock state, count of active devices.

### AI input bar
Rounded search-like input, sparkle icon (left), mic icon + send button (right), placeholder "Tell your home what you need…". **Why:** natural-language control entry point — the "smart" hook of the product. **Dev:** needs a text-input + voice-input(speech-to-text) + submit action wired to an assistant/command endpoint. This is the highest-effort component to make real — flag for backend/NLU scoping before committing to it in a demo.

### Section header
Uppercase eyebrow label + optional count pill ("2 passes") on the left, "See all" link on the right. **Dev:** `SectionHeader{title, badge?, action?}`, reused for "Expected tonight" and "Quick controls".

### Pass card (horizontal scroll)
White rounded card: avatar/icon, name, status pill ("Active"), meta line ("Main gate · Lift · Unit 1204"), time range with a progress bar, and a primary pill button at the bottom ("Share pass" / "Confirm"). **Why:** each card represents one scheduled access grant (guest, delivery, family) with its state and window. **Dev:** `PassCard{person, route, status, startTime, endTime, progress, cta}`. The progress bar is time-elapsed-in-window, not a generic loading bar — needs a real timestamp calc, not a static asset.

### Quick control tile (2×2 grid)
Two visual variants:
- **Active/dark tile** (Front door, Living room AC): black background, icon, state pill top-right (Locked / temperature stepper), bold label, sublabel.
- **Inactive/light tile** (Guest room lights, Guest room AC): white background, icon circle, on/off toggle switch top-right, bold label, sublabel ("Off").

**Why the two-tone split:** black = currently engaged/on, white = off — reinforces the monochrome-status rule instead of adding a third color. **Dev:** one `DeviceTile{device, type: lock|thermostat|switch, state, onToggle}` component with a `variant` derived from state (not authored per-instance). Thermostat tile needs +/- stepper wired to a real setpoint API; toggle tiles need a bound boolean device state.

### Toggle switch
Standard iOS-style pill switch, black knob/track when on, gray when off. **Dev:** native `Switch` component, no custom build needed.

### Stepper (− / +)
Inline within the dark thermostat tile, minus/plus flanking the temperature value. **Dev:** `Stepper{value, unit, min, max, onChange}`.

### Bottom navigation
5-tab pill-shaped bar floating above the bottom edge: Home, Passes, (center raised sparkle FAB — the AI assistant), Activity, Profile. **Why:** the center tab is elevated and iconographically distinct (assistant, not a plain nav item) to signal it's the differentiating feature. **Dev:** standard tab bar + 1 elevated center action button; keep the FAB visually special in code too, don't flatten it into a 5th equal tab.

---

## 5. Design rationale checklist (for every new screen/component)

Per [[feedback_design_rationale_devfeasible]]: before adding anything new, answer —
1. **Why does this exist?** (what user need/task)
2. **What real data/state does it bind to?** (must map to an actual field, API, or device attribute — no decorative-only UI)
3. **Does it fit the monochrome + status-color-only rule**, or does it need a case for introducing a new hue?
4. **Is it a variant of an existing component** (tile, chip, card, pill button) rather than a net-new one?

## 6. Open items / not yet locked

- Exact hex values and font family could not be read precisely without Dev Mode / edit access to the Figma file in this session — the values above are close visual estimates from the rendered frames. Recommend pulling exact tokens next time via Figma Dev Mode ("Inspect" panel) once someone with edit/view access opens it, or by re-running this with an authenticated Figma connection.
- Per [[feedback_stitch_figma_workflow]], treat these components as provisional — keep iterating in Stitch, don't rebuild this into a Figma component library until you say so.
