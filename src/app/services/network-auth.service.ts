import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Observable } from 'rxjs';

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
 */
@Injectable( { providedIn: 'root' } )
export class NetworkAuthService {
  private get auth (): Auth {
    return getAuth();
  }

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onAuthStateChanged( this.auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
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

  async signInWithGoogle (): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup( this.auth, provider );
    return result.user;
  }

  async signInWithEmail ( email: string, password: string ): Promise<User> {
    const result = await signInWithEmailAndPassword( this.auth, email, password );
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
