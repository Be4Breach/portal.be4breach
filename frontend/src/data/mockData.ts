export const threatTrendsData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 1, i + 1);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    critical: Math.floor(Math.random() * 15 + 5),
    high: Math.floor(Math.random() * 30 + 15),
    medium: Math.floor(Math.random() * 50 + 25),
    low: Math.floor(Math.random() * 40 + 20),
  };
});

export const severityData = [
  { name: "Critical", value: 47, color: "hsl(0, 72%, 51%)" },
  { name: "High", value: 128, color: "hsl(25, 95%, 53%)" },
  { name: "Medium", value: 312, color: "hsl(45, 93%, 47%)" },
  { name: "Low", value: 198, color: "hsl(0, 0%, 64%)" },
];

export const attackVectorsData = [
  { name: "Phishing", count: 342 },
  { name: "Ransomware", count: 187 },
  { name: "Malware", count: 256 },
  { name: "Zero-Day", count: 43 },
  { name: "Insider Threat", count: 89 },
];

export const geoThreatData = [
  { country: "United States", lat: 39, lng: -98, count: 1243, intensity: 0.9 },
  { country: "Russia", lat: 60, lng: 100, count: 987, intensity: 0.85 },
  { country: "China", lat: 35, lng: 105, count: 876, intensity: 0.8 },
  { country: "Brazil", lat: -14, lng: -51, count: 432, intensity: 0.5 },
  { country: "India", lat: 20, lng: 77, count: 654, intensity: 0.65 },
  { country: "Germany", lat: 51, lng: 10, count: 321, intensity: 0.4 },
  { country: "Nigeria", lat: 10, lng: 8, count: 287, intensity: 0.35 },
  { country: "Iran", lat: 32, lng: 53, count: 543, intensity: 0.6 },
  { country: "North Korea", lat: 40, lng: 127, count: 234, intensity: 0.3 },
  { country: "Ukraine", lat: 49, lng: 32, count: 198, intensity: 0.25 },
  { country: "UK", lat: 54, lng: -2, count: 176, intensity: 0.2 },
  { country: "Japan", lat: 36, lng: 138, count: 145, intensity: 0.18 },
];

export const recentAlerts = [
  { id: 1, name: "APT-29 Activity Detected", source: "Network IDS", severity: "Critical" as const, time: "2 min ago", description: "Advanced persistent threat group activity on perimeter" },
  { id: 2, name: "Suspicious Login Attempt", source: "Auth System", severity: "High" as const, time: "8 min ago", description: "Multiple failed login attempts from unknown IP" },
  { id: 3, name: "Malware Signature Match", source: "Endpoint", severity: "High" as const, time: "15 min ago", description: "Known malware signature detected on workstation" },
  { id: 4, name: "Unusual Data Transfer", source: "DLP", severity: "Medium" as const, time: "23 min ago", description: "Large file transfer to external destination" },
  { id: 5, name: "Certificate Expiry Warning", source: "PKI", severity: "Low" as const, time: "1 hr ago", description: "SSL certificate expiring in 14 days" },
  { id: 6, name: "Port Scan Detected", source: "Firewall", severity: "Medium" as const, time: "2 hr ago", description: "Sequential port scanning from external IP" },
];

export const statsData = {
  totalThreats: { value: 2847, change: 12.5, trend: "up" as const },
  criticalAlerts: { value: 47, change: -8.3, trend: "down" as const },
  systemsMonitored: { value: 1284, change: 3.2, trend: "up" as const },
  riskScore: 72,
};
