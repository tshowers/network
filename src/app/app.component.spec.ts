import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, of } from 'rxjs';
import { AppComponent } from './app.component';
import { NetworkAuthService } from './services/network-auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        // Real SwUpdate needs a registered service worker; AppComponent
        // only touches it behind `if (!environment.production) return;` in
        // ngOnInit, but it's injected eagerly, so a stub still has to exist.
        {
          provide: SwUpdate, useValue: {
            isEnabled: false,
            versionUpdates: EMPTY,
            checkForUpdate: () => Promise.resolve( false ),
            activateUpdate: () => Promise.resolve( true ),
          },
        },
        // Real NetworkAuthService calls getAuth(), which needs
        // initializeApp() to have run first - that only happens as a side
        // effect of importing app.config.ts (main.ts's entry point), not
        // here. Stubbed the same way a real signed-out visitor resolves.
        {
          provide: NetworkAuthService, useValue: {
            getUser: () => of( null ),
            isLoggedIn: () => of( false ),
            signOut: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();
  });

  it( 'should create the app', () => {
    const fixture = TestBed.createComponent( AppComponent );
    expect( fixture.componentInstance ).toBeTruthy();
  } );

  it( `should have the 'network' title`, () => {
    const fixture = TestBed.createComponent( AppComponent );
    expect( fixture.componentInstance.title ).toEqual( 'network' );
  } );
} );
