import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

/** Ported verbatim - pure HttpClient, same shared linkpreview.net key every TODD frontend uses. */
@Injectable({
  providedIn: 'root'
})
export class LinkPreviewService {

  private apiKey = environment.linkPreview;
  private apiUrl = 'https://api.linkpreview.net';

  constructor(private http: HttpClient, private logger: LoggerService) {}

  fetchLinkPreview(url: string): Observable<any> {
    if (!url) {
      return throwError(() => new Error('URL parameter is required'));
    }
    const encodedUrl = encodeURIComponent(url);
    return this.http.get(`${this.apiUrl}/?key=${this.apiKey}&q=${encodedUrl}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.error instanceof ErrorEvent) {
      this.logger.error('An error occurred:', error.error.message);
    } else {
      this.logger.error(`Backend returned code ${error.status}, body was: `, error.error);
    }
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }
}
