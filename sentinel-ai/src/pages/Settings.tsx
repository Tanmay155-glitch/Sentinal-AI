import { useState, useEffect } from "react";
import { Settings as SettingsIcon, AlertTriangle, Database, Rss, Trash2, Plus, ExternalLink, Info } from "lucide-react";
import { getSettingLive, updateSettingLive } from "../services/liveData";

interface Feed {
  name: string;
  url: string;
  lastRefresh: string;
}

export default function SettingsPage() {
  const [threshold, setThreshold] = useState(65);
  const [autoResponse, setAutoResponse] = useState(false);
  const [retention, setRetention] = useState(30);
  const [feeds, setFeeds] = useState<Feed[]>([
    { name: "abuse.ch URLhaus", url: "https://urlhaus.abuse.ch/downloads/csv/", lastRefresh: "12 min ago" },
    { name: "abuse.ch MalwareBazaar", url: "https://bazaar.abuse.ch/export/csv/recent/", lastRefresh: "12 min ago" },
  ]);

  useEffect(() => {
    getSettingLive("detection_threshold").then(val => {
      const parsed = parseInt(val);
      if (!isNaN(parsed)) setThreshold(parsed);
    });
    getSettingLive("auto_response_enabled").then(val => {
      setAutoResponse(val === "true");
    });
    getSettingLive("retention_days").then(val => {
      const parsed = parseInt(val);
      if (!isNaN(parsed)) setRetention(parsed);
    });
  }, []);

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    updateSettingLive("detection_threshold", val.toString());
  };

  const handleAutoResponseToggle = () => {
    const next = !autoResponse;
    setAutoResponse(next);
    updateSettingLive("auto_response_enabled", next.toString());
  };

  const handleRetentionChange = (val: number) => {
    setRetention(val);
    updateSettingLive("retention_days", val.toString());
  };

  const thresholdLabel = threshold >= 80 ? "High (fewer alerts, higher confidence)" : threshold >= 50 ? "Medium (balanced)" : "Low (more alerts, more noise)";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <div className="page-header-sub">Configure detection sensitivity, feeds, and retention</div>
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 700 }}>
        {/* Detection Sensitivity */}
        <div className="settings-section">
          <h3><SettingsIcon size={16} style={{ verticalAlign: -3, marginRight: 8 }} />Detection Sensitivity</h3>
          <div className="card">
            <div className="setting-row">
              <div>
                <div className="setting-label">Alert Score Threshold</div>
                <div className="setting-desc">
                  Processes with ONNX risk score ≥ {threshold} will generate an alert in SQLite. {thresholdLabel}
                </div>
              </div>
              <div className="slider-container">
                <input type="range" min={10} max={95} value={threshold} onChange={e => handleThresholdChange(Number(e.target.value))} />
                <span className="slider-value">{threshold}</span>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-label">Auto-Response</div>
                <div className="setting-desc">
                  Automatically terminate/block high-confidence threats. Off by default.
                </div>
              </div>
              <div className={`toggle ${autoResponse ? "on" : ""}`} onClick={handleAutoResponseToggle} />
            </div>
            {autoResponse && (
              <div style={{ background: "var(--severity-medium-bg)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginTop: 12, display: "flex", gap: 10, fontSize: 12, color: "var(--severity-medium)" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Warning:</strong> Automated termination/blocking may disrupt legitimate software. 
                  Only enable if you understand the risk of false-positive service disruption.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Retention */}
        <div className="settings-section">
          <h3><Database size={16} style={{ verticalAlign: -3, marginRight: 8 }} />Data Retention</h3>
          <div className="card">
            <div className="setting-row">
              <div>
                <div className="setting-label">Event Retention Window</div>
                <div className="setting-desc">
                  Process events, network flows, and sightings older than this are purged. Alerts are retained longer.
                </div>
              </div>
              <div className="slider-container">
                <input type="range" min={7} max={180} value={retention} onChange={e => handleRetentionChange(Number(e.target.value))} />
                <span className="slider-value">{retention}d</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Capabilities & Feature Status */}
        <div className="settings-section">
          <h3><Info size={16} style={{ verticalAlign: -3, marginRight: 8 }} />Telemetry Engine Status</h3>
          <div className="card" style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>Process Monitoring (sysinfo)</span>
              <span className="badge green" style={{ fontSize: 11 }}>Active Live</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>Network Connections (netstat correlation)</span>
              <span className="badge green" style={{ fontSize: 11 }}>Active Live</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>ONNX ML Scorer (models/detector.onnx)</span>
              <span className="badge green" style={{ fontSize: 11 }}>Active Live</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>SQLite Event Persistence</span>
              <span className="badge green" style={{ fontSize: 11 }}>Active Live</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>Registry Persistence Watcher</span>
              <span className="badge yellow" style={{ fontSize: 11 }}>Not Implemented (Requires Admin / ETW)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
              <span>USB Insertion Monitor</span>
              <span className="badge yellow" style={{ fontSize: 11 }}>Not Implemented (Requires Win32 WM_DEVICECHANGE)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span>Authenticode Signature Validator</span>
              <span className="badge yellow" style={{ fontSize: 11 }}>Not Implemented (Requires WinVerifyTrust)</span>
            </div>
          </div>
        </div>

        {/* Threat Intel Feeds */}
        <div className="settings-section">
          <h3><Rss size={16} style={{ verticalAlign: -3, marginRight: 8 }} />Threat Intelligence Feeds</h3>
          <div className="card">
            {feeds.map((feed, i) => (
              <div key={i} className="setting-row">
                <div>
                  <div className="setting-label">{feed.name}</div>
                  <div className="setting-desc" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {feed.url} <ExternalLink size={10} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--severity-low)", marginTop: 4 }}>Last refresh: {feed.lastRefresh}</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: "6px 8px" }} onClick={() => setFeeds(feeds.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
              <Plus size={14} /> Add Feed
            </button>
          </div>
        </div>

        {/* Disclosure */}
        <div className="settings-section">
          <h3>Disclosure</h3>
          <div className="card" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            <p><strong>Sentinel AI</strong> is a desktop endpoint detection tool built with Tauri, Rust, and React.</p>
            <p style={{ marginTop: 8 }}>It monitors: live processes, entropy, local network connections, local ARP device inventory, and persists events to SQLite.</p>
          </div>
        </div>
      </div>
    </>
  );
}
