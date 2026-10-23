const $ = id => document.getElementById(id);
const labels = { active: 'Active', safe: 'Confirmed safe', active_sos: 'SOS', heartbeat_lost: 'Signal lost', unaccounted: 'Unaccounted', location_unknown: 'Location unknown' };
const colors = { active: '#6f889b', safe: '#8bd6be', active_sos: '#ff665e', heartbeat_lost: '#ffd078', unaccounted: '#ffd078', location_unknown: '#ffd078' };
const priority = { active_sos: 0, heartbeat_lost: 1, location_unknown: 2 };
let state = null, building = null, selected = 1, focusedDevice = null, alertFilter = null;
let initialSelection = false, lastReceived = 0, serverAgeAtReceipt = 0, socket = null, share = null, runtime = null;
const fieldView = new URLSearchParams(location.search).get('view') === 'field';
const byPriority = (a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || (a.floor ?? 99) - (b.floor ?? 99) || a.device_id.localeCompare(b.device_id);
const needsAttention = d => Object.hasOwn(priority, d.status);
const age = timestamp => timestamp === null ? 'Never received' : `${Math.max(0, Math.floor((estimatedNow() - timestamp) / 1000))}s ago`;
function estimatedNow() { return state ? state.server_time + serverAgeAtReceipt + Math.max(0, Date.now() - lastReceived) : Date.now(); }
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function json(url) { const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Unable to load ${url}`); return response.json(); }
function setState(next) {
  state = next;
  window.__emberState = state;
  lastReceived = Date.now();
  // Hosted responses include the server-measured source age, independent of phone clock skew.
  serverAgeAtReceipt = Math.max(0, next.source_age_ms || 0);
  if (!initialSelection) { const first = state.devices.filter(needsAttention).sort(byPriority)[0]; selected = first ? first.floor : 1; initialSelection = true; }
  render();
  window.dispatchEvent(new CustomEvent('ember-state', { detail: state }));
}
function merge(diff) {
  if (!state || diff.revision !== state.revision + 1) { socket.emit('resync'); return; }
  for (const key of ['devices', 'aps']) { const id = key === 'devices' ? 'device_id' : 'id'; const changes = new Map(diff[key].map(item => [item[id], item])); diff[key] = state[key].map(item => changes.get(item[id]) || item); }
  setState({ ...state, ...diff });
}
function connection() {
  const stale = !state || Date.now() - lastReceived + serverAgeAtReceipt > 6500;
  $('connection').textContent = !state ? 'Connecting…' : stale ? 'Feed unavailable' : 'Live';
  $('connection').className = `connection ${stale ? 'stale' : 'live'}`;
  $('stale-banner').hidden = !state || !stale;
  $('stale-age').textContent = state ? age(state.server_time) : 'unknown';
  document.body.classList.toggle('feed-stale', stale);
}
async function start() {
  try {
    document.getElementById('building-3d').open = true;
    document.body.classList.toggle('field-view', fieldView);
    runtime = await json('/api/runtime');
    $('demo-controls').hidden = !runtime.can_control || fieldView;
    share = runtime.share;
    setupShare();
    building = await json('/api/building');
    window.__emberBuilding = building;
    window.dispatchEvent(new CustomEvent('ember-building', { detail: building }));
    if (runtime.transport === 'socket.io') {
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/socket.io/socket.io.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
      socket = io('/live'); socket.on('snapshot', setState); socket.on('state_diff', merge);
      socket.on('disconnect', () => { lastReceived = 0; connection(); });
      socket.on('connect_error', () => { lastReceived = 0; connection(); });
    } else {
      const poll = async () => {
        try { const next = await json('/api/state'); setState(next); } catch { connection(); }
        setTimeout(poll, 1500);
      };
      poll();
    }
  } catch { $('incident-title').textContent = 'Building feed unavailable'; $('incident-note').textContent = 'Reconnecting automatically…'; setTimeout(start, 3000); }
}
function roomDescription(device) {
  const p = device.position_estimate;
  if (!p || device.floor === null) return 'Location unknown';
  const plan = building?.floor_plans?.find(plan => plan.floor === device.floor);
  const rooms = plan?.rooms.filter(r => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) || [];
  const boundary = rooms.some(r => Math.min(Math.abs(p.x-r.x), Math.abs(p.x-r.x-r.width), Math.abs(p.y-r.y), Math.abs(p.y-r.y-r.height)) < .15);
  if (rooms.length === 1) return `${boundary ? 'Near' : 'Est.'} room ${rooms[0].id} · ${rooms[0].label}`;
  if (rooms.length > 1) return `Near rooms ${rooms.map(r => r.id).join(' / ')}`;
  return plan ? 'Main corridor · estimated' : `${p.x}, ${p.y} m · estimated`;
}
function focusDevice(device) { selected = device.floor; focusedDevice = device.device_id; render(); $('floor-title').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
function chooseFloor(floor) { selected = floor; focusedDevice = null; render(); window.dispatchEvent(new CustomEvent('ember-selection', { detail: { floor } })); }
function metricFilter(status) {
  alertFilter = status;
  if (status === 'unaccounted') { selected = null; focusedDevice = null; alertFilter = null; }
  else { const first = state?.devices.filter(d => d.status === status).sort(byPriority)[0]; if (first) { selected = first.floor; focusedDevice = first.device_id; } }
  render();
}
function render() {
  connection(); if (!state) return;
  for (const [key, value] of Object.entries(state.summary)) $(key).textContent = value;
  const lost = state.devices.filter(d => d.status === 'heartbeat_lost').length;
  $('heartbeat_lost').textContent = lost;
  const sos = state.summary.active_sos;
  $('incident-title').textContent = sos ? `${sos} occupant${sos === 1 ? '' : 's'} signaling SOS` : 'No active SOS signals';
  $('incident-title').style.color = sos ? colors.active_sos : '';
  $('incident-note').textContent = `${lost} signal${lost === 1 ? '' : 's'} lost · ${state.summary.unaccounted} unaccounted · ${state.summary.safe} confirmed safe`;
  $('unlocated-count').textContent = state.unlocated_count;
  $('unknown-summary-count').textContent = `${state.summary.unaccounted} unaccounted`;
  // Update existing floor buttons so live ticks do not destroy keyboard focus.
  if (!$('floors').children.length) state.floors.forEach(floor => { const button = element('button'); button.dataset.floor = floor.floor; button.append(element('strong'), element('span')); button.onclick = () => chooseFloor(floor.floor); $('floors').append(button); });
  for (const floor of state.floors) {
    const button = $('floors').querySelector(`[data-floor="${floor.floor}"]`);
    const occupants = state.devices.filter(d => d.floor === floor.floor);
    const sosCount = occupants.filter(d => d.status === 'active_sos').length;
    const lostCount = occupants.filter(d => d.status === 'heartbeat_lost').length;
    const unknownCount = occupants.filter(d => d.status === 'location_unknown').length;
    button.className = `floor-button ${floor.color}${selected === floor.floor ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', selected === floor.floor ? 'true' : 'false');
    button.firstChild.textContent = `Floor ${floor.floor}`;
    button.lastChild.textContent = sosCount ? `! ${sosCount} SOS${lostCount ? ` · ${lostCount} lost` : ''}` : lostCount ? `${lostCount} signal lost` : floor.offline_aps ? 'Coverage lost' : unknownCount ? 'Location uncertain' : 'No alerts';
  }
  const plan = building?.floor_plans?.find(p => p.floor === selected);
  $('floor-title').textContent = selected === null ? 'Unknown floor' : `Floor ${selected}`;
  $('floor-subtitle').textContent = selected === null ? 'No reliable floor estimate' : plan?.name || 'Estimated locations';
  const devices = state.devices.filter(d => d.floor === selected);
  const offline = state.aps.filter(ap => ap.floor === selected && !ap.online);
  $('ap-banner').hidden = !offline.length;
  $('ap-banner').textContent = `Coverage degraded · ${offline.length} access point${offline.length === 1 ? '' : 's'} offline. Positions may be less reliable.`;
  $('unknown-banner').hidden = selected !== null; $('map-wrap').hidden = selected === null;
  $('show-all').parentElement.hidden = selected === null;
  $('unknown-list').replaceChildren(...(selected === null ? devices.sort(byPriority).map(d => { const row = element('div', undefined, 'unknown-row'); row.append(element('strong', d.name ? `${d.name} · ${d.device_id}` : d.device_id), element('span', labels[d.status])); return row; }) : []));
  const focus = state.devices.find(d => d.device_id === focusedDevice);
  $('selected-person').hidden = !focus;
  if (focus) $('selected-person').replaceChildren(element('strong', `${focus.name || focus.device_id} · ${labels[focus.status]}`), element('span', `${focus.device_id} · ${roomDescription(focus)} · Last signal ${age(focus.last_heartbeat)}`));
  if (building && selected !== null) drawMap(devices);
  const attention = state.devices.filter(needsAttention).sort(byPriority);
  $('attention-count').textContent = attention.length;
  const shown = alertFilter ? attention.filter(d => d.status === alertFilter) : attention;
  $('all-alerts').hidden = !alertFilter;
  // Rebuild only when alert records or the focused selection change.
  const key = JSON.stringify(shown.map(d => [d.device_id, d.status, d.floor, d.position_estimate, d.last_heartbeat])) + focusedDevice;
  if ($('attention-list').dataset.renderKey !== key) {
    $('attention-list').dataset.renderKey = key;
    $('attention-list').replaceChildren(...shown.map(device => {
      const card = element('button', undefined, `attention-card ${device.status}${focusedDevice === device.device_id ? ' focused' : ''}`);
      const top = element('span', undefined, 'card-top'); top.append(element('span', `${device.status === 'active_sos' ? '! ' : '? '}${labels[device.status]}`, 'status'), element('strong', device.name || device.device_id));
      const timestamp = element('span', undefined, 'age'); timestamp.dataset.deviceTime = device.device_id;
      card.append(top, element('span', device.floor === null ? 'Floor unknown' : `Floor ${device.floor}`, 'where'), element('span', `${device.name || device.device_id} · ${roomDescription(device)}`, 'room'), timestamp);
      card.onclick = () => focusDevice(device); return card;
    }));
    if (!shown.length) { const empty = element('div', undefined, 'empty-alerts'); empty.append(element('strong', alertFilter ? 'No matching alerts' : 'No SOS or lost signals'), element('span', 'Unaccounted occupants are listed below.')); $('attention-list').append(empty); }
  }
  document.querySelectorAll('[data-device-time]').forEach(el => { const d = state.devices.find(d => d.device_id === el.dataset.deviceTime); el.textContent = `Last signal ${age(d.last_heartbeat)}`; });
  $('updated').textContent = `Updated ${age(state.server_time)}`;
  if ($('technical').open) renderRoster();
  if (!$('device-select').options.length) state.devices.forEach(d => $('device-select').add(new Option(`${d.name || d.device_id} · ${d.device_id}`, d.device_id)));
  if (!$('ap-select').options.length) state.aps.forEach(ap => $('ap-select').add(new Option(`${ap.id} · F${ap.floor}`, ap.id)));
}
function renderRoster() {
  if (!state) return;
  $('devices').replaceChildren(...[...state.devices].sort(byPriority).map(d => { const row = element('tr'); const p = d.position_estimate; [d.name || d.device_id, `${d.device_id} · ${labels[d.status]}`, d.floor === null ? 'Unknown' : `F${d.floor} / ${p ? `${p.x}, ${p.y} m` : 'unknown'}`, age(d.last_heartbeat), d.connected_ap || '—', d.confidence === null ? '—' : `${d.confidence.toFixed(1)} dB`].forEach(text => row.append(element('td', text))); return row; }));
}
function drawMap(devices) {
  const map = $('map'), size = building.grid_size_m;
  map.replaceChildren(); map.setAttribute('viewBox', `-1 -1 ${size + 2} ${size + 2}`);
  drawFloorPlan(map, size);
  // Draw quiet markers first, then large alert symbols. Dot centers remain at the computed coordinates.
  const groups = new Map();
  for (const d of devices.filter(d => d.position_estimate)) { const p = d.position_estimate; const key = `${p.x},${p.y}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(d); }
  for (const group of [...groups.values()].sort((a,b) => byPriority(b.sort(byPriority)[0], a.sort(byPriority)[0]))) {
    group.sort(byPriority); const device = group[0], p = device.position_estimate;
    const alert = needsAttention(device), isFocused = group.some(d => d.device_id === focusedDevice), showLabel = alert || isFocused || $('show-all').checked;
    const x = p.x, y = size - p.y, scale = size / 20;
    const marker = svgNode('g', { tabindex: 0, role: 'button', 'aria-label': group.map(d => `${d.device_id}, ${labels[d.status]}, ${roomDescription(d)}`).join('; '), style: 'cursor:pointer' });
    marker.append(svgNode('title', {}, group.map(d => `${d.device_id} · ${labels[d.status]}`).join(', ')));
    if (alert || isFocused) marker.append(svgNode('circle', { cx:x, cy:y, r:.66*scale, fill:colors[device.status], opacity:.2 }));
    marker.append(svgNode('circle', { cx:x, cy:y, r:(alert ? .4 : showLabel ? .22 : .14)*scale, fill:colors[device.status], stroke:alert || isFocused ? '#fff' : '#101923', 'stroke-width': .06*scale, opacity: alert || showLabel ? 1 : .55 }));
    if (alert) marker.append(svgNode('text', { x, y:y+.17*scale, fill:'#0c1117', 'font-size':.53*scale, 'font-weight':900, 'text-anchor':'middle' }, group.length > 1 ? String(group.length) : device.status === 'active_sos' ? '!' : '?'));
    if (showLabel) {
      const labelX = Math.max(1.1*scale, Math.min(size-1.1*scale, x)); const labelY = y < 1.5*scale ? y+1.05*scale : y-.85*scale;
      const text = group.length > 1 ? `${device.name || device.device_id} +${group.length-1}` : (device.name || device.device_id);
      const width = (text.length * .31 + .35)*scale;
      marker.append(svgNode('rect', { x:labelX-width/2, y:labelY-.44*scale, width, height:.66*scale, rx:.12*scale, fill:'#0c1117', stroke:colors[device.status], 'stroke-width':.04*scale }));
      marker.append(svgNode('text', { x:labelX, y:labelY+.03*scale, fill:'#fff', 'font-size':.48*scale, 'font-weight':750, 'text-anchor':'middle' }, text));
    }
    const choose = () => { focusedDevice = device.device_id; render(); }; marker.onclick = choose; marker.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }; map.append(marker);
  }
}
function setupShare() {
  const ready = !!share?.url;
  $('station-qr').hidden = !ready; $('share-qr').hidden = !ready; $('share-link').hidden = !ready; $('copy-link').hidden = !ready;
  if (ready) {
    $('station-qr').src = share.qr_url; $('share-qr').src = share.qr_url; $('share-link').href = share.url; $('share-link').textContent = share.url;
    $('qr-status').textContent = share.ready ? 'Live over Wi-Fi or mobile data.' : 'QR prepared · public publish pending.';
    $('share-message').textContent = share.ready ? '' : 'The live public host is not published yet. Scanning will work after deployment is enabled.';
  } else { $('qr-status').textContent = 'Public link not connected yet.'; $('share-message').textContent = 'The public live link is not configured. A localhost address cannot be opened from another phone.'; }
  $('sync-note').textContent = runtime.transport === 'poll' ? 'Field view · updates automatically' : 'Command station · live';
}
function showShare() { $('share-dialog').showModal(); }
$('share-button').onclick = showShare; $('qr-open').onclick = showShare; $('close-share').onclick = () => $('share-dialog').close();
$('copy-link').onclick = async () => { try { await navigator.clipboard.writeText(share.url); $('share-message').textContent = 'Link copied.'; } catch { $('share-message').textContent = 'Select and copy the link above.'; } };
$('station-qr').onerror = () => { $('station-qr').hidden = true; $('qr-status').textContent = 'QR unavailable. Open the phone link.'; };
$('share-qr').onerror = () => { $('share-qr').hidden = true; $('share-message').textContent = 'QR unavailable. Use the link below.'; };
$('show-all').onchange = render; $('technical').ontoggle = renderRoster;
$('sos-metric').onclick = () => metricFilter('active_sos'); $('lost-metric').onclick = () => metricFilter('heartbeat_lost'); $('unaccounted-metric').onclick = () => metricFilter('unaccounted');
$('unlocated-tab').onclick = () => chooseFloor(null); $('review-unaccounted').onclick = () => { chooseFloor(null); $('floor-title').scrollIntoView({ block:'start', behavior:'smooth' }); };
$('all-alerts').onclick = () => { alertFilter = null; render(); };
document.querySelectorAll('[data-action]').forEach(button => { button.onclick = async () => {
  const action = button.dataset.action;
  if (action === 'power-outage' && selected === null) { $('control-message').textContent = 'Select a floor first.'; return; }
  const body = action === 'reset' ? {} : action === 'ap-down' ? { ap_id:$('ap-select').value } : action === 'power-outage' ? { floor:selected } : { device_id:$('device-select').value };
  button.disabled = true;
  try { const response = await fetch(`/simulate/${action}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); $('control-message').textContent = `${action} applied.${action === 'go-silent' ? ` Signal loss appears after ${building.simulation.heartbeat_timeout_seconds}s.` : ''}`; } catch (error) { $('control-message').textContent = error.message; } finally { button.disabled = false; }
}; });
setInterval(render,1000); start();
