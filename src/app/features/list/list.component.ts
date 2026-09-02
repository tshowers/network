import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription, combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { Contact } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

/**
 * A ground-up rewrite, not a trim of features/contact/list/list.component.ts
 * (2,465 lines). That original isn't "a table with some extras" - its own
 * import list alone pulls in ~30 dependencies (contact-search's 783-line AI
 * query parser, three alternate view modes - rolodex/persona-card/
 * horizontal-scroll, cockpit automation-activity lights, guided hot/due/
 * VIP/subscriber sections, CSV export, inline note and edit modals) whose
 * combined weight is bigger than every other page ported so far combined.
 * Every one of those is a real, standalone feature - not something to trim
 * piecemeal the way read.component.ts's LinkedIn import or view.component's
 * Signal Engine tab could be cleanly lifted out.
 *
 * What this delivers instead: the actual job of a contact list - browse
 * every contact, search by name/company/email, open one, delete one.
 * Sorting, alternate view modes, CSV export, and inline editing are
 * deferred, not ported thin.
 */
@Component( {
  selector: 'app-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackToTopComponent, PreloaderComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.css',
} )
export class ListComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  filteredContacts: Contact[] = [];
  searchText = '';
  isLoading = true;
  errorMessage = '';
  /** null = auth state not resolved yet (still show the preloader); false = resolved and signed out. */
  isSignedIn: boolean | null = null;

  private tenantId = '';
  private authSubscription?: Subscription;

  constructor (
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private contactState: NetworkContactStateService,
  ) { }

  ngOnInit (): void {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Contacts` );

    this.authSubscription = combineLatest( [this.authService.getUserId(), this.authService.getTenantId()] )
      .subscribe( ( [userId, tenantId] ) => {
        this.isSignedIn = !!userId;

        if ( !userId ) {
          // Resolved and signed out - stop spinning instead of waiting on a
          // loadContacts() call that will never come.
          this.isLoading = false;
          return;
        }

        if ( tenantId && tenantId !== this.tenantId ) {
          this.tenantId = tenantId;
          this.loadContacts();
        }
      } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  private async loadContacts (): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.contacts = await this.dataService.getAllContacts( this.tenantId );
      this.applyFilter();
    } catch ( error ) {
      this.errorMessage = 'Unable to load contacts.';
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter (): void {
    const term = this.searchText.trim().toLowerCase();

    if ( !term ) {
      this.filteredContacts = this.contacts;
      return;
    }

    this.filteredContacts = this.contacts.filter( ( contact ) => {
      const haystack = [
        contact.firstName,
        contact.lastName,
        contact.company?.name,
        contact.profession,
        ...( contact.emailAddresses || [] ).map( ( e ) => e.emailAddress ),
      ]
        .filter( Boolean )
        .join( ' ' )
        .toLowerCase();

      return haystack.includes( term );
    } );
  }

  displayName ( contact: Contact ): string {
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    return name || contact.company?.name || 'Unnamed contact';
  }

  primaryEmail ( contact: Contact ): string {
    return contact.emailAddresses?.[0]?.emailAddress || '';
  }

  primaryPhone ( contact: Contact ): string {
    return contact.phoneNumbers?.[0]?.phoneNumber || '';
  }

  openContact ( contact: Contact ): void {
    if ( contact.id ) {
      this.router.navigate( ['/contact', contact.id] );
    }
  }

  addContact (): void {
    this.contactState.resetContact();
    this.router.navigate( ['/contact-edit'] );
  }

  async deleteContact ( event: Event, contact: Contact ): Promise<void> {
    event.stopPropagation();
    if ( !contact.id ) return;

    const confirmation = confirm( `Delete ${this.displayName( contact )}?` );
    if ( !confirmation ) return;

    try {
      await this.dataService.deleteContact( this.tenantId, contact.id );
      this.contacts = this.contacts.filter( ( c ) => c.id !== contact.id );
      this.applyFilter();
    } catch ( error ) {
      this.errorMessage = 'Unable to delete that contact.';
    }
  }
}
