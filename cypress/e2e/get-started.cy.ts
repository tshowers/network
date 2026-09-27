/**
 * Pre-sign-in onboarding wizard at /get-started: one question per screen
 * under a 4-segment progress bar whose first segment ("Start") is already
 * complete, answers persisted to localStorage so they survive the redirect
 * to TODD's hosted login, and a final step that hands off to that login.
 */
describe( 'Get started wizard', () => {
  const storageKey = 'network_onboarding_profile_draft';

  beforeEach( () => {
    cy.clearLocalStorage();
  } );

  it( 'starts with the first segment complete and walks every question', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-shell"]' ).should( 'be.visible' );

    cy.get( '[data-cy="get-started-progress"] li' ).should( 'have.length', 4 );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 0 ).should( 'have.class', 'is-done' );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 1 ).should( 'have.class', 'is-active' );

    cy.contains( '[data-cy="get-started-question"]', "What's your first name?" );
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );

    cy.contains( '[data-cy="get-started-question"]', 'And your last name?' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );

    cy.contains( '[data-cy="get-started-question"]', "What's your role?" );
    cy.contains( '[data-cy="get-started-role"]', 'Owner' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="get-started-input"]' ).should( 'not.exist' );
    cy.get( '[data-cy="get-started-role-other"]' ).click();
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Founder{enter}' );

    cy.contains( '[data-cy="get-started-question"]', "What's your company called?" );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 1 ).should( 'have.class', 'is-done' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Analytical Co{enter}' );

    cy.contains( '[data-cy="get-started-question"]', 'What do you want Network to help you with?' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.contains( '[data-cy="get-started-chip"]', 'Follow up faster' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'What timezone is your workday in?' );
    cy.get( '[data-cy="get-started-timezone"]' ).select( 'America/Chicago' );
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'create your account' );
    cy.get( '[data-cy="get-started-sign-in"]' ).should( 'be.visible' );

    cy.window().then( ( win ) => {
      const draft = JSON.parse( win.localStorage.getItem( storageKey ) || '{}' );
      expect( draft ).to.include( {
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'Founder',
        companyName: 'Analytical Co',
        timezone: 'America/Chicago',
        readyToSubmit: true,
      } );
      expect( draft.helpWith ).to.deep.equal( ['Follow up faster'] );
    } );
  } );

  it( 'goes back without losing answers and lets optional steps be skipped', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-back"]' ).click();
    cy.get( '[data-cy="get-started-input"]' ).should( 'have.value', 'Ada' );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.contains( '[data-cy="get-started-role"]', 'Sales' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.contains( '[data-cy="get-started-question"]', "What's your company called?" );
    cy.contains( 'button', 'Skip' ).click();
    cy.contains( '[data-cy="get-started-question"]', 'What do you want Network to help you with?' );
    cy.window().then( ( win ) => {
      expect( JSON.parse( win.localStorage.getItem( storageKey ) || '{}' ).role ).to.equal( 'Sales' );
    } );
  } );

  it( 'resumes a saved draft after a reload', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Grace' );
    cy.reload();
    cy.get( '[data-cy="get-started-input"]' ).should( 'have.value', 'Grace' );
  } );

  it( 'hands off to TODD hosted login from the last step', () => {
    cy.window().then( ( win ) => win.localStorage.setItem( storageKey, JSON.stringify( {
      firstName: 'Ada', lastName: 'Lovelace', role: 'Owner', companyName: '', helpWith: ['Follow up faster'], helpNote: '', timezone: 'America/Chicago', readyToSubmit: false,
    } ) ) );
    cy.visit( '/get-started' );
    ['{enter}', '{enter}'].forEach( ( key ) => cy.get( '[data-cy="get-started-input"]' ).type( key ) );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.contains( 'button', 'Skip' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-sign-in"]' ).click();
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );

  it( 'links returning users straight to sign-in', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href' ).and( 'include', '/login' );
  } );
} );
