import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NetworkAuthService } from '../../services/network-auth.service';

/**
 * Sign-in for Network no longer happens natively in this app - it
 * redirects to TODD's hosted login (todd.taliferro.tech/login, the same
 * page network-ios/pulse-ios open via TODDAuthKit's HostedLogin) instead
 * of rendering its own Google/Apple/email-link buttons. See
 * NetworkAuthService.signIn() for the handoff.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  isSigningIn = false;

  private returnUrl = '/app';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: NetworkAuthService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';
    if ( await firstValueFrom( this.authService.isLoggedIn() ) ) {
      await this.router.navigateByUrl( this.returnUrl );
      return;
    }
    // /login is a compatibility handoff route. Send visitors directly to
    // TODD's shared hosted login instead of making them click twice.
    // Let Angular commit the compatibility shell before leaving the app.
    // Besides avoiding a blank flash for real visitors, this keeps the
    // handoff observable to smoke tests and assistive technology.
    setTimeout( () => this.signIn(), 100 );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
