/**
 * Trimmed version of TODD's Contact interface
 * (frontend/src/app/shared/data/interfaces/contact.model.ts) - that one is
 * huge and covers every feature across TODD (opportunities, engagements,
 * subscriptions, etc.). This grows field-by-field as more of Network's
 * pages get ported and actually need them, rather than porting the whole
 * interface up front.
 */
export interface EmailAddress {
  emailAddress: string;
  emailAddressType?: string;
  blocked?: boolean;
}

export interface PhoneNumber {
  phoneNumber: string;
  phoneNumberType?: string;
}

export interface Company {
  name?: string;
  url?: string;
  logoUrl?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company?: Company;
  emailAddresses?: EmailAddress[];
  phoneNumbers?: PhoneNumber[];
  profileTypes?: any[];
  addresses?: any[];
  notes?: any[];
  lastUpdated?: string;
  important?: boolean;
  status?: string;
}
