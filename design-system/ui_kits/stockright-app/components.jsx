/* eslint-disable */
// StockRight Mobile UI Kit — atomic components

const SR_BRAND = {
  amber: "#C8712A", amberHover: "#AD5E1F", amberPress: "#9A5418", amberText: "#8C4A12",
  amberSubtle: "#F5E8D8",
  inward: "#0B7B6E", inwardBg: "#E6F5F3", inwardBorder: "#A8DDD7",
  outward: "#A83422", outwardBg: "#F7EAE7", outwardBorder: "#E0B8B0",
  pending: "#7B5200", pendingBg: "#FAF2D9", pendingBorder: "#E0CC88",
  bgPage: "#FEFCF8", bgSurface: "#FFFFFF", bgSubtle: "#F5F0E8", bgInset: "#EDE6D9",
  textPrimary: "#1C1A16", textSecondary: "#4A4237", textTertiary: "#7A6F61", textPlaceholder: "#C0B8B0",
  borderDefault: "#E5DED2",
};

const SAFE_TOP = 50; // sit below iOS device status bar / dynamic island

const Icon = ({ d, children, size = 22, color = "currentColor", strokeWidth = 2, fill = "none" }) =>
  React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: fill, stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round"
  }, children || (d ? React.createElement("path", { d }) : null));

