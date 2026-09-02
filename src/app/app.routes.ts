import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './features/quick-actions/quick-actions.component' ).then( ( m ) => m.QuickActionsComponent ),
  },
];
