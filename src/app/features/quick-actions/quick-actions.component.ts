import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';

import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkNotificationService } from '../../services/network-notification.service';
import { QuickActionCardComponent } from '../../shared/quick-action-card/quick-action-card.component';
import { RecentItemsListComponent, RecentListItem } from '../../shared/recent-items-list/recent-items-list.component';

/**
 * Ported from features/contact/network-quick-actions/network-quick-actions.component.ts.
 * Logic is unchanged; only the service calls are rewritten against
 * NetworkAuthService/NetworkDataService/NetworkNotificationService instead
 * of TODD's AuthService/DataService/NotificationService.
 */
@Component( {
  selector: 'app-network-quick-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, QuickActionCardComponent, RecentItemsListComponent],
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.css'
} )
export class QuickActionsComponent implements OnInit, OnDestroy {
  firstName = '';
  lastName = '';
  companyName = '';

  isSubmitting = false;
  errorMessage = '';

  recentContacts: RecentListItem[] = [];
  isLoadingRecent = false;

  private tenantId = '';
  private authSubscription?: Subscription;

  constructor (
    private readonly authService: NetworkAuthService,
    private readonly dataService: NetworkDataService,
    private readonly notificationService: NetworkNotificationService
  ) { }

  ngOnInit (): void {
    this.authSubscription = combineLatest( [this.authService.getUserId(), this.authService.getTenantId()] )
      .subscribe( ( [userId, tenantId] ) => {
        this.tenantId = userId ? tenantId : '';
        if ( this.tenantId ) {
          this.loadRecentContacts();
        }
      } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  private async loadRecentContacts (): Promise<void> {
    this.isLoadingRecent = true;
    try {
      const contacts = await this.dataService.getRecentContacts( this.tenantId, 5 );
      this.recentContacts = ( contacts || [] ).map( ( contact: any ) => ( {
        id: contact.id,
        primaryText: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'Unnamed contact',
        secondaryText: contact.company?.name || '',
        routerLink: ['/contact', contact.id]
      } ) );
    } catch {
      this.recentContacts = [];
    } finally {
      this.isLoadingRecent = false;
    }
  }

  async addContact (): Promise<void> {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();

    if ( !firstName ) {
      this.errorMessage = 'Add at least a first name to create the contact.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      await this.dataService.addContact( this.tenantId, {
        firstName,
        lastName,
        company: { name: this.companyName.trim() },
        emailAddresses: [],
        phoneNumbers: [],
        profileTypes: [],
        addresses: [],
        notes: [],
        id: ''
      } );

      this.notificationService.show( 'Contact added', `${firstName} ${lastName}`.trim() + ' is now in Network.', 'success' );
      this.firstName = '';
      this.lastName = '';
      this.companyName = '';
      await this.loadRecentContacts();
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Unable to add this contact. Please try again.';
      this.notificationService.show( 'Add contact failed', this.errorMessage, 'error' );
    } finally {
      this.isSubmitting = false;
    }
  }
}