const IconHome = (p) => <Icon {...p}><path d="M3 9l9-7 9 7v11H3z"/></Icon>;
const IconStock = (p) => <Icon {...p}><path d="M3 7l9-4 9 4M5 9v11h14V9M9 14h6"/></Icon>;
const IconParties = (p) => <Icon {...p}><circle cx="9" cy="8" r="3"/><path d="M15 11a3 3 0 100-6 3 3 0 000 6zM3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M17 21v-2a4 4 0 00-3-3.9"/></Icon>;
const IconMoney = (p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
const IconArrowIn = (p) => <Icon {...p}><path d="M5 12l7-7M5 12l7 7M5 12h14"/></Icon>;
const IconArrowOut = (p) => <Icon {...p}><path d="M19 12l-7-7M19 12l-7 7M19 12H5"/></Icon>;
const IconBack = (p) => <Icon {...p}><path d="M15 18l-6-6 6-6"/></Icon>;
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M5 13l4 4L19 7"/></Icon>;
const IconChevron = (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>;
const IconX = (p) => <Icon {...p}><path d="M6 6l12 12M6 18L18 6"/></Icon>;
const IconBolt = (p) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/></Icon>;
const IconTruck = (p) => <Icon {...p}><rect x="1" y="6" width="14" height="12" rx="1"/><path d="M15 9h4l3 3v6h-7M3 18a2 2 0 104 0 2 2 0 00-4 0M15 18a2 2 0 104 0 2 2 0 00-4 0"/></Icon>;
const IconReceipt = (p) => <Icon {...p}><path d="M5 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2-3-2zM9 8h6M9 12h6M9 16h4"/></Icon>;
const IconWallet = (p) => <Icon {...p}><path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2zM21 10h-4a2 2 0 100 4h4"/></Icon>;
const IconUser = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/></Icon>;
const IconBox = (p) => <Icon {...p}><path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v9"/></Icon>;

// ----- Offline banner (only when offline) -----
function OfflineBanner({ queueCount }) {
  return (
    <div style={{
      background: SR_BRAND.pendingBg, color: SR_BRAND.pending,
      borderBottom: `1px solid ${SR_BRAND.pendingBorder}`,
      padding: "8px 16px", fontFamily: "Noto Sans", fontSize: 12, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
    }}>
      <IconBolt size={14}/>
      <span>Offline · {queueCount} {queueCount === 1 ? "entry" : "entries"} queued — will upload when connected</span>
    </div>
  );
}

// ----- Page Header (sticky, aligned across tabs) -----
function PageHeader({ title, leading, trailing, sticky = true, withSearch = true, searchPlaceholder, chips, activeChip, onChipClick }) {
  return (
    <div style={{
      position: sticky ? "sticky" : "relative", top: 0, zIndex: 5,
      background: SR_BRAND.bgPage, paddingTop: 8,
    }}>
      <div style={{
        padding: "8px 16px 12px", display: "flex", alignItems: "center", gap: 10
      }}>
        {leading}
        <div style={{
          fontFamily: "Noto Serif", fontSize: 22, fontWeight: 600,
          color: SR_BRAND.textPrimary, flex: 1, lineHeight: 1.2
        }}>{title}</div>
        {trailing}
      </div>
      {withSearch && (
        <div style={{ padding: "0 16px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
            background: SR_BRAND.bgSurface, border: `1px solid ${SR_BRAND.borderDefault}`,
            borderRadius: 8, height: 40
          }}>
            <IconSearch size={18} color={SR_BRAND.textTertiary}/>
            <span style={{
              fontFamily: "Noto Sans", fontSize: 15, color: SR_BRAND.textPlaceholder
            }}>{searchPlaceholder || "Search…"}</span>
          </div>
        </div>
      )}
      {chips && chips.length > 0 && (
        <div style={{
          display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto",
          borderBottom: `1px solid ${SR_BRAND.borderDefault}`, paddingBottom: 12
        }}>
          {chips.map(c => (
            <button key={c.id} onClick={() => onChipClick?.(c.id)} style={{
              padding: "6px 14px", fontFamily: "Noto Sans", fontSize: 13,
              fontWeight: activeChip === c.id ? 600 : 500, cursor: "pointer",
              border: `1px solid ${activeChip === c.id ? SR_BRAND.amber : SR_BRAND.borderDefault}`,
              background: activeChip === c.id ? SR_BRAND.amberSubtle : SR_BRAND.bgSurface,
              color: activeChip === c.id ? SR_BRAND.amberText : SR_BRAND.textSecondary,
              borderRadius: 999, whiteSpace: "nowrap", height: 30,
              display: "inline-flex", alignItems: "center", gap: 5
            }}>{c.label}{c.count != null && (
              <span style={{
                fontFamily: "Noto Sans Mono", fontSize: 10, opacity: 0.7
              }}>{c.count}</span>
            )}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Avatar -----
function Avatar({ initials = "SK", size = 36, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 999, background: SR_BRAND.amberSubtle,
      color: SR_BRAND.amberText, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Noto Serif", fontSize: size * 0.4, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${SR_BRAND.borderDefault}`, flexShrink: 0,
    }}>{initials}</button>
  );
}

// ----- Icon button (header) -----
function IconButton({ children, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none",
      display: "flex", alignItems: "center", justifyContent: "center", color: SR_BRAND.textPrimary,
      cursor: "pointer", flexShrink: 0, position: "relative"
    }}>
      {children}
      {badge && <span style={{
        position: "absolute", top: 4, right: 4, width: 8, height: 8,
        borderRadius: 999, background: SR_BRAND.outward,
        border: `1.5px solid ${SR_BRAND.bgPage}`
      }}/>}
    </button>
  );
}

// ----- Bottom tab bar (4 tabs, no center control) -----
function TabBar({ active, onChange }) {
  const tabs = [
    { id: "home", label: "Home", Icon: IconHome },
    { id: "stock", label: "Stock", Icon: IconStock },
    { id: "parties", label: "Parties", Icon: IconParties },
    { id: "money", label: "Money", Icon: IconMoney },
  ];
  return (
    <div style={{
      background: SR_BRAND.bgSurface, borderTop: `1px solid ${SR_BRAND.borderDefault}`,
      display: "flex", paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      paddingTop: 8, flexShrink: 0, gap: 4, paddingLeft: 8, paddingRight: 8,
    }}>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
          flex: 1, background: active === t.id ? SR_BRAND.amberSubtle : "transparent",
          border: "none", borderRadius: 10,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0 4px",
          color: active === t.id ? SR_BRAND.amberText : SR_BRAND.textTertiary,
          fontFamily: "Noto Sans", fontSize: 11,
          fontWeight: active === t.id ? 600 : 500, cursor: "pointer",
          transition: "background 120ms ease"
        }}><t.Icon size={22}/><span>{t.label}</span></button>
      ))}
    </div>
  );
}

