const QRCode = require('qrcode');

function publicDashboardUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('PUBLIC_DASHBOARD_URL must be a public HTTPS origin.');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_DASHBOARD_URL must be an origin without a path, query, or fragment.');
  return url.origin;
}

class CloudPublisher {
  constructor({ url, token, ready = false, fetcher = fetch }) {
    this.url = publicDashboardUrl(url);
    this.token = token;
    this.ready = Boolean(ready);
    this.fetcher = fetcher;
    this.busy = false;
    this.lastPublished = null;
    this.lastError = null;
  }
  get share() {
    return this.url ? { url: `${this.url}/?view=field`, qr_url: '/api/share/qr.png', ready: this.ready } : null;
  }
  async publish(state, building) {
    if (!this.url || !this.token || this.busy) return;
    this.busy = true;
    try {
      const response = await this.fetcher(`${this.url}/api/ingest`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ state, building }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Hosted sync returned ${response.status}`);
      this.lastPublished = Date.now(); this.lastError = null;
    } catch (error) { this.lastError = error.message; }
    finally { this.busy = false; }
  }
  async qr() {
    if (!this.share) return null;
    return QRCode.toBuffer(this.share.url, { type: 'png', errorCorrectionLevel: 'M', margin: 4, width: 360 });
  }
}

module.exports = { CloudPublisher, publicDashboardUrl };
