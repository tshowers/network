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
    path: 'contact-edit',
    loadComponent: () =>
      import( './features/contact-edit/contact-edit.component' ).then( ( m ) => m.ContactEditComponent ),
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
];