// ----- FAB Action Sheet (multi-option modal from FAB tap) -----
function FabActionSheet({ open, onClose, title, actions }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 80,
      background: "rgba(28,26,22,0.45)",
      display: "flex", alignItems: "flex-end",
      animation: "sr-fade 160ms ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: SR_BRAND.bgSurface, width: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: "12px 16px calc(20px + env(safe-area-inset-bottom))",
        animation: "sr-slide-up 220ms cubic-bezier(.16,1,.3,1)"
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 999, background: SR_BRAND.bgInset,
          margin: "0 auto 14px"
        }}/>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12
        }}>
          <div style={{
            fontFamily: "Noto Serif", fontSize: 18, fontWeight: 600, color: SR_BRAND.textPrimary
          }}>{title}</div>
          <IconButton onClick={onClose}><IconX size={20}/></IconButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.map((a, i) => (
            <button key={i} onClick={() => { a.onClick?.(); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 14px",
              background: SR_BRAND.bgSubtle, border: `1px solid ${SR_BRAND.borderDefault}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%"
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: a.tone === "inward" ? SR_BRAND.inwardBg : a.tone === "outward" ? SR_BRAND.outwardBg : SR_BRAND.amberSubtle,
                color: a.tone === "inward" ? SR_BRAND.inward : a.tone === "outward" ? SR_BRAND.outward : SR_BRAND.amberText,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "Noto Sans", fontSize: 15, fontWeight: 600, color: SR_BRAND.textPrimary
                }}>{a.label}</div>
                <div style={{
                  fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 2, lineHeight: 1.4
                }}>{a.hint}</div>
              </div>
              <IconChevron size={18} color={SR_BRAND.textTertiary}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Tab-context FAB -----
function TabFab({ icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: "absolute", right: 16, bottom: 16, zIndex: 30,
      width: 56, height: 56, borderRadius: 999, background: SR_BRAND.amber,
      color: "white", border: "none", cursor: "pointer",
      boxShadow: "0 6px 18px rgba(200,113,42,0.35), 0 2px 4px rgba(28,26,22,0.10)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>{icon || <IconPlus size={26}/>}</button>
  );
}

// ----- Button -----
function Button({ variant = "primary", size = "default", pill, full, children, onClick, disabled, leftIcon, style }) {
  const sz = size === "sm" ? { h: 28, px: 12, f: 13 } : size === "lg" ? { h: 42, px: 20, f: 15 } : { h: 36, px: 16, f: 14 };
  const variants = {
    primary: { bg: SR_BRAND.amber, color: "white", border: "transparent" },
    secondary: { bg: SR_BRAND.bgSubtle, color: SR_BRAND.textPrimary, border: SR_BRAND.borderDefault },
    ghost: { bg: "transparent", color: SR_BRAND.textPrimary, border: SR_BRAND.borderDefault },
    danger: { bg: SR_BRAND.outwardBg, color: SR_BRAND.outward, border: SR_BRAND.outwardBorder },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: sz.h, padding: `0 ${sz.px}px`, fontSize: sz.f, fontFamily: "Noto Sans", fontWeight: 500,
      background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
      borderRadius: pill ? 999 : 8, width: full ? "100%" : undefined,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      transition: "background 120ms cubic-bezier(.16,1,.3,1)", ...style
    }}>{leftIcon}{children}</button>
  );
}

// ----- Badge -----
function Badge({ tone = "neutral", children, style }) {
  const tones = {
    inward: { bg: SR_BRAND.inwardBg, color: SR_BRAND.inward, border: SR_BRAND.inwardBorder },
    outward: { bg: SR_BRAND.outwardBg, color: SR_BRAND.outward, border: SR_BRAND.outwardBorder },
    pending: { bg: SR_BRAND.pendingBg, color: SR_BRAND.pending, border: SR_BRAND.pendingBorder },
    brand: { bg: SR_BRAND.amberSubtle, color: SR_BRAND.amberText, border: "#E0B08A" },
    neutral: { bg: SR_BRAND.bgSubtle, color: SR_BRAND.textTertiary, border: SR_BRAND.borderDefault },
  };
  const t = tones[tone];
  return <span style={{
    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
    background: t.bg, color: t.color, border: `1px solid ${t.border}`,
    fontFamily: "Noto Sans", fontSize: 11, fontWeight: 500, ...style
  }}>{children}</span>;
}

// ----- Input -----
function Input({ label, value, onChange, placeholder, suffix, type = "text", helper, error, focused, autoFocus, mono }) {
  const [isFocus, setFocus] = React.useState(focused || false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <div style={{
        fontFamily: "Noto Sans Mono", fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
        textTransform: "uppercase", color: SR_BRAND.textSecondary
      }}>{label}</div>}
      <div style={{
        height: 36, padding: "0 12px", display: "flex", alignItems: "center", gap: 8,
        background: SR_BRAND.bgSurface,
        border: `1.5px solid ${error ? "rgba(184,75,42,0.55)" : isFocus ? "rgba(200,113,42,0.55)" : SR_BRAND.borderDefault}`,
        boxShadow: error ? "0 0 0 3px rgba(184,75,42,0.08)" : isFocus ? "0 0 0 3px rgba(200,113,42,0.08)" : "none",
        borderRadius: 8, transition: "all 120ms"
      }}>
        <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
          autoFocus={autoFocus} placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            border: "none", outline: "none", background: "transparent",
            fontFamily: mono ? "Noto Sans Mono" : "Noto Sans",
            fontSize: 16, color: SR_BRAND.textPrimary, flex: 1, width: "100%",
            fontVariantNumeric: mono ? "tabular-nums" : "normal",
          }}/>
        {suffix && <span style={{ fontFamily: "Noto Sans Mono", fontSize: 13, color: SR_BRAND.textTertiary }}>{suffix}</span>}
      </div>
      {(helper || error) && (
        <div style={{
          fontFamily: "Noto Sans", fontSize: 12, color: error ? SR_BRAND.outward : SR_BRAND.textTertiary
        }}>{error || helper}</div>
      )}
    </div>
  );
}

// ----- Card -----
function Card({ children, style, padding = 16, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: SR_BRAND.bgSurface, border: `1px solid ${SR_BRAND.borderDefault}`,
      borderRadius: 8, padding, cursor: onClick ? "pointer" : "default", ...style
    }}>{children}</div>
  );
}

// ----- KPI -----
function KPI({ label, value, sub, accent, currency }) {
  return (
    <Card padding={16}>
      <div style={{
        fontFamily: "Noto Sans Mono", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
        textTransform: "uppercase", color: SR_BRAND.textTertiary
      }}>{label}</div>
      <div style={{
        fontFamily: "Noto Serif", fontSize: 28, fontWeight: 700, lineHeight: 1.1,
        letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums",
        color: accent || SR_BRAND.textPrimary, marginTop: 6
      }}>{currency && "₹"}{value}</div>
      {sub && <div style={{
        fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 4
      }}>{sub}</div>}
    </Card>
  );
}

// ----- Section label -----
function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "0 4px", marginBottom: 8
    }}>
      <span style={{
        fontFamily: "Noto Sans Mono", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
        textTransform: "uppercase", color: SR_BRAND.textTertiary
      }}>{children}</span>
      {action}
    </div>
  );
}

// ----- Entry list row -----
function EntryRow({ entry, onClick }) {
  const isInward = entry.type === "inward";
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
      background: SR_BRAND.bgSurface, border: `1px solid ${SR_BRAND.borderDefault}`,
      borderRadius: 8, cursor: "pointer"
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isInward ? SR_BRAND.inwardBg : SR_BRAND.outwardBg,
        color: isInward ? SR_BRAND.inward : SR_BRAND.outward,
        border: `1px solid ${isInward ? SR_BRAND.inwardBorder : SR_BRAND.outwardBorder}`
      }}>{isInward ? <IconArrowIn size={18}/> : <IconArrowOut size={18}/>}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "Noto Sans Mono", fontSize: 11, color: SR_BRAND.textTertiary, letterSpacing: "0.04em"
        }}>{entry.lot} · {entry.time}</div>
        <div style={{
          fontFamily: "Noto Serif", fontSize: 16, fontWeight: 600,
          color: SR_BRAND.textPrimary, marginTop: 2, lineHeight: 1.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{entry.party}</div>
        <div style={{
          fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 2
        }}>{entry.godown} · {entry.commodity}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontFamily: "Noto Serif", fontSize: 22, fontWeight: 700, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: isInward ? SR_BRAND.inward : SR_BRAND.outward
        }}>{isInward ? "+" : "−"}{entry.bags}</div>
        <div style={{
          fontFamily: "Noto Sans Mono", fontSize: 10, color: SR_BRAND.textTertiary, marginTop: 2
        }}>bags</div>
      </div>
    </div>
  );
}

// ----- Toast -----
function Toast({ tone = "inward", icon, children, visible }) {
  if (!visible) return null;
  const tones = {
    inward: { bg: SR_BRAND.inwardBg, color: SR_BRAND.inward, border: SR_BRAND.inwardBorder },
    outward: { bg: SR_BRAND.outwardBg, color: SR_BRAND.outward, border: SR_BRAND.outwardBorder },
    pending: { bg: SR_BRAND.pendingBg, color: SR_BRAND.pending, border: SR_BRAND.pendingBorder },
  };
  const t = tones[tone];
  return (
    <div style={{
      position: "absolute", left: 16, right: 16, bottom: 90, zIndex: 50,
      padding: "12px 14px", background: t.bg, border: `1px solid ${t.border}`,
      color: t.color, borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
      fontFamily: "Noto Sans", fontSize: 14, fontWeight: 500,
      boxShadow: "0 8px 24px rgba(28,26,22,0.12)",
    }}>{icon}<span>{children}</span></div>
  );
}

Object.assign(window, {
  SR_BRAND, SAFE_TOP,
  Icon, IconHome, IconStock, IconParties, IconMoney, IconSettings, IconPlus,
  IconArrowIn, IconArrowOut, IconBack, IconSearch, IconCheck, IconChevron,
  IconX, IconBolt, IconTruck, IconReceipt, IconWallet, IconUser, IconBox,
  PageHeader, Avatar, IconButton, OfflineBanner, TabBar, TabFab, FabActionSheet,
  Button, Badge, Input, Card, KPI, SectionLabel, EntryRow, Toast,
});
