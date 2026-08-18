import { useState, useEffect } from "react";
import {
  Wifi, RefreshCw, Laptop, Router, Network, Info, Check, Ban,
  Smartphone, Tv, Printer, ChevronDown, ChevronRight,
  Radio, HardDrive, LayoutGrid, Network as TreeIcon,
  Globe, Zap
} from "lucide-react";
import { scanDevices, RealDeviceInfo, ScanResult } from "../services/deviceScanner";

const statusColors: Record<string, string> = {
  trusted: "low",
  flagged: "medium",
  blocked: "critical",
  unclassified: "info",
};

export default function Devices() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [filter, setFilter] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState<RealDeviceInfo | null>(null);
  
  // Tree collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const performScan = async () => {
    setLoading(true);
    try {
      const res = await scanDevices();
      setScanResult(res);
      if (res.devices.length > 0 && !selectedDevice) {
        setSelectedDevice(res.devices[0]);
      }
    } catch (e) {
      console.error("Device scan error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performScan();
  }, []);

  const devices = scanResult?.devices || [];
  
  const toggleCategory = (catKey: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  // Group devices by category for the tree view
  const gatewayDevice = devices.find(d => d.is_gateway || d.category === "gateway");
  
  const categories = [
    {
      key: "mobile",
      title: "Mobile & Smart Devices",
      icon: Smartphone,
      color: "var(--accent-cyan)",
      devices: devices.filter(d => d.category === "mobile" || d.device_type.includes("Smartphone") || d.device_type.includes("Tablet")),
    },
    {
      key: "workstation",
      title: "Computers & Workstations",
      icon: Laptop,
      color: "var(--accent-blue)",
      devices: devices.filter(d => d.category === "workstation" || d.is_self || d.device_type.includes("Laptop") || d.device_type.includes("MacBook")),
    },
    {
      key: "iot",
      title: "Smart Home & IoT Devices",
      icon: Tv,
      color: "var(--accent-purple)",
      devices: devices.filter(d => d.category === "iot" || d.device_type.includes("TV") || d.device_type.includes("Speaker")),
    },
    {
      key: "peripheral",
      title: "Peripherals & Storage",
      icon: Printer,
      color: "var(--severity-medium)",
      devices: devices.filter(d => d.category === "peripheral" || d.device_type.includes("Printer") || d.device_type.includes("NAS")),
    },
  ];

  const getDeviceIcon = (d: RealDeviceInfo) => {
    if (d.is_gateway || d.category === "gateway") return Router;
    if (d.is_self) return Laptop;
    if (d.device_type.includes("Smartphone") || d.device_type.includes("Tablet")) return Smartphone;
    if (d.device_type.includes("TV")) return Tv;
    if (d.device_type.includes("Printer")) return Printer;
    if (d.device_type.includes("Speaker")) return Radio;
    if (d.device_type.includes("NAS")) return HardDrive;
    return Network;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2>Network Topology & Connected Devices</h2>
            <span className="badge-pill badge-info" style={{ fontSize: 11 }}>
              <Wifi size={12} /> {scanResult?.host.ssid || "Local Subnet"}
            </span>
          </div>
          <div className="page-header-sub">
            Tree map of connected Wi-Fi devices, smartphones, workstations, and local endpoints
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* View Mode Switcher */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: 3, borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
            <button
              className={`btn btn-ghost ${viewMode === "tree" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("tree")}
              style={{ padding: "5px 12px", fontSize: 12, borderRadius: "var(--radius-sm)" }}
            >
              <TreeIcon size={14} /> Tree View
            </button>
            <button
              className={`btn btn-ghost ${viewMode === "grid" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("grid")}
              style={{ padding: "5px 12px", fontSize: 12, borderRadius: "var(--radius-sm)" }}
            >
              <LayoutGrid size={14} /> Card Grid
            </button>
          </div>

          <button className="btn btn-primary" onClick={performScan} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            {loading ? "Scanning Subnet..." : "Rescan Network"}
          </button>
        </div>
      </div>

      <div className="page-body animate-stagger">
        {/* Host Network Banner */}
        {scanResult?.host && (
          <div className="card" style={{
            marginBottom: 20,
            background: "linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)",
            border: "1px solid rgba(0, 242, 254, 0.25)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="stat-icon cyan" style={{ width: 48, height: 48 }}>
                  <Laptop size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                    {scanResult.host.hostname}
                    <span className="badge-pill badge-low" style={{ fontSize: 10 }}>This Workstation</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Adapter: {scanResult.host.adapter_description}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Local IPv4</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--accent-cyan)", marginTop: 2 }}>
                    {scanResult.host.ip_address}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>MAC Address</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>
                    {scanResult.host.mac_address}
                  </div>
                </div>
                {scanResult.host.ssid && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Wi-Fi Access Point</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent-blue)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                      <Wifi size={14} /> {scanResult.host.ssid} ({scanResult.host.signal_strength || "100%"})
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>Default Gateway</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--severity-medium)", marginTop: 2 }}>
                    {scanResult.host.gateway_ip}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-bar">
          {["all", "trusted", "unclassified", "flagged", "blocked"].map(f => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} (
              {devices.filter(d => (f === "all" ? true : d.trust_status === f)).length})
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {devices.length} network endpoints online
          </span>
        </div>

        {/* Main Content Layout: Left Tree/Grid + Right Detail Drawer */}
        <div style={{ display: "flex", gap: 20 }}>
          {/* Main Tree / Grid Container */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === "tree" ? (
              /* ================= TREE VIEW STRUCTURE ================= */
              <div className="card" style={{ padding: 24, minHeight: 520 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border-default)" }}>
                  <Globe size={18} style={{ color: "var(--accent-cyan)" }} />
                  <span style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-secondary)" }}>
                    Wi-Fi Network Topology Tree
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Click any device node to inspect details</span>
                </div>

                {/* ROOT NODE: Wi-Fi Gateway Router */}
                {gatewayDevice && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      onClick={() => setSelectedDevice(gatewayDevice)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 18px",
                        borderRadius: "var(--radius-lg)",
                        background: selectedDevice?.id === gatewayDevice.id
                          ? "linear-gradient(135deg, rgba(0,242,254,0.18) 0%, rgba(59,130,246,0.1) 100%)"
                          : "rgba(255,255,255,0.03)",
                        border: selectedDevice?.id === gatewayDevice.id
                          ? "1px solid var(--accent-cyan)"
                          : "1px solid var(--border-default)",
                        boxShadow: selectedDevice?.id === gatewayDevice.id
                          ? "0 0 20px rgba(0,242,254,0.2)"
                          : "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div className="stat-icon amber" style={{ width: 44, height: 44, margin: 0 }}>
                        <Router size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>
                            {gatewayDevice.hostname || "Wi-Fi Router / Hotspot Gateway"}
                          </span>
                          <span className="badge-pill badge-medium" style={{ fontSize: 10 }}>ROOT GATEWAY</span>
                          <span className="badge-pill badge-info" style={{ fontSize: 10 }}>10.168.219.192</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 16 }}>
                          <span>MAC: {gatewayDevice.mac_address}</span>
                          <span>Vendor: {gatewayDevice.vendor}</span>
                          <span>Interface: {gatewayDevice.connection_type}</span>
                        </div>
                      </div>
                      <Zap size={18} style={{ color: "var(--severity-medium)" }} />
                    </div>
                  </div>
                )}

                {/* TREE BRANCHES & CATEGORY GROUPS */}
                <div style={{ paddingLeft: 24, borderLeft: "2px dashed rgba(0, 242, 254, 0.2)", marginLeft: 22, display: "flex", flexDirection: "column", gap: 20 }}>
                  {categories.map(cat => {
                    const catDevices = cat.devices.filter(d => filter === "all" || d.trust_status === filter);
                    if (catDevices.length === 0) return null;
                    const isCollapsed = collapsedCategories[cat.key];
                    const CatIcon = cat.icon;

                    return (
                      <div key={cat.key} style={{ position: "relative" }}>
                        {/* Horizontal connecting line from tree trunk */}
                        <div style={{
                          position: "absolute",
                          left: -24,
                          top: 20,
                          width: 20,
                          height: 2,
                          background: "rgba(0, 242, 254, 0.2)"
                        }} />

                        {/* Category Header */}
                        <div
                          onClick={() => toggleCategory(cat.key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            borderRadius: "var(--radius-md)",
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid var(--border-default)",
                            cursor: "pointer",
                            marginBottom: isCollapsed ? 0 : 12,
                            userSelect: "none"
                          }}
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <CatIcon size={18} style={{ color: cat.color }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                            {cat.title}
                          </span>
                          <span className="badge-pill badge-info" style={{ marginLeft: "auto", fontSize: 10 }}>
                            {catDevices.length} Device{catDevices.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Connected Device Nodes in this Branch */}
                        {!isCollapsed && (
                          <div style={{
                            paddingLeft: 24,
                            borderLeft: "2px solid rgba(255,255,255,0.05)",
                            marginLeft: 18,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10
                          }}>
                            {catDevices.map(d => {
                              const DevIcon = getDeviceIcon(d);
                              const isSelected = selectedDevice?.id === d.id;
                              const statusCol = statusColors[d.trust_status];

                              return (
                                <div
                                  key={d.id}
                                  onClick={() => setSelectedDevice(d)}
                                  style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-md)",
                                    background: isSelected
                                      ? "linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)"
                                      : "rgba(255,255,255,0.02)",
                                    border: isSelected
                                      ? "1px solid var(--accent-cyan)"
                                      : "1px solid var(--border-default)",
                                    boxShadow: isSelected
                                      ? "0 0 12px rgba(0,242,254,0.15)"
                                      : "none",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                  }}
                                >
                                  {/* Connector Line */}
                                  <div style={{
                                    position: "absolute",
                                    left: -24,
                                    top: "50%",
                                    width: 20,
                                    height: 2,
                                    background: "rgba(255, 255, 255, 0.08)"
                                  }} />

                                  <div className={`stat-icon ${d.is_self ? "cyan" : "blue"}`} style={{ width: 34, height: 34, margin: 0, flexShrink: 0 }}>
                                    <DevIcon size={16} />
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {d.hostname || d.device_type}
                                      </span>
                                      {d.is_self && <span className="badge-pill badge-low" style={{ fontSize: 9 }}>YOU</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12, marginTop: 2 }}>
                                      <span>IP: <strong style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{d.ip_address}</strong></span>
                                      <span>MAC: <strong style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{d.mac_address}</strong></span>
                                      <span>Vendor: {d.vendor}</span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {d.connection_type && (
                                      <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 4 }}>
                                        {d.connection_type}
                                      </span>
                                    )}
                                    <span className={`badge-pill badge-${statusCol}`} style={{ fontSize: 10 }}>
                                      {d.trust_status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ================= GRID CARD VIEW ================= */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {devices.filter(d => filter === "all" || d.trust_status === filter).map(d => {
                  const Icon = getDeviceIcon(d);
                  const col = statusColors[d.trust_status];
                  const isSelected = selectedDevice?.id === d.id;

                  return (
                    <div
                      key={d.id}
                      className="card"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: isSelected ? "1px solid var(--accent-cyan)" : undefined,
                        boxShadow: isSelected ? "0 0 16px rgba(0,242,254,0.2)" : undefined,
                      }}
                      onClick={() => setSelectedDevice(d)}
                    >
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className={`stat-icon ${d.is_self ? "cyan" : d.is_gateway ? "amber" : "blue"}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                              {d.hostname || d.device_type}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.vendor}</div>
                          </div>
                        </div>
                        <span className={`badge-pill badge-${col}`} style={{ fontSize: 10 }}>
                          {d.trust_status}
                        </span>
                      </div>

                      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>IP: </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{d.ip_address}</span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>MAC: </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{d.mac_address}</span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Type: </span>
                          <span style={{ fontSize: 11 }}>{d.connection_type}</span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>State: </span>
                          <span style={{ fontSize: 11, color: "var(--severity-low)" }}>{d.state}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= RIGHT DEEP INSPECTION DRAWER ================= */}
          {selectedDevice && (
            <div className="card animate-in" style={{ width: 360, flexShrink: 0, alignSelf: "start", position: "sticky", top: 20 }}>
              <div className="card-header">
                <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Info size={15} style={{ color: "var(--accent-cyan)" }} /> Device Telemetry & Detail
                </span>
                <span className={`badge-pill badge-${statusColors[selectedDevice.trust_status]}`} style={{ fontSize: 10 }}>
                  {selectedDevice.trust_status.toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: 13 }}>
                {/* Header overview */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                  <div className={`stat-icon ${selectedDevice.is_self ? "cyan" : selectedDevice.is_gateway ? "amber" : "blue"}`} style={{ width: 42, height: 42, margin: 0 }}>
                    {(() => {
                      const Icon = getDeviceIcon(selectedDevice);
                      return <Icon size={20} />;
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedDevice.hostname || selectedDevice.device_type}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{selectedDevice.vendor}</div>
                  </div>
                </div>

                {/* Key Attributes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    ["Device Role", selectedDevice.device_type],
                    ["IPv4 Address", selectedDevice.ip_address],
                    ["IPv6 Address", selectedDevice.ipv6_address || "fe80::..."],
                    ["MAC Address", selectedDevice.mac_address],
                    ["Interface / Link", selectedDevice.connection_type],
                    ["Network State", selectedDevice.state],
                    ["OS / Firmware", selectedDevice.os_info || "Embedded Network Stack"],
                    ["Bandwidth Usage", selectedDevice.bandwidth_usage || "Normal (Active)"],
                    ["Risk Score", `${selectedDevice.risk_score ?? 10} / 100`],
                  ].map(([label, val]) => (
                    <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>{String(val)}</span>
                    </div>
                  ))}
                </div>

                {/* Open Ports & Advertised Services */}
                {selectedDevice.open_ports && selectedDevice.open_ports.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 6 }}>
                      Discovered Open Ports & Services
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedDevice.open_ports.map(port => (
                        <span key={port} className="badge-pill badge-info" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          Port {port}
                        </span>
                      ))}
                    </div>
                    {selectedDevice.services && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)", lineHeight: "1.5" }}>
                        {selectedDevice.services.join(" • ")}
                      </div>
                    )}
                  </div>
                )}

                {/* Adapter or Wi-Fi Link Specs */}
                {selectedDevice.ssid && (
                  <div style={{ marginTop: 14, background: "rgba(0, 242, 254, 0.05)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid rgba(0, 242, 254, 0.2)" }}>
                    <div style={{ color: "var(--accent-cyan)", fontWeight: 700, fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <Wifi size={12} /> Wireless Link Telemetry
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 2 }}>
                      <div>SSID: <strong>{selectedDevice.ssid}</strong></div>
                      <div>Signal Quality: <strong>{selectedDevice.signal_strength}</strong></div>
                      {selectedDevice.link_speed && <div>Phy Speed: <strong>{selectedDevice.link_speed}</strong></div>}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: 12, justifyContent: "center" }}>
                    <Check size={14} /> Trust Device
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: 12, justifyContent: "center" }}>
                    <Ban size={14} /> Block / Isolate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
