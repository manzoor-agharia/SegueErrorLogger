# ErrorLogger — React frontend

A feature-complete port of the Angular app in [`frontend/`](../frontend), running against the
same FastAPI backend with no server-side changes.

## Stack

| Concern | Angular | React |
| --- | --- | --- |
| Framework | Angular 20 (standalone, signals) | React 18 + TypeScript |
| Build | Angular CLI | Vite 6 |
| State | `signal()` / `computed()` in services | `useState` + Zustand stores |
| HTTP | `HttpClient` + `HttpInterceptorFn` | axios + request/response interceptors |
| Routing | `provideRouter` + `CanActivateFn` | React Router 6 + guard wrapper components |
| Rich text | `ngx-quill` | `QuillEditor.tsx` (Quill 2 wrapped directly) |
| Dates | `DatePipe` | `utils/date.ts` (`Intl.DateTimeFormat`) |

## Running

The backend must be on `http://localhost:8000`; `/api` is proxied there (same as the Angular
app's `proxy.conf.json`).

```bash
npm install
npm run dev        # http://localhost:4400
npm run build      # type-check + production build
npm run typecheck
```

## Layout

```
src/
  api/client.ts        axios instance, auth + 401 interceptors, error-detail helper
  types/               API models — copied verbatim from the Angular app
  services/            one module per resource, mirrors the Angular @Injectable services
  stores/              Zustand: auth (session + role selectors) and toast
  hooks/               useClickOutside, useDocumentEvent — replace @HostListener
  components/          shared + feature components
  views/               routed pages
  styles/              base.scss (unchanged) + per-component sheets, each scoped to a `.c-*` root
```

### Notes on the port

- **Style scoping.** Angular's view encapsulation kept colliding selectors (`.modal-topbar`,
  `.empty`, `.kebab-menu`) apart across components. Each component stylesheet is wrapped in a
  `.c-<component>` root class and the component's root element carries that class, which
  reproduces the same isolation without a CSS-in-JS layer.
- **`useDocumentEvent`** keeps the handler in a ref so document listeners aren't torn down and
  re-added on every render — the behaviour an Angular `@HostListener` gives for free.
- **Attachment images** are fetched as blobs (the download routes need the `Authorization`
  header, so `<img src>` can't hit them directly) and exposed as object URLs, revoked on unmount.
- **Search is debounced into separate state** (`searchTerm` for the input, `debouncedSearch` for
  the query) so typing doesn't fire a request per keystroke while the input stays responsive.
- **Business rules preserved as-is:** comment permissions (reporter, current *or past* assignee,
  or SuperAdmin), reference IDs never recomputed on edit, filter changes resetting to page 1,
  and a failed attachment upload still counting as a successful save.
