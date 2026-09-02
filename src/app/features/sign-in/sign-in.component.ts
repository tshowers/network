import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NetworkAuthService } from '../../services/network-auth.service';

/**
 * There was no sign-in surface anywhere in this app until now - every
 * "Sign in" link (contact-home's browse-mode banner, network-pricing's
 * login callout) pointed at /login with nothing there to catch it.
 * NetworkAuthService already had signInWithGoogle/signInWithEmail from
 * the very first commit; this is the first page that actually calls them.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  email = '';
  password = '';
  isSigningIn = false;
  errorMessage = '';
  private returnUrl = '/app';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: NetworkAuthService,
  ) { }

  ngOnInit (): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';

    this.authService.getUser().subscribe( ( user ) => {
      if ( user ) {
        this.router.navigateByUrl( this.returnUrl );
      }
    } );
  }

  async signInWithGoogle (): Promise<void> {
    this.errorMessage = '';
    this.isSigningIn = true;
    try {
      await this.authService.signInWithGoogle();
      this.router.navigateByUrl( this.returnUrl );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Unable to sign in with Google.';
    } finally {
      this.isSigningIn = false;
    }
  }

  async signInWithEmail (): Promise<void> {
    if ( !this.email.trim() || !this.password ) {
      this.errorMessage = 'Enter your email and password.';
      return;
    }

    this.errorMessage = '';
    this.isSigningIn = true;
    try {
      await this.authService.signInWithEmail( this.email.trim(), this.password );
      this.router.navigateByUrl( this.returnUrl );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Unable to sign in.';
    } finally {
      this.isSigningIn = false;
    }
  }
}
