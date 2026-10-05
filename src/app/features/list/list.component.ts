import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription, combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkAssistantSignalService } from '../../services/network-assistant-signal.service';
import { Contact } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { StatusFlowComponent } from '../../shared/status-flow/status-flow.component';
import { stageTint } from '../../shared/stage-tint';

type ContactSortKey = 'name' | 'company' | 'email' | 'phone' | 'status';
type SortDirection = 'asc' | 'desc';

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
  imports: [CommonModule, FormsModule, RouterModule, BackToTopComponent, PreloaderComponent, StatusFlowComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.css',
} )
export class ListComponent implements OnInit, OnDestroy {
  readonly tint = stageTint;

  contacts: Contact[] = [];
  filteredContacts: Contact[] = [];
  searchText = '';
  isLoading = true;
  errorMessage = '';
  sortKey: ContactSortKey = 'name';
  sortDirection: SortDirection = 'asc';
  /** null = auth state not resolved yet (still show the preloader); false = resolved and signed out. */
  isSignedIn: boolean | null = null;
  currentUserId = '';
  /** Arrived from Getting Started's "Give relationships a stage"
   * (/contact-list?setStage=1): show a hint and list unstaged contacts first. */
  setStageMode = false;
  /** The row whose stage list is open, and the one just saved. */
  stagePickerFor = '';
  stageSavedFor = '';
  stageErrorFor = '';

  private tenantId = '';
  private authSubscription?: Subscription;

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private contactState: NetworkContactStateService,
    private assistantBus: NetworkAssistantSignalService,
  ) { }

  ngOnInit (): void {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Contacts` );
    this.setStageMode = this.route.snapshot.queryParamMap.get( 'setStage' ) === '1';

    this.authSubscription = combineLatest( [this.authService.getUserId(), this.authService.getTenantId()] )
      .subscribe( ( [userId, tenantId] ) => {
        this.isSignedIn = !!userId;
        this.currentUserId = userId || '';

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
    this.assistantBus.clearPageContext();
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

    const matches = !term ? this.contacts : this.contacts.filter( ( contact ) => {
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

    this.filteredContacts = [...matches].sort( ( a, b ) => this.compareContacts( a, b ) );
    if ( this.setStageMode ) {
      // Contacts still needing a stage first (stable within each group).
      this.filteredContacts = [
        ...this.filteredContacts.filter( ( contact ) => !contact.status?.trim() ),
        ...this.filteredContacts.filter( ( contact ) => !!contact.status?.trim() ),
      ];
    }
    this.publishAssistantContext();
  }

  private publishAssistantContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'contact-list',
      page: 'contact-list',
      mode: 'list',
      title: 'Contact List',
      summary: {
        totalContacts: this.contacts.length,
        filteredCount: this.filteredContacts.length,
        searchText: this.searchText.trim(),
      },
    } );
  }

  sortBy ( key: ContactSortKey ): void {
    if ( this.sortKey === key ) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }

    this.filteredContacts = [...this.filteredContacts].sort( ( a, b ) => this.compareContacts( a, b ) );
  }

  sortIndicator ( key: ContactSortKey ): string {
    if ( this.sortKey !== key ) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  private compareContacts ( first: Contact, second: Contact ): number {
    const firstValue = this.sortValue( first, this.sortKey );
    const secondValue = this.sortValue( second, this.sortKey );
    const comparison = firstValue.localeCompare( secondValue, undefined, { sensitivity: 'base', numeric: true } );
    return this.sortDirection === 'asc' ? comparison : -comparison;
  }

  private sortValue ( contact: Contact, key: ContactSortKey ): string {
    switch ( key ) {
      case 'company': return contact.company?.name || '';
      case 'email': return this.primaryEmail( contact );
      case 'phone': return this.primaryPhone( contact );
      case 'status': return contact.status || '';
      case 'name':
      default: return this.displayName( contact );
    }
  }

  /** The signed-in user's own contact record (its id is their uid) - shown
   * with a "(You)" tag, the same cue TODD's contact list gives. */
  isSelf ( contact: Contact ): boolean {
    return !!this.currentUserId && ( contact as any ).id === this.currentUserId;
  }

  toggleStagePicker ( event: Event, contact: Contact ): void {
    event.stopPropagation();
    const id = ( contact as any ).id as string;
    this.stagePickerFor = this.stagePickerFor === id ? '' : id;
  }

  /** Saves a stage straight from the list - no trip through the edit page. */
  async saveStage ( contact: Contact, status: string ): Promise<void> {
    const id = ( contact as any ).id as string;
    const previous = contact.status;
    contact.status = status;
    this.stagePickerFor = '';
    this.stageErrorFor = '';
    try {
      await this.dataService.updateContact( this.tenantId, id, { status } );
      this.stageSavedFor = id;
      setTimeout( () => { if ( this.stageSavedFor === id ) this.stageSavedFor = ''; }, 2000 );
    } catch {
      contact.status = previous;
      this.stageErrorFor = id;
    }
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
