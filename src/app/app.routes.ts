import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
  },
  {
    // The real signed-in app experience - contact-home.component.ts ported
    // from TODD, confirmed as the actual live /network/app route there.
    path: 'app',
    loadComponent: () =>
      import( './features/contact-home/contact-home.component' ).then( ( m ) => m.ContactHomeComponent ),
  },
  {
    // Relocated here so /app could go to the real ContactHomeComponent -
    // this page showcases the Network iOS app, not the web experience.
    path: 'ios',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import( './features/pricing/pricing.component' ).then( ( m ) => m.PricingComponent ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'finish-sign-in',
    loadComponent: () =>
      import( './features/finish-sign-in/finish-sign-in.component' ).then( ( m ) => m.FinishSignInComponent ),
  },
  {
    path: 'contact-edit',
    loadComponent: () =>
      import( './features/contact-edit/contact-edit.component' ).then( ( m ) => m.ContactEditComponent ),
  },
  {
    path: 'contact-import',
    loadComponent: () =>
      import( './features/csv-import/csv-import.component' ).then( ( m ) => m.CsvImportComponent ),
  },
  {
    path: 'contact-deal-flow',
    loadComponent: () =>
      import( './features/pipeline/pipeline.component' ).then( ( m ) => m.PipelineComponent ),
  },
  {
    path: 'contact-list',
    loadComponent: () =>
      import( './features/list/list.component' ).then( ( m ) => m.ListComponent ),
  },
  {
    path: 'contact/:id',
    loadComponent: () =>
      import( './features/view/view.component' ).then( ( m ) => m.ViewComponent ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/paid-success/paid-success.component' ).then( ( m ) => m.PaidSuccessComponent ),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
  {
    // Catches any unmatched URL (typos, stale links, deep links to routes
    // that never existed here) - without this, the router just silently
    // fails to navigate instead of showing anything.
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
