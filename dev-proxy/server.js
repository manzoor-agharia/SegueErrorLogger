/**
 * Single-origin dev proxy for the three ErrorLogger UIs.
 *
 * The whole point is the shared origin. The session lives in localStorage under
 * `errorlogger_token` / `errorlogger_user`, and localStorage is partitioned per origin --
 * so running the three dev servers on their own ports (4200/4300/4400) means three separate
 * sessions and a re-login on every switch. Fronting them with one port makes the JWT visible
 * to all three, and switching framework becomes a plain page load.
 *
 *   http://localhost:4000/         -> Angular  (ng serve, 4200)
 *   http://localhost:4000/vue/     -> Vue      (vite, 4300)
 *   http://localhost:4000/react/   -> React    (vite, 4400)
 *   http://localhost:4000/api/     -> FastAPI  (uvicorn, 8000)
 *
 * Dev only. Nothing here is referenced by the Dockerfile, the CI workflow, or the deploy
 * script -- production still serves the Angular build alone, straight from FastAPI.
 */
import http from 'node:http';

import httpProxy from 'http-proxy';

const PORT = Number(process.env.PORT ?? 4000);

// `localhost`, not `127.0.0.1`: `ng serve` binds IPv6 loopback ([::1]) while the Vite
// servers bind IPv4, so a hard-coded family refuses the connection for one of them. Node 20
// resolves `localhost` with Happy Eyeballs and tries both.
const TARGETS = {
  api: process.env.API_TARGET ?? 'http://localhost:8000',
  vue: process.env.VUE_TARGET ?? 'http://localhost:4300',
  react: process.env.REACT_TARGET ?? 'http://localhost:4400',
  angular: process.env.ANGULAR_TARGET ?? 'http://localhost:4200',
};

// `ws: true` matters: both Vite and ng serve push hot-reload over a websocket, and without
// upgrade forwarding you get a working page that silently never reloads on edit.
const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true });

proxy.on('error', (err, _req, res) => {
  const message = `dev-proxy: upstream unreachable (${err.message})`;
  console.error(message);
  if (res && 'writeHead' in res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`${message}\n\nIs the dev server for that app running?\n`);
  }
});

/**
 * Routes by first path segment. Each app is *built* with a matching base (`/vue/`,
 * `/react/`), so its own asset URLs already carry the prefix and the path is forwarded
 * untouched -- no rewriting, which is what keeps source maps and HMR paths correct.
 */
function targetFor(url = '/') {
  if (url.startsWith('/api')) return TARGETS.api;
  if (url === '/vue' || url.startsWith('/vue/')) return TARGETS.vue;
  if (url === '/react' || url.startsWith('/react/')) return TARGETS.react;
  return TARGETS.angular;
}

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: targetFor(req.url) });
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: targetFor(req.url) });
});

server.listen(PORT, () => {
  console.log(`dev-proxy listening on http://localhost:${PORT}`);
  console.log(`  /        -> ${TARGETS.angular}  (Angular)`);
  console.log(`  /vue/    -> ${TARGETS.vue}  (Vue)`);
  console.log(`  /react/  -> ${TARGETS.react}  (React)`);
  console.log(`  /api/    -> ${TARGETS.api}  (FastAPI)`);
});
