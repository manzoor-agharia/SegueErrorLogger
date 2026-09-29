# ErrorLogger — Vue 3 frontend

A feature-complete port of the Angular app in [`frontend/`](../frontend), running against the
same FastAPI backend with no server-side changes.

## Stack

| Concern | Angular | Vue |
| --- | --- | --- |
| Framework | Angular 20 (standalone, signals) | Vue 3.5 (`<script setup>`, Composition API) |
| Build | Angular CLI | Vite 6 |
| State | `signal()` / `computed()` in services | `ref()` / `computed()` in Pinia stores |
| HTTP | `HttpClient` + `HttpInterceptorFn` | axios + request/response interceptors |
| Routing | `provideRouter` + `CanActivateFn` | Vue Router + `router.beforeEach` |
| Rich text | `ngx-quill` | `QuillEditor.vue` (Quill 2 wrapped directly) |
| Dates | `DatePipe` | `utils/date.ts` (`Intl.DateTimeFormat`) |

## Running

The backend must be on `http://localhost:8000`; `/api` is proxied there (same as the Angular
app's `proxy.conf.json`).

```bash
npm install
npm run dev        # http://localhost:4300
npm run build      # type-check + production build
npm run typecheck
```

## Layout

```
src/
  api/client.ts        axios instance, auth + 401 interceptors, error-detail helper
  types/               API models — copied verbatim from the Angular app
  services/            one module per resource, mirrors the Angular @Injectable services
  stores/              Pinia: auth (session + role) and toast
  composables/         useClickOutside — replaces @HostListener('document:click')
  components/          shared + feature components
  views/               routed pages
  styles/              base.scss (unchanged) + per-component sheets, each scoped to a `.c-*` root
```

### Notes on the port

- **Style scoping.** Angular's view encapsulation kept colliding selectors (`.modal-topbar`,
  `.empty`, `.kebab-menu`) apart across components. Each component stylesheet is wrapped in a
  `.c-<component>` root class and the component's root element carries that class, which
  reproduces the same isolation without relying on `scoped`.
- **Attachment images** are fetched as blobs (the download routes need the `Authorization`
  header, so `<img src>` can't hit them directly) and exposed as object URLs, revoked on unmount.
- **Business rules preserved as-is:** comment permissions (reporter, current *or past* assignee,
  or SuperAdmin), reference IDs never recomputed on edit, filter changes resetting to page 1,
  and a failed attachment upload still counting as a successful save.
