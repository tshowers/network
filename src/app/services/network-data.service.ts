import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  getFirestore,
} from 'firebase/firestore';

import { Contact } from '../models/contact.model';

/**
 * Trimmed, Firestore-direct data layer for the standalone Network app -
 * same collection path convention as TODD's DataService.getCollectionReference
 * (`tenants/{tenantId}/contacts`, confirmed against `data.service.ts` and
 * matching what `networkRoutes.js` already uses server-side for the iOS
 * app), but reimplemented from scratch rather than porting the 2000+ line
 * original. Each method here exists because a specific ported component
 * needs it - this is not meant to be a complete recreation of DataService's
 * full surface, only the slice Network's own pages use.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkDataService {
  private get firestore () {
    return getFirestore();
  }

  private contactsRef ( tenantId: string ) {
    return collection( this.firestore, `tenants/${tenantId}/contacts` );
  }

  /** Mirrors DataService.getCollectionDataWithLimit('CONTACTS', ...). */
  async getRecentContacts ( tenantId: string, limitTo = 5 ): Promise<Contact[]> {
    const q = query( this.contactsRef( tenantId ), orderBy( 'lastUpdated', 'desc' ), limit( limitTo ) );
    const snap = await getDocs( q );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Contact );
  }

  /**
   * Mirrors DataService.addDocument('CONTACTS', ...): add, then patch the
   * new doc with its own id (TODD stores id redundantly inside the document
   * itself, not just as the Firestore doc id - several components read
   * `contact.id` directly off the data, not off the doc reference).
   */
  async addContact ( tenantId: string, data: Partial<Contact> ): Promise<string> {
    const ref = this.contactsRef( tenantId );
    const docRef = await addDoc( ref, data );
    await updateDoc( doc( ref, docRef.id ), { id: docRef.id } );
    return docRef.id;
  }

  /** Mirrors DataService.getContactFullByIdOnce(contactId, user). */
  async getContact ( tenantId: string, contactId: string ): Promise<Contact | null> {
    if ( !contactId ) return null;
    const snap = await getDoc( doc( this.contactsRef( tenantId ), contactId ) );
    return snap.exists() ? ( { id: snap.id, ...( snap.data() as any ) } as Contact ) : null;
  }
}
