import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import * as Papa from 'papaparse';

import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkContactAccessService, ContactAccessState } from '../../services/network-contact-access.service';
import { NetworkContactPackService } from '../../services/network-contact-pack.service';
import { NetworkNotificationService } from '../../services/network-notification.service';
import { NetworkAssistantSignalService } from '../../services/network-assistant-signal.service';
import { SoundService } from '../../services/sound.service';
import { Contact, PhoneNumber, EmailAddress } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { RouterLink } from '@angular/router';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { EXPECTED_FIELDS, FieldMatchComponent, matchCsvHeaders } from '../../shared/field-match/field-match.component';
import { NetworkOnboardingService } from '../../services/network-onboarding.service';
import { NetworkImportService } from '../../services/network-import.service';

type ImportStep = 'upload' | 'preview' | 'map' | 'result';

/** 12 people to try Network with, tagged "Sample" so they're easy to find and delete. */
const SAMPLE_FILE = 'assets/sample-contacts.csv';

/**
 * Ported from features/contact/csv-import/csv-import.component.ts (1,470
 * lines), trimmed the same way contact-edit and read were: dropped
 * TopDogComponent, ToddAssistantBusService, PageActionsService, TipService,
 * CacheService, and the Outreach campaign-return redirect (all TODD-wide
 * subsystems this standalone app doesn't carry, or - for the campaign
 * link - reference a module that doesn't exist here). Kept: the actual
 * import mechanics (upload, field mapping, mapped-data preview, transform,
 * write) and the real free-tier contact-limit gate via
 * NetworkContactAccessService/NetworkContactPackService, since those are
 * already ported and this is genuine product behavior, not TODD-wide
 * scaffolding. NetworkDataService.uploadData didn't exist (Network's data
 * layer only had single-contact addContact) so this adds
 * NetworkDataService.uploadContacts alongside it, batched, add-only - no
 * merge/dedupe against existing contacts like TODD's original.
 *
 * One confirm step (design_handoff_network_onboarding 03): columns are
 * matched automatically and shown as a preview; the mapper only opens when
 * the user asks to change them or no email column was found.
 */
@Component( {
  selector: 'app-csv-import',
  standalone: true,
  imports: [
    WriteActionDirective,
    CommonModule,
    FormsModule,
    BackToTopComponent,
    PreloaderComponent,
    FieldMatchComponent,
    RouterLink,
  ],
  templateUrl: './csv-import.component.html',
  styleUrl: './csv-import.component.css',
} )
export class CsvImportComponent implements OnInit, OnDestroy {
  step: ImportStep = 'upload';
  isSignedIn = false;
  isLoading = true;
  processing = false;
  message = '';

  csvData: any[] = [];
  csvHeaders: string[] = [];
  fieldMapping: Record<string, string> = {};
  mappedData: any[] = [];
  contacts: Partial<Contact>[] = [];

  importCompleted = false;
  lastImportSuccessCount = 0;
  lastImportFailureCount = 0;

  /** Mapped columns as the preview's tags, and the columns left out. */
  matchedLabels: string[] = [];
  skippedHeaders: string[] = [];

  accessState: ContactAccessState | null = null;

