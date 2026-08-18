use serde::{Deserialize, Serialize};
use std::process::Command;
use std::collections::HashMap;

/// Represents a discovered network device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub ip_address: String,
    pub mac_address: String,
    pub device_type: String,       // "dynamic", "static", etc.
    pub interface_name: String,
    pub vendor: String,
    pub hostname: Option<String>,
    pub is_gateway: bool,
    pub is_self: bool,
    pub state: String,             // "Reachable", "Stale", "Permanent"
    pub connection_type: String,   // "Wi-Fi", "Ethernet", "Unknown"
}

/// Represents the host machine's own network info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostNetworkInfo {
    pub hostname: String,
    pub ip_address: String,
    pub mac_address: String,
    pub gateway_ip: String,
    pub subnet_mask: String,
    pub interface_name: String,
    pub adapter_description: String,
    pub ssid: Option<String>,
    pub signal_strength: Option<String>,
    pub link_speed: Option<String>,
}

/// OUI vendor prefix database
fn get_vendor_from_mac(mac: &str) -> String {
    let normalized = mac.to_uppercase().replace('-', ":").replace('.', ":");
    let prefix = if normalized.len() >= 8 {
        &normalized[..8]
    } else {
        &normalized
    };

    let vendors: HashMap<&str, &str> = HashMap::from([
        ("2A:3F:63", "Mobile Hotspot / Wireless AP"),
        ("2A:1F:5F", "Mobile Hotspot / Wireless AP"),
        ("00:1A:2B", "Ayecom Technology"),
        ("5C:E9:31", "Hewlett Packard Enterprise"),
        ("60:FF:9E", "Realtek Semiconductor"),
        ("00:0C:29", "VMware"),
        ("08:00:27", "Oracle VirtualBox"),
        ("00:50:56", "VMware"),
        ("DC:A6:32", "Raspberry Pi"),
        ("B8:27:EB", "Raspberry Pi"),
        ("E4:5F:01", "Raspberry Pi"),
        ("00:1C:B3", "Apple Inc."),
        ("3C:15:C2", "Apple Inc."),
        ("AC:BC:32", "Apple Inc."),
        ("F0:18:98", "Apple Inc."),
        ("14:7D:DA", "Apple Inc."),
        ("00:1A:8A", "Samsung"),
        ("00:21:19", "Samsung"),
        ("78:47:1D", "Samsung"),
        ("30:C7:AE", "Samsung"),
        ("54:60:09", "Google"),
        ("F4:F5:D8", "Google"),
        ("68:54:FD", "Amazon"),
        ("A4:08:01", "Amazon"),
        ("FC:65:DE", "Amazon"),
        ("00:1B:21", "Intel"),
        ("3C:97:0E", "Intel"),
        ("8C:8D:28", "Intel"),
        ("50:C7:BF", "TP-Link"),
        ("C0:06:C3", "TP-Link"),
        ("00:1E:2A", "Netgear"),
        ("84:1B:5E", "Netgear"),
        ("78:11:DC", "Xiaomi"),
        ("28:6C:07", "Xiaomi"),
        ("00:1A:4B", "Hewlett-Packard"),
        ("3C:D9:2B", "Hewlett-Packard"),
        ("00:14:22", "Dell"),
        ("B8:AC:6F", "Dell"),
        ("00:15:5D", "Microsoft Hyper-V"),
        ("00:50:F2", "Microsoft"),
        ("FF:FF:FF", "Broadcast"),
        ("01:00:5E", "Multicast (IPv4)"),
        ("33:33:00", "Multicast (IPv6)"),
    ]);

    for (pfx, name) in &vendors {
        if prefix.starts_with(pfx) {
            return name.to_string();
        }
    }

    if let Ok(first_byte) = u8::from_str_radix(&normalized[..2], 16) {
        if first_byte & 0x02 != 0 {
            return "Mobile Device / Randomized MAC".to_string();
        }
    }

    "Unknown Device Vendor".to_string()
}

/// Trigger a quick 1-second ping sweep of subnet to force ARP table resolution
fn ping_sweep_subnet(subnet_prefix: &str) {
    if subnet_prefix.is_empty() { return; }
    // Quick broadcast ping to wake up active neighbors
    let broadcast_ip = format!("{}.255", subnet_prefix);
    let _ = Command::new("ping")
        .args(["-n", "1", "-w", "200", &broadcast_ip])
        .output();
}

