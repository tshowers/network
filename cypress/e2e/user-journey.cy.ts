/**
 * One new user's whole first session, in order, carrying state from step to
 * step: get-started wizard -> sign up -> profile -> CSV import + a contact
 * made by hand -> enrichment -> relationship monitoring on /app -> sign out.
 *
 * What's real and what's stood in for:
 * - Sign-up: TODD's hosted login (todd.taliferro.tech) can't run here, so the
 *   test plays its part - it stashes the same pending-login state signIn()
 *   would, then lands on /auth/callback with an unsigned custom token the
 *   Auth emulator accepts. Everything from the callback on is the app's own
 *   code, including OnboardingProfileService.submitIfPending().
 * - Profile API (/api/onboarding/profile, /api/profile): stubbed, but
 *   stateful, so the wizard answers carry through to the profile page.
 * - Contacts: real writes to the Firestore emulator by the import and wizard.
 * - Enrichment: in production it's todd-backend's nightly
 *   scheduledContactMaintenance (OpenAI + email validation, no test mode),
 *   so the test does what that job does to each contact doc - sets
 *   isReconfigured, isEnriched (only when there's a company name), and marks
 *   the first email checked - directly in the emulator.
 * - Monitoring: GET /api/network/dashboard-counts is computed by todd-backend
 *   from tenants/{uid}/contacts. The test computes the same counts from the
 *   emulator's docs and serves them, so the health meters on /app reflect the
 *   contacts this run actually created.
 */
const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8180';
const CONTACTS_PATH = ( uid: string ) => `${FIRESTORE_EMULATOR_URL}/v1/projects/taliferrotech/databases/(default)/documents/tenants/${uid}/contacts`;
// The Firestore emulator lets this token bypass security rules.
const OWNER = { Authorization: 'Bearer owner' };

type FirestoreDoc = { name: string; fields?: Record<string, any> };

const base64Url = ( value: object ) => btoa( JSON.stringify( value ) ).replace( /=+$/, '' ).replace( /\+/g, '-' ).replace( /\//g, '_' );

/** The Auth emulator accepts unsigned (alg: none) custom tokens. */
const emulatorCustomToken = ( uid: string ) => {
  const now = Math.floor( Date.now() / 1000 );
  const serviceAccount = 'cypress@taliferrotech.iam.gserviceaccount.com';
  return `${base64Url( { alg: 'none', typ: 'JWT' } )}.${base64Url( {
    iss: serviceAccount,
    sub: serviceAccount,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  } )}.`;
};

const docId = ( doc: FirestoreDoc ) => doc.name.split( '/' ).pop() as string;

const listContacts = ( uid: string ) => cy.request( { url: CONTACTS_PATH( uid ), headers: OWNER } )
  .then( ( response ) => ( response.body.documents || [] ) as FirestoreDoc[] );

const patchContact = ( uid: string, id: string, fields: Record<string, any> ) => {
  const mask = Object.keys( fields ).map( ( field ) => `updateMask.fieldPaths=${field}` ).join( '&' );
  return cy.request( { method: 'PATCH', url: `${CONTACTS_PATH( uid )}/${id}?${mask}`, headers: OWNER, body: { fields } } );
};

const companyName = ( doc: FirestoreDoc ) => {
  const company = doc.fields?.['company'];
  return ( company?.mapValue?.fields?.name?.stringValue || company?.stringValue || '' ).trim();
};

const emailEntries = ( doc: FirestoreDoc ): any[] => doc.fields?.['emailAddresses']?.arrayValue?.values || [];

/** What scheduledContactMaintenance writes to one contact (contactProcessingService.js). */
const simulateNightlyMaintenance = ( uid: string, doc: FirestoreDoc ) => {
  const now = new Date().toISOString();
  const fields: Record<string, any> = {
    isReconfigured: { booleanValue: true },
    lastReconfigured: { stringValue: now },
  };
  if ( companyName( doc ) ) {
    fields['isEnriched'] = { booleanValue: true };
    fields['lastEnriched'] = { stringValue: now };
  }
  const emails = emailEntries( doc );
  if ( emails.length ) {
    const [first, ...rest] = emails;
    const checked = { mapValue: { fields: { ...first.mapValue?.fields, checked: { booleanValue: true }, blocked: { booleanValue: false }, dateChecked: { stringValue: now } } } };
    fields['emailAddresses'] = { arrayValue: { values: [checked, ...rest] } };
  }
  return patchContact( uid, docId( doc ), fields );
};

/** Mirrors GET /api/network/dashboard-counts (networkBillingRoutes.js). */
const dashboardCountsFrom = ( uid: string, docs: FirestoreDoc[] ) => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth( oneMonthAgo.getMonth() - 1 );
  const live = docs.filter( ( doc ) => docId( doc ) !== uid && doc.fields?.['status']?.stringValue !== 'deleted' );
  const lastContacted = ( doc: FirestoreDoc ) => doc.fields?.['lastContacted']?.stringValue || doc.fields?.['lastContacted']?.timestampValue;
  return {
    totalContacts: live.length,
    enrichedContacts: live.filter( ( doc ) => doc.fields?.['isEnriched']?.booleanValue ).length,
    reconfiguredContacts: live.filter( ( doc ) => doc.fields?.['isReconfigured']?.booleanValue ).length,
    validEmailContacts: live.filter( ( doc ) => emailEntries( doc ).some( ( email ) => email.mapValue?.fields?.checked?.booleanValue && email.mapValue?.fields?.dateChecked ) ).length,
    contactsNeedingFollowUp: live.filter( ( doc ) => lastContacted( doc ) && new Date( lastContacted( doc ) ) < oneMonthAgo ).length,
    subscriberContacts: live.filter( ( doc ) => doc.fields?.['subscriber']?.booleanValue ).length,
    importantContacts: live.filter( ( doc ) => doc.fields?.['important']?.booleanValue ).length,
  };
};

