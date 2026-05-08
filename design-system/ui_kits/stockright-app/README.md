# StockRight Mobile App — UI Kit

High-fidelity recreation of the StockRight mobile app surface. Open `index.html` to see the running prototype.

## Files

- `index.html` — entry point; runs the click-thru prototype in an iPhone frame
- `ios-frame.jsx` — device bezel (starter component)
- `components.jsx` — atomic components: `Topbar`, `TabBar`, `Button`, `Badge`, `Input`, `Card`, `KPI`, `EntryRow`, `Toast`, all `Icon*` exports
- `screens.jsx` — full screens: `HomeScreen`, `StockScreen`, `InwardEntryScreen`, `PartiesScreen`, `SettingsScreen`
- `app.jsx` — wiring, navigation state, toast/queue state, dark-mode toggle

## What's interactive

- **Bottom tab bar:** switches between Stock / Parties / Home / Settings (Home is the default)
- **+ FAB / "+ Inward" CTA:** opens the inward entry sheet
- **Inward entry → Record inward:** simulates an offline save → shows the queued toast (the app is in offline mode by default to demonstrate the network-honesty pattern)
- **Settings → Dark mode toggle:** flips `data-theme="dark"` on `<html>` to exercise the dark-mode tokens

## Visual coverage

Every component reads from the v3 token system:
- Two-token brand (`brand-ui` for fills, `brand-text` for text)
- Locked semantic colors (teal=inward, rust=outward, amber=pending)
- Noto Serif for numbers/headings, Noto Sans for body, Noto Sans Mono for codes/labels
- 48px tap zones, 16px input font, 36px visual control height
- Bottom tab + center FAB on mobile, with safe-area padding

## Iconography

Icons are inline Lucide-style stroke-1.5 SVGs defined in `components.jsx`. Substitution flagged in the root `README.md`.
