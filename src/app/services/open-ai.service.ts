import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

/**
 * Trimmed port of TODD's open-ai.service.ts, scoped to the one endpoint the
 * assistant-box pilot needs: the shared `/app-assistant` endpoint that the
 * whole suite already calls, parameterized by domain. Network only ever
 * asks for the 'contact' domain slice of it - see the assistant-box
 * scoping decision (frontend/.../assistant-capabilities.service.ts and its
 * siblings carry the other domains for TODD itself).
 */
@Injectable( { providedIn: 'root' } )
export class OpenAIService {
  constructor ( private http: HttpClient, private logger: LoggerService ) { }

  private wrapDataForDomain ( data?: any ): any | null {
    if ( !data ) return null;

    if ( Array.isArray( data ) ) return { contacts: data };

    if ( typeof data === 'object' ) {
      if ( Array.isArray( ( data as any ).contacts ) ) return data;

      const looksLikeEntity = ( obj: any ) => obj && ( obj.id || obj.title || obj.name || obj.email || obj.company );
      if ( looksLikeEntity( data ) ) return { contacts: [data] };
      return data;
    }

    return null;
  }

  getAssistance ( prompt: string, domain: 'general' | 'contact', user?: string, data?: any ): Observable<any> {
    this.logger.log( 'Calling', `${environment.backendURL}/app-assistant`, 'With this message', prompt );
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    const payload = {
      prompt,
      domain,
      data: this.wrapDataForDomain( data )
    };

    return this.http
      .post<any>( `${environment.backendURL}/app-assistant`, payload, { headers } )
      .pipe(
        tap( ( res ) => {
          try {
            this.logger.info( 'APP_ASSISTANT_RAW_RESPONSE', { domain, type: typeof res } );
          } catch { /* ignore */ }
        } ),
        catchError( ( err: any ) => {
          this.logger.error( 'APP_ASSISTANT_ERROR', { domain, err } );
          return throwError( () => err );
        } )
      );
  }

  getContactAssistantResponse ( prompt: string, userId: string, data: any ): Observable<any> {
    return this.getAssistance( prompt, 'contact', userId, data );
  }
}
