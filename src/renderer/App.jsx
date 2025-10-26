import React, { useState } from "react";
import TxComposer from "./components/TxComposer";
import StatusPanel from "./components/StatusPanel";
import HyperIndexPage from "./pages/HyperIndexPage";
import Dashboard from "./pages/Dashboard";
import TxLifecycle from "./pages/TxLifecycle";
import SafeSetup from './components/SafeSetup.jsx';
import KeyGenerator from './components/KeyGenerator.jsx';
import { SafeProvider } from './context/SafeContext';


export default function App() {
  const [safeAddress, setSafeAddress] = useState(
    localStorage.getItem("safeAddress") || null
  );
  const [chainId, setChainId] = useState(11155111); // Sepolia
  const [currentPage, setCurrentPage] = useState("safe-setup");

  useEffect(() => {
    if (safeAddress) {
      localStorage.setItem("safeAddress", safeAddress);
    }
  }, [safeAddress]);

  const renderPage = () => {
    switch (currentPage) {
      case "safe-setup":
        return <SafeSetup onSafeDeployed={setSafeAddress} />;
      case "dashboard":
        return <Dashboard safeAddress={safeAddress} chainId={chainId} />;
      case "hyperindex":
        return <HyperIndexPage safeAddress={safeAddress} chainId={chainId} />;
      case "tx-lifecycle":
        return <TxLifecycle safeAddress={safeAddress} />;
      default:
        return <SafeSetup onSafeDeployed={setSafeAddress} />;
    }
  };

  return (
    <SafeProvider>
      <div className="app">
        {/* <header className="header">Safe Desktop — PoC</header> */}
        <header className="header">
        Safe Desktop — PoC
        <nav style={{ marginLeft: "20px" }}>
          <button
            onClick={() => setCurrentPage("safe-setup")}
            style={{
              marginRight: 10,
              padding: "5px 10px",
              cursor: "pointer",
              backgroundColor:
                currentPage === "safe-setup" ? "#4CAF50" : "#f0f0f0",
              color: currentPage === "safe-setup" ? "white" : "black",
            }}
          >
            Safe Setup
          </button>
          <button
            onClick={() => setCurrentPage("hyperindex")}
            style={{
              marginRight: 10,
              padding: "5px 10px",
              cursor: "pointer",
              backgroundColor:
                currentPage === "hyperindex" ? "#4CAF50" : "#f0f0f0",
              color: currentPage === "hyperindex" ? "white" : "black",
            }}
          >
            HyperIndex
          </button>
          <button
            onClick={() => setCurrentPage("dashboard")}
            style={{
              marginRight: 10,
              padding: "5px 10px",
              cursor: "pointer",
              backgroundColor:
                currentPage === "dashboard" ? "#4CAF50" : "#f0f0f0",
              color: currentPage === "dashboard" ? "white" : "black",
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage("tx-lifecycle")}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
              backgroundColor:
                currentPage === "tx-lifecycle" ? "#4CAF50" : "#f0f0f0",
              color: currentPage === "tx-lifecycle" ? "white" : "black",
            }}
          >
            Tx Lifecycle
          </button>
        </nav>
      </header>

      <main className="main" style={{ padding: "20px" }}>
        {renderPage()}
      </main>
    </div>
    </SafeProvider>
  );
}
