// You can add custom commands or global hooks here
import './commands';

// Prevent AUT-level uncaught exceptions (e.g. Firebase init, zone.js async errors)
// from failing tests.
Cypress.on( 'uncaught:exception', () => false );

// The dev server talks to the production API, so a test that wanders into a
// purchase would open a real (live) Stripe checkout. Fail those calls instead;
// a test that means to exercise checkout stubs its own, which wins.
beforeEach( () => {
  cy.intercept( 'POST', /\/(checkout|portal)(\?.*)?$/, {
    statusCode: 418,
    body: { message: 'Checkout is blocked in e2e runs.' },
  } );
} );
