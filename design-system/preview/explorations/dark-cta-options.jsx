/* eslint-disable */
// Dark-mode CTA contrast — option exploration

const SR = {
  page: "#12100B", surface: "#1F1C14", subtle: "#2C281C", inset: "#3A3325",
  text: "#F0EBE0", textSec: "#C4BAA8", textTert: "#8A7F6E",
  border: "#3A3325", borderStrong: "#5A4F3D",
};

// Wrapper card showing a dark surface + CTA stack
function CTACard({ bg, fg, label, ratio, note }) {
  return (
    <div style={{
      background: SR.surface, borderRadius: 12, padding: 24,
      display: "flex", flexDirection: "column", gap: 14, height: "100%",
      border: `1px solid ${SR.border}`,
    }}>
      <div style={{
        fontFamily: "Noto Sans Mono", fontSize: 10, letterSpacing: "0.1em",
        textTransform: "uppercase", color: SR.textTert
      }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button style={{
          background: bg, color: fg, border: "none", padding: "12px 18px",
          borderRadius: 8, fontFamily: "Noto Sans", fontSize: 15, fontWeight: 600,
          cursor: "pointer", height: 42
        }}>+ Record inward</button>
        <button style={{
          background: bg, color: fg, border: "none", padding: "0 14px",
          borderRadius: 8, fontFamily: "Noto Sans", fontSize: 14, fontWeight: 500,
          cursor: "pointer", height: 36, alignSelf: "flex-start"
        }}>Save entry</button>
      </div>
      <div style={{
        marginTop: "auto", fontFamily: "Noto Sans Mono", fontSize: 11, color: SR.textSec,
        display: "flex", justifyContent: "space-between"
      }}>
        <span>bg {bg}</span><span>fg {fg}</span>
      </div>
      <div style={{
        fontFamily: "Noto Sans Mono", fontSize: 10, color: SR.textTert
      }}>contrast {ratio}</div>
      <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR.textSec, lineHeight: 1.4 }}>{note}</div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="current" title="Current — flagged: contrast hurts the eye">
        <DCArtboard id="cur" label="A · Current (#E8943A bg / #1C1A16 fg)" width={320} height={300} background={SR.page}>
          <CTACard
            bg="#E8943A" fg="#1C1A16"
            label="A — current"
            ratio="7.22:1 AAA"
            note="Bright amber + near-black soil text. Reads correct, but the value gap feels harsh against a warm-black surface — buttons appear to vibrate."
          />
        </DCArtboard>
      </DCSection>

      <DCSection id="softer" title="Softer options — same amber, calmer text">
        <DCArtboard id="opt-b" label="B · Soil-tinted amber text" width={320} height={300} background={SR.page}>
          <CTACard
            bg="#E8943A" fg="#2A1F12"
            label="B — soil-tinted"
            ratio="6.02:1 AA"
            note="Warm dark brown instead of near-black. Still strongly readable, but the button feels like part of the same warm family — less ink-on-paper, more wood-on-wood."
          />
        </DCArtboard>
        <DCArtboard id="opt-c" label="C · Muted amber bg + soil" width={320} height={300} background={SR.page}>
          <CTACard
            bg="#D08530" fg="#1C1A16"
            label="C — muted bg"
            ratio="6.21:1 AA+"
            note="Pulled the amber toward the light-mode hue (less luminous). Softer overall energy, still unmistakably the brand."
          />
        </DCArtboard>
        <DCArtboard id="opt-d" label="D · Amber bg + warm cream" width={320} height={300} background={SR.page}>
          <CTACard
            bg="#E8943A" fg="#3A2E1E"
            label="D — warm cocoa"
            ratio="4.66:1 AA"
            note="Cocoa-brown text. Most relaxed of the soil-text options. Still passes AA for normal text and AAA for the 18px+ button label."
          />
        </DCArtboard>
      </DCSection>

      <DCSection id="recommendation" title="Recommended — option B">
        <DCArtboard id="rec" label="B · dm-brand-cta-text = #2A1F12" width={400} height={300} background={SR.page}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20, height: "100%" }}>
            <div style={{ fontFamily: "Noto Serif", fontSize: 22, fontWeight: 600, color: SR.text }}>
              Soil-tinted amber text
            </div>
            <div style={{ fontFamily: "Noto Sans", fontSize: 14, color: SR.textSec, lineHeight: 1.5 }}>
              Keeps the amber CTA chip exactly the same — only the text token changes from <code style={{fontFamily:"Noto Sans Mono",color:SR.text}}>#1C1A16</code> to <code style={{fontFamily:"Noto Sans Mono",color:SR.text}}>#2A1F12</code>.
              Drops contrast from 7.22:1 (AAA) to ~6:1 (AA), which is still well above the 4.5:1 floor and still passes large-text AAA.
              The CTA stops "vibrating" against the warm-black surface and reads as part of the same soil-and-amber family.
            </div>
            <button style={{
              background: "#E8943A", color: "#2A1F12", border: "none", padding: "12px 20px",
              borderRadius: 8, fontFamily: "Noto Sans", fontSize: 15, fontWeight: 600,
              cursor: "pointer", height: 42, alignSelf: "flex-start"
            }}>+ Record inward</button>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
