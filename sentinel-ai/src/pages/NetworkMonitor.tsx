import { useState, useEffect } from "react";
import { Search, ArrowUpRight, ArrowDownRight, AlertTriangle, ShieldCheck, Activity, Radio } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getNetworkFlowsLive, isLiveMode } from "../services/liveData";
import type { NetworkFlow } from "../services/liveData";

function formatBytes(b: number): string {
  if (b > 1e6) return (b / 1e6).toFixed(1) + " MB";
  if (b > 1e3) return (b / 1e3).toFixed(1) + " KB";
  return b + " B";
}

export default function NetworkMonitor() {
  const [flows, setFlows] = useState<NetworkFlow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [live, setLive] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const f = await getNetworkFlowsLive();
      setFlows(f);
      setLive(isLiveMode());
    };
    refresh();
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
  }, []);

  const filtered = flows.filter(f => {
    if (search && !f.dst_ip.includes(search) && !(f.sni_hostname || "").toLowerCase().includes(search.toLowerCase()) && !(f.process_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "threat" && !f.threat_intel_match) return false;
    return true;
  });

  // Top destinations by traffic
  const destMap: Record<string, number> = {};
  flows.forEach(f => {
    const key = f.sni_hostname || f.dst_ip;
    destMap[key] = (destMap[key] || 0) + f.bytes_received + f.bytes_sent;
  });
  const topDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, bytes]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, bytes }));

  // Protocol distribution
  const protoMap: Record<string, number> = {};
  flows.forEach(f => {
    protoMap[f.protocol] = (protoMap[f.protocol] || 0) + 1;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Network Flow Monitor</h2>
          <div className="page-header-sub">
            {live ? "Live active connections from netstat — real-time flow capture" : "Simulated network metadata — launch Tauri for live capture"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge-pill ${live ? "badge-low" : "badge-medium"}`} style={{ fontSize: 10 }}>
            <Radio size={10} /> {live ? "LIVE CAPTURE" : "MOCK DATA"}
          </span>
          <div className="search-box">
            <Search size={14} />
            <input placeholder="Filter by IP, hostname..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="page-body animate-stagger">
        <div className="filter-bar">
          {[
            { id: "all", label: "All Active Flows" },
            { id: "threat", label: "Threat Intel Matches Only" },
          ].map(f => (
            <button key={f.id} className={`filter-chip ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {filtered.length} active sessions
          </span>
        </div>

        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Activity size={15} style={{ color: "var(--accent-blue)" }} /> Top Traffic Destinations</span>
            </div>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDest} layout="vertical" margin={{ left: -10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13, 19, 34, 0.95)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                    }}
                    formatter={(v: any) => [formatBytes(Number(v || 0)), "Traffic"]}
                  />
                  <Bar dataKey="bytes" fill="url(#blueBarGrad)" radius={[0, 6, 6, 0]} />
                  <defs>
                    <linearGradient id="blueBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#00f2fe" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><ShieldCheck size={15} style={{ color: "var(--accent-cyan)" }} /> Protocol Distribution</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "8px 0" }}>
              {Object.entries(protoMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([proto, count]) => (
                <div key={proto} style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  textAlign: "center",
                  transition: "all 0.2s ease"
                }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: "var(--accent-cyan)" }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontWeight: 600 }}>{proto}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 490px)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Hostname / SNI</th>
                <th>Sent</th>
                <th>Received</th>
                <th>Process</th>
                <th>Threat Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.flow_id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{f.src_ip}:{f.src_port}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{f.dst_ip}:{f.dst_port}</td>
                  <td><span className="badge-pill badge-info">{f.protocol}</span></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{f.dst_port}</td>
                  <td style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500 }}>{f.sni_hostname || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <ArrowUpRight size={12} style={{ color: "var(--severity-low)" }} /> {formatBytes(f.bytes_sent)}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <ArrowDownRight size={12} style={{ color: "var(--accent-blue)" }} /> {formatBytes(f.bytes_received)}
                  </td>
                  <td style={{ fontSize: 12 }}>{f.process_name || "—"}</td>
                  <td>
                    {f.threat_intel_match ? (
                      <span className="badge-pill badge-critical">
                        <AlertTriangle size={11} /> Flagged
                      </span>
                    ) : (
                      <span className="badge-pill badge-low" style={{ fontSize: 10 }}>Clean</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
