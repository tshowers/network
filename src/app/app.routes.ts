import { Routes } from '@angular/router';
import { landingRedirectGuard } from './services/landing-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
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
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts; replaces the old
    // Stripe plan page.
    path: 'pricing',
    data: { product: 'network' },
    loadComponent: () =>
      import( './features/get-the-app/get-the-app.component' ).then( ( m ) => m.GetTheAppComponent ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import( './features/help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import( './features/about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
  {
    // Pre-sign-in onboarding wizard (name, role, company, goals, timezone)
    // - the web twin of network-ios's OnboardingWizardView. Sign-in entry
    // points land here; /login stays a direct handoff for returning users,
    // purchase flows, and deep links.
    path: 'get-started',
    loadComponent: () =>
      import( './features/get-started/get-started.component' ).then( ( m ) => m.GetStartedComponent ),
  },
  {
    // In-app profile management (shared fields/API with network-ios's
    // TODDProfileKit) - replaces the menu's old link out to TODD's
    // /update-profile. Signed-out visitors are sent to /login.
    path: 'profile',
    loadComponent: () =>
      import( './features/profile/profile.component' ).then( ( m ) => m.ProfileComponent ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'mobile-handoff',
    loadComponent: () =>
      import( './features/mobile-handoff/mobile-handoff.component' ).then( ( m ) => m.MobileHandoffComponent ),
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
    path: 'contact-deal-flow-dashboard',
    loadComponent: () =>
      import( './features/deal-flow-dashboard/deal-flow-dashboard.component' ).then( ( m ) => m.DealFlowDashboardComponent ),
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
    path: 'contact-upload',
    loadComponent: () =>
      import( './features/contact-upload/contact-upload.component' ).then( ( m ) => m.ContactUploadComponent ),
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
