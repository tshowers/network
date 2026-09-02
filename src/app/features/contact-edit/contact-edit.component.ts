import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
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
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { ReadComponent } from '../read/read.component';

interface WizardStep {
  key: string;
  label: string;
  heading: string;
}

/**
 * Rewritten as a real step wizard with a live preview pane, matching what
 * create.component.ts (1,336 lines) + ContactUpdateLongFormComponent
 * (382 lines) actually deliver - the flat single-page form this replaced
 * undersold it. The wizard mechanic itself (numbered stepper, Previous/
 * Next, a live-updating card preview via the same ReadComponent embedded
 * in read-only mode, Regular View/Raw JSON tabs, a "Missing Information"
 * banner) is kept faithfully; what's still simplified is the field set
 * within each step and the browse-mode banner is displayed for it too.
 *
 * Dropped, same as before: per-field visibility toggles and
 * admin-configurable dropdown option lists (two subsystems, not
 * decoration - see the git history for the flat-form version this
 * replaced), Google Places address autocomplete, NAICS lookup, social
 * media rows, DBA/employee-count/projects company fields, timezone,
 * business type, anniversary, contact value, subscriber flag, draft
 * auto-persistence while typing. Kept: create-vs-edit detection, the
 * free-tier contact-limit gate, add/remove repeating email and phone
 * rows, per-step required-field validation for first/last name.
 */
@Component( {
  selector: 'app-contact-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatusFlowComponent,
    BackToTopComponent,
    PreloaderComponent,
    CockpitBrowseModeBannerComponent,
    ReadComponent,
  ],
  templateUrl: './contact-edit.component.html',
  styleUrl: './contact-edit.component.css',
} )
export class ContactEditComponent implements OnInit {
  readonly steps: WizardStep[] = [
    { key: 'firstName', label: 'First Name', heading: 'Name' },
    { key: 'middleName', label: 'Middle Name', heading: 'Name' },
    { key: 'lastName', label: 'Last Name', heading: 'Name' },
    { key: 'company', label: 'Company', heading: 'Company' },
    { key: 'category', label: 'Category', heading: 'Tags' },
    { key: 'status', label: 'Status', heading: 'State' },
    { key: 'profession', label: 'Profession', heading: 'Professional' },
    { key: 'email', label: 'Email', heading: 'Email' },
    { key: 'phone', label: 'Phone', heading: 'Phone' },
    { key: 'address', label: 'Address', heading: 'Address' },
    { key: 'nickname', label: 'Nickname', heading: 'Name' },
    { key: 'birthday', label: 'Birthday', heading: 'Birthday' },
    { key: 'gender', label: 'Gender', heading: 'Identification' },
  ];

  currentStep = 0;
  activeTab: 'read' | 'json' = 'read';

  contact: Contact = this.buildEmptyContact();
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  limitMessage = '';
  missingMessage = '';
  isSignedIn = false;

  private tenantId = '';
  userId = '';

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

    // Wait for the real, resolved auth state (getUserId's first emission)
    // rather than reading Auth.currentUser synchronously - on a fresh page
    // load that can return empty for a split second before Firebase
    // finishes restoring a signed-in session, which would incorrectly show
    // "not signed in" and block a real user from adding a contact.
    const userId = await firstValueFrom( this.authService.getUserId() );
    this.userId = userId || '';
    this.isSignedIn = !!userId;
    this.tenantId = this.userId ? await this.authService.resolveTenantId( this.userId ) : '';

    if ( queryId && this.tenantId ) {
      const existing = await this.dataService.getContact( this.tenantId, queryId );
      if ( existing ) this.contact = existing;
    } else if ( cached?.id ) {
      this.contact = cached;
    }

    this.ensureCompany();
    this.ensureAtLeastOneRow();
    if ( this.isSignedIn ) await this.refreshLimitMessage();
    this.refreshMissingMessage();
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

  /** Mirrors ContactService.getMissingInfo. */
  private refreshMissingMessage (): void {
    const missing: string[] = [];
    if ( !this.contact.firstName ) missing.push( 'first name' );
    if ( !this.contact.lastName ) missing.push( 'last name' );
    if ( !this.contact.company?.name ) missing.push( 'company name' );
    if ( !this.contact.phoneNumbers?.length ) missing.push( 'phone number' );
    if ( !this.contact.emailAddresses?.length ) missing.push( 'email address' );

    this.missingMessage = missing.length
      ? `The contact is missing the following information: ${missing.join( ', ' )}.`
      : '';
  }

  get currentStepKey (): string {
    return this.steps[this.currentStep]?.key || '';
  }

  get isLastStep (): boolean {
    return this.currentStep >= this.steps.length - 1;
  }

  get isFirstStepValid (): boolean {
    return this.currentStepKey !== 'firstName' || !!this.contact.firstName?.trim();
  }

  get isLastNameStepValid (): boolean {
    return this.currentStepKey !== 'lastName' || !!this.contact.lastName?.trim();
  }

  get canAdvance (): boolean {
    return this.isFirstStepValid && this.isLastNameStepValid;
  }

  nextStep (): void {
    this.refreshMissingMessage();
    if ( !this.canAdvance ) return;
    if ( this.currentStep < this.steps.length - 1 ) this.currentStep++;
  }

  previousStep (): void {
    if ( this.currentStep > 0 ) this.currentStep--;
  }

  addEmail (): void {
    this.contact.emailAddresses = this.contact.emailAddresses || [];
    this.contact.emailAddresses.push( { emailAddress: '', emailAddressType: 'Work' } );
  }

  removeEmail ( index: number ): void {
    this.contact.emailAddresses?.splice( index, 1 );
    this.refreshMissingMessage();
  }

  addPhone (): void {
    this.contact.phoneNumbers = this.contact.phoneNumbers || [];
    this.contact.phoneNumbers.push( { phoneNumber: '', phoneNumberType: 'Work' } );
  }

  removePhone ( index: number ): void {
    this.contact.phoneNumbers?.splice( index, 1 );
    this.refreshMissingMessage();
  }

  onStatusChange ( status: string ): void {
    this.contact.status = status;
  }

  async onSubmit (): Promise<void> {
    this.refreshMissingMessage();

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
