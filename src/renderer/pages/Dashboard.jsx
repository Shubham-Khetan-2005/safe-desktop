import React, { useEffect, useState } from "react";
import { fetchSafeOverviewData, fetchRecentActivity, fetchTxLifecycleData } from "../services/hyperindex.service";
import Modal from "../components/Modal";

export default function Dashboard({ safeAddress, chainId = 11155111 }) {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [showOwnersModal, setShowOwnersModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  
  // Modal data
  const [transactions, setTransactions] = useState([]);
  const [ownersData, setOwnersData] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  if (!safeAddress) {
    return <div style={styles.loading}>No safe address specified.</div>;
  }
  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [overviewData, activityPreview] = await Promise.all([
          fetchSafeOverviewData(safeAddress),
          fetchRecentActivity(safeAddress, 5)
        ]);
        setStats(overviewData);
        setRecentActivity(activityPreview);
        setLastUpdate(Date.now());
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [safeAddress]);

  // Load transaction data when modal opens
  const openTxModal = async () => {
    setShowTxModal(true);
    setModalLoading(true);
    try {
      const txs = await fetchTxLifecycleData(safeAddress);
      setTransactions(txs);
    } catch (e) {
      console.error("Failed to load transactions:", e);
    }
    setModalLoading(false);
  };

  // Load owners data when modal opens
//   const openOwnersModal = async () => {
//     setShowOwnersModal(true);
//     setModalLoading(true);
//     try {
//       const owners = await fetchOwnersData(safeAddress);
//       setOwnersData(owners);
//     } catch (e) {
//       console.error("Failed to load owners:", e);
//     }
//     setModalLoading(false);
//   };

  // Load full activity when modal opens
  const openActivityModal = async () => {
    setShowActivityModal(true);
    setModalLoading(true);
    try {
      const activity = await fetchRecentActivity(safeAddress, 50);
      setActivityData(activity);
    } catch (e) {
      console.error("Failed to load activity:", e);
    }
    setModalLoading(false);
  };

  if (loading) return <div style={styles.loading}>Loading Safe Dashboard...</div>;
  if (err) return <div style={{ color: "#b00020" }}>Error: {err}</div>;
  if (!stats) return <div>No Safe data found.</div>;

  const executionRate = stats.totalTxs > 0 ? Math.round((stats.executedTxs / stats.totalTxs) * 100) : 0;
  const failureRate = stats.totalTxs > 0 ? Math.round((stats.failedTxs / stats.totalTxs) * 100) : 0;
  const healthScore = calculateHealthScore(executionRate, failureRate, stats.totalTxs);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Safe Dashboard</h1>
          <div style={styles.networkInfo}>
            <span style={styles.networkBadge}>🟢 Sepolia Testnet</span>
            <span style={styles.safeAddress}>Safe: {truncateAddress(safeAddress)}</span>
            <span style={styles.lastUpdate}>Last updated: {formatRelativeTime(lastUpdate)}</span>
          </div>
        </div>
        {/* <HealthScoreBadge score={healthScore} /> */}
      </div>

      {/* Circular Gauges */}
      <div style={styles.gaugesRow}>
        <CircularGauge 
          percentage={executionRate} 
          label="Success Rate" 
          color="#28a745"
          subtitle={`${stats.executedTxs} executed`}
        />
        <CircularGauge 
          percentage={100 - failureRate} 
          label="Reliability" 
          color="#007bff"
          subtitle={`${stats.failedTxs} failures`}
        />
        {/* <CircularGauge 
          percentage={healthScore} 
          label="Health Score" 
          color="#ff9800"
          subtitle="Overall status"
        /> */}
      </div>

      {/* Quick Stats */}
      <div style={styles.statsGrid}>
        <QuickStat icon="📊" label="Total Transactions" value={stats.totalTxs} color="#6c757d" />
        <QuickStat icon="✅" label="Executed" value={stats.executedTxs} color="#28a745" />
        <QuickStat icon="⏳" label="Pending" value={stats.pendingTxs} color="#ffc107" />
        <QuickStat icon="❌" label="Failed" value={stats.failedTxs} color="#dc3545" />
      </div>

      {/* Safe Owners */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>👥 Safe Owners ({3})</h2>
        <div style={styles.ownersList}>
          {stats.owners.slice(0, 3).map((owner, idx) => (
            <div key={owner} style={styles.ownerItem}>
              <div style={styles.ownerAvatar}>{getIdenticon(owner)}</div>
              <div style={styles.ownerAddress}>{truncateAddress(owner)}</div>
            </div>
          ))}
          {stats.owners.length > 3 && (
            <div style={styles.moreOwners}>+{stats.owners.length - 3} more</div>
          )}
        </div>
        <div style={styles.thresholdInfo}>
          <strong>Threshold:</strong> 2 of {3} signatures required
        </div>
      </div>

      {/* Recent Activity */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📋 Recent Activity</h2>
        <div style={styles.activityPreview}>
          {recentActivity.length > 0 ? (
            recentActivity.slice(0, 3).map(activity => (
              <ActivityItemCompact key={activity.id} activity={activity} />
            ))
          ) : (
            <div style={styles.noActivity}>No recent activity</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <h2 style={styles.sectionTitle}>⚡ Quick Actions</h2>
        <div style={styles.actionButtons}>
          <ActionButton icon="📜" label="View All Transactions" onClick={openTxModal} />
          {/* <ActionButton icon="👥" label="Manage Owners" onClick={openOwnersModal} /> */}
          <ActionButton icon="📊" label="Activity Log" onClick={openActivityModal} />
          <ActionButton icon="💾" label="Export Data" onClick={() => exportData(stats)} />
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showTxModal} onClose={() => setShowTxModal(false)} title="Transaction Lifecycle">
        <TransactionModal transactions={transactions} loading={modalLoading} chainId={chainId} />
      </Modal>

      <Modal isOpen={showOwnersModal} onClose={() => setShowOwnersModal(false)} title="Safe Owners & Settings">
        <OwnersModal ownersData={ownersData} loading={modalLoading} safeAddress={safeAddress} />
      </Modal>

      <Modal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} title="Activity Log">
        <ActivityModal activityData={activityData} loading={modalLoading} chainId={chainId} />
      </Modal>
    </div>
  );
}

// Modal Content Components

function TransactionModal({ transactions, loading, chainId }) {
  if (loading) return <div>Loading transactions...</div>;
  if (!transactions.length) return <div>No transactions found.</div>;

  return (
    <div style={styles.modalTable}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Status</th>
            <th>To</th>
            <th>Value</th>
            <th>Timestamp</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: tx.status === "Executed" ? "#d4edda" : tx.status === "Failed" ? "#f8d7da" : "#fff3cd",
                  color: tx.status === "Executed" ? "#155724" : tx.status === "Failed" ? "#721c24" : "#856404"
                }}>
                  {tx.status}
                </span>
              </td>
              <td style={{fontFamily: "monospace", fontSize: 13}}>{truncateAddress(tx.to)}</td>
              <td>{tx.value}</td>
              <td style={{fontSize: 13}}>{formatExactTime(tx.timestamp)}</td>
              <td>
                {tx.txHash && (
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    View →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OwnersModal({ ownersData, loading, safeAddress }) {
  if (loading) return <div>Loading owners...</div>;
  if (!ownersData) return <div>No owner data found.</div>;

  return (
    <div>
      <div style={styles.ownerStats}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{ownersData.currentOwners.length}</div>
          <div style={styles.statLabel}>Current Owners</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{ownersData.threshold}</div>
          <div style={styles.statLabel}>Signature Threshold</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{ownersData.totalChanges}</div>
          <div style={styles.statLabel}>Total Changes</div>
        </div>
      </div>

      <h3 style={{marginTop: 24, marginBottom: 16}}>Current Owners</h3>
      <div style={styles.ownersGrid}>
        {ownersData.currentOwners.map((owner, idx) => (
          <OwnerCard key={owner.owner} owner={owner} index={idx} />
        ))}
      </div>

      {ownersData.history && ownersData.history.length > 0 && (
        <>
          <h3 style={{marginTop: 24, marginBottom: 16}}>Change History</h3>
          <div style={styles.historyList}>
            {ownersData.history.map((event) => (
              <div key={event.id} style={styles.historyItem}>
                <div style={styles.historyIcon}>
                  {event.type === "AddedOwner" ? "➕" : event.type === "RemovedOwner" ? "➖" : "⚙️"}
                </div>
                <div style={styles.historyDetails}>
                  <div style={styles.historyType}>{event.type}</div>
                  <div style={styles.historyTime}>{formatExactTime(event.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityModal({ activityData, loading, chainId }) {
  if (loading) return <div>Loading activity...</div>;
  if (!activityData.length) return <div>No activity found.</div>;

  return (
    <div style={styles.activityList}>
      {activityData.map(activity => (
        <ActivityItemFull key={activity.id} activity={activity} chainId={chainId} />
      ))}
    </div>
  );
}

// Helper Components

function ActivityItemCompact({ activity }) {
  const getIcon = (type) => {
    switch (type) {
      case "ExecutionSuccess": return "✅";
      case "ExecutionFailure": return "❌";
      case "AddedOwner": return "👤➕";
      default: return "📝";
    }
  };

  // Convert timestamp to milliseconds if it's in seconds
  const getTimestamp = () => {
    if (!activity.timestamp) return Date.now();
    // If timestamp is less than 1000000000000, it's in seconds, convert to milliseconds
    return activity.timestamp < 1000000000000 ? activity.timestamp * 1000 : activity.timestamp;
  };

  return (
    <div style={styles.activityItemCompact}>
      <span style={{fontSize: 18}}>{getIcon(activity.type)}</span>
      <span style={{flex: 1, fontSize: 13}}>{activity.type}</span>
      <span style={{fontSize: 12, color: "#999"}}>{formatRelativeTime(getTimestamp())}</span>
    </div>
  );
}

function ActivityItemFull({ activity, chainId }) {
  const getIcon = (type) => {
    switch (type) {
      case "ExecutionSuccess": return "✅";
      case "ExecutionFailure": return "❌";
      case "AddedOwner": return "👤➕";
      case "RemovedOwner": return "👤➖";
      case "ApproveHash": return "✍️";
      default: return "📝";
    }
  };

  const getColor = (type) => {
    switch (type) {
      case "ExecutionSuccess": return "#28a745";
      case "ExecutionFailure": return "#dc3545";
      case "AddedOwner": return "#007bff";
      case "RemovedOwner": return "#ff9800";
      default: return "#6c757d";
    }
  };

  // Convert timestamp to milliseconds if it's in seconds
  const getTimestamp = () => {
    if (!activity.timestamp) return null;
    // If timestamp is less than 1000000000000, it's in seconds, convert to milliseconds
    return activity.timestamp < 1000000000000 ? activity.timestamp * 1000 : activity.timestamp;
  };

  return (
    <div style={styles.activityItemFull}>
      <div style={{...styles.activityIconFull, backgroundColor: getColor(activity.type) + "20"}}>
        {getIcon(activity.type)}
      </div>
      <div style={{flex: 1}}>
        <div style={{fontWeight: 600, marginBottom: 4}}>{activity.type}</div>
        <div style={{fontSize: 13, color: "#666"}}>
          {formatExactTime(getTimestamp())}
          {activity.txHash && (
            <>
              {" • "}
              <a 
                href={`https://sepolia.etherscan.io/tx/${activity.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on Etherscan →
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OwnerCard({ owner, index }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(owner.owner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert timestamp to milliseconds if it's in seconds
  const getTimestamp = () => {
    if (!owner.timestamp) return Date.now();
    // If timestamp is less than 1000000000000, it's in seconds, convert to milliseconds
    return owner.timestamp < 1000000000000 ? owner.timestamp * 1000 : owner.timestamp;
  };

  return (
    <div style={styles.ownerCard}>
      <div style={styles.ownerAvatarLarge}>{getIdenticon(owner.owner)}</div>
      <div style={{flex: 1}}>
        <div style={{fontFamily: "monospace", fontSize: 14, fontWeight: 500, marginBottom: 4}}>
          {truncateAddress(owner.owner)}
        </div>
        <div style={{fontSize: 12, color: "#666"}}>
          Added {formatRelativeTime(getTimestamp())}
        </div>
      </div>
      <button onClick={handleCopy} style={styles.copyButton}>
        {copied ? "✓ Copied" : "📋 Copy"}
      </button>
    </div>
  );
}

// Keep all your existing helper components and functions
// (CircularGauge, HealthScoreBadge, QuickStat, ActionButton, etc.)
// ... [Previous helper functions remain the same]

function CircularGauge({ percentage, label, color, subtitle }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    let current = 0;
    const increment = percentage / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= percentage) {
        setAnimatedPercentage(percentage);
        clearInterval(timer);
      } else {
        setAnimatedPercentage(Math.round(current));
      }
    }, 20);
    
    return () => clearInterval(timer);
  }, [percentage]);

  const radius = 80;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  return (
    <div style={styles.gaugeContainer}>
      <svg height={radius * 2} width={radius * 2}>
        <circle stroke="#e0e0e0" fill="transparent" strokeWidth={strokeWidth} r={normalizedRadius} cx={radius} cy={radius} />
        <circle stroke={color} fill="transparent" strokeWidth={strokeWidth} strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%', strokeLinecap: 'round' }}
          r={normalizedRadius} cx={radius} cy={radius} />
      </svg>
      <div style={styles.gaugeText}>
        <div style={{ ...styles.gaugePercentage, color }}>{animatedPercentage}%</div>
        <div style={styles.gaugeLabel}>{label}</div>
        {subtitle && <div style={styles.gaugeSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}

function HealthScoreBadge({ score }) {
  const getColor = () => {
    if (score >= 80) return { bg: "#d4edda", text: "#155724", label: "Excellent" };
    if (score >= 60) return { bg: "#fff3cd", text: "#856404", label: "Good" };
    if (score >= 40) return { bg: "#f8d7da", text: "#721c24", label: "Fair" };
    return { bg: "#f8d7da", text: "#721c24", label: "Needs Attention" };
  };
  const { bg, text, label } = getColor();
  
  return (
    <div style={{ ...styles.healthBadge, backgroundColor: bg, color: text }}>
      <div style={styles.healthLabel}>{label}</div>
      <div style={styles.healthScore}>{score}/100</div>
    </div>
  );
}

function QuickStat({ icon, label, value, color }) {
  return (
    <div style={styles.quickStat}>
      <div style={{ ...styles.quickStatIcon, color }}>{icon}</div>
      <div style={styles.quickStatValue}>{value}</div>
      <div style={styles.quickStatLabel}>{label}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button style={styles.actionButton} onClick={onClick}>
      <span style={styles.actionIcon}>{icon}</span>
      <span style={styles.actionLabel}>{label}</span>
    </button>
  );
}

// Helper Functions
function calculateHealthScore(successRate, failureRate, totalTxs) {
  if (totalTxs === 0) return 50;
  const activityBonus = Math.min(totalTxs / 10, 20);
  const successScore = successRate * 0.6;
  const reliabilityScore = (100 - failureRate) * 0.2;
  return Math.min(Math.round(successScore + reliabilityScore + activityBonus), 100);
}

function truncateAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getIdenticon(addr) {
  const colors = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'];
  const index = parseInt(addr.slice(2, 4), 16) % colors.length;
  return colors[index];
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

function formatExactTime(timestamp) {
  if (!timestamp) return "-";
  // Timestamp is already in milliseconds from getTimestamp()
  const date = new Date(Number(timestamp));
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
}

function exportData(stats) {
  const dataStr = JSON.stringify(stats, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `safe-dashboard-${Date.now()}.json`;
  link.click();
}

// Styles (add to existing styles object)
const styles = {
  // ... [keep all existing styles]
  container: { maxWidth: 1600, margin: "32px auto", padding: 24, fontFamily: "Inter, -apple-system, Arial", backgroundColor: "#f8f9fa", minHeight: "100vh" },
  loading: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: 18, color: "#666" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30, padding: 20, background: "white", borderRadius: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: "#1a1a1a" },
  networkInfo: { display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: "#666" },
  networkBadge: { padding: "4px 10px", background: "#d4edda", color: "#155724", borderRadius: 12, fontWeight: 500 },
  safeAddress: { fontFamily: "monospace", background: "#f0f0f0", padding: "4px 8px", borderRadius: 4 },
  lastUpdate: { color: "#999", fontStyle: "italic" },
  healthBadge: { padding: "12px 20px", borderRadius: 12, textAlign: "center", minWidth: 120 },
  healthLabel: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  healthScore: { fontSize: 24, fontWeight: 700 },
  gaugesRow: { display: "flex", justifyContent: "center", gap: 60, marginBottom: 40, padding: "30px 0", background: "white", borderRadius: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  gaugeContainer: { position: "relative", display: "inline-block" },
  gaugeText: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" },
  gaugePercentage: { fontSize: 32, fontWeight: "bold", lineHeight: 1 },
  gaugeLabel: { fontSize: 13, color: "#666", marginTop: 6, fontWeight: 500 },
  gaugeSubtitle: { fontSize: 11, color: "#999", marginTop: 2 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 30 },
  quickStat: { background: "white", padding: 20, borderRadius: 12, textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", transition: "transform 0.2s" },
  quickStatIcon: { fontSize: 32, marginBottom: 8 },
  quickStatValue: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 },
  quickStatLabel: { fontSize: 13, color: "#666", fontWeight: 500 },
  twoColumn: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 30 },
  section: { background: "white", padding: 24, borderRadius: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  sectionTitle: { margin: "0 0 20px 0", fontSize: 18, fontWeight: 600, color: "#1a1a1a" },
  ownersList: { display: "flex", flexDirection: "column", gap: 8 },
  ownerItem: { display: "flex", alignItems: "center", gap: 12, padding: 8, background: "#f8f9fa", borderRadius: 8 },
  ownerAvatar: { width: 32, height: 32, borderRadius: "50%", background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  ownerAddress: { fontFamily: "monospace", fontSize: 13 },
  moreOwners: { padding: 8, textAlign: "center", color: "#666", fontSize: 13, fontStyle: "italic" },
  thresholdInfo: { marginTop: 16, padding: 12, background: "#fff3cd", borderRadius: 8, fontSize: 14, color: "#856404" },
  activityPreview: { display: "flex", flexDirection: "column", gap: 8 },
  activityItemCompact: { display: "flex", alignItems: "center", gap: 12, padding: 8, background: "#f8f9fa", borderRadius: 8 },
  noActivity: { textAlign: "center", padding: 20, color: "#999", fontSize: 14 },
  actions: { background: "white", padding: 24, borderRadius: 12, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  actionButtons: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  actionButton: { padding: "12px 20px", background: "#f8f9fa", border: "2px solid #e0e0e0", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" },
  actionIcon: { fontSize: 18 },
  actionLabel: { color: "#1a1a1a", fontWeight: 600 },
  
  // Modal content styles
  modalTable: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  statusBadge: { padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 500 },
  link: { color: "#007bff", textDecoration: "none", fontWeight: 500 },
  ownerStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  statItem: { textAlign: "center", padding: 16, background: "#f8f9fa", borderRadius: 8 },
  statValue: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 },
  statLabel: { fontSize: 13, color: "#666" },
  ownersGrid: { display: "flex", flexDirection: "column", gap: 12 },
  ownerCard: { display: "flex", alignItems: "center", padding: 12, background: "#f8f9fa", borderRadius: 8, gap: 12 },
  ownerAvatarLarge: { width: 48, height: 48, borderRadius: "50%", background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 },
  copyButton: { padding: "6px 14px", background: "#007bff", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500 },
  historyList: { display: "flex", flexDirection: "column", gap: 12 },
  historyItem: { display: "flex", gap: 12, padding: 12, background: "#f8f9fa", borderRadius: 8 },
  historyIcon: { width: 40, height: 40, borderRadius: 8, background: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
  historyDetails: { flex: 1 },
  historyType: { fontWeight: 600, marginBottom: 4 },
  historyTime: { fontSize: 12, color: "#666" },
  activityList: { display: "flex", flexDirection: "column", gap: 12 },
  activityItemFull: { display: "flex", gap: 12, padding: 12, background: "#f8f9fa", borderRadius: 8, alignItems: "flex-start" },
  activityIconFull: { width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
};