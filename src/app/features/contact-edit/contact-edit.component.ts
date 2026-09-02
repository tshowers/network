import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkContactAccessService } from '../../services/network-contact-access.service';
import { NetworkContactPackService } from '../../services/network-contact-pack.service';
import { NetworkNotificationService } from '../../services/network-notification.service';
import { Contact, EmailAddress, PhoneNumber } from '../../models/contact.model';
import { StatusFlowComponent } from '../../shared/status-flow/status-flow.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

/**
 * A ground-up rewrite of the create/edit surface, not a trim of
 * create.component.ts (1,336 lines) + ContactUpdateLongFormComponent
 * (382 lines). The long-form's complexity is almost entirely two
 * subsystems already dropped elsewhere in this port: per-field visibility
 * toggles read from tenant Settings (isContactFieldEnabled for 25+
 * fields), and admin-configurable dropdown option lists fetched from
 * Firestore (STATES/SECTORS/PHONE_TYPES/CATEGORIES/... via
 * DataService.getDropdownData). Neither trims to something smaller - the
 * form fields ARE that system's output. So this ships a fixed, curated
 * field set with plain inputs and hardcoded option lists instead, the
 * same call already made for list.component.ts.
 *
 * Kept for real: create vs. edit detection (query param ?id, or a contact
 * already sitting in NetworkContactStateService from the list/view page),
 * the free-tier contact-limit gate before allowing a new contact
 * (NetworkContactAccessService + NetworkContactPackService's upgrade
 * checkout prompt - this is a real paid-plan boundary, not decoration),
 * add/remove repeating email and phone rows, and save via
 * addContact/updateContact.
 *
 * Dropped: Google Places address autocomplete (ContactMapComponent's
 * Google Maps dependency was already avoided the same way), NAICS
 * industry-code lookup, social media rows, notes, images, draft
 * auto-persistence while typing.
 */
@Component( {
  selector: 'app-contact-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusFlowComponent, BackToTopComponent, PreloaderComponent],
  templateUrl: './contact-edit.component.html',
  styleUrl: './contact-edit.component.css',
} )
export class ContactEditComponent implements OnInit {
  contact: Contact = this.buildEmptyContact();
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  limitMessage = '';

  private tenantId = '';
  private userId = '';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private contactState: NetworkContactStateService,
    private accessService: NetworkContactAccessService,
    private contactPackService: NetworkContactPackService,
    private notificationService: NetworkNotificationService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Contact Edit` );

    const queryId = this.route.snapshot.queryParamMap.get( 'id' );
    const cached = this.contactState.currentContact;

    this.userId = this.authService.getCurrentUserIdSync();
    this.tenantId = this.userId ? await this.authService.resolveTenantId( this.userId ) : '';

    if ( queryId && this.tenantId ) {
      const existing = await this.dataService.getContact( this.tenantId, queryId );
      if ( existing ) this.contact = existing;
    } else if ( cached?.id ) {
      this.contact = cached;
    }

    this.ensureCompany();
    this.ensureAtLeastOneRow();
    await this.refreshLimitMessage();
    this.isLoading = false;
  }

  private buildEmptyContact (): Contact {
    return {
      id: '',
      firstName: '',
      middleName: '',
      lastName: '',
      profession: '',
      important: false,
      status: '',
      category: '',
      company: { name: '', url: '' },
      emailAddresses: [],
      phoneNumbers: [],
      addresses: [{ streetAddress: '', city: '', state: '', zip: '' }],
    };
  }

  private ensureCompany (): void {
    if ( !this.contact.company ) this.contact.company = { name: '', url: '' };
  }

  private ensureAtLeastOneRow (): void {
    if ( !this.contact.addresses?.length ) this.contact.addresses = [{ streetAddress: '', city: '', state: '', zip: '' }];
  }

  private async refreshLimitMessage (): Promise<void> {
    if ( this.contact.id ) {
      this.limitMessage = '';
      return;
    }

    const state = await this.accessService.getAccessState();
    if ( state.isPaidUser ) {
      this.limitMessage = '';
    } else if ( state.remainingFreeContacts <= 0 ) {
      this.limitMessage = 'You have used all of your free contacts. Upgrade to keep adding people.';
    } else {
      this.limitMessage = `${state.remainingFreeContacts} of ${state.contactLimit} free contacts left`;
    }
  }

  addEmail (): void {
    this.contact.emailAddresses = this.contact.emailAddresses || [];
    this.contact.emailAddresses.push( { emailAddress: '', emailAddressType: 'Work' } );
  }

  removeEmail ( index: number ): void {
    this.contact.emailAddresses?.splice( index, 1 );
  }

  addPhone (): void {
    this.contact.phoneNumbers = this.contact.phoneNumbers || [];
    this.contact.phoneNumbers.push( { phoneNumber: '', phoneNumberType: 'Work' } );
  }

  removePhone ( index: number ): void {
    this.contact.phoneNumbers?.splice( index, 1 );
  }

  onStatusChange ( status: string ): void {
    this.contact.status = status;
  }

  async onSubmit (): Promise<void> {
    if ( !this.userId || !this.tenantId ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to save contacts to your network.', 'info' );
      return;
    }

    if ( !this.contact.firstName?.trim() && !this.contact.company?.name?.trim() ) {
      this.errorMessage = 'Add at least a first name or a company name.';
      return;
    }

    const isNewContact = !this.contact.id;

    if ( isNewContact ) {
      const state = await this.accessService.getAccessState();
      if ( !state.canAddContact ) {
        try {
          const startedCheckout = await this.contactPackService.promptAndStartCheckout();
          if ( !startedCheckout ) {
            this.notificationService.show( 'Contact Limit Reached', this.contactPackService.upgradePromptMessage.replace( '\n', ' ' ), 'info' );
          }
        } catch ( error: any ) {
          this.notificationService.show( 'Contact Limit Reached', error?.message || this.contactPackService.limitErrorMessage, 'error' );
        }
        return;
      }
    }

    this.isSaving = true;
    this.errorMessage = '';

    try {
      const cleaned = this.sanitizeContact();

      if ( isNewContact ) {
        const id = await this.dataService.addContact( this.tenantId, cleaned );
        this.notificationService.show( 'Added', `${this.contact.firstName} ${this.contact.lastName}`.trim() + ' is now in Network.', 'success' );
        this.router.navigate( ['/contact', id] );
      } else {
        await this.dataService.updateContact( this.tenantId, this.contact.id, cleaned );
        this.notificationService.show( 'Updated', `${this.contact.firstName} ${this.contact.lastName}`.trim() + ' was updated.', 'success' );
        this.router.navigate( ['/contact', this.contact.id] );
      }
    } catch ( error ) {
      this.errorMessage = 'Unable to save this contact. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  onCancel (): void {
    this.router.navigate( this.contact.id ? ['/contact', this.contact.id] : ['/contact-list'] );
  }

  private sanitizeContact (): Partial<Contact> {
    const emailAddresses = ( this.contact.emailAddresses || [] ).filter( ( e: EmailAddress ) => e.emailAddress?.trim() );
    const phoneNumbers = ( this.contact.phoneNumbers || [] ).filter( ( p: PhoneNumber ) => p.phoneNumber?.trim() );
    const addresses = ( this.contact.addresses || [] ).filter( ( a ) =>
      a.streetAddress?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() );

    return {
      ...this.contact,
      emailAddresses,
      phoneNumbers,
      addresses,
    };
  }
}
