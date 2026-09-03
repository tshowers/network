import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkAuthService } from '../../services/network-auth.service';

/**
 * Rewritten to match TODD's real login.component.ts exactly: Google +
 * Apple + passwordless email link, not the Google+password pairing this
 * had before - see NetworkAuthService's header comment for why that
 * consistency matters here specifically. Email link is primary (matches
 * TODD's layout - the OAuth buttons are the "alternatives" below the
 * email form, not the other way around); dropped TODD's phone-recovery
 * fallback, marketing-consent checkbox, and invite-flow branching, none
 * of which apply to Network.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  view: 'form' | 'sent' = 'form';
  emailAddress = '';
  isSigningIn = false;
  errorMessage = '';

  private returnUrl = '/app';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: NetworkAuthService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';

    this.authService.getUser().subscribe( ( user ) => {
      if ( user ) this.router.navigateByUrl( this.returnUrl );
    } );

    // Picks up a mobile signInWithRedirect() result after the page reloads
    // back from Google/Apple - a no-op on every other page load.
    try {
      const user = await this.authService.checkRedirectResult();
      if ( user ) this.router.navigateByUrl( this.returnUrl );
    } catch ( error: any ) {
      this.errorMessage = this.describeAuthError( error, 'Sign-in' );
    }
  }

  async signInWithGoogle (): Promise<void> {
    await this.signInWithProvider( () => this.authService.signInWithGoogle(), 'Google' );
  }

  async signInWithApple (): Promise<void> {
    await this.signInWithProvider( () => this.authService.signInWithApple(), 'Apple' );
  }

  private async signInWithProvider ( signIn: () => Promise<unknown>, providerLabel: string ): Promise<void> {
    this.errorMessage = '';
    this.isSigningIn = true;
    try {
      const user = await signIn();
      // null means signInWithRedirect just started a full-page navigation
      // on mobile - nothing left to do here, the redirect result is
      // handled by ngOnInit on the page that loads next.
      if ( user ) this.router.navigateByUrl( this.returnUrl );
    } catch ( error: any ) {
      this.errorMessage = this.describeAuthError( error, providerLabel );
    } finally {
      this.isSigningIn = false;
    }
  }

  async sendSignInLink (): Promise<void> {
    const email = this.emailAddress.trim();
    if ( !email ) {
      this.errorMessage = 'Enter your email address.';
      return;
    }

    this.errorMessage = '';
    this.isSigningIn = true;
    try {
      await this.authService.sendSignInLink( email, this.returnUrl );
      this.view = 'sent';
    } catch ( error: any ) {
      this.errorMessage = this.describeAuthError( error, 'Email link' );
    } finally {
      this.isSigningIn = false;
    }
  }

  resendLink (): void {
    this.view = 'form';
  }

  private describeAuthError ( error: any, providerLabel: string ): string {
    const code = error?.code || '';

    if ( code === 'auth/popup-closed-by-user' ) return `${providerLabel} sign-in popup was closed before sign-in completed.`;
    if ( code === 'auth/popup-blocked' ) return `Your browser blocked the ${providerLabel} sign-in popup.`;
    if ( code === 'auth/unauthorized-domain' ) return `This domain is not authorized for ${providerLabel} sign-in.`;
    if ( code === 'auth/operation-not-allowed' ) return `${providerLabel} sign-in is not enabled for this account.`;
    if ( code === 'auth/network-request-failed' ) return `A network error interrupted ${providerLabel} sign-in.`;
    if ( code ) return `${providerLabel} sign-in failed (${code}). Please try again.`;

    return error?.message || `${providerLabel} sign-in failed. Please try again.`;
  }
}
