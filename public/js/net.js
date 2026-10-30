/* Client WebSocket + REST, avec reconnexion automatique. */
(function () {
  'use strict';
  const listeners = {};
  let ws = null, wantOpen = false, retry = 0, pingTimer = null;
  const Net = {
    online: 0, latency: 0, connected: false,
    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    emit(type, data) { (listeners[type] || []).forEach(fn => fn(data)); (listeners['*'] || []).forEach(fn => fn(type, data)); },
    // La session est un cookie httpOnly posé par le serveur : rien n'est stocké côté page.
    setToken() { try { localStorage.removeItem('ogs_token'); } catch (e) { /* ignore */ } },
    getToken() { return null; },
    connect() {
      wantOpen = true;
      if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ t: 'auth' })); };
      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.t === 'auth_ok') { Net.connected = true; Net.online = msg.online; startPing(); }
        if (msg.t === 'pong') { Net.latency = Date.now() - msg.ts; Net.online = msg.online; }
        Net.emit(msg.t, msg);
      };
      ws.onclose = () => {
        Net.connected = false; stopPing(); Net.emit('disconnected');
        if (wantOpen) { retry += 1; setTimeout(() => Net.connect(), Math.min(8000, 500 * retry)); }
      };
      ws.onerror = () => {};
    },
    disconnect() { wantOpen = false; if (ws) ws.close(); ws = null; Net.connected = false; },
    send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); },
    async api(path, body, method) {
      const opts = { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    },
  };
  function startPing() { stopPing(); pingTimer = setInterval(() => Net.send({ t: 'ping', ts: Date.now() }), 5000); Net.send({ t: 'ping', ts: Date.now() }); }
  function stopPing() { clearInterval(pingTimer); pingTimer = null; }
  window.Net = Net;
})();
