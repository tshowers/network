import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
  },
  {
    // Placeholder until list/home/contact-home are ported - the real app
    // experience will replace this route's component, not its path
    // (landing.component.html and pricing.component.html already link here).
    path: 'app',
    loadComponent: () =>
      import( './features/quick-actions/quick-actions.component' ).then( ( m ) => m.QuickActionsComponent ),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import( './features/pricing/pricing.component' ).then( ( m ) => m.PricingComponent ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import( './features/paid-success/paid-success.component' ).then( ( m ) => m.PaidSuccessComponent ),
  },
];
