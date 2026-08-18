import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Cpu, Network, Wifi, AlertTriangle,
  Clock, FileDown, Settings, Shield, Activity, Key, Brain
} from "lucide-react";

const navItems = [
  { section: "Overview" },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Monitoring" },
  { path: "/processes", label: "Process Monitor", icon: Cpu },
  { path: "/network", label: "Network Monitor", icon: Network },
  { path: "/devices", label: "Devices", icon: Wifi },
  { path: "/persistence", label: "Persistence", icon: Key },
  { section: "Security" },
  { path: "/alerts", label: "Alerts", icon: AlertTriangle, badge: 5 },
  { path: "/timeline", label: "Timeline", icon: Clock },
  { path: "/export", label: "Incident Export", icon: FileDown },
  { section: "Intelligence" },
  { path: "/model-info", label: "ML Engine Info", icon: Brain },
  { section: "System" },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Shield size={20} />
        </div>
        <div className="sidebar-title">
          <h1>Sentinel AI</h1>
          <span>Endpoint Protection</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if ("section" in item && !("path" in item)) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          if (!("path" in item)) return null;
          const Icon = item.icon!;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path!}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              {item.label}
              {item.badge && <span className="badge">{item.badge}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="feed-status">
          <span className="dot"></span>
          <div>
            <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 12 }}>
              Threat Intel Active
            </div>
            <div style={{ fontSize: 10 }}>Updated 12 min ago</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--text-muted)" }}>
          <Activity size={12} />
          <span>System monitoring active</span>
        </div>
      </div>
    </aside>
  );
}