  private tenantId = '';

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    private onboarding: NetworkOnboardingService,
    private importService: NetworkImportService,
    private titleService: Title,
    private http: HttpClient,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private accessService: NetworkContactAccessService,
    private contactPackService: NetworkContactPackService,
    private notificationService: NetworkNotificationService,
    private soundService: SoundService,
    private assistantBus: NetworkAssistantSignalService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Import` );

    const userId = await this.firstUserId();
    this.isSignedIn = !!userId;
    this.tenantId = userId ? await this.authService.resolveTenantId( userId ) : '';

    if ( this.isSignedIn ) {
      await this.refreshAccessState();
    }

    this.isLoading = false;
    this.publishAssistantContext();
    if ( this.route.snapshot.queryParamMap.get( 'sample' ) ) this.importSample();
  }

  ngOnDestroy (): void {
    this.assistantBus.clearPageContext();
  }

  private publishAssistantContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'contact-import',
      page: 'contact-import',
      mode: this.step === 'result' ? 'view' : 'create',
      title: 'Import Contacts',
      summary: {
        currentStep: this.step,
        processing: this.processing,
        importCompleted: this.importCompleted,
        csvRowCount: this.csvData.length,
        mappedRowCount: this.mappedData.length,
        contactCount: this.contacts.length,
        successCount: this.lastImportSuccessCount,
        failureCount: this.lastImportFailureCount,
      },
    } );
  }

  private firstUserId (): Promise<string> {
    return new Promise( ( resolve ) => {
      const sub = this.authService.getUserId().subscribe( ( uid ) => {
        resolve( uid || '' );
        setTimeout( () => sub.unsubscribe() );
      } );
    } );
  }

  private async refreshAccessState (): Promise<void> {
    try {
      this.accessState = await this.accessService.getAccessState();
    } catch {
      this.accessState = null;
    }
  }

  // ── Step 1: Upload ──────────────────────────────────────────────────

  onFileSelect ( event: any ): void {
    const file = event.target.files?.[0];
    if ( file ) this.processFile( file );
  }

  onDrop ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if ( file ) this.processFile( file );
  }

  onDragOver ( event: DragEvent ): void {
    event.preventDefault();
    event.stopPropagation();
  }

  processFile ( file: File ): void {
    this.resetImportState( { preserveStep: false } );
    this.processing = true;
    this.message = 'Reading file...';

    Papa.parse( file, {
      header: true,
      skipEmptyLines: true,
      complete: ( result ) => {
        this.csvData = result.data as any[];
        this.csvHeaders = result.meta.fields || [];
        this.processing = false;
        this.message = '';
        this.soundService.playSound( 'finished' );
        const { mapping } = matchCsvHeaders( this.csvHeaders );
        // No email column means nothing for TODD to check: ask for the mapping.
        if ( mapping['emailAddress'] ) this.applyMapping( mapping );
        else this.step = 'map';
        this.publishAssistantContext();
      },
      error: ( error: any ) => {
        this.processing = false;
        this.message = 'Unable to read that file.';
        this.notificationService.show( 'Upload failed', error?.message || 'Unable to read that file.', 'error' );
        this.publishAssistantContext();
      },
    } );
  }

  importSample (): void {
    this.http.get( SAMPLE_FILE, { responseType: 'blob' } ).subscribe( {
      next: ( blob ) => this.processFile( new File( [blob], 'sample-contacts.csv', { type: 'text/csv' } ) ),
      error: () => this.notificationService.show( 'Sample unavailable', 'Unable to load the sample file.', 'error' ),
    } );
  }

  // ── Preview, and the mapper behind "change them" ─────────────────────

  /** From the mapper. */
  updateFieldMapping ( mapping: Record<string, string> ): void {
    this.soundService.playSound( 'click' );
    this.applyMapping( mapping );
    this.publishAssistantContext();
  }

  changeColumns (): void {
    this.step = 'map';
    this.publishAssistantContext();
  }

  onMapperCancel (): void {
    if ( this.contacts.length ) this.step = 'preview';
    else this.resetImportState();
  }

  private applyMapping ( mapping: Record<string, string> ): void {
    this.fieldMapping = mapping;
    this.mappedData = this.csvData.map( ( row ) => {
      const mapped: any = {};
      Object.keys( mapping ).forEach( ( field ) => {
        const header = mapping[field];
        if ( header ) mapped[field] = row[header];
      } );
      return mapped;
    } );
    this.contacts = this.transformToContact( this.mappedData )
      .filter( ( contact ) => Object.keys( contact ).length > 0 );
    const used = new Set( Object.values( mapping ).filter( Boolean ) );
    this.matchedLabels = EXPECTED_FIELDS
      .filter( ( field ) => !!mapping[field.name] )
      .map( ( field ) => field.description.split( ',' )[0] );
    this.skippedHeaders = this.csvHeaders.filter( ( header ) => !used.has( header ) );
    this.step = 'preview';
  }

  private parseBoolean ( value: any ): boolean {
    if ( typeof value === 'boolean' ) return value;
    const normalized = String( value ?? '' ).trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }

  private parseTags ( value: any ): string[] {
    if ( Array.isArray( value ) ) return value.map( ( v ) => String( v ).trim() ).filter( Boolean );
    return String( value ?? '' ).split( ',' ).map( ( v ) => v.trim() ).filter( Boolean );
  }

  private transformToContact ( data: any[] ): Partial<Contact>[] {
    return data.map( ( entry ) => {
      const contact: Partial<Contact> = {};

      if ( entry['firstName'] ) contact.firstName = entry['firstName'];
      if ( entry['middleName'] ) contact.middleName = entry['middleName'];
      if ( entry['lastName'] ) contact.lastName = entry['lastName'];
      if ( entry['profession'] ) contact.profession = entry['profession'];
      if ( entry['status'] ) contact.status = entry['status'];
      if ( entry['category'] ) contact.category = entry['category'];
      if ( entry['profileTypes'] ) contact.profileTypes = this.parseTags( entry['profileTypes'] );
      if ( entry['nickname'] ) contact.nickname = entry['nickname'];
      if ( entry['birthday'] ) contact.birthday = entry['birthday'];
      if ( entry['gender'] ) contact.gender = entry['gender'];
      if ( entry['important'] ) contact.important = this.parseBoolean( entry['important'] );

      const company: Contact['company'] = {};
      if ( entry['company.name'] ) company!.name = entry['company.name'];
      if ( entry['company.url'] ) company!.url = entry['company.url'];
      if ( entry['company.dba'] ) company!.dba = entry['company.dba'];
      if ( entry['company.numberOfEmployees'] ) company!.numberOfEmployees = entry['company.numberOfEmployees'];
      if ( entry['company.industry'] ) company!.industry = entry['company.industry'];
      if ( entry['company.sicCode'] ) company!.sicCode = entry['company.sicCode'];
      if ( entry['company.capabilities'] ) company!.capabilities = this.parseTags( entry['company.capabilities'] );
      if ( entry['company.streetAddress'] ) {
        company!.addresses = [{
          streetAddress: entry['company.streetAddress'],
          city: entry['company.city'] || '',
          state: entry['company.state'] || '',
          zip: entry['company.zip'] || '',
          country: entry['company.country'] || '',
          county: entry['company.county'] || '',
        }];
      }
      if ( Object.keys( company! ).length > 0 ) contact.company = company;

      if ( entry['streetAddress'] ) {
        contact.addresses = [{
          streetAddress: entry['streetAddress'],
          city: entry['city'] || '',
          state: entry['state'] || '',
          zip: entry['zip'] || '',
          country: entry['country'] || '',
          county: entry['county'] || '',
          addressType: entry['addressType'] || '',
        }];
      }

      const phoneNumbers: PhoneNumber[] = [];
      if ( entry['phoneNumber'] ) phoneNumbers.push( { phoneNumber: entry['phoneNumber'], phoneNumberType: entry['phoneNumberType'] || '' } );
      if ( entry['phoneNumber2'] ) phoneNumbers.push( { phoneNumber: entry['phoneNumber2'], phoneNumberType: entry['phoneNumberType2'] || '' } );
      if ( phoneNumbers.length > 0 ) contact.phoneNumbers = phoneNumbers;

      const emailAddresses: EmailAddress[] = [];
      if ( entry['emailAddress'] ) emailAddresses.push( { emailAddress: String( entry['emailAddress'] ).toLowerCase(), emailAddressType: entry['emailAddressType'] || '' } );
      if ( entry['emailAddress2'] ) emailAddresses.push( { emailAddress: String( entry['emailAddress2'] ).toLowerCase(), emailAddressType: entry['emailAddressType2'] || '' } );
      if ( emailAddresses.length > 0 ) contact.emailAddresses = emailAddresses;

      if ( entry['notes.subject'] || entry['notes.body'] ) {
        contact.notes = [{ subject: entry['notes.subject'] || '', body: entry['notes.body'] || '' }];
      }

      return contact;
    } );
  }

  // ── Gating + submit ─────────────────────────────────────────────────

  /** Signed in is enough here: the Import button's appWriteAction asks for Network first (nothing stored is free). */
  canStartImport (): boolean {
    return this.isSignedIn && !!this.accessState?.isLoggedIn;
  }

  getImportButtonLabel (): string {
    if ( !this.isSignedIn ) return 'Sign In to Import';
    return `Import ${this.contacts.length} contact${this.contacts.length === 1 ? '' : 's'}`;
  }

  /** Only when something stands in the way - a paid account needs no note. */
  getImportAccessNote (): string {
    if ( !this.isSignedIn || !this.accessState?.isLoggedIn ) {
      return 'Sign in to import contacts into your network.';
    }
    if ( this.accessState.isPaidUser ) return '';
    return 'Importing contacts needs a Network subscription.';
  }

  async submitImport (): Promise<void> {
    if ( !this.isSignedIn ) {
      this.notificationService.show( 'Sign In Required', 'Sign in to import contacts into your network.', 'info' );
      return;
    }

    if ( !this.canStartImport() ) {
      try {
        const startedCheckout = await this.contactPackService.promptAndStartCheckout();
        if ( !startedCheckout ) {
          this.notificationService.show( 'Import Locked', this.contactPackService.upgradePromptMessage.replace( '\n', ' ' ), 'info' );
        }
      } catch ( error: any ) {
        this.notificationService.show( 'Import Locked', error?.message || this.contactPackService.limitErrorMessage, 'error' );
      }
      return;
    }

    this.step = 'result';
    this.processing = true;
    this.importCompleted = false;
    this.message = 'Writing contacts to Network...';
    this.soundService.playSound( 'click' );
    this.publishAssistantContext();

    try {
      // A batch lets TODD clean these contacts right away and the user watch
      // it. If the batch can't be opened, the import still goes ahead and
      // the nightly run cleans them instead.
      let batchId = '';
      try {
        batchId = await this.importService.create( 'csv', this.contacts.length );
      } catch ( error ) {
        console.warn( '[CsvImport] could not open an import batch; cleanup will run tonight', error );
      }
      const contacts = batchId
        ? this.contacts.map( ( contact ) => ( { ...contact, importBatchId: batchId } ) )
        : this.contacts;
      const results = await this.dataService.uploadContacts( this.tenantId, contacts );
      this.lastImportSuccessCount = results.successCount;
      this.lastImportFailureCount = results.failureCount;
      this.soundService.playSound( 'finished' );
      if ( batchId && results.successCount > 0 ) {
        try {
          await this.importService.start( batchId );
          void this.onboarding.refresh();
          await this.router.navigate( ['/import', batchId, 'cleanup'] );
          return;
        } catch ( error ) {
          console.warn( '[CsvImport] could not start cleanup; it will run tonight', error );
        }
      }
      this.importCompleted = true;
      this.message = `Complete. ${results.successCount} imported${results.failureCount ? `, ${results.failureCount} failed` : ''}.`;
      void this.onboarding.refresh();
    } catch ( error: any ) {
      this.message = error?.message || 'Unable to import contacts.';
      this.notificationService.show( 'Import failed', this.message, 'error' );
    } finally {
      this.processing = false;
      await this.refreshAccessState();
      this.publishAssistantContext();
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────

  /** Back: from the preview to the drop zone, from the drop zone to Home. */
  goBack (): void {
    this.soundService.playSound( 'click' );
    if ( this.step === 'upload' ) {
      void this.router.navigate( ['/app'] );
      return;
    }
    if ( this.step === 'result' && !this.importCompleted ) {
      this.step = 'preview';
      return;
    }
    this.resetImportState();
  }

  goHome (): void {
    void this.router.navigate( ['/app'] );
  }

  startAnotherImport (): void {
    this.soundService.playSound( 'click' );
    this.resetImportState();
  }

  goToContacts (): void {
    this.router.navigate( ['/contact-list'] );
  }

  private resetImportState ( options?: { preserveStep?: boolean } ): void {
    if ( !options?.preserveStep ) this.step = 'upload';
    this.processing = false;
    this.message = '';
    this.csvData = [];
    this.csvHeaders = [];
    this.fieldMapping = {};
    this.mappedData = [];
    this.contacts = [];
    this.matchedLabels = [];
    this.skippedHeaders = [];
    this.importCompleted = false;
    this.lastImportSuccessCount = 0;
    this.lastImportFailureCount = 0;
    this.publishAssistantContext();
  }
}
