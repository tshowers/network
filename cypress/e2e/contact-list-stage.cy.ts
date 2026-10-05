/**
 * Contact list: set a relationship stage right from the list (the
 * Getting Started checklist's "Give relationships a stage" link opens
 * /contact-list?setStage=1), plus the self "(You)" tag. Firebase emulators.
 */
describe( 'Contact list - Set stage', () => {
  const stubEntitlement = () => {
    cy.intercept( 'POST', '**/network/entitlement', {
      statusCode: 200,
      body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 },
    } );
  };

  const seedAndVisit = ( path: string ) => {
    const credentials = { email: `network-stage-${Date.now()}@example.com`, password: 'CypressTest123!' };
    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, account.uid, { firstName: 'Booker', lastName: 'Showers' } );
      cy.seedContact( account, 'staged-1', { firstName: 'Aaron', lastName: 'Adams', status: 'Qualification' } );
      cy.seedContact( account, 'unstaged-1', { firstName: 'Zoe', lastName: 'Zhang', profession: 'Founder', company: { name: 'Zhang Studio' }, emailAddresses: [{ emailAddress: 'zoe@zhang.studio', emailAddressType: 'Work' }] } );
      cy.visitWithFirebaseEmulators( path, credentials );
    } );
  };

  it( 'lists unstaged contacts first with a hint, and saves a stage from the list', () => {
    stubEntitlement();
    seedAndVisit( '/contact-list?setStage=1' );

    cy.get( '[data-cy="set-stage-hint"]' ).should( 'be.visible' );
    cy.get( '.cl-row:not(.cl-row--head) .cl-name strong' ).last().should( 'contain.text', 'Aaron Adams' );

    cy.contains( '.cl-row', 'Zoe Zhang' ).within( () => {
      cy.get( '[data-cy="set-stage-button"]' ).should( 'contain.text', 'Set stage' ).click();
      cy.get( '[data-cy="stage-picker"]' ).should( 'be.visible' );
      cy.contains( '[data-cy="choice-option"]', 'Proposal' ).click();
      cy.get( '[data-cy="stage-picker"]' ).should( 'not.exist' );
      cy.get( '[data-cy="set-stage-button"]' ).should( 'contain.text', 'Proposal' );
      cy.contains( '.cl-saved', 'Saved' );
    } );
    cy.location( 'pathname' ).should( 'eq', '/contact-list' );

    // Persisted: reload and it's still there.
    cy.reload();
    cy.contains( '.cl-row', 'Zoe Zhang' ).find( '[data-cy="set-stage-button"]' ).should( 'contain.text', 'Proposal' );
  } );

  it( 'tags the signed-in user\'s own contact with (You)', () => {
    stubEntitlement();
    seedAndVisit( '/contact-list' );
    cy.contains( '.cl-row', 'Booker Showers' ).find( '[data-cy="contact-self-tag"]' ).should( 'contain.text', '(You)' );
    cy.contains( '.cl-row', 'Zoe Zhang' ).find( '[data-cy="contact-self-tag"]' ).should( 'not.exist' );
    // Their own record is their profile, not a relationship - no stage.
    cy.contains( '.cl-row', 'Booker Showers' ).find( '[data-cy="set-stage-button"]' ).should( 'not.exist' );
  } );

  it( 'renders as cards on a phone', () => {
    stubEntitlement();
    cy.viewport( 390, 844 );
    seedAndVisit( '/contact-list?setStage=1' );
    cy.contains( '.cl-row', 'Zoe Zhang' ).should( 'be.visible' );
    cy.contains( '.cl-row', 'Zoe Zhang' ).find( '[data-cy="set-stage-button"]' ).click();
    cy.document().then( ( doc ) => expect( doc.documentElement.scrollWidth ).to.be.at.most( 390 ) );
    cy.screenshot( 'contact-list-phone', { capture: 'viewport' } );
  } );
} );
