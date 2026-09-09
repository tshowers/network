import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TabBarComponent, TabBarItem } from '../tab-bar/tab-bar.component';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkAuthService } from '../../services/network-auth.service';
import { Subscription } from 'rxjs';

/**
 * The only nav any inner page (contact-edit, csv-import, pipeline,
 * contact-list, contact view) had was a "Cancel"/"Back" link buried in
 * its own footer, if that - there was no consistent way to get from one
 * to another, or back to the dashboard, without editing the URL by hand.
 * contact-home already has this exact link set wired into its
 * cockpit-command-deck via app-tab-bar; this just makes the same bar
 * (and the same underlying component) available to every other page,
 * so the app has one navigation surface instead of each page inventing
 * its own way out.
 *
 * Deliberately points "Home" at /app, not contact-home's own choice of
 * '/' - contact-home IS the dashboard, so '/' there is a real "leave the
 * app" exit to the marketing site. Every other page here is one level
 * below the dashboard, so "Home" should return to it, not eject to
 * marketing.
 */
@Component( {
  selector: 'app-primary-nav',
  standalone: true,
  imports: [TabBarComponent],
  templateUrl: './primary-nav.component.html',
  styleUrl: './primary-nav.component.css',
} )
export class PrimaryNavComponent implements OnInit, OnDestroy {
  tabs: TabBarItem[] = [];
  private authSubscription?: Subscription;

  private buildTabs (isLoggedIn: boolean): TabBarItem[] {
    return [
    { id: 'home', label: 'Home', icon: 'house', routerLink: '/app' },
    { id: 'contacts', label: 'Contact List', icon: 'address-book', routerLink: '/contact-list' },
    { id: 'import', label: 'Import Contacts', icon: 'file-import', routerLink: '/contact-import' },
    { id: 'pipeline', label: 'Pipeline', icon: 'diagram-project', routerLink: '/contact-deal-flow-dashboard' },
    { id: 'add', label: 'Add Contact', icon: 'user-plus', action: () => this.addContact() },
    ...(isLoggedIn ? [{ id: 'logout', label: 'Log out', icon: 'right-from-bracket', action: () => void this.logOut() }] : []),
    ];
  }

  constructor (
    private router: Router,
    private contactState: NetworkContactStateService,
    private authService: NetworkAuthService,
  ) { }

  ngOnInit (): void {
    this.authSubscription = this.authService.isLoggedIn().subscribe( isLoggedIn => {
      this.tabs = this.buildTabs( isLoggedIn );
    } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  private addContact (): void {
    this.contactState.resetContact();
    this.router.navigate( ['/contact-edit'] );
  }

  private async logOut (): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate( ['/'] );
  }
}
