import { Injectable } from '@angular/core';
import {
  ActionCodeSettings,
  Auth,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  OAuthProvider,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable, shareReplay, switchMap, of } from 'rxjs';

/**
 * Trimmed, purpose-built auth service for the standalone Network app -
 * mirrors sayit's AuthContextService in style (raw `firebase/auth`, not
 * `@angular/fire`'s wrapper - no reason to pull in a bigger dependency for
 * what's a handful of calls), but unlike SayIt (a single-tenant, public app
 * pinned to one master tenant) Network serves TODD's real multi-tenant
 * customers, so it needs real tenant resolution.
 *
 * Mirrors the exact same resolution TODD's own `AuthService` uses
 * (`resolveAssignedTenantId`) and that Network-iOS's `AuthService.swift`
 * already reimplements: `users/{uid}.companyId` if set, else the uid itself
 * is the tenant. Keeping this identical across TODD, Network-iOS, and this
 * app is deliberate - three independent reimplementations of the same rule
 * is fine; three different *rules* would silently fragment which tenant a
 * user lands in depending which client they signed in from.
 *
 * Sign-in providers match TODD's real web login.component.ts exactly -
 * Google, Apple (same `apple.com` provider id as the native iOS apps, so
 * accounts unify across platforms), and passwordless email link - not the
 * Google+password pairing this had before. Popup-vs-redirect and the
 * email-link send/complete mechanics are ported from AuthService's
 * signInWithGoogle/signInWithApple/sendLoginLink/completeSignInWithEmailLink,
 * trimmed of the multi-tenant invite branching those carry (Network has no
 * invite flow) but otherwise unchanged - this is the one piece of Network
 * that should NOT drift from TODD's behavior, since the whole point is a
 * user recognizing the same three buttons everywhere.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  private userId$?: Observable<string>;
  private tenantId$?: Observable<string>;

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  /** Matches TODD's own AuthService.getUserId() shape - components ported
   * from features/contact/* call this by name, so keeping the signature
   * identical means the rest of a component's logic ports unchanged. */
  getUserId (): Observable<string> {
    if ( !this.userId$ ) {
      this.userId$ = new Observable<string>( ( subscriber ) => {
        const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user?.uid || '' ) );
        return unsubscribe;
      } ).pipe( shareReplay( { bufferSize: 1, refCount: false } ) );
    }
    return this.userId$;
  }

  /** Resolved once per session and shared - every ported component needs
   * this for `tenants/{tenantId}/...` reads, so it's cached here rather
   * than making each component re-resolve it. */
  getTenantId (): Observable<string> {
    if ( !this.tenantId$ ) {
      this.tenantId$ = this.getUserId().pipe(
        switchMap( ( uid ) => ( uid ? this.resolveTenantId( uid ) : of( '' ) ) ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.tenantId$;
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    return this.auth.currentUser?.uid || '';
  }

  /**
   * Mobile browsers (particularly iOS Safari) frequently block or kill
   * signInWithPopup's window.open regardless of gesture timing, so provider
   * sign-in uses a full-page redirect there instead - same rule as TODD's
   * AuthService.isMobileDevice().
   */
  isMobileDevice (): boolean {
    return /Android|iPhone|iPad|iPod/i.test( navigator.userAgent );
  }

  /**
   * On mobile this starts a full-page redirect and returns null; the
   * redirect result is picked up by checkRedirectResult() after the page
   * reloads back from the provider.
   */
  async signInWithGoogle (): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    if ( this.isMobileDevice() ) {
      await signInWithRedirect( this.auth, provider );
      return null;
    }
    const result = await signInWithPopup( this.auth, provider );
    return result.user;
  }

  /**
   * Uses the same `apple.com` provider id the native iOS apps authenticate
   * through, so a person who already has an account from one platform
   * resolves to the same Firebase user on the other. Same popup/mobile-
   * redirect split as signInWithGoogle.
   */
  async signInWithApple (): Promise<User | null> {
    const provider = new OAuthProvider( 'apple.com' );
    provider.addScope( 'email' );
    provider.addScope( 'name' );

    if ( this.isMobileDevice() ) {
      await signInWithRedirect( this.auth, provider );
      return null;
    }
    const result = await signInWithPopup( this.auth, provider );
    return result.user;
  }

  /** Picks up the result of a mobile signInWithRedirect() call after the page reloads. */
  async checkRedirectResult (): Promise<User | null> {
    const result = await getRedirectResult( this.auth );
    return result?.user ?? null;
  }

  private readonly emailForSignInStorageKey = 'network_emailForSignIn';

  /** Sends a passwordless sign-in link, completed by FinishSignInComponent at /finish-sign-in. */
  async sendSignInLink ( email: string, returnUrl?: string ): Promise<void> {
    const actionCodeSettings: ActionCodeSettings = {
      url: `${window.location.origin}/finish-sign-in${returnUrl ? `?returnUrl=${encodeURIComponent( returnUrl )}` : ''}`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail( this.auth, email, actionCodeSettings );
    localStorage.setItem( this.emailForSignInStorageKey, email );
  }

  getStoredEmailForSignIn (): string {
    return localStorage.getItem( this.emailForSignInStorageKey ) || '';
  }

  clearStoredEmailForSignIn (): void {
    localStorage.removeItem( this.emailForSignInStorageKey );
  }

  isSignInLinkUrl ( url: string ): boolean {
    return isSignInWithEmailLink( this.auth, url );
  }

  async completeSignInWithEmailLink ( email: string, url: string ): Promise<User> {
    const result = await signInWithEmailLink( this.auth, email, url );
    return result.user;
  }

  async signOut (): Promise<void> {
    await signOut( this.auth );
  }

  /**
   * Same rule as `users.service.ts`'s `getTenantLoggedInContactInfo` /
   * Network-iOS's `AuthService.refreshTenantId` - not a guess.
   */
  async resolveTenantId ( uid: string ): Promise<string> {
    const snap = await getDoc( doc( getFirestore(), 'users', uid ) );
    const companyId = String( ( snap.data() as any )?.companyId || '' ).trim();
    return companyId || uid;
  }
}
