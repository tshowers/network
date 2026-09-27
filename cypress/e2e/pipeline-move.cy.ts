/**
 * Pipeline: move a contact between stages right from the board, and pick a
 * single lane on phones. Firebase emulators.
 */
describe( 'Pipeline - move between stages', () => {
  const seedAndVisit = () => {
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 } } );
    const credentials = { email: `network-move-${Date.now()}@example.com`, password: 'CypressTest123!' };
    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'mover-1', { firstName: 'Marcus', lastName: 'Webb', status: 'Lead Generation' } );
      cy.seedContact( account, 'mover-2', { firstName: 'Priya', lastName: 'Nair', status: 'Proposal' } );
      cy.visitWithFirebaseEmulators( '/contact-deal-flow', credentials );
    } );
  };

  it( 'moves a card to another stage and keeps it there', () => {
    seedAndVisit();
    cy.contains( '[data-cy="pipeline-card"]', 'Marcus Webb' ).find( '[data-cy="pipeline-move"]' ).click();
    cy.get( '[data-cy="pipeline-move-picker"]' ).should( 'be.visible' );
    cy.get( '[data-cy="pipeline-move-picker"]' ).contains( '[data-cy="choice-option"]', 'Negotiation' ).click();
    const laneOf = ( name: string ) => cy.contains( '[data-cy="pipeline-card"]', name ).parents( '.pipeline-column' ).find( '.pipeline-column__title' );
    laneOf( 'Marcus Webb' ).should( 'have.text', 'Negotiation' );
    cy.contains( '.pipeline-column__title', 'Lead Generation' ).parents( '.pipeline-column' ).should( 'not.contain.text', 'Marcus Webb' );

    // Wait for the save to finish before reloading.
    cy.contains( '.pipeline-card__moved', 'Moved' ).should( 'be.visible' );
    cy.reload();
    laneOf( 'Marcus Webb' ).should( 'have.text', 'Negotiation' );
  } );

  it( 'shows one lane at a time on a phone', () => {
    cy.viewport( 390, 844 );
    seedAndVisit();
    cy.get( '[data-cy="pipeline-stage-select"]' ).should( 'be.visible' );
    cy.get( '.pipeline-column:visible' ).should( 'have.length', 1 ).and( 'contain.text', 'Marcus Webb' );
    cy.get( '[data-cy="choice-row"]' ).click();
    cy.contains( '[data-cy="choice-option"]', 'Proposal (1)' ).click();
    cy.get( '.pipeline-column:visible' ).should( 'have.length', 1 ).and( 'contain.text', 'Priya Nair' );
    cy.document().then( ( doc ) => expect( doc.documentElement.scrollWidth ).to.be.at.most( 390 ) );
    cy.get( '[data-cy="pipeline-stage-select"]' ).scrollIntoView();
    cy.screenshot( 'pipeline-phone', { capture: 'viewport' } );
  } );
} );
