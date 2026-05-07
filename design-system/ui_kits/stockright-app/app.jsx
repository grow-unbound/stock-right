/* eslint-disable */
function App() {
  const [tab, setTab] = React.useState("home");
  const [darkMode, setDarkMode] = React.useState(false);
  const [network] = React.useState("offline");
  const [queue, setQueue] = React.useState(3);
  const [toast, setToast] = React.useState(null);
  const [fabOpen, setFabOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const showToast = (tone, icon, text) => {
    setToast({ tone, icon, text });
    setTimeout(() => setToast(null), 2200);
  };

  // Tab-context FAB configurations
  const fabConfigs = {
    stock: {
      title: "Add to stock",
      actions: [
        { label: "Add Lot", hint: "Record a new lot arriving at the godown — paddy, rice, maize.", icon: <IconBox size={22}/>, tone: "inward", onClick: () => showToast("inward", "✓", "New lot draft started") },
        { label: "Add Delivery", hint: "Stock leaving the godown — to a mill, party, or another godown.", icon: <IconTruck size={22}/>, tone: "outward", onClick: () => showToast("outward", "✓", "New delivery draft started") },
      ],
    },
    parties: {
      title: "Add party",
      actions: [
        { label: "Add Party", hint: "New farmer, trader, mill or buyer with name, village & contact.", icon: <IconUser size={22}/>, tone: "neutral", onClick: () => showToast("inward", "✓", "New party draft started") },
      ],
    },
    money: {
      title: "Record money",
      actions: [
        { label: "Add Receipt", hint: "Money you received from a party — UPI, cash, or bank transfer.", icon: <IconReceipt size={22}/>, tone: "inward", onClick: () => showToast("inward", "✓", "New receipt draft started") },
        { label: "Add Payment", hint: "Money you paid to a party — wages, expenses, or settlements.", icon: <IconWallet size={22}/>, tone: "outward", onClick: () => showToast("outward", "✓", "New payment draft started") },
      ],
    },
  };

  const renderScreen = () => {
    if (showSearch) return <GlobalSearchScreen onClose={() => setShowSearch(false)}/>;
    if (showSettings) return <SettingsScreen darkMode={darkMode} setDarkMode={setDarkMode} onClose={() => setShowSettings(false)}/>;
    switch (tab) {
      case "home": return <HomeScreen onProfileClick={() => setShowSettings(true)}/>;
      case "stock": return <StockScreen/>;
      case "parties": return <PartiesScreen/>;
      case "money": return <MoneyScreen/>;
      default: return <HomeScreen onProfileClick={() => setShowSettings(true)}/>;
    }
  };

  const fabConfig = fabConfigs[tab];
  const showFab = !showSettings && !showSearch && fabConfig;
  const showTabs = !showSettings && !showSearch;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 844,
      background: "var(--bg-page)",
      paddingTop: SAFE_TOP, // sit below iOS device status bar
    }}>
      {network === "offline" && !showSearch && !showSettings && (
        <OfflineBanner queueCount={queue}/>
      )}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {renderScreen()}
        {showFab && <TabFab onClick={() => setFabOpen(true)}/>}
        {fabOpen && fabConfig && (
          <FabActionSheet
            open={fabOpen}
            onClose={() => setFabOpen(false)}
            title={fabConfig.title}
            actions={fabConfig.actions}
          />
        )}
        {toast && <Toast tone={toast.tone} icon={toast.icon} visible>{toast.text}</Toast>}
      </div>
      {showTabs && (
        <TabBar
          active={tab}
          onChange={setTab}
          onSearch={() => setShowSearch(true)}
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(
  <IOSDevice width={390} height={844}>
    <App/>
  </IOSDevice>
);
