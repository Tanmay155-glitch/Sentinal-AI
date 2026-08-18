import { useState, useEffect } from "react";
import { Key, RefreshCw, ShieldAlert, CheckCircle } from "lucide-react";

interface PersistenceItem {
  name: string;
  location_type: string;
  path_or_command: string;
  risk_score: number;
  is_suspicious: boolean;
  explanation: String;
}

export default function Persistence() {
  const [items, setItems] = useState<PersistenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    try {
      if ((window as any).__TAURI__) {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<PersistenceItem[]>("scan_persistence");
        setItems(res);
      } else {
        // Mock fallback for browser dev mode
        setItems([
          {
            name: "SecurityHealthSystray",
            location_type: "Registry Run Key",
            path_or_command: "C:\\Windows\\System32\\SecurityHealthSystray.exe",
            risk_score: 15,
            is_suspicious: false,
            explanation: "Standard Windows Security System Tray Process",
          },
          {
            name: "OneDriveStartup",
            location_type: "Registry Run Key",
            path_or_command: "C:\\Users\\User\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe /background",
            risk_score: 25,
            is_suspicious: false,
            explanation: "Microsoft OneDrive Startup",
          },
          {
            name: "UpdateHelperService",
            location_type: "Startup Folder",
            path_or_command: "C:\\Users\\User\\AppData\\Local\\Temp\\update_service.vbs",
            risk_score: 85,
            is_suspicious: true,
            explanation: "VBScript executing from TEMP directory — potential persistence dropper",
          },
        ]);
      }
    } catch (e) {
      console.warn("Failed to fetch persistence items:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Persistence Mechanisms</h2>
          <div className="page-header-sub">
            Scan Windows Registry Run keys, Startup directory, and Services for reboot persistence
          </div>
        </div>
        <button className="btn btn-secondary" onClick={fetchItems} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          {loading ? "Scanning..." : "Rescan System"}
        </button>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Key size={14} /> Active Startup & Persistence Entries ({items.length})
            </span>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Entry Name</th>
                <th>Type</th>
                <th>Path / Command</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Analysis</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</td>
                  <td>
                    <span className="badge blue" style={{ fontSize: 11 }}>{item.location_type}</span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.path_or_command}
                  </td>
                  <td>
                    <span className={`badge ${item.risk_score >= 60 ? "red" : item.risk_score >= 30 ? "yellow" : "green"}`}>
                      {item.risk_score.toFixed(0)}
                    </span>
                  </td>
                  <td>
                    {item.is_suspicious ? (
                      <span className="status-tag status-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ShieldAlert size={12} /> Suspicious
                      </span>
                    ) : (
                      <span className="status-tag status-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle size={12} /> Trusted
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
