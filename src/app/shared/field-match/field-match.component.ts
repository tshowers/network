import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SoundService } from '../../services/sound.service';

export interface ExpectedField {
  name: string;
  description: string;
}

/**
 * Ported from shared/page/field-match/field-match.component.ts - the
 * auto-matching/manual-override logic is generic (just string comparison
 * against csvHeaders) and carried over unchanged. What's trimmed is
 * `expectedFields`: the original's ~70 fields cover TODD's full Contact
 * interface (ssn, isCompany, sector, dual address/phone/email slots,
 * company phone/email, socialMedia.*). Network's Contact model
 * (models/contact.model.ts) is smaller, so this only lists fields that
 * model actually has - a mapping target that doesn't exist on the model
 * would silently go nowhere in csv-import's transformToContact.
 */
@Component( {
  selector: 'app-field-match',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './field-match.component.html',
  styleUrl: './field-match.component.css',
} )
export class FieldMatchComponent implements OnInit {
  @Input() csvHeaders: string[] = [];
  @Output() fieldMapping = new EventEmitter<Record<string, string>>();
  @Output() cancel = new EventEmitter<void>();

  userFieldMapping: Record<string, string> = {};
  showExpectedFields = false;
  unmatchedHeaders: string[] = [];
  activeHeader = '';
  showOnlyUnmapped = false;

  readonly expectedFields: ExpectedField[] = [
    { name: 'firstName', description: 'First Name' },
    { name: 'middleName', description: 'Middle Name' },
    { name: 'lastName', description: 'Last Name' },
    { name: 'profession', description: 'Profession or Title' },
    { name: 'status', description: 'Status, e.g. Lead, Client' },
    { name: 'category', description: 'Category, e.g. Prospect, Client, Friend' },
    { name: 'profileTypes', description: 'Profile Types (comma-separated tags)' },
    { name: 'nickname', description: 'Nickname' },
    { name: 'birthday', description: 'Birthday' },
    { name: 'gender', description: 'Gender' },
    { name: 'important', description: 'Important / VIP - true or false' },
    { name: 'streetAddress', description: 'Street Address' },
    { name: 'city', description: 'City' },
    { name: 'state', description: 'State' },
    { name: 'zip', description: 'Zip' },
    { name: 'country', description: 'Country' },
    { name: 'county', description: 'County' },
    { name: 'addressType', description: 'Address Type' },
    { name: 'phoneNumber', description: 'Phone Number' },
    { name: 'phoneNumberType', description: 'Phone Number Type' },
    { name: 'phoneNumber2', description: 'Phone Number 2' },
    { name: 'phoneNumberType2', description: 'Phone Number Type 2' },
    { name: 'emailAddress', description: 'Email Address' },
    { name: 'emailAddressType', description: 'Email Address Type' },
    { name: 'emailAddress2', description: 'Email Address 2' },
    { name: 'emailAddressType2', description: 'Email Address Type 2' },
    { name: 'notes.subject', description: 'Note Subject' },
    { name: 'notes.body', description: 'Note Body' },
    { name: 'company.name', description: 'Company Name' },
    { name: 'company.url', description: 'Company Website' },
    { name: 'company.dba', description: 'Company DBA' },
    { name: 'company.numberOfEmployees', description: 'Company Number of Employees' },
    { name: 'company.sicCode', description: 'Company SIC Code' },
    { name: 'company.capabilities', description: 'Company Capabilities' },
    { name: 'company.streetAddress', description: 'Company Street Address' },
    { name: 'company.city', description: 'Company City' },
    { name: 'company.state', description: 'Company State' },
    { name: 'company.zip', description: 'Company Zip' },
    { name: 'company.country', description: 'Company Country' },
    { name: 'company.county', description: 'Company County' },
  ];

  constructor ( private soundService: SoundService ) { }

  ngOnInit (): void {
    this.preliminaryMatchHeaders();
  }

