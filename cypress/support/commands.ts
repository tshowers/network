/**
 * visitWithFirebaseEmulators works by writing __useFirebaseEmulators and
 * __cypressEmulatorCredentials to localStorage before the app boots.
 * app.config.ts only reads them when window.Cypress is present (see
 * appReady there) - this has no effect outside a Cypress-driven browser,
 * never in production, never in normal dev use.
 */
type EmulatorCredentials = {
  email: string;
  password: string;
};

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9199';
const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8180';
const FIRESTORE_PROJECT_ID = 'taliferrotech';

type EmulatorAccount = {
  uid: string;
  idToken: string;
};

declare global {
  namespace Cypress {
    interface Chainable {
      visitWithFirebaseEmulators ( path: string, credentials: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ): Chainable<AUTWindow>;
      /** Creates (or signs in) an emulator user via the Auth emulator's REST API - used to get a uid + idToken for seeding Firestore before the app itself signs in as the same user via visitWithFirebaseEmulators. */
      emulatorSignUp ( credentials: EmulatorCredentials ): Chainable<EmulatorAccount>;
      /** Writes a contact doc straight to the Firestore emulator at tenants/{uid}/contacts/{contactId}, mirroring NetworkDataService.addContact's write shape - lets a test seed data without driving the whole wizard. */
      seedContact ( account: EmulatorAccount, contactId: string, contact: Record<string, unknown> ): Chainable<Cypress.Response<unknown>>;
    }
  }
}

/** Converts a plain JS value into the Firestore REST API's typed value wrapper. */
function toFirestoreValue ( value: unknown ): unknown {
  if ( value === null || value === undefined ) return { nullValue: null };
  if ( typeof value === 'string' ) return { stringValue: value };
  if ( typeof value === 'boolean' ) return { booleanValue: value };
  if ( typeof value === 'number' ) return { doubleValue: value };
  if ( Array.isArray( value ) ) return { arrayValue: { values: value.map( toFirestoreValue ) } };
  if ( typeof value === 'object' ) return { mapValue: { fields: toFirestoreFields( value as Record<string, unknown> ) } };
  throw new Error( `seedContact: unsupported value type ${typeof value}` );
}

function toFirestoreFields ( obj: Record<string, unknown> ): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for ( const [key, value] of Object.entries( obj ) ) {
    fields[key] = toFirestoreValue( value );
  }
  return fields;
}

Cypress.Commands.add( 'visitWithFirebaseEmulators', ( path: string, credentials: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ) => {
  return cy.visit( path, {
    ...options,
    onBeforeLoad: ( win ) => {
      win.localStorage.setItem( '__useFirebaseEmulators', 'true' );
      win.localStorage.setItem( '__cypressEmulatorCredentials', JSON.stringify( credentials ) );

      if ( options?.onBeforeLoad ) {
        options.onBeforeLoad( win );
      }
    },
  } );
} );

Cypress.Commands.add( 'emulatorSignUp', ( { email, password }: EmulatorCredentials ) => {
  return cy.request( {
    method: 'POST',
    url: `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    body: { email, password, returnSecureToken: true },
  } ).then( ( response ) => ( { uid: response.body.localId as string, idToken: response.body.idToken as string } ) );
} );

Cypress.Commands.add( 'seedContact', ( account: EmulatorAccount, contactId: string, contact: Record<string, unknown> ) => {
  return cy.request( {
    method: 'POST',
    url: `${FIRESTORE_EMULATOR_URL}/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/tenants/${account.uid}/contacts?documentId=${contactId}`,
    headers: { Authorization: `Bearer ${account.idToken}` },
    body: { fields: toFirestoreFields( contact ) },
  } );
} );

export { };
