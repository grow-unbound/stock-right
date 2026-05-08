/* eslint-disable */
// StockRight Mobile UI Kit — screens

// ====== Home Dashboard ======
function HomeScreen({ onProfileClick }) {
  const recent = [
    { type: "inward", lot: "AP-1247-23", time: "14:32", party: "Sri Lakshmi Traders", godown: "Cold Storage 3", commodity: "Paddy", bags: 240 },
    { type: "outward", lot: "AP-1245-23", time: "12:08", party: "Reddy Rice Mills", godown: "Cold Storage 1", commodity: "Rice", bags: 80 },
    { type: "inward", lot: "AP-1244-23", time: "10:14", party: "Krishna Agro", godown: "Cold Storage 2", commodity: "Maize", bags: 120 },
    { type: "outward", lot: "AP-1242-23", time: "09:02", party: "Ganesh Mandi", godown: "Cold Storage 3", commodity: "Paddy", bags: 60 },
  ];
  const chips = [
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "all", label: "All time" },
  ];
  const [chip, setChip] = React.useState("today");
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <PageHeader
        title="Home"
        searchPlaceholder="Search lots, parties, commodities…"
        chips={chips} activeChip={chip} onChipClick={setChip}
        trailing={<Avatar initials="SK" onClick={onProfileClick}/>}
      />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "Noto Sans", fontSize: 13, color: SR_BRAND.textSecondary }}>Tuesday, 12 May 2026</div>
          <div style={{ fontFamily: "Noto Serif", fontSize: 22, fontWeight: 600, color: SR_BRAND.textPrimary, marginTop: 2 }}>
            Today's register
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <KPI label="Today inward" value="240" sub="bags · +18 vs yesterday" accent={SR_BRAND.inward}/>
          <KPI label="Today outward" value="140" sub="bags · 2 lots out" accent={SR_BRAND.outward}/>
          <KPI label="Stock on hand" value="12,480" sub="bags · 4 godowns"/>
          <KPI label="Collection due" value="2,47,500" sub="across 7 parties" currency accent={SR_BRAND.pending}/>
        </div>
        <div>
          <SectionLabel action={
            <span style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.amberText, fontWeight: 500 }}>See all</span>
          }>Recent entries</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((e, i) => <EntryRow key={i} entry={e} onClick={() => {}}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== Stock screen ======
function StockScreen() {
  const [chip, setChip] = React.useState("all");
  const lots = [
    { lot: "AP-1247-23", commodity: "Paddy", godown: "CS-3", bags: 240, party: "Sri Lakshmi Traders", status: "inward" },
    { lot: "AP-1244-23", commodity: "Maize", godown: "CS-2", bags: 120, party: "Krishna Agro", status: "inward" },
    { lot: "AP-1240-23", commodity: "Rice", godown: "CS-1", bags: 480, party: "Reddy Rice Mills", status: "inward" },
    { lot: "AP-1232-23", commodity: "Paddy", godown: "CS-4", bags: 360, party: "Mandal Society", status: "pending" },
    { lot: "AP-1218-23", commodity: "Rice", godown: "CS-1", bags: 200, party: "Sri Bhavani Traders", status: "inward" },
  ];
  const chips = [
    { id: "all", label: "All lots", count: 47 },
    { id: "in", label: "Inward", count: 38 },
    { id: "out", label: "Outward", count: 9 },
    { id: "due", label: "Due" },
  ];
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <PageHeader
        title="Stock"
        searchPlaceholder="Search lots, commodities, godowns…"
        chips={chips} activeChip={chip} onChipClick={setChip}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
        {lots.map(lot => (
          <Card key={lot.lot} padding={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Noto Sans Mono", fontSize: 11, color: SR_BRAND.textTertiary, letterSpacing: "0.04em" }}>{lot.lot}</div>
                <div style={{ fontFamily: "Noto Serif", fontSize: 17, fontWeight: 600, color: SR_BRAND.textPrimary, marginTop: 2 }}>{lot.commodity} · {lot.godown}</div>
                <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 4 }}>{lot.party}</div>
                <div style={{ marginTop: 8 }}>
                  {lot.status === "inward" ? <Badge tone="inward">✓ In stock</Badge> : <Badge tone="pending">⌛ Collection due</Badge>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Noto Serif", fontSize: 22, fontWeight: 700, color: SR_BRAND.textPrimary, fontVariantNumeric: "tabular-nums" }}>{lot.bags}</div>
                <div style={{ fontFamily: "Noto Sans Mono", fontSize: 10, color: SR_BRAND.textTertiary }}>bags</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ====== Parties screen ======
function PartiesScreen() {
  const [chip, setChip] = React.useState("all");
  const parties = [
    { name: "Sri Lakshmi Traders", village: "Tenali", balance: 47500, balanceType: "due", lots: 4 },
    { name: "Reddy Rice Mills", village: "Guntur", balance: 1_12_000, balanceType: "due", lots: 7 },
    { name: "Krishna Agro Suppliers", village: "Vijayawada", balance: 0, balanceType: "clear", lots: 2 },
    { name: "Mandal Co-op Society", village: "Tenali", balance: 88_000, balanceType: "due", lots: 9 },
    { name: "Sri Bhavani Traders", village: "Repalle", balance: 24_300, balanceType: "advance", lots: 3 },
    { name: "Ganesh Mandi", village: "Bapatla", balance: 0, balanceType: "clear", lots: 1 },
  ];
  const chips = [
    { id: "all", label: "All", count: 52 },
    { id: "due", label: "Due", count: 7 },
    { id: "advance", label: "Advance", count: 2 },
    { id: "clear", label: "Clear" },
  ];
  const fmt = (n) => n.toLocaleString("en-IN");
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <PageHeader
        title="Parties"
        searchPlaceholder="Search by name or village…"
        chips={chips} activeChip={chip} onChipClick={setChip}
      />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {parties.map(p => (
          <Card key={p.name} padding={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Noto Serif", fontSize: 17, fontWeight: 600, color: SR_BRAND.textPrimary, lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 4 }}>{p.village} · {p.lots} lots</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {p.balanceType === "due" && (
                  <>
                    <div style={{ fontFamily: "Noto Serif", fontSize: 18, fontWeight: 700, color: SR_BRAND.pending, fontVariantNumeric: "tabular-nums" }}>₹{fmt(p.balance)}</div>
                    <div style={{ fontFamily: "Noto Sans Mono", fontSize: 10, color: SR_BRAND.pending, letterSpacing: "0.06em", marginTop: 2 }}>DUE</div>
                  </>
                )}
                {p.balanceType === "clear" && <Badge tone="inward">✓ Clear</Badge>}
                {p.balanceType === "advance" && (
                  <>
                    <div style={{ fontFamily: "Noto Serif", fontSize: 18, fontWeight: 700, color: SR_BRAND.inward, fontVariantNumeric: "tabular-nums" }}>₹{fmt(p.balance)}</div>
                    <div style={{ fontFamily: "Noto Sans Mono", fontSize: 10, color: SR_BRAND.inward, letterSpacing: "0.06em", marginTop: 2 }}>ADVANCE</div>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ====== Money screen (replaces Settings) — receipts & payments ======
function MoneyScreen() {
  const [chip, setChip] = React.useState("all");
  const txns = [
    { type: "receipt", date: "12 May", party: "Sri Lakshmi Traders", method: "UPI", amount: 47500, ref: "TXN-2398" },
    { type: "payment", date: "12 May", party: "Krishna Agro", method: "Cash", amount: 18000, ref: "TXN-2397" },
    { type: "receipt", date: "11 May", party: "Reddy Rice Mills", method: "Bank", amount: 1_12_000, ref: "TXN-2395" },
    { type: "receipt", date: "11 May", party: "Mandal Society", method: "UPI", amount: 22000, ref: "TXN-2393" },
    { type: "payment", date: "10 May", party: "Ganesh Mandi", method: "Cash", amount: 8500, ref: "TXN-2392" },
    { type: "receipt", date: "10 May", party: "Sri Bhavani Traders", method: "UPI", amount: 24300, ref: "TXN-2391" },
  ];
  const chips = [
    { id: "all", label: "All", count: 84 },
    { id: "receipts", label: "Receipts", count: 62 },
    { id: "payments", label: "Payments", count: 22 },
    { id: "today", label: "Today" },
  ];
  const fmt = (n) => n.toLocaleString("en-IN");
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <PageHeader
        title="Money"
        searchPlaceholder="Search receipts, payments, parties…"
        chips={chips} activeChip={chip} onChipClick={setChip}
      />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <KPI label="This month received" value="4,82,300" sub="62 receipts" currency accent={SR_BRAND.inward}/>
          <KPI label="This month paid" value="84,500" sub="22 payments" currency accent={SR_BRAND.outward}/>
        </div>
        <div>
          <SectionLabel>Recent transactions</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {txns.map((t, i) => {
              const isReceipt = t.type === "receipt";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: SR_BRAND.bgSurface, border: `1px solid ${SR_BRAND.borderDefault}`,
                  borderRadius: 8, cursor: "pointer"
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isReceipt ? SR_BRAND.inwardBg : SR_BRAND.outwardBg,
                    color: isReceipt ? SR_BRAND.inward : SR_BRAND.outward,
                    border: `1px solid ${isReceipt ? SR_BRAND.inwardBorder : SR_BRAND.outwardBorder}`
                  }}>{isReceipt ? <IconReceipt size={18}/> : <IconWallet size={18}/>}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Noto Sans Mono", fontSize: 11, color: SR_BRAND.textTertiary, letterSpacing: "0.04em" }}>
                      {t.ref} · {t.date} · {t.method}
                    </div>
                    <div style={{
                      fontFamily: "Noto Serif", fontSize: 15, fontWeight: 600,
                      color: SR_BRAND.textPrimary, marginTop: 2, lineHeight: 1.2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>{t.party}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontFamily: "Noto Serif", fontSize: 17, fontWeight: 700, lineHeight: 1.1,
                      fontVariantNumeric: "tabular-nums",
                      color: isReceipt ? SR_BRAND.inward : SR_BRAND.outward
                    }}>{isReceipt ? "+" : "−"}₹{fmt(t.amount)}</div>
                    <div style={{
                      fontFamily: "Noto Sans Mono", fontSize: 10, color: SR_BRAND.textTertiary, marginTop: 2,
                      letterSpacing: "0.06em", textTransform: "uppercase"
                    }}>{t.type}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== Settings (now reached from Home profile avatar) ======
function SettingsScreen({ darkMode, setDarkMode, onClose }) {
  const SettingsRow = ({ label, value, last }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 16px", borderBottom: last ? "none" : `1px solid ${SR_BRAND.borderDefault}`, cursor: "pointer"
    }}>
      <div style={{ fontFamily: "Noto Sans", fontSize: 15, color: SR_BRAND.textPrimary }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Noto Sans", fontSize: 13, color: SR_BRAND.textTertiary }}>
        {value}<IconChevron size={16}/>
      </div>
    </div>
  );
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 5, background: SR_BRAND.bgPage,
        padding: "12px 16px 12px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${SR_BRAND.borderDefault}`
      }}>
        <IconButton onClick={onClose}><IconBack/></IconButton>
        <div style={{ fontFamily: "Noto Serif", fontSize: 22, fontWeight: 600, color: SR_BRAND.textPrimary, flex: 1 }}>Profile & settings</div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Card padding={14}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials="SK" size={48}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Noto Serif", fontSize: 17, fontWeight: 600, color: SR_BRAND.textPrimary }}>Suresh Kumar</div>
              <div style={{ fontFamily: "Noto Sans", fontSize: 13, color: SR_BRAND.textSecondary }}>Manager · Tenali Cold Storage</div>
            </div>
          </div>
        </Card>
        <div>
          <SectionLabel>Account</SectionLabel>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <SettingsRow label="Language" value="తెలుగు"/>
            <SettingsRow label="Godown" value="Tenali · 4 stores"/>
            <SettingsRow label="Number format" value="2,47,500" last/>
          </Card>
        </div>
        <div>
          <SectionLabel>Display</SectionLabel>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px"
            }}>
              <div style={{ fontFamily: "Noto Sans", fontSize: 15, color: SR_BRAND.textPrimary }}>Dark mode</div>
              <button onClick={() => setDarkMode(!darkMode)} style={{
                width: 44, height: 24, borderRadius: 999, border: "none", padding: 2,
                background: darkMode ? SR_BRAND.amber : SR_BRAND.bgInset,
                display: "flex", alignItems: "center", cursor: "pointer",
                justifyContent: darkMode ? "flex-end" : "flex-start", transition: "all 120ms"
              }}>
                <div style={{ width: 20, height: 20, borderRadius: 999, background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}/>
              </button>
            </div>
          </Card>
        </div>
        <div>
          <SectionLabel>Data</SectionLabel>
          <Card padding={14}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "Noto Sans", fontSize: 14, fontWeight: 500, color: SR_BRAND.textPrimary }}>Offline queue</div>
                <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 2 }}>3 entries waiting to upload</div>
              </div>
              <Badge tone="pending">⚡ 3 queued</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ====== Global search overlay ======
function GlobalSearchScreen({ onClose }) {
  return (
    <div style={{ flex: 1, overflow: "auto", background: SR_BRAND.bgPage }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 5, background: SR_BRAND.bgPage,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${SR_BRAND.borderDefault}`
      }}>
        <IconButton onClick={onClose}><IconBack/></IconButton>
        <div style={{
          flex: 1, height: 40, padding: "0 12px", display: "flex", alignItems: "center", gap: 8,
          background: SR_BRAND.bgSurface, border: `1.5px solid ${SR_BRAND.amber}`,
          boxShadow: "0 0 0 3px rgba(200,113,42,0.08)", borderRadius: 8
        }}>
          <IconSearch size={18} color={SR_BRAND.textTertiary}/>
          <span style={{ fontFamily: "Noto Sans", fontSize: 15, color: SR_BRAND.textPrimary }}>lakshmi</span>
        </div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <SectionLabel>Parties · 1 match</SectionLabel>
          <Card padding={14}>
            <div style={{ fontFamily: "Noto Serif", fontSize: 16, fontWeight: 600, color: SR_BRAND.textPrimary }}>Sri <mark style={{ background: SR_BRAND.amberSubtle, color: SR_BRAND.amberText, padding: "0 2px" }}>Lakshmi</mark> Traders</div>
            <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 4 }}>Tenali · 4 lots · ₹47,500 due</div>
          </Card>
        </div>
        <div>
          <SectionLabel>Lots · 2 matches</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Card padding={14}>
              <div style={{ fontFamily: "Noto Sans Mono", fontSize: 11, color: SR_BRAND.textTertiary }}>AP-1247-23 · CS-3</div>
              <div style={{ fontFamily: "Noto Serif", fontSize: 15, fontWeight: 600, color: SR_BRAND.textPrimary, marginTop: 2 }}>Paddy · 240 bags</div>
              <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 2 }}>Sri <mark style={{ background: SR_BRAND.amberSubtle, color: SR_BRAND.amberText, padding: "0 2px" }}>Lakshmi</mark> Traders</div>
            </Card>
            <Card padding={14}>
              <div style={{ fontFamily: "Noto Sans Mono", fontSize: 11, color: SR_BRAND.textTertiary }}>AP-1198-23 · CS-1</div>
              <div style={{ fontFamily: "Noto Serif", fontSize: 15, fontWeight: 600, color: SR_BRAND.textPrimary, marginTop: 2 }}>Rice · 480 bags</div>
              <div style={{ fontFamily: "Noto Sans", fontSize: 12, color: SR_BRAND.textSecondary, marginTop: 2 }}>Sri <mark style={{ background: SR_BRAND.amberSubtle, color: SR_BRAND.amberText, padding: "0 2px" }}>Lakshmi</mark> Traders</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, StockScreen, PartiesScreen, MoneyScreen, SettingsScreen, GlobalSearchScreen });
