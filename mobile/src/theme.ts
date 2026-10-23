export const theme = {
  colors: {
    bg: '#0c1117',
    panel: '#151d26',
    panelElevated: '#1f2b37',
    panelHighlight: '#222f3d',
    line: '#33404d',
    text: '#f3f6f8',
    muted: '#a9b8c7',
    accent: '#ff665e', // coral / red accent
    red: '#ff665e',    // SOS
    amber: '#ffd078',  // Signal lost / warning
    green: '#8bd6be',  // Active / Connected
    blue: '#38bdf8',   // Confirmed safe
    cardBorder: '#33404d',
  },
  statusColors: {
    active: '#8bd6be',
    active_sos: '#ff665e',
    heartbeat_lost: '#ffd078',
    unaccounted: '#ffd078',
    location_unknown: '#ffd078',
    safe: '#38bdf8',
  },
  statusLabels: {
    active: 'Active',
    active_sos: 'ACTIVE SOS',
    heartbeat_lost: 'Signal Lost',
    unaccounted: 'Unaccounted',
    location_unknown: 'Location Unknown',
    safe: 'Confirmed Safe',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 34,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
  },
};
