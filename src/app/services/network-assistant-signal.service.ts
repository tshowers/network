import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface NetworkAssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: 'view' | 'create' | 'edit' | 'list' | 'search' | 'dashboard';
  title?: string;
  description?: string;
  allowedActions?: string[];
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
}

export interface NetworkAssistantActivityEvent {
  feature: string;
  page: string;
  action: string;
  route?: string;
  mode?: string;
  summary?: Record<string, any>;
}

export interface NetworkAssistantTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Real implementation of the bus that every ported Network page already
 * calls into (see contact-home.component.ts's emitAssistantActivity /
 * setPageContext / clearPageContext / pushTranscript / markAssistantUnread /
 * setSignalReady) - this was a no-op stand-in until a real Network-scoped
 * assistant existed to plug into it. Same public method names/signatures as
 * the stub it replaces, so no call site needed to change. Shape mirrors
 * TODD's ToddAssistantBusService, trimmed to only what this app's pages
 * actually publish - no suite-wide growth/cross-sell/maturity-stage state.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkAssistantSignalService {
  private readonly pageContextSubject = new BehaviorSubject<NetworkAssistantPageContext | null>( null );
  private readonly transcriptInSubject = new Subject<NetworkAssistantTranscriptMessage>();
  private readonly activitySubject = new Subject<NetworkAssistantActivityEvent>();
  private readonly unreadSubject = new BehaviorSubject<boolean>( false );
  private readonly readySubject = new BehaviorSubject<boolean>( false );

  readonly pageContext$ = this.pageContextSubject.asObservable();
  readonly transcriptIn$ = this.transcriptInSubject.asObservable();
  readonly activity$ = this.activitySubject.asObservable();
  readonly unread$ = this.unreadSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  get currentPageContext (): NetworkAssistantPageContext | null {
    return this.pageContextSubject.value;
  }

  emitAssistantActivity ( event: NetworkAssistantActivityEvent ): void {
    this.activitySubject.next( event );
  }

  setPageContext ( context: NetworkAssistantPageContext ): void {
    this.pageContextSubject.next( context );
  }

  clearPageContext (): void {
    this.pageContextSubject.next( null );
  }

  pushTranscript ( message: NetworkAssistantTranscriptMessage ): void {
    this.transcriptInSubject.next( message );
  }

  markAssistantUnread (): void {
    this.unreadSubject.next( true );
  }

  clearAssistantUnread (): void {
    this.unreadSubject.next( false );
  }

  setSignalReady (): void {
    this.readySubject.next( true );
  }
}