  preliminaryMatchHeaders (): void {
    this.userFieldMapping = {};
    this.activeHeader = '';
    this.showOnlyUnmapped = false;

    const headerMappings: { [key: string]: string[] } = {
      firstName: ['firstName', 'First Name', 'first_name', 'firstname', 'given name'],
      middleName: ['middleName', 'Middle Name', 'middle_name'],
      lastName: ['lastName', 'Last Name', 'last_name', 'lastname', 'family name'],
      profession: ['profession', 'title', 'job title', 'jobTitle', 'occupation'],
      status: ['status', 'Status'],
      category: ['category', 'classification', 'segment', 'group'],
      profileTypes: ['profileTypes', 'tags', 'Groups', 'Categories'],
      nickname: ['nickname', 'short name', 'handle'],
      birthday: ['birthday', 'dob', 'date of birth'],
      gender: ['gender'],
      important: ['important', 'vip'],
      streetAddress: ['streetAddress', 'street Address', 'address', 'address1', 'home address'],
      city: ['city', 'city_name', 'town'],
      state: ['state', 'state_name', 'province'],
      zip: ['zip', 'zip code', 'zipcode', 'postal code'],
      country: ['country', 'country name', 'nation'],
      county: ['county', 'county name', 'district'],
      addressType: ['addressType', 'address type'],
      phoneNumber: ['phoneNumber', 'phone', 'mobile', 'Phone Number', 'Telephone Number', 'Cell Number'],
      phoneNumberType: ['phoneNumberType', 'phone type'],
      phoneNumber2: ['phoneNumber2', 'phone2', 'mobile phone', 'secondary phone'],
      phoneNumberType2: ['phoneNumberType2', 'phone type 2'],
      emailAddress: ['emailAddress', 'email', 'Email', 'email_address', 'contact email'],
      emailAddressType: ['emailAddressType', 'email type'],
      emailAddress2: ['emailAddress2', 'email2', 'secondary email'],
      emailAddressType2: ['emailAddressType2', 'email type 2'],
      'notes.subject': ['notes.subject', 'note subject'],
      'notes.body': ['notes.body', 'notes', 'Notes', 'remarks', 'comments'],
      'company.name': ['company.name', 'company', 'company name', 'companyName', 'organization', 'business name'],
      'company.url': ['company.url', 'company website', 'company url'],
      'company.dba': ['company.dba', 'dba'],
      'company.numberOfEmployees': ['company.numberOfEmployees', 'number of employees', 'employee count'],
      'company.sicCode': ['company.sicCode', 'sic', 'sicCode'],
      'company.capabilities': ['company.capabilities', 'capabilities', 'naics', 'NAICS Code'],
      'company.streetAddress': ['company.streetAddress', 'business address', 'company address'],
      'company.city': ['company.city', 'company city'],
      'company.state': ['company.state', 'company state'],
      'company.zip': ['company.zip', 'company zip'],
      'company.country': ['company.country', 'company country'],
      'company.county': ['company.county', 'company county'],
    };

    const unmatchedHeaders: string[] = [];

    for ( const field of this.expectedFields ) {
      if ( !headerMappings[field.name] ) {
        headerMappings[field.name] = [field.name];
      } else if ( !headerMappings[field.name].includes( field.name ) ) {
        headerMappings[field.name].push( field.name );
      }
    }

    for ( const header of this.csvHeaders || [] ) {
      const lowerCaseHeader = header.toLowerCase().trim();
      let matched = false;
      for ( const [expectedHeader, variations] of Object.entries( headerMappings ) ) {
        if ( variations.map( ( v ) => v.toLowerCase().trim() ).includes( lowerCaseHeader ) ) {
          this.userFieldMapping[expectedHeader] = header;
          matched = true;
          break;
        }
      }
      if ( !matched ) {
        unmatchedHeaders.push( header );
      }
    }

    this.unmatchedHeaders = unmatchedHeaders;
    this.pruneDuplicateManualAssignments();
  }

  getMatchedFieldCount (): number {
    return this.expectedFields.filter( ( field ) => this.isFieldResolved( field ) ).length;
  }

  getUnmappedExpectedFieldCount (): number {
    return this.expectedFields.filter( ( field ) => !this.isFieldResolved( field ) ).length;
  }

  isFieldResolved ( field: ExpectedField ): boolean {
    return !!this.userFieldMapping[field.name];
  }

  setActiveHeader ( header: string ): void {
    this.soundService.playSound( 'click' );
    this.activeHeader = this.activeHeader === header ? '' : header;
  }

  getAvailableHeaders ( field: ExpectedField ): string[] {
    const currentValue = this.userFieldMapping[field.name];
    const assignedHeaders = new Set(
      Object.entries( this.userFieldMapping )
        .filter( ( [key, value] ) => key !== field.name && !!value )
        .map( ( [, value] ) => String( value ) ),
    );

    return ( this.csvHeaders || [] ).filter( ( header ) => !assignedHeaders.has( header ) || header === currentValue );
  }

  onManualFieldSelected ( field: ExpectedField, value: string ): void {
    if ( !value ) {
      delete this.userFieldMapping[field.name];
      return;
    }

    this.clearHeaderFromOtherFields( field.name, value );
    this.userFieldMapping[field.name] = value;

    if ( this.activeHeader === value ) {
      this.activeHeader = '';
    }
  }

  assignActiveHeader ( field: ExpectedField ): void {
    if ( !this.activeHeader ) return;

    const selectedHeader = this.activeHeader;
    this.clearHeaderFromOtherFields( field.name, selectedHeader );
    this.userFieldMapping[field.name] = selectedHeader;
    this.activeHeader = '';
    this.soundService.playSound( 'click' );
  }

  private clearHeaderFromOtherFields ( currentFieldName: string, header: string ): void {
    Object.keys( this.userFieldMapping ).forEach( ( key ) => {
      if ( key !== currentFieldName && this.userFieldMapping[key] === header ) {
        delete this.userFieldMapping[key];
      }
    } );
  }

  private pruneDuplicateManualAssignments (): void {
    const seenHeaders = new Set<string>();

    this.expectedFields.forEach( ( field ) => {
      const mappedHeader = this.userFieldMapping[field.name];
      if ( !mappedHeader ) return;

      if ( seenHeaders.has( mappedHeader ) ) {
        delete this.userFieldMapping[field.name];
        return;
      }

      seenHeaders.add( mappedHeader );
    } );
  }

  submitMapping (): void {
    this.soundService.playSound( 'click' );
    this.activeHeader = '';
    this.fieldMapping.emit( this.userFieldMapping );
  }

  toggleExpectedFields (): void {
    this.soundService.playSound( 'click' );
    this.showExpectedFields = !this.showExpectedFields;
  }

  onCancel (): void {
    this.soundService.playSound( 'click' );
    this.cancel.emit();
  }
}