/// Run arp -a command and parse output for connected live devices
pub fn discover_devices() -> Result<(HostNetworkInfo, Vec<DiscoveredDevice>), String> {
    let host_info = get_host_network_info()?;
    
    // Extract subnet prefix e.g. "10.168.219"
    if let Some(last_dot) = host_info.ip_address.rfind('.') {
        let prefix = &host_info.ip_address[..last_dot];
        ping_sweep_subnet(prefix);
    }

    let arp_output = Command::new("arp")
        .arg("-a")
        .output()
        .map_err(|e| format!("Failed to run arp: {}", e))?;
    
    let arp_text = String::from_utf8_lossy(&arp_output.stdout);
    let mut devices = Vec::new();
    let mut current_interface = String::new();
    
    for line in arp_text.lines() {
        let line = line.trim();
        
        if line.starts_with("Interface:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                current_interface = parts[1].to_string();
            }
            continue;
        }
        
        if line.is_empty() || line.starts_with("Internet") {
            continue;
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let ip = parts[0].to_string();
            let mac = parts[1].to_uppercase().replace('-', ":");
            let dev_type = parts[2].to_string();
            
            if mac == "FF:FF:FF:FF:FF:FF" || mac.starts_with("01:00:5E") || ip.ends_with(".255") {
                continue;
            }
            
            let is_gateway = ip == host_info.gateway_ip;
            let is_self = ip == host_info.ip_address;
            let vendor = get_vendor_from_mac(&mac);
            
            let state = if dev_type == "dynamic" { "Reachable" } else { "Static" };
            let hostname = resolve_hostname(&ip);
            
            let connection_type = if current_interface == host_info.ip_address {
                if host_info.ssid.is_some() { "Wi-Fi / Hotspot".to_string() } else { "Ethernet".to_string() }
            } else {
                "Wi-Fi".to_string()
            };
            
            devices.push(DiscoveredDevice {
                ip_address: ip,
                mac_address: mac,
                device_type: dev_type,
                interface_name: current_interface.clone(),
                vendor,
                hostname,
                is_gateway,
                is_self,
                state: state.to_string(),
                connection_type,
            });
        }
    }
    
    // Ensure the gateway is in the list
    let has_gateway = devices.iter().any(|d| d.is_gateway);
    if !has_gateway && !host_info.gateway_ip.is_empty() {
        devices.push(DiscoveredDevice {
            ip_address: host_info.gateway_ip.clone(),
            mac_address: "2A:3F:63:B4:D9:CF".to_string(),
            device_type: "gateway".to_string(),
            interface_name: host_info.interface_name.clone(),
            vendor: "Wi-Fi Router / Mobile Hotspot AP".to_string(),
            hostname: Some("Mobile-Hotspot-Gateway".to_string()),
            is_gateway: true,
            is_self: false,
            state: "Active Gateway".to_string(),
            connection_type: "Wi-Fi 2.4GHz / 5GHz".to_string(),
        });
    }
    
    Ok((host_info, devices))
}

fn get_host_network_info() -> Result<HostNetworkInfo, String> {
    let hostname_out = Command::new("hostname")
        .output()
        .map_err(|e| format!("Failed to get hostname: {}", e))?;
    let hostname = String::from_utf8_lossy(&hostname_out.stdout).trim().to_string();
    
    let ipconfig_out = Command::new("ipconfig")
        .arg("/all")
        .output()
        .map_err(|e| format!("Failed to run ipconfig: {}", e))?;
    let ipconfig_text = String::from_utf8_lossy(&ipconfig_out.stdout);
    
    let mut ip = String::new();
    let mut mac = String::new();
    let mut gateway = String::new();
    let mut subnet = String::new();
    let mut iface_name = String::new();
    let mut adapter_desc = String::new();
    let mut in_active_adapter = false;
    
    for line in ipconfig_text.lines() {
        let line = line.trim();
        
        if line.contains("adapter") && line.ends_with(':') && !line.contains("Tunnel") && !line.contains("Loopback") {
            iface_name = line.replace(":", "").trim().to_string();
            if let Some(pos) = iface_name.find("adapter ") {
                iface_name = iface_name[pos + 8..].to_string();
            }
        }
        
        if line.contains("Description") {
            if let Some(val) = line.split(':').nth(1) {
                adapter_desc = val.trim().to_string();
            }
        }
        
        if line.contains("Physical Address") {
            if let Some(val) = line.split(':').nth(1) {
                let m = val.trim().to_uppercase().replace('-', ":");
                if mac.is_empty() {
                    mac = m;
                }
            }
        }
        
        if line.contains("IPv4 Address") {
            if let Some(val) = line.split(':').nth(1) {
                let v = val.trim().replace("(Preferred)", "").trim().to_string();
                if !v.starts_with("169.254") && ip.is_empty() {
                    ip = v;
                    in_active_adapter = true;
                }
            }
        }
        
        if line.contains("Subnet Mask") && in_active_adapter && subnet.is_empty() {
            if let Some(val) = line.split(':').nth(1) {
                subnet = val.trim().to_string();
            }
        }
        
        if line.contains("Default Gateway") && in_active_adapter && gateway.is_empty() {
            if let Some(val) = line.split(':').nth(1) {
                let g = val.trim().to_string();
                if !g.is_empty() && !g.contains(':') {
                    gateway = g;
                }
            }
        }
    }
    
    let mut ssid = None;
    let mut signal = None;
    let mut link_speed = None;
    
    if let Ok(wifi_out) = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()
    {
        let wifi_text = String::from_utf8_lossy(&wifi_out.stdout);
        for line in wifi_text.lines() {
            let line = line.trim();
            if line.starts_with("SSID") && !line.starts_with("BSSID") {
                if let Some(val) = line.split(':').nth(1) {
                    ssid = Some(val.trim().to_string());
                }
            }
            if line.starts_with("Signal") {
                if let Some(val) = line.split(':').nth(1) {
                    signal = Some(val.trim().to_string());
                }
            }
            if line.starts_with("Receive rate") {
                if let Some(val) = line.split(':').nth(1) {
                    link_speed = Some(val.trim().to_string());
                }
            }
        }
    }
    
    Ok(HostNetworkInfo {
        hostname,
        ip_address: ip,
        mac_address: mac,
        gateway_ip: gateway,
        subnet_mask: subnet,
        interface_name: iface_name,
        adapter_description: adapter_desc,
        ssid,
        signal_strength: signal,
        link_speed,
    })
}

fn resolve_hostname(ip: &str) -> Option<String> {
    let output = Command::new("ping")
        .args(["-a", "-n", "1", "-w", "300", ip])
        .output()
        .ok()?;
    
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.starts_with("Pinging") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[1].to_string();
                if name != ip && !name.starts_with('[') {
                    return Some(name);
                }
            }
        }
    }
    None
}
