# dev-proxy — run all three UIs on one origin

Fronts the Angular, Vue and React dev servers (plus the API) on a single port so you can
switch framework from the login screen or the toolbar without logging in again.

**Dev only.** Nothing in this folder is referenced by the [Dockerfile](../Dockerfile), the
[CI workflow](../.github/workflows/deploy.yml), or
[Deploy-ErrorLogger.ps1](../deploy/windows/Deploy-ErrorLogger.ps1). Production is unchanged:
FastAPI serves the Angular build alone.

## Why a proxy at all

The session is a JWT in `localStorage` (`errorlogger_token` / `errorlogger_user`), and
`localStorage` is partitioned **per origin**. Run the dev servers on their own ports and
`localhost:4200`, `localhost:4300` and `localhost:4400` are three different origins with
three separate sessions — switching would mean logging in again each time.

Put one port in front of all three and they share an origin, so they share the token. The
switch is then just `window.location.assign('/vue/error-logs')` — the target app boots,
reads the token that's already there, and lands you on the same page, signed in.

## Routes

| URL | Upstream | |
| --- | --- | --- |
| `http://localhost:4000/` | `localhost:4200` | Angular (`ng serve`) |
| `http://localhost:4000/vue/` | `localhost:4300` | Vue (Vite) |
| `http://localhost:4000/react/` | `localhost:4400` | React (Vite) |
| `http://localhost:4000/api/` | `localhost:8000` | FastAPI |

Paths are forwarded untouched — each app is *built* with a matching base (`base: '/vue/'`,
`basename="/react"`), so its own asset URLs already carry the prefix. No rewriting means
source maps and HMR paths stay correct.

Override any upstream with `ANGULAR_TARGET`, `VUE_TARGET`, `REACT_TARGET`, `API_TARGET`, or
the listen port with `PORT`.

## Running

Start the backend first (it has its own venv and migrations):

```bash
cd backend
./venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Then everything else in one go:

```bash
cd dev-proxy
npm install
npm run all     # ng serve + both Vite servers + this proxy
```

Open **http://localhost:4000** — not the individual ports, or you lose the shared origin and
the switcher can't work.

To run the proxy alone against dev servers you started yourself: `npm start`.

## The switcher

- **Login screen** — an "Open with" radio group; after a successful sign-in you land in the
  framework you picked.
- **Toolbar** — Angular / Vue / React buttons to jump mid-session.

In Angular both are gated on `environment.uiSwitcher`, which is `false` in
[environment.prod.ts](../frontend/src/environments/environment.prod.ts). `angular.json`'s
production `fileReplacements` swaps that file in, so the picker never renders in a production
build. (The markup is still present in the bundle as dead code — Angular's `@if` is a runtime
conditional, not a compile-time one — it just never renders.) Vue and React need no guard:
those apps are never deployed.

## Gotchas

- **`ng serve` binds IPv6 loopback** (`[::1]:4200`) while Vite binds IPv4. The upstreams are
  addressed as `localhost` rather than `127.0.0.1` so Node tries both families.
- **Hot reload needs the websocket upgrade**, which the proxy forwards (`ws: true`). Without
  it you get a page that works but silently never reloads on edit.
- **A 502 from the proxy** means that app's dev server isn't running — the response body says
  which upstream was unreachable.
