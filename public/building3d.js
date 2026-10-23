import * as THREE from '/three.module.js';
/* A deliberately lightweight Three.js model: room volumes give orientation,
   while live markers are the only elements that carry incident meaning. */
(function () {
  let scene, camera, renderer, root, markers = new Map(), state, building, selectedFloor = null;
  let dragging = false, lastX = 0, lastY = 0, yaw = .68, pitch = .42, distance = 35;
  const host = () => document.getElementById('building-3d-canvas');
  const color = status => ({ active_sos: 0xff665e, heartbeat_lost: 0xffd078, location_unknown: 0xffd078, safe: 0x8bd6be, active: 0x6f889b }[status] || 0x6f889b);
  const label = device => device.name || device.device_id;
  function makeTextSprite(text, tint) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.font = 'bold 30px system-ui'; ctx.fillStyle = '#0c1117'; ctx.roundRect(4, 8, 504, 76, 12); ctx.fill();
    ctx.strokeStyle = tint; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text.slice(0, 25), 256, 57);
    const texture = new THREE.CanvasTexture(canvas); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true })); sprite.scale.set(2.8, .52, 1); return sprite;
  }
  function addBox(parent, x, y, z, width, height, depth, material) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
  function rebuildGeometry() {
    if (!root || !building) return;
    root.clear(); markers.clear();
    const plans = building.floor_plans || [];
    const roomMaterial = new THREE.MeshStandardMaterial({ color: 0x243744, transparent: true, opacity: .78, roughness: .9 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x101d27, transparent: true, opacity: .28, side: THREE.DoubleSide });
    for (const plan of plans) {
      const y = (plan.floor - 1) * building.floor_height_m;
      addBox(root, 0, y, 0, building.grid_size_m, .18, building.grid_size_m, floorMaterial);
      for (const room of plan.rooms || []) addBox(root, room.x + room.width / 2 - 10, y + .65, -(room.y + room.height / 2 - 10), room.width, 1.25, room.height, roomMaterial);
      const text = makeTextSprite(`F${plan.floor} · ${plan.name}`, '#90a9b9'); text.position.set(-9, y + 1.7, -9); root.add(text);
    }
    updateMarkers();
  }
  function updateMarkers() {
    if (!root || !state || !building) return;
    for (const marker of markers.values()) root.remove(marker);
    markers.clear();
    for (const device of state.devices.filter(d => d.position_estimate && (selectedFloor === null || selectedFloor === undefined || d.floor === selectedFloor))) {
      const p = device.position_estimate, floorY = (device.floor - 1) * building.floor_height_m + 1.7;
      const group = new THREE.Group(); group.position.set(p.x - 10, floorY, -(p.y - 10)); group.userData.device = device;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(device.status === 'active_sos' ? .42 : .27, 16, 12), new THREE.MeshStandardMaterial({ color: color(device.status), emissive: color(device.status), emissiveIntensity: device.status === 'active_sos' ? .35 : .08 })); group.add(sphere);
      if (device.status === 'active_sos' || device.status === 'heartbeat_lost') { const glow = new THREE.Mesh(new THREE.RingGeometry(.5, .65, 24), new THREE.MeshBasicMaterial({ color: color(device.status), transparent: true, opacity: .7, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI / 2; group.add(glow); }
      const caption = makeTextSprite(label(device), device.status === 'active_sos' ? '#ff665e' : '#ffd078'); caption.position.y = .75; caption.visible = device.status === 'active_sos' || device.status === 'heartbeat_lost'; group.add(caption);
      root.add(group); markers.set(device.device_id, group);
    }
  }
  function cameraPosition() { const target = new THREE.Vector3(0, 10, 0); camera.position.set(Math.cos(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, Math.sin(yaw) * Math.cos(pitch) * distance); camera.lookAt(target); }
  function resize() { if (!renderer || !host()) return; const r = host().getBoundingClientRect(); renderer.setSize(r.width, Math.max(360, r.height), false); camera.aspect = r.width / Math.max(360, r.height); camera.updateProjectionMatrix(); }
  function animate() { if (!renderer) return; requestAnimationFrame(animate); renderer.render(scene, camera); }
  function init() {
  if (!host() || scene) return;
    try { scene = new THREE.Scene(); scene.background = new THREE.Color(0x101923); camera = new THREE.PerspectiveCamera(35, 1, .1, 200); renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); host().replaceChildren(renderer.domElement); root = new THREE.Group(); scene.add(root); } catch (error) { host().textContent = '3-D preview is unavailable in this browser. Use the labeled 2-D floor map above.'; host().classList.add('model-unavailable'); return; }
    scene.add(new THREE.HemisphereLight(0xcde4ff, 0x19222d, 2)); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(20, 30, 15); scene.add(light); cameraPosition(); resize(); animate();
    const el = renderer.domElement; el.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); }); el.addEventListener('pointerup', e => { dragging = false; el.releasePointerCapture(e.pointerId); }); el.addEventListener('pointermove', e => { if (!dragging) return; yaw -= (e.clientX - lastX) * .008; pitch = Math.max(.08, Math.min(1.25, pitch + (e.clientY - lastY) * .006)); lastX = e.clientX; lastY = e.clientY; cameraPosition(); }); el.addEventListener('wheel', e => { e.preventDefault(); distance = Math.max(14, Math.min(65, distance + e.deltaY * .025)); cameraPosition(); }, { passive: false }); el.addEventListener('click', e => { const rect = el.getBoundingClientRect(); const pointer = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera); const hits = ray.intersectObjects([...markers.values()].flatMap(group => group.children), true); const device = hits.find(hit => hit.object.parent?.userData.device)?.object.parent.userData.device; if (device) { document.getElementById('building-3d-selection').textContent = `${label(device)} · ${device.device_id} · Floor ${device.floor} · ${device.status.replaceAll('_', ' ')}`; window.dispatchEvent(new CustomEvent('ember-focus-device', { detail: device.device_id })); } });
    window.addEventListener('resize', resize); window.addEventListener('ember-state', e => { state = e.detail; updateMarkers(); }); window.addEventListener('ember-building', e => { building = e.detail; rebuildGeometry(); }); window.addEventListener('ember-selection', e => { selectedFloor = e.detail.floor; updateMarkers(); });
    if (window.__emberBuilding) { building = window.__emberBuilding; rebuildGeometry(); } if (window.__emberState) { state = window.__emberState; updateMarkers(); }
  }
  window.addEventListener('load', init); window.addEventListener('ember-state', init); window.addEventListener('ember-building', init);
})();
