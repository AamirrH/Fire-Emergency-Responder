const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const defaults = require('./config');
const { loadBuilding, generateFingerprintMap } = require('./lib/building');
const { OccupantState } = require('./lib/state');
const { Simulator } = require('./lib/simulator');
const { CloudPublisher } = require('./lib/cloud');

function createApp({ config = defaults, directory = __dirname, clock = Date.now, random = Math.random, cloud = {}, host = process.env.HOST || '127.0.0.1', deviceToken = process.env.DEVICE_TOKEN } = {}) {
  const building = loadBuilding(directory, config);
  const fingerprints = generateFingerprintMap(building, config);
  fs.writeFileSync(path.join(directory, 'fingerprint_map.json'), JSON.stringify(fingerprints, null, 2) + '\n');
  const state = new OccupantState(building, fingerprints, config, clock);
  const simulator = new Simulator(building, config, payload => state.heartbeat(payload), random);
  const publisher = new CloudPublisher(cloud);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const live = io.of('/live');
  let revision = 0;
  let previous;
  let timers = [];
  app.use(express.json({ limit: '32kb' }));

  // CORS for /api/device/* only
  app.use('/api/device', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-device-token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Device API authorization: requires x-device-token matching DEVICE_TOKEN
  app.use('/api/device', (req, res, next) => {
    const token = req.get('x-device-token');
    if (!deviceToken || token !== deviceToken) {
      return res.status(401).json({ error: 'Unauthorized: invalid or missing device token.' });
    }
    next();
  });

  // Command mutations stay at the local station; the public mirror is read-only.
  app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    if (req.path.startsWith('/api/device')) return next();
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const origin = req.get('origin');
    if (!local || (origin && origin !== `http://${req.get('host')}`)) return res.status(403).json({ error: 'Demo controls are available only at the local command station.' });
    next();
  });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const snapshot = () => ({ ...state.snapshot(), revision });
  const publicBuilding = () => ({ ...building, simulation: {
    heartbeat_interval_seconds: config.HEARTBEAT_INTERVAL_MS / 1000,
    heartbeat_timeout_seconds: config.HEARTBEAT_TIMEOUT_SECONDS,
    sos_window_seconds: config.SOS_WINDOW_SECONDS,
    sos_cancel_grace_seconds: config.SOS_CANCEL_GRACE_SECONDS || 15,
    fingerprint_step_m: config.FINGERPRINT_STEP_M,
    ghost_device_ids: config.GHOST_DEVICE_IDS,
    pressure_per_meter: config.PRESSURE_PER_METER,
    pressure_noise_pa: config.PRESSURE_NOISE_PA,
    a: config.A,
    path_loss_exponent: config.PATH_LOSS_EXPONENT,
    floor_attenuation_db: config.FLOOR_ATTENUATION_DB,
    rssi_noise_db: config.RSSI_NOISE_DB,
  } });
  // Initial full state, followed by changed devices/APs only. Floor aggregates and
  // summary are small and sent each time. Server time drives relative timestamps.
  function publish(reset = false) {
    revision++;
    const current = snapshot();
    if (reset || !previous) live.emit('snapshot', current);
    else {
      const changed = key => current[key].filter(item => {
        const idKey = key === 'devices' ? 'device_id' : 'id';
        return JSON.stringify(item) !== JSON.stringify(previous[key].find(old => old[idKey] === item[idKey]));
      });
      live.emit('state_diff', { ...current, devices: changed('devices'), aps: changed('aps') });
    }
    previous = current;
  }
  live.on('connection', socket => {
    socket.emit('snapshot', snapshot());
    socket.on('resync', () => socket.emit('snapshot', snapshot()));
  });
  app.get('/api/summary', (_req, res) => res.json(state.snapshot().summary));
  app.get('/api/floors', (_req, res) => res.json(state.snapshot().floors));
  app.get('/api/state', (_req, res) => res.json(snapshot()));
  app.get('/api/building', (_req, res) => res.json(publicBuilding()));
  app.get('/api/runtime', (_req, res) => res.json({ transport: 'socket.io', can_control: true, share: publisher.share }));
  app.get('/api/share/status', (_req, res) => res.json({ configured: !!publisher.share, last_published: publisher.lastPublished, error: publisher.lastError }));
  app.get('/api/share/qr.png', async (_req, res, next) => {
    try { const png = await publisher.qr(); if (!png) return res.status(503).json({ error: 'Public dashboard is not configured.' }); res.type('png').send(png); } catch (error) { next(error); }
  });
  app.get('/building.json', (_req, res) => res.json(building));
  app.get(['/download/apk', '/download/app.apk', '/download/ember-responder.apk'], (_req, res) => {
    const apkPath = path.join(__dirname, 'public', 'ember-responder.apk');
    if (fs.existsSync(apkPath)) {
      return res.download(apkPath, 'ember-responder-sos.apk');
    }
    res.redirect('https://expo.dev/artifacts/eas/GtuLkRUnIYTrhKDY8wUt7evHUDvCLC7aturAAgn_kOE.apk');
  });
  app.get('/api/floors/:floor', (req, res) => {
    const floor = Number(req.params.floor);
    if (!Number.isInteger(floor) || floor < 1 || floor > building.floors) return res.status(400).json({ error: 'Invalid floor.' });
    const current = state.snapshot();
    res.json({ ...current.floors.find(f => f.floor === floor),
      devices: current.devices.filter(d => d.floor === floor), aps: current.aps.filter(ap => ap.floor === floor) });
  });
  app.post('/api/heartbeat', (req, res, next) => {
    try { state.heartbeat(req.body); publish(); res.json({ ok: true }); } catch (error) { next(error); }
  });
  // Device API
  app.post('/api/device/heartbeat', (req, res, next) => {
    try { state.heartbeat(req.body); publish(); res.json({ ok: true }); } catch (error) { next(error); }
  });
  app.post('/api/device/sos', (req, res, next) => {
    try { const id = requireDevice(req.body); state.event('sos', id); publish(); res.json({ ok: true, revision }); } catch (error) { next(error); }
  });
  app.post('/api/device/sos-cancel', (req, res, next) => {
    try { const id = requireDevice(req.body); state.event('sos-cancel', id); publish(); res.json({ ok: true, revision }); } catch (error) { next(error); }
  });
  app.post('/api/device/claim', (req, res, next) => {
    try { const id = requireDevice(req.body); simulator.claim(id); res.json({ ok: true, claimed: id }); } catch (error) { next(error); }
  });
  app.post('/api/device/release', (req, res, next) => {
    try { const id = requireDevice(req.body); simulator.release(id); res.json({ ok: true, released: id }); } catch (error) { next(error); }
  });
  app.get('/api/device/:id/status', (req, res) => {
    const current = snapshot();
    const device = current.devices.find(d => d.device_id === req.params.id);
    if (!device) return res.status(404).json({ error: 'Unknown device_id.' });
    res.json({
      device_id: device.device_id,
      name: device.name,
      status: device.status,
      floor: device.floor,
      x: device.position_estimate?.x ?? null,
      y: device.position_estimate?.y ?? null,
      match_distance_db: device.confidence,
      confidence: device.confidence,
      matched_ap_count: device.matched_ap_count,
      connected_ap: device.connected_ap,
      last_heartbeat: device.last_heartbeat,
      last_event: device.last_event,
      raw_pressure: device.raw_pressure,
    });
  });

  function control(route, action) {
    app.post(`/simulate/${route}`, (req, res, next) => {
      try { action(req.body || {}); publish(route === 'reset'); res.json({ ok: true, revision }); } catch (error) { next(error); }
    });
  }
  const requireDevice = body => {
    if (!state.devices.has(body.device_id)) throw new Error('Unknown device_id.');
    return body.device_id;
  };
  control('sos', body => state.event('sos', requireDevice(body)));
  control('go-silent', body => simulator.goSilent(requireDevice(body)));
  control('evacuate', body => {
    const id = requireDevice(body);
    state.event('evacuate', id);
    simulator.goSilent(id);
  });
  control('ap-down', body => { state.apDown(body.ap_id); simulator.apDown(body.ap_id); });
  control('power-outage', body => {
    if (!Number.isInteger(body.floor) || body.floor < 1 || body.floor > building.floors) throw new Error('Invalid floor.');
    simulator.powerOutage(body.floor);
    building.aps.filter(ap => ap.floor === body.floor).forEach(ap => state.apDown(ap.id));
  });
  control('reset', () => { state.reset(); simulator.reset(); simulator.tick(); });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((error, _req, res, _next) => res.status(error.status || 400).json({ error: error.message }));
  simulator.tick();
  previous = snapshot();
  return {
    app, server, state, simulator,
    async start(port = config.PORT, bindHost = host) {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bindHost, resolve); });
      timers = [setInterval(() => simulator.tick(), config.HEARTBEAT_INTERVAL_MS), setInterval(publish, config.STATE_INTERVAL_MS)];
      if (publisher.url && publisher.token) {
        const sync = () => publisher.publish(snapshot(), publicBuilding());
        void sync(); timers.push(setInterval(sync, 2000));
      }
      return server.address();
    },
    async stop() { timers.forEach(clearInterval); await new Promise(resolve => io.close(resolve)); },
  };
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
  const host = process.env.HOST || '127.0.0.1';
  const deviceToken = process.env.DEVICE_TOKEN;
  const application = createApp({
    host,
    deviceToken,
    cloud: { url: process.env.PUBLIC_DASHBOARD_URL, token: process.env.PUBLISH_TOKEN, ready: process.env.PUBLIC_DASHBOARD_READY === 'true' },
  });
  application.start(Number(process.env.PORT) || defaults.PORT, host).then(address => {
    console.log(`Fire locator demo: http://${host}:${address.port}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await application.stop(); process.exit(0); });
}
module.exports = { createApp };
