import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../models/contact.model';

/**
 * Trimmed from the state-sharing slice of ContactService (contactSource /
 * resetContact / etc.) - the "currently editing contact" BehaviorSubject
 * TODD's contact-home/list pages use to hand a contact off to the
 * create/edit form without a route param (null = "creating a new one").
 * Reused as-is by whichever ported pages need it (create, view, list),
 * not duplicated per page.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkContactStateService {
  private readonly contactSource = new BehaviorSubject<Contact | null>( null );
  readonly currentContact$ = this.contactSource.asObservable();

  setContact ( contact: Contact | null ): void {
    this.contactSource.next( contact );
  }

  resetContact (): void {
    this.contactSource.next( null );
  }

  get currentContact (): Contact | null {
    return this.contactSource.value;
  }
}
