import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkAuthService } from '../../services/network-auth.service';

/**
 * Ported from features/security/finish-sign-in/finish-sign-in.component.ts,
 * trimmed of AuthFlowService/MarketingFunnelService/AffiliateTrackingService
 * and the invite-context branching - none of that applies here. What's
 * kept: the actual completion mechanic (read the email stashed in
 * localStorage when the link was sent, complete
 * signInWithEmailLink, and handle the case where the link was opened in a
 * different browser than the one that requested it, which has no stored
 * email and needs the user to type it back in).
 */
@Component( {
  selector: 'app-finish-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finish-sign-in.component.html',
  styleUrl: './finish-sign-in.component.css',
} )
export class FinishSignInComponent implements OnInit {
  status: 'working' | 'needs-email' | 'error' = 'working';
  emailAddress = '';
  errorMessage = '';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: NetworkAuthService,
  ) { }

  ngOnInit (): void {
    const storedEmail = this.authService.getStoredEmailForSignIn();
    if ( storedEmail ) {
      this.emailAddress = storedEmail;
      void this.completeSignIn();
    } else {
      this.status = 'needs-email';
    }
  }

  async completeSignIn (): Promise<void> {
    const email = this.emailAddress.trim();
    const url = window.location.href;

    if ( !email ) {
      this.status = 'needs-email';
      this.errorMessage = 'Enter the email address you used to request this link.';
      return;
    }

    if ( !this.authService.isSignInLinkUrl( url ) ) {
      this.status = 'error';
      this.errorMessage = 'This sign-in link is invalid or has expired. Request a new one.';
      return;
    }

    this.status = 'working';
    try {
      await this.authService.completeSignInWithEmailLink( email, url );
      this.authService.clearStoredEmailForSignIn();
      const returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';
      this.router.navigateByUrl( returnUrl );
    } catch ( error: any ) {
      this.status = 'error';
      this.errorMessage = this.describeCompletionError( error );
    }
  }

  private describeCompletionError ( error: any ): string {
    const code = error?.code || '';

    if ( code === 'auth/invalid-action-code' || code === 'auth/expired-action-code' ) {
      return 'This link has expired or has already been used. Request a new one.';
    }
    if ( code === 'auth/invalid-email' ) {
      return 'That email doesn\'t match the address this link was sent to.';
    }

    return error?.message || 'This sign-in link is invalid or has expired. Request a new one.';
  }

  goToSignIn (): void {
    this.router.navigate( ['/login'] );
  }
}
