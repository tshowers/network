import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  getFirestore,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

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

  /**
   * Bulk counterpart to addContact, for csv-import. Unlike TODD's original
   * DataService.uploadData, this doesn't dedupe/merge against existing
   * contacts by matching fields - every row becomes a new document. Writes
   * are chunked to stay under Firestore's 500-operation batch limit.
   */
  async uploadContacts ( tenantId: string, contacts: Partial<Contact>[] ): Promise<{ successCount: number; failureCount: number; skippedCount: number }> {
    const ref = this.contactsRef( tenantId );
    const chunkSize = 450;
    let successCount = 0;
    let failureCount = 0;

    for ( let i = 0; i < contacts.length; i += chunkSize ) {
      const chunk = contacts.slice( i, i + chunkSize );
      const batch = writeBatch( this.firestore );

      chunk.forEach( ( contact ) => {
        const docRef = doc( ref );
        batch.set( docRef, { ...contact, id: docRef.id } );
      } );

      try {
        await batch.commit();
        successCount += chunk.length;
      } catch {
        failureCount += chunk.length;
      }
    }

    return { successCount, failureCount, skippedCount: 0 };
  }

  /** Mirrors DataService.getContactFullByIdOnce(contactId, user). */
  async getContact ( tenantId: string, contactId: string ): Promise<Contact | null> {
    if ( !contactId ) return null;
    const snap = await getDoc( doc( this.contactsRef( tenantId ), contactId ) );
    return snap.exists() ? ( { id: snap.id, ...( snap.data() as any ) } as Contact ) : null;
  }

  /** Mirrors DataService.getDocument('CONTACTS', ...) / getDocumentRealtime - live updates, not a one-time fetch. */
  getContactRealtime ( tenantId: string, contactId: string ): Observable<Contact | null> {
    return new Observable( ( subscriber ) => {
      const unsubscribe = onSnapshot(
        doc( this.contactsRef( tenantId ), contactId ),
        ( snap ) => subscriber.next( snap.exists() ? ( { id: snap.id, ...( snap.data() as any ) } as Contact ) : null ),
        ( error ) => subscriber.error( error ),
      );
      return unsubscribe;
    } );
  }

  /** Mirrors DataService.setDocument('CONTACTS', ...): merge, not overwrite. */
  async updateContact ( tenantId: string, contactId: string, data: Partial<Contact> ): Promise<void> {
    await setDoc( doc( this.contactsRef( tenantId ), contactId ), data, { merge: true } );
  }

  /** Mirrors DataService.deleteDocument('CONTACTS', ...). */
  async deleteContact ( tenantId: string, contactId: string ): Promise<void> {
    await deleteDoc( doc( this.contactsRef( tenantId ), contactId ) );
  }

  /**
   * Mirrors DataService.getCollectionData('CONTACTS', ...) - the whole
   * tenant's contact collection, no pagination. list.component.ts's real
   * loadData() does the exact same full-collection fetch (its "pagination"
   * is really just project-based access filtering, which this doesn't
   * carry - see ListComponent's own scoping note).
   */
  async getAllContacts ( tenantId: string ): Promise<Contact[]> {
    const snap = await getDocs( this.contactsRef( tenantId ) );
    return snap.docs.map( ( d ) => ( { ...( d.data() as any ), id: d.id } ) as Contact );
  }

  /**
   * Name lookup for the assistant box (find-contact-by-name intents). Uses
   * equality queries on firstName/lastName rather than fetching the whole
   * collection - the old full fetch + substring filter read every contact
   * (thousands, for real tenants) on each question. Firestore can't do
   * substring or case-insensitive matching, so each name part is tried as
   * typed and capitalized; equality on two fields needs no composite index.
   *
   *   "Roland Martin"        -> first=Roland & last=Martin
   *   "Mary Ann Smith"       -> first=Mary & last=Smith, first="Mary Ann" & last=Smith,
   *                             first=Mary & last="Ann Smith"
   *   "Martin"               -> last=Martin, or first=Martin
   */
  async findContactsByName ( tenantId: string, name: string ): Promise<Contact[]> {
    const parts = ( name || '' ).trim().split( /\s+/ ).filter( Boolean );
    if ( !parts.length ) return [];

    const variants = ( v: string ) => {
      const capitalized = v.charAt( 0 ).toUpperCase() + v.slice( 1 ).toLowerCase();
      return Array.from( new Set( [v, capitalized] ) );
    };

    const pairs: Array<{ firstName?: string; lastName?: string; }> = [];
    if ( parts.length === 1 ) {
      variants( parts[0] ).forEach( ( v ) => pairs.push( { lastName: v }, { firstName: v } ) );
    } else {
      for ( let split = 1; split < parts.length; split++ ) {
        const first = parts.slice( 0, split ).join( ' ' );
        const last = parts.slice( split ).join( ' ' );
        for ( const f of variants( first ) ) {
          for ( const l of variants( last ) ) pairs.push( { firstName: f, lastName: l } );
        }
      }
      // A middle name in the question ("Mary Ann Smith") when the record only has first + last.
      if ( parts.length === 3 ) {
        variants( parts[0] ).forEach( ( f ) => variants( parts[2] ).forEach( ( l ) => pairs.push( { firstName: f, lastName: l } ) ) );
      }
    }

    const snaps = await Promise.all( pairs.map( ( pair ) => {
      const filters = Object.entries( pair ).map( ( [field, value] ) => where( field, '==', value ) );
      return getDocs( query( this.contactsRef( tenantId ), ...filters, limit( 10 ) ) );
    } ) );

    const byId = new Map<string, Contact>();
    snaps.forEach( ( snap ) => snap.docs.forEach( ( d ) => {
      if ( !byId.has( d.id ) ) byId.set( d.id, { ...( d.data() as any ), id: d.id } as Contact );
    } ) );
    return Array.from( byId.values() );
  }
}
