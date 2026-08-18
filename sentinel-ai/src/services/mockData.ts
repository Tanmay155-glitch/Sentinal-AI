/**
 * Mock data service for Sentinel AI
 * Provides realistic simulated data for all dashboard modules
 * In production, these would be Tauri IPC commands calling the Rust backend
 */

// ---- Process Data ----
const processNames = [
  "chrome.exe","firefox.exe","explorer.exe","svchost.exe","System","csrss.exe",
  "lsass.exe","services.exe","taskhostw.exe","sihost.exe","dwm.exe","code.exe",
  "node.exe","python.exe","conhost.exe","RuntimeBroker.exe","SearchApp.exe",
  "ctfmon.exe","SecurityHealthSystray.exe","MsMpEng.exe","WindowsTerminal.exe",
  "msedge.exe","notepad.exe","powershell.exe","cmd.exe","discord.exe","slack.exe",
  "spotify.exe","steam.exe","OneDrive.exe"
];

const suspiciousNames = [
  "svchost32.exe","winlogon_helper.exe","update_service.exe","tmp_proc.exe"
];

const protocols = ["TCP","UDP","DNS","HTTPS","HTTP","TLS"];
const attackTechniques: Record<string, string> = {
  "T1547":"Boot or Logon Autostart Execution",
  "T1053":"Scheduled Task/Job",
  "T1059":"Command and Scripting Interpreter",
  "T1566":"Phishing",
  "T1071":"Application Layer Protocol",
  "T1090":"Proxy",
  "T1082":"System Information Discovery",
  "T1055":"Process Injection",
  "T1003":"OS Credential Dumping",
  "T1021":"Remote Services",
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, dec = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function randIP(): string {
  return `192.168.1.${rand(1, 254)}`;
}

function randExternalIP(): string {
  return `${rand(1, 223)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`;
}

function randMAC(): string {
  return Array.from({ length: 6 }, () => rand(0, 255).toString(16).padStart(2, '0')).join(':');
}

function ts(minutesAgo = 0): number {
  return Math.floor(Date.now() / 1000) - minutesAgo * 60;
}

export interface ProcessInfo {
  pid: number;
  parent_pid: number | null;
  name: string;
  exe_path: string;
  cpu_usage: number;
  memory_mb: number;
  status: string;
  is_signed: boolean;
  risk_score: number;
  category: string;
  start_time: number;
}

export interface SystemStats {
  cpu_usage: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_usage_percent: number;
  uptime_seconds: number;
  total_processes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
}

export interface NetworkFlow {
  flow_id: number;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  sni_hostname: string | null;
  bytes_sent: number;
  bytes_received: number;
  process_name: string | null;
  started_ts: number;
  threat_intel_match: boolean;
}

export interface DeviceInfo {
  device_id: number;
  mac_address: string;
  vendor: string;
  device_name: string | null;
  ip_address: string;
  first_seen: number;
  last_seen: number;
  trust_status: string;
  mac_randomization_suspected: boolean;
}

export interface AlertInfo {
  alert_id: number;
  source_type: string;
  source_name: string;
  risk_score: number;
  category_label: string;
  attck_technique: string | null;
  attck_name: string | null;
  explanation: string[];
  status: string;
  created_ts: number;
}

export interface TimelineEvent {
  timeline_id: number;
  event_ts: number;
  event_category: string;
  summary_text: string;
  related_alert_id: number | null;
}

export interface RegistryEvent {
  reg_event_id: number;
  hive_key_path: string;
  value_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  event_ts: number;
}

export interface FileEvent {
  file_event_id: number;
  file_path: string;
  sha256_hash: string | null;
  event_type: string;
  event_ts: number;
}

// ---- Generators ----
let _processes: ProcessInfo[] | null = null;

export function getProcesses(): ProcessInfo[] {
  if (!_processes) {
    _processes = [];
    const all = [...processNames, ...suspiciousNames];
    for (let i = 0; i < all.length; i++) {
      const isSusp = i >= processNames.length;
      const risk = isSusp ? randFloat(45, 95) : randFloat(0, 35);
      const cat = risk >= 70 ? "High Risk" : risk >= 40 ? "Suspicious" : risk >= 20 ? "Monitor" : "Normal";
      _processes.push({
        pid: rand(100, 30000),
        parent_pid: rand(1, 5000),
        name: all[i],
        exe_path: isSusp ? `C:\\Users\\User\\AppData\\Local\\Temp\\${all[i]}` : `C:\\Windows\\System32\\${all[i]}`,
        cpu_usage: randFloat(0, isSusp ? 85 : 25),
        memory_mb: randFloat(1, isSusp ? 800 : 400),
        status: "Run",
        is_signed: !isSusp,
        risk_score: risk,
        category: cat,
        start_time: ts(rand(1, 1440)),
      });
    }
    _processes.sort((a, b) => b.risk_score - a.risk_score);
  }
  // Add small random fluctuations
  return _processes.map(p => ({
    ...p,
    cpu_usage: Math.max(0, p.cpu_usage + randFloat(-2, 2)),
    memory_mb: Math.max(1, p.memory_mb + randFloat(-5, 5)),
  }));
}

let _statsHistory: number[] = [];

export function getSystemStats(): SystemStats {
  const cpu = randFloat(8, 45);
  _statsHistory.push(cpu);
  if (_statsHistory.length > 60) _statsHistory.shift();
  return {
    cpu_usage: cpu,
    memory_total_mb: 16384,
    memory_used_mb: rand(6000, 12000),
    memory_usage_percent: randFloat(38, 72),
    uptime_seconds: 86400 + rand(0, 172800),
    total_processes: processNames.length + suspiciousNames.length + rand(-2, 5),
    network_rx_bytes: rand(500000, 5000000),
    network_tx_bytes: rand(100000, 2000000),
  };
}

export function getCpuHistory(): number[] {
  if (_statsHistory.length < 2) {
    _statsHistory = Array.from({ length: 30 }, () => randFloat(10, 50));
  }
  return [..._statsHistory];
}

const vendors = ["Apple Inc.","Samsung","Intel","TP-Link","Netgear","Raspberry Pi","Dell","HP","Lenovo","Unknown"];
const deviceNames = ["iPhone-14","Galaxy-S23","MacBook-Pro","Smart-TV","Echo-Dot","Printer-HP","NAS-Synology","Ring-Doorbell",null,null];

let _devices: DeviceInfo[] | null = null;
export function getDevices(): DeviceInfo[] {
  if (!_devices) {
    _devices = Array.from({ length: 12 }, (_, i) => ({
      device_id: i + 1,
      mac_address: randMAC(),
      vendor: vendors[i % vendors.length],
      device_name: deviceNames[i % deviceNames.length],
      ip_address: `192.168.1.${100 + i}`,
      first_seen: ts(rand(60, 10080)),
      last_seen: ts(rand(0, 30)),
      trust_status: i < 6 ? "trusted" : i < 9 ? "unclassified" : i === 11 ? "blocked" : "flagged",
      mac_randomization_suspected: i >= 10,
    }));
  }
  return _devices;
}

let _flows: NetworkFlow[] | null = null;
export function getNetworkFlows(): NetworkFlow[] {
  if (!_flows) {
    const hostnames = ["google.com","github.com","cloudflare.com","amazonaws.com","microsoft.com",
      "akamai.net","fastly.net","cdn.discord.com","api.slack.com","suspicious-domain.xyz"];
    _flows = Array.from({ length: 40 }, (_, i) => {
      const isThreat = i >= 38;
      return {
        flow_id: i + 1,
        src_ip: randIP(),
        dst_ip: randExternalIP(),
        src_port: rand(1024, 65535),
        dst_port: [80, 443, 8080, 53, 3389][rand(0, 4)],
        protocol: protocols[rand(0, protocols.length - 1)],
        sni_hostname: hostnames[i % hostnames.length],
        bytes_sent: rand(1000, 500000),
        bytes_received: rand(5000, 2000000),
        process_name: processNames[rand(0, processNames.length - 1)],
        started_ts: ts(rand(0, 120)),
        threat_intel_match: isThreat,
      };
    });
  }
  return _flows;
}

let _alerts: AlertInfo[] | null = null;
export function getAlerts(): AlertInfo[] {
  if (!_alerts) {
    const techniques = Object.keys(attackTechniques);
    const sourceTypes = ["process","network","device","registry","file"];
    const cats = ["Ransomware-like","Trojan","PUA","Unknown-suspicious","C2-Communication"];
    const explanationPool = [
      "Unsigned binary launched from user-writable path",
      "High file-write rate detected (>50 files/sec)",
      "Matched threat-intel hash (abuse.ch MalwareBazaar)",
      "Rapid outbound connections to multiple IPs",
      "Registry Run key modification detected",
      "MAC address changed 4 times in 10 minutes",
      "Process spawned from temporary directory",
      "Suspicious command-line arguments detected",
      "Known C2 beacon interval pattern observed",
      "Executable file dropped in Startup folder",
    ];
    _alerts = Array.from({ length: 15 }, (_, i) => {
      const tech = techniques[rand(0, techniques.length - 1)];
      const risk = randFloat(35, 98);
      return {
        alert_id: i + 1,
        source_type: sourceTypes[rand(0, sourceTypes.length - 1)],
        source_name: i < 4 ? suspiciousNames[i % suspiciousNames.length] : processNames[rand(0, 10)],
        risk_score: risk,
        category_label: cats[rand(0, cats.length - 1)],
        attck_technique: tech,
        attck_name: attackTechniques[tech],
        explanation: [
          explanationPool[rand(0, explanationPool.length - 1)],
          explanationPool[rand(0, explanationPool.length - 1)],
        ],
        status: i < 5 ? "open" : i < 9 ? "reviewed" : i < 12 ? "actioned" : "dismissed",
        created_ts: ts(rand(1, 2880)),
      };
    });
    _alerts.sort((a, b) => b.created_ts - a.created_ts);
  }
  return _alerts;
}

export function getTimeline(): TimelineEvent[] {
  const categories = ["process","network","device","registry","file","alert","response"];
  const texts = [
    "Process chrome.exe (PID 4521) started",
    "New device detected: 192.168.1.108 (Apple Inc.)",
    "Alert: Unsigned binary svchost32.exe flagged",
    "Network flow to suspicious-domain.xyz blocked",
    "Registry key HKCU\\...\\Run modified by update_service.exe",
    "File created: C:\\Users\\Downloads\\payload.exe",
    "User terminated process tmp_proc.exe (PID 28912)",
    "USB device inserted: SanDisk Cruzer — scan clean",
    "Threat intel match: IP 45.33.32.156 (abuse.ch)",
    "Firewall rule created blocking 203.0.113.42",
    "Process winlogon_helper.exe spawned from Temp directory",
    "Alert dismissed: chrome.exe false positive",
  ];
  return Array.from({ length: 30 }, (_, i) => ({
    timeline_id: i + 1,
    event_ts: ts(i * rand(5, 30)),
    event_category: categories[rand(0, categories.length - 1)],
    summary_text: texts[rand(0, texts.length - 1)],
    related_alert_id: Math.random() > 0.6 ? rand(1, 15) : null,
  }));
}

export function getRegistryEvents(): RegistryEvent[] {
  const paths = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
    "HKLM\\SYSTEM\\CurrentControlSet\\Services",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run",
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    reg_event_id: i + 1,
    hive_key_path: paths[i % paths.length],
    value_name: i < 3 ? "UpdateService" : "SecurityCheck",
    old_value: i % 2 === 0 ? null : "C:\\OldPath\\app.exe",
    new_value: `C:\\Users\\AppData\\Local\\Temp\\svc${i}.exe`,
    change_type: i < 3 ? "created" : "modified",
    event_ts: ts(rand(5, 600)),
  }));
}

export function getFileEvents(): FileEvent[] {
  const paths = [
    "C:\\Users\\Downloads\\invoice.exe",
    "C:\\Users\\Desktop\\setup_crack.exe",
    "C:\\Users\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\helper.vbs",
    "C:\\Users\\Downloads\\document.pdf.exe",
    "C:\\Users\\Downloads\\update.msi",
  ];
  return Array.from({ length: 10 }, (_, i) => ({
    file_event_id: i + 1,
    file_path: paths[i % paths.length],
    sha256_hash: Array.from({ length: 64 }, () => "0123456789abcdef"[rand(0, 15)]).join(''),
    event_type: ["created","modified","executed","renamed"][rand(0, 3)],
    event_ts: ts(rand(1, 1000)),
  }));
}
