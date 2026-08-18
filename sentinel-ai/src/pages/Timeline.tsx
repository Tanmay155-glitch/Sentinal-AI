import { useState, useEffect } from "react";
import { Cpu, Network, Wifi, FileText, Key, AlertTriangle, Reply, Usb, Radio } from "lucide-react";
import { getTimelineLive, isLiveMode } from "../services/liveData";
import type { TimelineEvent } from "../services/liveData";

const catIcons: Record<string, typeof Cpu> = {
  process: Cpu, network: Network, device: Wifi, registry: Key,
  file: FileText, alert: AlertTriangle, response: Reply, usb: Usb,
};

const catColors: Record<string, string> = {
  process: "var(--accent-cyan)", network: "var(--accent-blue)", device: "var(--accent-purple)",
  registry: "var(--severity-medium)", file: "var(--text-secondary)", alert: "var(--severity-high)",
  response: "var(--severity-low)", usb: "var(--text-muted)",
};

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [live, setLive] = useState(false);
  const categories = ["all","process","network","device","registry","file","alert","response","usb"];

  useEffect(() => {
    const load = async () => {
      setEvents(await getTimelineLive());
      setLive(isLiveMode());
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = events.filter(e => filter === "all" || e.event_category === filter);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Attack Timeline</h2>
          <div className="page-header-sub">
            {live ? "Chronological event feed from live process & network telemetry" : "Simulated event feed — launch Tauri for live stream"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge-pill ${live ? "badge-low" : "badge-medium"}`} style={{ fontSize: 10 }}>
            <Radio size={10} /> {live ? "LIVE EVENT STREAM" : "MOCK STREAM"}
          </span>
        </div>
      </div>
      <div className="page-body animate-stagger">
        <div className="filter-bar">
          {categories.map(c => (
            <button key={c} className={`filter-chip ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="timeline">
            {filtered.map(ev => {
              const Icon = catIcons[ev.event_category] || FileText;
              const color = catColors[ev.event_category] || "var(--text-muted)";
              return (
                <div key={ev.timeline_id} className={`timeline-item ${ev.event_category === "alert" ? "alert" : ev.event_category === "response" ? "response" : ""}`}>
                  <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`badge-pill ${ev.event_category === "alert" ? "badge-high" : "badge-info"}`} style={{ fontSize: 10 }}>
                          {ev.event_category}
                        </span>
                        <span className="timeline-time">
                          {new Date(ev.event_ts * 1000).toLocaleTimeString()} · {new Date(ev.event_ts * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="timeline-text" style={{ marginTop: 6 }}>{ev.summary_text}</div>
                      {ev.related_alert_id && (
                        <div style={{ fontSize: 11, color: "var(--accent-blue)", marginTop: 4, cursor: "pointer" }}>
                          Related to Alert #{ev.related_alert_id} →
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
