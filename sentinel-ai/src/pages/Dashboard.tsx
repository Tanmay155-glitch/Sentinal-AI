import { useState, useEffect } from "react";
import {
  Cpu, MemoryStick, Wifi, AlertTriangle, Shield, Monitor,
  Ban, Activity, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Radio
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getSystemStatsLive, getCpuHistoryLive, getAlertsLive, isLiveMode } from "../services/liveData";
import { scanDevices } from "../services/deviceScanner";
import type { SystemStats, AlertInfo } from "../services/liveData";
import MitreHeatmap from "../components/MitreHeatmap";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

function formatBytes(bytes: number): string {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(2) + " GB";
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes > 1e3) return (bytes / 1e3).toFixed(1) + " KB";
  return bytes + " B";
}

export default function Dashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [alerts, setAlerts] = useState<AlertInfo[]>([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const s = await getSystemStatsLive();
      setStats(s);
      setCpuHist(getCpuHistoryLive());
      setLive(isLiveMode());

      const a = await getAlertsLive();
      setAlerts(a);

      try {
        const scan = await scanDevices();
        setDeviceCount(scan.devices.length);
        setBlockedCount(scan.devices.filter(d => d.trust_status === "blocked").length);
      } catch {
        setDeviceCount(0);
      }
    };
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, []);

  if (!stats) return null;

  const openAlerts = alerts.filter(a => a.status === "open");
  const riskLevel = openAlerts.length > 10 ? "Critical" : openAlerts.length > 5 ? "High" : openAlerts.length > 0 ? "Medium" : "Low";
  const riskColor = riskLevel === "Critical" ? "critical" : riskLevel === "High" ? "high" : riskLevel === "Medium" ? "medium" : "low";

  const chartData = cpuHist.map((v, i) => ({ time: i, cpu: v }));

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2>Security Dashboard</h2>
            <Sparkles size={16} style={{ color: "var(--accent-cyan)" }} />
          </div>
          <div className="page-header-sub">Real-time endpoint protection and AI threat intelligence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`badge-pill ${live ? "badge-low" : "badge-medium"}`} style={{ fontSize: 10 }}>
            <Radio size={10} /> {live ? "LIVE TELEMETRY" : "MOCK DATA MODE"}
          </span>
          <span className={`badge-pill badge-${riskColor}`}>
            <Shield size={12} /> {riskLevel} Risk
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Uptime: {formatUptime(stats.uptime_seconds)}
          </span>
        </div>
      </div>

      <div className="page-body animate-stagger">
        {/* KPI Cards */}
        <div className="stats-grid">
          <div className="stat-card cyan">
            <div className="stat-icon cyan"><Cpu size={20} /></div>
            <div className="stat-value">{stats.cpu_usage.toFixed(1)}%</div>
            <div className="stat-label">CPU Usage</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-icon blue"><MemoryStick size={20} /></div>
            <div className="stat-value">{stats.memory_usage_percent.toFixed(0)}%</div>
            <div className="stat-label">Memory ({stats.memory_used_mb} / {stats.memory_total_mb} MB)</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple"><Monitor size={20} /></div>
            <div className="stat-value">{stats.total_processes}</div>
            <div className="stat-label">Active Processes</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-icon amber"><AlertTriangle size={20} /></div>
            <div className="stat-value">{openAlerts.length}</div>
            <div className="stat-label">Open Alerts</div>
          </div>
          <div className="stat-card cyan">
            <div className="stat-icon cyan"><Wifi size={20} /></div>
            <div className="stat-value">{deviceCount}</div>
            <div className="stat-label">Network Devices</div>
          </div>
          <div className="stat-card red">
            <div className="stat-icon red"><Ban size={20} /></div>
            <div className="stat-value">{blockedCount}</div>
            <div className="stat-label">Blocked Devices</div>
          </div>
        </div>

        {/* MITRE ATT&CK Matrix Heatmap */}
        <MitreHeatmap />

        <div className="grid-2" style={{ marginTop: 20 }}>
          {/* CPU Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Activity size={15} style={{ color: "var(--accent-cyan)" }} /> CPU Load History</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {live ? "Live Telemetry" : "Simulated"}
              </span>
            </div>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f2fe" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#4facfe" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13, 19, 34, 0.95)",
                      border: "1px solid rgba(0, 242, 254, 0.2)",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(v: any) => [`${Number(v || 0).toFixed(1)}%`, "CPU"]}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#00f2fe" strokeWidth={2.5} fill="url(#cpuGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Level + Network */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className={`risk-level-card ${riskColor}`}>
              <div className="risk-level-label" style={{ color: `var(--severity-${riskColor})` }}>
                Overall Threat Score
              </div>
              <div className="risk-level-value" style={{ color: `var(--severity-${riskColor})` }}>
                {riskLevel}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Based on {openAlerts.length} open alert{openAlerts.length !== 1 ? "s" : ""} across process & network modules
              </div>
            </div>

            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="card-header">
                <span className="card-title"><TrendingUp size={15} style={{ color: "var(--accent-blue)" }} /> Network Bandwidth</span>
              </div>
              <div style={{ display: "flex", gap: 32 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <ArrowDownRight size={14} style={{ color: "var(--severity-low)" }} /> Received
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>
                    {formatBytes(stats.network_rx_bytes)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <ArrowUpRight size={14} style={{ color: "var(--accent-blue)" }} /> Sent
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--text-primary)" }}>
                    {formatBytes(stats.network_tx_bytes)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={15} style={{ color: "var(--severity-high)" }} /> Active Threat Alerts</span>
            <a href="/alerts" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-cyan)" }}>View All →</a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Risk Score</th>
                <th>Source</th>
                <th>Category</th>
                <th>MITRE ATT&CK</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 5).map(a => {
                const sev = a.risk_score >= 80 ? "critical" : a.risk_score >= 60 ? "high" : a.risk_score >= 40 ? "medium" : "low";
                return (
                  <tr key={a.alert_id}>
                    <td><span className={`badge-pill badge-${sev}`}>{a.risk_score.toFixed(0)}</span></td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 600 }}>{a.source_name}</td>
                    <td>{a.category_label}</td>
                    <td>
                      {a.attck_technique ? (
                        <span className="badge-pill badge-purple">{a.attck_technique}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(a.created_ts * 1000).toLocaleTimeString()}
                    </td>
                    <td><span className={`badge-pill badge-${a.status === "open" ? "high" : "info"}`}>{a.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
