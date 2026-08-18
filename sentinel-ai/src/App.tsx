import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import ProcessMonitor from "./pages/ProcessMonitor";
import NetworkMonitor from "./pages/NetworkMonitor";
import Devices from "./pages/Devices";
import Persistence from "./pages/Persistence";
import Alerts from "./pages/Alerts";
import Timeline from "./pages/Timeline";
import IncidentExport from "./pages/IncidentExport";
import ModelInfo from "./pages/ModelInfo";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/processes" element={<ProcessMonitor />} />
          <Route path="/network" element={<NetworkMonitor />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/persistence" element={<Persistence />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/export" element={<IncidentExport />} />
          <Route path="/model-info" element={<ModelInfo />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
