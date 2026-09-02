import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contact } from '../models/contact.model';

/**
 * Just the one method Network needs out of OpenAIService (696 lines total,
 * covering everything from campaign copy to survey generation) -
 * contactInsight() is a single POST to the same /contact-insight endpoint
 * the iOS app's "TODD Insight" already calls, with the same static Bearer
 * key every TODD frontend ships.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkInsightService {
  constructor ( private http: HttpClient ) { }

  contactInsight ( contact: Contact ): Observable<any> {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/contact-insight`, { profile: contact }, { headers } );
  }
}
