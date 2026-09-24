import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

initializeApp( environment.firebaseConfig );

/**
 * Cypress-only bootstrap gate for the Firebase Local Emulator Suite.
 * cypress/support/commands.ts's visitWithFirebaseEmulators stashes
 * __useFirebaseEmulators + __cypressEmulatorCredentials in localStorage
 * via onBeforeLoad (synchronous, before any app code runs), so this can
 * point the SDK at localhost and sign the test user in before
 * NetworkAuthService's first onAuthStateChanged emission - components
 * like ContactEditComponent only take that first emission
 * (firstValueFrom) as the resolved auth state, so signing in has to
 * finish before bootstrapApplication() runs in main.ts, not after.
 * Gated on window.Cypress, which Cypress injects into every page it
 * drives and which is never present in a normal browser session, so
 * production and regular dev use take the immediately-resolved branch
 * below untouched.
 */
export const appReady: Promise<void> = ( async () => {
  if ( typeof window === 'undefined' || !( window as any ).Cypress || window.localStorage.getItem( '__useFirebaseEmulators' ) !== 'true' ) {
    return;
  }

  const auth = getAuth();
  connectAuthEmulator( auth, 'http://127.0.0.1:9199', { disableWarnings: true } );
  connectFirestoreEmulator( getFirestore(), '127.0.0.1', 8180 );

  const raw = window.localStorage.getItem( '__cypressEmulatorCredentials' );
  if ( !raw ) return;

  const { email, password } = JSON.parse( raw ) as { email: string; password: string };
  try {
    await createUserWithEmailAndPassword( auth, email, password );
  } catch ( error: any ) {
    if ( error?.code !== 'auth/email-already-in-use' ) throw error;
    await signInWithEmailAndPassword( auth, email, password );
  }
} )();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }), provideClientHydration(withEventReplay()),
  ]
};
