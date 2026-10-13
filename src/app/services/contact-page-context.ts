import { Contact } from '../models/contact.model';
import { NetworkAssistantPageContext } from './network-assistant-signal.service';

/**
 * TODD's page context for any page about one contact (the contact view,
 * attach files). feature 'contact' is what the assistant box keys on to
 * answer from this record instead of a name search across the network.
 * Only the fields TODD's answers read are sent - notes are trimmed so the
 * context stays small enough to ride along on every LLM prompt.
 */
export function buildContactPageContext (
  contact: Contact,
  contactId: string,
  page: { page: string; route: string; mode: NetworkAssistantPageContext['mode']; description: string; },
): NetworkAssistantPageContext {
  const c: any = contact;
  const displayName = c.displayName || [c.firstName, c.lastName].filter( Boolean ).join( ' ' ).trim();
  const notes = Array.isArray( c.notes )
    ? c.notes.slice( 0, 5 ).map( ( n: any ) => ( { subject: n?.subject || '', body: String( n?.body || '' ).slice( 0, 400 ) } ) )
    : [];

  return {
    feature: 'contact',
    page: page.page,
    route: page.route,
    mode: page.mode,
    title: displayName || 'Contact',
    description: page.description,
    summary: {
      contactId,
      displayName,
    },
    dataPreview: {
      contact: {
        id: contactId,
        displayName,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        profession: c.profession || '',
        status: c.status || '',
        email: c.email || '',
        emailAddresses: c.emailAddresses || [],
        phoneNumbers: c.phoneNumbers || [],
        category: c.category || [],
        addresses: c.addresses || [],
        lastContacted: c.lastContacted || null,
        company: c.company
          ? { name: c.company.name || '', publicInfo: c.company.publicInfo || '', dba: c.company.dba || '', numberOfEmployees: c.company.numberOfEmployees || '' }
          : null,
        notes,
        imageCount: Array.isArray( c.images ) ? c.images.length : 0,
        documentCount: Array.isArray( c.documents ) ? c.documents.length : 0,
      },
    },
  };
}
