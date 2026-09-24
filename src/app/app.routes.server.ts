import { RenderMode, ServerRoute } from '@angular/ssr';

// Unlike Find (a public search app where every route is safe to prerender),
// most of Network's routes are behind a Firebase Auth guard or otherwise
// depend on browser-only APIs (the landing route's own
// window.scrollTo(0, 0) call, for one) — evaluating those at build time in
// Node would either throw or produce a meaningless prerendered page. Only
// the two purely static content pages are prerendered; everything else
// keeps rendering exactly as it did before SSR/prerendering was added.
export const serverRoutes: ServerRoute[] = [
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
