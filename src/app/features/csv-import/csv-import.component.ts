import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import * as Papa from 'papaparse';

import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkContactAccessService, ContactAccessState } from '../../services/network-contact-access.service';
import { NetworkContactPackService } from '../../services/network-contact-pack.service';
import { NetworkNotificationService } from '../../services/network-notification.service';
import { SoundService } from '../../services/sound.service';
import { Contact, PhoneNumber, EmailAddress } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { FieldMatchComponent } from '../../shared/field-match/field-match.component';

interface ImportStep {
  key: 'upload' | 'map' | 'review' | 'confirm' | 'result';
  label: string;
}

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
 */
@Component( {
  selector: 'app-csv-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BackToTopComponent,
    PreloaderComponent,
    CockpitBrowseModeBannerComponent,
    FieldMatchComponent,
  ],
  templateUrl: './csv-import.component.html',
  styleUrl: './csv-import.component.css',
} )
export class CsvImportComponent implements OnInit {
  readonly steps: ImportStep[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map Fields' },
    { key: 'review', label: 'Review' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'result', label: 'Import' },
  ];

  currentStep = 0;
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

  accessState: ContactAccessState | null = null;

  private tenantId = '';

  constructor (
    private router: Router,
    private titleService: Title,
    private http: HttpClient,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private accessService: NetworkContactAccessService,
    private contactPackService: NetworkContactPackService,
    private notificationService: NetworkNotificationService,
    private soundService: SoundService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Import Contacts` );

    const userId = await this.firstUserId();
    this.isSignedIn = !!userId;
    this.tenantId = userId ? await this.authService.resolveTenantId( userId ) : '';

    if ( this.isSignedIn ) {
      await this.refreshAccessState();
    }

    this.isLoading = false;
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

  get currentStepKey (): ImportStep['key'] {
    return this.steps[this.currentStep]?.key || 'upload';
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
        this.message = `Loaded ${this.csvData.length} rows.`;
        this.currentStep = 1;
        this.soundService.playSound( 'finished' );
        this.notificationService.show( 'File loaded', `${this.csvData.length} rows ready to map.`, 'success' );
      },
      error: ( error: any ) => {
        this.processing = false;
        this.message = 'Unable to read that file.';
        this.notificationService.show( 'Upload failed', error?.message || 'Unable to read that file.', 'error' );
      },
    } );
  }

  importSample (): void {
    this.http.get( 'assets/sample.csv', { responseType: 'blob' } ).subscribe( {
      next: ( blob ) => this.processFile( new File( [blob], 'sample.csv', { type: 'text/csv' } ) ),
      error: () => this.notificationService.show( 'Sample unavailable', 'Unable to load the sample file.', 'error' ),
    } );
  }

  // ── Step 2: Map fields ──────────────────────────────────────────────

  updateFieldMapping ( mapping: Record<string, string> ): void {
    this.fieldMapping = mapping;
    this.mappedData = this.csvData.map( ( row ) => {
      const mapped: any = {};
      Object.keys( mapping ).forEach( ( field ) => {
        const header = mapping[field];
        if ( header ) mapped[field] = row[header];
      } );
      return mapped;
    } );
    this.currentStep = 2;
    this.soundService.playSound( 'click' );
  }

  // ── Step 3: Review mapped rows, Step 4: confirm/transform ───────────

  get previewHeaders (): string[] {
    return this.mappedData.length > 0 ? Object.keys( this.mappedData[0] ) : [];
  }

  get previewRows (): any[] {
    return this.mappedData.slice( 0, 25 );
  }

  confirmMappedData (): void {
    this.contacts = this.transformToContact( this.mappedData );
    this.currentStep = 3;
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

  // ── Step 4: gating + submit ─────────────────────────────────────────

  canStartImport (): boolean {
    if ( !this.isSignedIn || !this.accessState?.isLoggedIn ) return false;
    if ( this.accessState.isPaidUser ) return true;
    return this.contacts.length <= this.accessState.remainingFreeContacts;
  }

  getImportButtonLabel (): string {
    if ( !this.isSignedIn ) return 'Sign In to Import';
    if ( !this.canStartImport() ) return 'Upgrade to Import';
    return 'Import Contacts';
  }

  getImportAccessNote (): string {
    if ( !this.isSignedIn || !this.accessState?.isLoggedIn ) {
      return 'Sign in to import contacts into your network.';
    }
    if ( this.accessState.isPaidUser ) {
      return 'Your paid account can import all of these contacts.';
    }
    if ( this.contacts.length > this.accessState.remainingFreeContacts ) {
      return `This file has ${this.contacts.length} contacts, but you only have ${this.accessState.remainingFreeContacts} free slots left. Upgrade to import all of them.`;
    }
    return `Free account: ${this.accessState.remainingFreeContacts} of ${this.accessState.contactLimit} contacts remaining after this import.`;
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

    this.currentStep = 4;
    this.processing = true;
    this.importCompleted = false;
    this.message = 'Writing contacts to Network...';
    this.soundService.playSound( 'click' );

    try {
      const results = await this.dataService.uploadContacts( this.tenantId, this.contacts );
      this.lastImportSuccessCount = results.successCount;
      this.lastImportFailureCount = results.failureCount;
      this.importCompleted = true;
      this.message = `Complete. ${results.successCount} imported${results.failureCount ? `, ${results.failureCount} failed` : ''}.`;
      this.soundService.playSound( 'finished' );
    } catch ( error: any ) {
      this.message = error?.message || 'Unable to import contacts.';
      this.notificationService.show( 'Import failed', this.message, 'error' );
    } finally {
      this.processing = false;
      await this.refreshAccessState();
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────

  previousStep (): void {
    this.soundService.playSound( 'click' );
    if ( this.currentStep > 0 ) this.currentStep--;
  }

  onCancel (): void {
    this.resetImportState();
  }

  startAnotherImport (): void {
    this.soundService.playSound( 'click' );
    this.resetImportState();
  }

  goToContacts (): void {
    this.router.navigate( ['/contact-list'] );
  }

  private resetImportState ( options?: { preserveStep?: boolean } ): void {
    if ( !options?.preserveStep ) this.currentStep = 0;
    this.processing = false;
    this.message = '';
    this.csvData = [];
    this.csvHeaders = [];
    this.fieldMapping = {};
    this.mappedData = [];
    this.contacts = [];
    this.importCompleted = false;
    this.lastImportSuccessCount = 0;
    this.lastImportFailureCount = 0;
  }
}
