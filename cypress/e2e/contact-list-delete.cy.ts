/**
 * Contact list cleanup: the "Can't email" and "Marked for deletion" views,
 * select-all, and bulk delete. Deleting archives each contact to
 * tenants/{tenantId}/deleted-contacts (which feeds Lead Vault) in the same
 * batch that removes it from contacts. Firebase emulators.
 */
const FIRESTORE = 'http://127.0.0.1:8180/v1/projects/taliferrotech/databases/(default)/documents';

describe( 'Contact list - Delete', () => {
  const stubAccess = () => {
    cy.intercept( 'POST', '**/network/entitlement', {
      statusCode: 200,
      body: { success: true, hasNetwork: true, effectiveLimit: 1000, currentCount: 0 },
    } );
    // Bulk delete carries appWriteAction.
    cy.intercept( 'GET', '**/account/summary', {
      statusCode: 200,
      body: { success: true, data: { writeAccess: { network: true } } },
    } );
  };

  const getDoc = ( account: { uid: string; idToken: string }, path: string ) => cy.request( {
    url: `${FIRESTORE}/tenants/${account.uid}/${path}`,
    headers: { Authorization: `Bearer ${account.idToken}` },
    failOnStatusCode: false,
  } );

  it( 'filters to contacts that can\'t be emailed or are marked, and bulk deletes them into Deleted Contacts', () => {
    stubAccess();
    const credentials = { email: `network-delete-${Date.now()}@example.com`, password: 'CypressTest123!' };

    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, account.uid, { firstName: 'Booker', lastName: 'Showers' } );
      cy.seedContact( account, 'good-1', { firstName: 'Gina', lastName: 'Good', emailAddresses: [{ emailAddress: 'gina@good.co' }] } );
      cy.seedContact( account, 'blocked-1', { firstName: 'Bob', lastName: 'Blocked', status: 'Qualification', company: { name: 'Bounce Inc' }, emailAddresses: [{ emailAddress: 'bob@bounce.co', blocked: true }] } );
      cy.seedContact( account, 'noemail-1', { firstName: 'Nora', lastName: 'Noemail' } );
      cy.seedContact( account, 'marked-1', { firstName: 'Mark', lastName: 'Marked', status: 'Deleted', emailAddresses: [{ emailAddress: 'mark@marked.co' }] } );
      cy.visitWithFirebaseEmulators( '/contact-list', credentials );

      cy.contains( '.cl-row', 'Gina Good' ).should( 'be.visible' );
      cy.get( '[data-cy="view-cant-email"]' ).should( 'contain.text', '2' );
      cy.get( '[data-cy="view-marked"]' ).should( 'contain.text', '1' );

      // Marked for deletion: only Mark.
      cy.get( '[data-cy="view-marked"]' ).click();
      cy.get( '.cl-row:not(.cl-row--head)' ).should( 'have.length', 1 ).and( 'contain.text', 'Mark Marked' );
      cy.get( '[data-cy="view-all"]' ).click();

      // Can't email: Bob (blocked) and Nora (no address); never the user's own record.
      cy.get( '[data-cy="view-cant-email"]' ).click();
      cy.get( '.cl-row:not(.cl-row--head)' ).should( 'have.length', 2 );
      cy.contains( '.cl-row', 'Bob Blocked' );
      cy.contains( '.cl-row', 'Nora Noemail' );

      cy.get( '[data-cy="contact-select-all"]' ).check();
      cy.get( '[data-cy="contacts-bulk"]' ).should( 'contain.text', '2 selected' );
      // Nobody selected can be emailed, so only Delete is offered.
      cy.get( '[data-cy="contacts-bulk-email"]' ).should( 'not.exist' );

      cy.on( 'window:confirm', ( text ) => {
        expect( text ).to.contain( 'Delete 2 contacts' );
        return true;
      } );
      cy.get( '[data-cy="contacts-bulk-delete"]' ).click();

      cy.get( '[data-cy="contacts-notice"]' ).should( 'contain.text', 'Deleted 2 contacts' );
      cy.get( '[data-cy="contacts-bulk"]' ).should( 'not.exist' );
      cy.contains( 'Everyone here can be emailed.' );
      cy.get( '[data-cy="view-cant-email"]' ).should( 'contain.text', '0' );

      // Gone from contacts, archived (with its old stage kept) in deleted-contacts.
      getDoc( account, 'contacts/blocked-1' ).its( 'status' ).should( 'eq', 404 );
      getDoc( account, 'contacts/noemail-1' ).its( 'status' ).should( 'eq', 404 );
      getDoc( account, 'deleted-contacts/blocked-1' ).then( ( response ) => {
        expect( response.status ).to.eq( 200 );
        const fields = response.body.fields;
        expect( fields.status.stringValue ).to.eq( 'Deleted' );
        expect( fields.statusBeforeDelete.stringValue ).to.eq( 'Qualification' );
        expect( fields.deletedFrom.stringValue ).to.eq( 'network' );
        expect( fields.company.mapValue.fields.name.stringValue ).to.eq( 'Bounce Inc' );
      } );
      getDoc( account, 'deleted-contacts/noemail-1' ).its( 'status' ).should( 'eq', 200 );
      getDoc( account, 'contacts/good-1' ).its( 'status' ).should( 'eq', 200 );

      // Persisted.
      cy.reload();
      cy.contains( '.cl-row', 'Gina Good' ).should( 'be.visible' );
      cy.contains( '.cl-row', 'Bob Blocked' ).should( 'not.exist' );
    } );
  } );

  it( 'archives a single delete from the row too', () => {
    stubAccess();
    const credentials = { email: `network-delete-one-${Date.now()}@example.com`, password: 'CypressTest123!' };

    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'one-1', { firstName: 'Olive', lastName: 'One', emailAddresses: [{ emailAddress: 'olive@one.co' }] } );
      cy.visitWithFirebaseEmulators( '/contact-list', credentials );

      cy.on( 'window:confirm', () => true );
      cy.contains( '.cl-row', 'Olive One' ).find( 'button[aria-label="Delete Olive One"]' ).click();
      cy.contains( '.cl-row', 'Olive One' ).should( 'not.exist' );

      getDoc( account, 'contacts/one-1' ).its( 'status' ).should( 'eq', 404 );
      getDoc( account, 'deleted-contacts/one-1' ).its( 'status' ).should( 'eq', 200 );
    } );
  } );
} );