// Each cy.visit is a full reload that restores the emulator session behind the
// splash screen, which can take longer than the 4s default.
describe( 'Network user journey - sign up to sign out', { defaultCommandTimeout: 15000 }, () => {
  const uid = `journey-${Date.now()}`;
  let profile: Record<string, unknown> = {};

  beforeEach( () => {
    cy.clearLocalStorage();

    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    // Import and Save carry appWriteAction - this user has Network write access.
    cy.intercept( 'GET', '**/account/summary', { statusCode: 200, body: { success: true, data: { writeAccess: { network: true } } } } ).as( 'writeAccess' );
    // Setup checklist done, so Home shows the dashboard rather than first-run steps.
    cy.intercept( 'POST', '**/network/imports', { statusCode: 503, body: {} } );
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: { allDone: true, steps: [], counts: { imported: 1 } } } } );

    // The backend's onboarding save only fills blank fields.
    cy.intercept( 'POST', '**/onboarding/profile', ( req ) => {
      for ( const [key, value] of Object.entries( req.body.profile as Record<string, unknown> ) ) {
        if ( !profile[key] ) profile[key] = value;
      }
      req.reply( { statusCode: 200, body: { success: true } } );
    } ).as( 'onboardingProfile' );
    cy.intercept( 'GET', '**/api/profile', ( req ) => req.reply( { statusCode: 200, body: { success: true, profile } } ) ).as( 'loadProfile' );
    cy.intercept( 'PATCH', '**/api/profile', ( req ) => {
      profile = { ...profile, ...req.body.profile };
      req.reply( { statusCode: 200, body: { success: true, profile } } );
    } ).as( 'saveProfile' );
  } );

  it( 'signs up, fills in the profile, adds contacts, sees them monitored, and signs out', () => {
    // 1. Get started wizard, signed out.
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.contains( '[data-cy="get-started-question"]', 'And your last name?' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.contains( '[data-cy="get-started-question"]', "What's your role?" );
    cy.contains( '[data-cy="get-started-role"]', 'Owner' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.contains( '[data-cy="get-started-question"]', "What's your company called?" );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Analytical Co{enter}' );
    cy.contains( '[data-cy="get-started-chip"]', 'Follow up faster' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-timezone"]' ).select( 'America/Chicago' );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-sign-in"]' ).should( 'be.visible' );

    // 2. Sign up. Stand in for TODD's hosted login: same pending state
    // signIn() stores, then back to /auth/callback with a token.
    const state = 'cypress-journey-state';
    cy.visit( `/auth/callback?token=${encodeURIComponent( emulatorCustomToken( uid ) )}&state=${state}`, {
      onBeforeLoad: ( win ) => {
        win.localStorage.setItem( '__useFirebaseEmulators', 'true' );
        win.sessionStorage.setItem( 'network_hosted_login_pending', JSON.stringify( { state, returnUrl: '/app' } ) );
      },
    } );
    cy.wait( '@onboardingProfile' ).then( ( { request } ) => {
      expect( request.body.source ).to.eq( 'network-web' );
      expect( request.body.profile ).to.include( { firstName: 'Ada', lastName: 'Lovelace', profession: 'Owner', companyName: 'Analytical Co', timezone: 'America/Chicago' } );
    } );
    cy.location( 'pathname', { timeout: 15000 } ).should( 'eq', '/app' );
    cy.window().its( 'localStorage' ).invoke( 'getItem', 'network_onboarding_profile_draft' ).should( 'be.null' );

    // 3. Profile shows the wizard answers; fill in the rest.
    cy.visit( '/profile' );
    cy.wait( '@loadProfile' );
    cy.get( '[data-cy="profile-read"]' ).should( 'contain.text', 'Ada Lovelace' ).and( 'contain.text', 'Owner' );
    cy.get( '[data-cy="profile-edit"]' ).click();
    cy.contains( '[data-cy="profile-choice-valueProp"]', 'Personal service' ).click();
    cy.wait( '@writeAccess' );
    cy.get( '[data-cy="profile-save"]' ).should( 'not.be.disabled' ).click();
    cy.wait( '@saveProfile' ).its( 'request.body.profile' ).should( 'include', { firstName: 'Ada', profession: 'Owner' } )
      .and( 'have.property', 'valueProp' ).and( 'not.be.empty' );
    cy.contains( '[data-cy="profile-edit"]', 'Saved' );

    // 4a. Import the sample CSV.
    cy.visit( '/contact-import' );
    cy.get( '[data-cy="csv-import-shell"]' ).should( 'be.visible' );
    cy.get( '[data-cy="ci-sample"]' ).click();
    cy.get( '[data-cy="ci-import"]' ).should( 'contain.text', 'Import 12 contacts' ).click();
    cy.contains( '.ci-card--center h2', '12 contacts imported', { timeout: 15000 } ).should( 'be.visible' );

    // 4b. Create one contact by hand: a company, but no email.
    cy.visit( '/contact-edit' );
    cy.get( '[data-cy="contact-edit-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.get( '[name="firstName"]' ).should( 'be.visible' ).type( 'Grace' );
    cy.get( '[name="lastName"]' ).type( 'Hopper' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();
    cy.get( '[name="companyName"]' ).should( 'be.visible' ).type( 'Compiler Works' );
    for ( let section = 0; section < 3; section++ ) {
      cy.get( '[data-cy="contact-wizard-next"]' ).click();
    }
    cy.get( '[data-cy="contact-wizard-submit"]' ).click();
    cy.get( '[data-cy="contact-view-shell"]', { timeout: 15000 } ).should( 'be.visible' );

    // Both the imported and hand-made contacts are in the list.
    cy.visit( '/contact-list' );
    cy.contains( '.cl-name strong', 'Sarah Chen' ).should( 'be.visible' );
    cy.contains( '.cl-name strong', 'Grace Hopper' ).should( 'be.visible' );

    // 5. Enrichment: what the nightly maintenance job does to each contact.
    // Sarah also hasn't been contacted in two months.
    listContacts( uid ).then( ( docs ) => {
      expect( docs.length, 'contacts written to Firestore' ).to.be.at.least( 5 );
      docs.filter( ( doc ) => docId( doc ) !== uid ).forEach( ( doc ) => simulateNightlyMaintenance( uid, doc ) );
      const sarah = docs.find( ( doc ) => doc.fields?.['firstName']?.stringValue === 'Sarah' );
      expect( sarah, 'imported Sarah Chen' ).to.exist;
      const twoMonthsAgo = new Date( Date.now() - 60 * 24 * 60 * 60 * 1000 ).toISOString();
      patchContact( uid, docId( sarah! ), { lastContacted: { stringValue: twoMonthsAgo } } );
    } );

    // 6. Relationship monitoring on /app, from those contacts.
    listContacts( uid ).then( ( docs ) => {
      const counts = dashboardCountsFrom( uid, docs );
      expect( counts.enrichedContacts, 'every contact had a company, so all are enriched' ).to.eq( counts.totalContacts );
      expect( counts.validEmailContacts, 'Grace has no email' ).to.eq( counts.totalContacts - 1 );
      expect( counts.contactsNeedingFollowUp ).to.eq( 1 );
      cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: { success: true, ...counts } } ).as( 'dashboardCounts' );
    } );
    cy.visit( '/app' );
    cy.get( '[data-cy="contact-home-shell"]' ).should( 'be.visible' );
    cy.contains( '.rel-meter p', '1 relationships need attention now.' ).should( 'be.visible' );
    cy.contains( '.rel-meter p', '0 records still need enrichment.' ).should( 'be.visible' );
    cy.contains( '.rel-meter p', '1 contacts are not safely reachable yet.' ).should( 'be.visible' );
    cy.contains( '.rel-row p', '1 contacts have gone quiet long enough to risk lost momentum.' ).should( 'be.visible' );

    // 7. Sign out from the menu, back to the signed-out site.
    cy.get( '.platform-menu-trigger' ).first().click();
    cy.contains( 'button.um-row', 'Sign out' ).click();
    cy.location( 'pathname', { timeout: 10000 } ).should( 'eq', '/' );
    cy.contains( 'h1', 'Get clients. Keep clients.' ).should( 'be.visible' );
    cy.visit( '/contact-list' );
    cy.get( '.nw-banner' ).should( 'be.visible' );
    cy.get( '.cl-table' ).should( 'not.exist' );
  } );
} );
