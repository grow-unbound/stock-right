/* eslint-disable */
// Icon library options — cross-platform comparison

const SR = {
  surface: "#FFFFFF", page: "#FAF6EE", border: "#E0D9C7",
  text: "#1C1A16", textSec: "#4A4438", textTert: "#7A7060",
  brandUI: "#C8712A", brandText: "#8C4A12",
  inward: "#0E7C70", outward: "#B84B2A", pending: "#7B5200",
};

// ---------- ICON SETS ----------

// 1) Lucide (current) — outline only
const LucideIcons = {
  stock: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4M5 9v11h14V9"/></svg>,
  parties: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M15 11a3 3 0 100-6 3 3 0 000 6zM3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></svg>,
  inward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l7-7M5 12l7 7M5 12h14"/></svg>,
  outward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12l-7-7M19 12l-7 7M19 12H5"/></svg>,
  add: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  party: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/></svg>,
};

// 2) Phosphor "Duotone" — fill + stroke pairing (recreated authentic style)
const PhosphorDuo = {
  stock: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><path d="M3 9v11h18V9L12 3.5 3 9z" fill="currentColor" opacity="0.2"/><path d="M3 7.5l9-4 9 4M5 9v11h14V9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  parties: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><circle cx="9" cy="8" r="3" fill="currentColor" opacity="0.2"/><circle cx="15" cy="8" r="3" fill="currentColor" opacity="0.2"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2H3z" fill="currentColor" opacity="0.2"/><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15 11a3 3 0 100-6 3 3 0 000 6zM3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  inward: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><path d="M5 12l7-7v4h7v6h-7v4l-7-7z" fill="currentColor" opacity="0.2"/><path d="M5 12l7-7M5 12l7 7M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  outward: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><path d="M19 12l-7-7v4H5v6h7v4l7-7z" fill="currentColor" opacity="0.2"/><path d="M19 12l-7-7M19 12l-7 7M19 12H5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  add: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.2"/><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  party: (s) => <svg viewBox="0 0 24 24" width={s} height={s}><circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.2"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" fill="currentColor" opacity="0.2"/><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// 3) Material Symbols-style — solid filled
const MaterialFilled = {
  stock: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M12 3L2 9v2h20V9L12 3zm-6 9v8h2v-8H6zm5 0v8h2v-8h-2zm5 0v8h2v-8h-2zM2 22h20v-2H2v2z"/></svg>,
  parties: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  inward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>,
  outward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M4 11h12.17l-5.59-5.59L12 4l8 8-8 8-1.42-1.41L16.17 13H4v-2z"/></svg>,
  add: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>,
  party: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/></svg>,
};

// 4) Heroicons "Solid" — soft solid w/ rounded shapes
const HeroSolid = {
  stock: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 01-1.06 1.06l-.22-.22V19.5a2.25 2.25 0 01-2.25 2.25h-1.5a.75.75 0 01-.75-.75v-3a.75.75 0 00-.75-.75h-2.25a.75.75 0 00-.75.75v3a.75.75 0 01-.75.75h-1.5A2.25 2.25 0 015.25 19.5v-6.13l-.22.22a.75.75 0 11-1.06-1.06l8.69-8.69z"/></svg>,
  parties: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003c0 .527-.422.967-.948 1.011a48.12 48.12 0 01-12.354 0 1.012 1.012 0 01-.948-1.014v-.001zM17.25 19.128c0 .345-.022.68-.064 1.014a.99.99 0 00.852-.41c.74-1.06.952-2.443.421-3.722a4.123 4.123 0 00-3.196-2.487 7.123 7.123 0 011.987 5.605z"/></svg>,
  inward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd"/></svg>,
  outward: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>,
  add: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd"/></svg>,
  party: (s) => <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/></svg>,
};

const SETS = [
  { id: "lucide", title: "A · Lucide (current)", subtitle: "Outline 1.5px · Open-source · Web + RN", icons: LucideIcons,
    pros: "✓ 1,500+ icons, MIT licensed\n✓ Lucide-react, lucide-react-native, vanilla JS\n✓ Familiar (Linear, Vercel, Notion all use it)",
    cons: "✗ Stroke-only — what you flagged. Reads thin against warm cream surfaces.\n✗ No fill option built-in." },
  { id: "phosphor", title: "B · Phosphor Duotone", subtitle: "Fill + stroke · Open-source · Web + RN + Flutter", icons: PhosphorDuo,
    pros: "✓ 9,000+ icons in 6 weights (thin, light, regular, bold, fill, DUOTONE)\n✓ phosphor-react, phosphor-react-native, phosphor-icons (vanilla), Flutter\n✓ Duotone gives warmth + structure — fills feel handcrafted, not flat\n✓ Soft fill tint scales naturally to dark mode",
    cons: "✗ Slightly heavier weight than Lucide\n✗ Less familiar to ex-SaaS designers" },
  { id: "material", title: "C · Material Symbols (filled)", subtitle: "Solid fill · Apache 2 · Web + Android + iOS + RN", icons: MaterialFilled,
    pros: "✓ Google's official set — Android-native\n✓ Variable font (1 file, all weights/grades)\n✓ react-icons, @material-symbols, RN vector icons all support",
    cons: "✗ Reads as Google/Android-y — competes with brand identity\n✗ Filled-only feels heavy for inline use" },
  { id: "hero", title: "D · Heroicons (solid)", subtitle: "Soft solid · MIT · Web + RN", icons: HeroSolid,
    pros: "✓ From Tailwind team — stable, well-maintained\n✓ Solid + outline + mini variants in one library\n✓ Soft rounded forms feel close to Phosphor's warmth",
    cons: "✗ Smaller set (~300 icons) — may need supplementing\n✗ No native Flutter / iOS port" },
];

// ---------- DEMO COMPONENTS ----------

function IconRow({ icons }) {
  const labels = [
    { k: "stock", color: SR.text, label: "Stock" },
    { k: "parties", color: SR.text, label: "Parties" },
    { k: "inward", color: SR.inward, label: "Inward" },
    { k: "outward", color: SR.outward, label: "Outward" },
    { k: "add", color: SR.brandUI, label: "Add" },
    { k: "party", color: SR.text, label: "Party" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
      {labels.map(l => (
        <div key={l.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            background: SR.surface, border: `1px solid ${SR.border}`, borderRadius: 8, color: l.color
          }}>
            {icons[l.k](24)}
          </div>
          <div style={{ fontFamily: "Noto Sans Mono", fontSize: 9, color: SR.textTert, letterSpacing: "0.04em" }}>{l.label}</div>
        </div>
      ))}
    </div>
  );
}

function TabBarPreview({ icons }) {
  // Mini bottom-tab demo with active tab highlighted
  const items = [
    { k: "stock", label: "Stock", active: true },
    { k: "parties", label: "Parties" },
    { k: "party", label: "You" },
  ];
  return (
    <div style={{
      background: SR.surface, border: `1px solid ${SR.border}`, borderRadius: 12,
      padding: "10px 16px", display: "flex", justifyContent: "space-around"
    }}>
      {items.map(it => (
        <div key={it.k} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          color: it.active ? SR.brandText : SR.textTert
        }}>
          {icons[it.k](22)}
          <div style={{ fontFamily: "Noto Sans", fontSize: 10, fontWeight: it.active ? 600 : 500 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function EntryRowPreview({ icons }) {
  return (
    <div style={{
      background: SR.surface, border: `1px solid ${SR.border}`, borderRadius: 8,
      padding: 10, display: "flex", alignItems: "center", gap: 10
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: "#E6F5F3",
        display: "flex", alignItems: "center", justifyContent: "center", color: SR.inward
      }}>{icons.inward(18)}</div>
      <div style={{ flex: 1, fontFamily: "Noto Sans", fontSize: 13, color: SR.text }}>Inward · 240 bags</div>
      <div style={{ fontFamily: "Noto Serif", fontSize: 16, fontWeight: 700, color: SR.inward }}>+240</div>
    </div>
  );
}

function FabPreview({ icons }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 28, background: SR.brandUI,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#FFFFFF", boxShadow: "0 4px 12px rgba(28,26,22,0.18)"
    }}>{icons.add(28)}</div>
  );
}

// ---------- ARTBOARDS ----------

function SetCard({ set }) {
  return (
    <div style={{
      background: SR.page, padding: 20, height: "100%", display: "flex", flexDirection: "column", gap: 16
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontFamily: "Noto Serif", fontSize: 18, fontWeight: 700, color: SR.text }}>{set.title}</div>
        <div style={{ fontFamily: "Noto Sans Mono", fontSize: 10, color: SR.textTert, letterSpacing: "0.06em" }}>{set.subtitle.toUpperCase()}</div>
      </div>

      <IconRow icons={set.icons}/>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <TabBarPreview icons={set.icons}/>
        <EntryRowPreview icons={set.icons}/>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <FabPreview icons={set.icons}/>
        <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR.textSec, lineHeight: 1.5, flex: 1 }}>
          FAB at 56px · brand-ui fill · white glyph
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: "auto" }}>
        <div style={{ background: "#E6F5F3", border: "1px solid #A8DDD7", borderRadius: 8, padding: 10 }}>
          <div style={{ fontFamily: "Noto Sans Mono", fontSize: 9, letterSpacing: "0.08em", color: SR.inward, marginBottom: 4 }}>PROS</div>
          <div style={{ fontFamily: "Noto Sans", fontSize: 11, color: SR.text, whiteSpace: "pre-line", lineHeight: 1.5 }}>{set.pros}</div>
        </div>
        <div style={{ background: "#F7EAE7", border: "1px solid #E0B8B0", borderRadius: 8, padding: 10 }}>
          <div style={{ fontFamily: "Noto Sans Mono", fontSize: 9, letterSpacing: "0.08em", color: SR.outward, marginBottom: 4 }}>CONS</div>
          <div style={{ fontFamily: "Noto Sans", fontSize: 11, color: SR.text, whiteSpace: "pre-line", lineHeight: 1.5 }}>{set.cons}</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="all" title="Cross-platform icon-set options — same six glyphs in each">
        {SETS.map(s => (
          <DCArtboard key={s.id} id={s.id} label={s.title} width={520} height={620} background={SR.page}>
            <SetCard set={s}/>
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="reco" title="Recommendation">
        <DCArtboard id="reco" label="B · Phosphor Duotone" width={760} height={420} background={SR.page}>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
            <div style={{ fontFamily: "Noto Serif", fontSize: 22, fontWeight: 700, color: SR.text }}>
              Phosphor Duotone — best fit for StockRight
            </div>
            <div style={{ fontFamily: "Noto Sans", fontSize: 14, color: SR.textSec, lineHeight: 1.6 }}>
              <strong style={{ color: SR.text }}>Why:</strong> Duotone gives the icons body — a soft ~20% fill of the icon's own color, plus a regular-weight stroke. That fill warms up against our cream surfaces, where stroke-only Lucide felt thin. The fill is the icon's own currentColor, so semantic icons (teal inward, rust outward, amber pending) get a built-in warm halo for free.
            </div>
            <div style={{ fontFamily: "Noto Sans", fontSize: 14, color: SR.textSec, lineHeight: 1.6 }}>
              <strong style={{ color: SR.text }}>Cross-platform parity:</strong> <code style={{ fontFamily: "Noto Sans Mono", fontSize: 12, color: SR.text, background: "#F0E9D7", padding: "1px 5px", borderRadius: 3 }}>phosphor-react</code> for desktop & mobile web · <code style={{ fontFamily: "Noto Sans Mono", fontSize: 12, color: SR.text, background: "#F0E9D7", padding: "1px 5px", borderRadius: 3 }}>phosphor-react-native</code> for iOS/Android · Flutter & vanilla JS ports for the long tail. Same SVG geometry, same six weights, every platform.
            </div>
            <div style={{ fontFamily: "Noto Sans", fontSize: 14, color: SR.textSec, lineHeight: 1.6 }}>
              <strong style={{ color: SR.text }}>System rule:</strong> Use the <em>duotone</em> weight by default for nav, list rows, and decorative use. Use <em>regular</em> outline weight inside small chips/badges where the fill would muddy at 14–16px. Use <em>bold</em> weight only for the FAB and other large brand moments.
            </div>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
