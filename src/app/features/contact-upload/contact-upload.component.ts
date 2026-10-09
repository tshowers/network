import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { combineLatest } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Contact, ContactDocument, ContactImage } from '../../models/contact.model';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';

/**
 * Attach images and files to a contact: /contact-upload?id=<contactId>.
 * Ported from TODD's /upload page (features/document/upload-document), which
 * read the contact from in-memory state; here the contact id is in the URL so
 * TODD and other apps can link straight to it. Images go on contact.images,
 * other files on contact.documents, stored under documents/<uid>/ as before.
 */
@Component( {
  selector: 'app-contact-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './contact-upload.component.html',
  styleUrl: './contact-upload.component.css',
} )
export class ContactUploadComponent {
  private readonly dataService = inject( NetworkDataService );

  readonly contactId = String( inject( ActivatedRoute ).snapshot.queryParamMap.get( 'id' ) || '' ).trim();
  contact = signal<Contact | null>( null );
  loading = signal( true );
  uploading = signal( false );
  progress = signal<number | null>( null );
  error = signal( '' );
  status = signal( '' );

  private userId = '';
  private tenantId = '';

  constructor () {
    inject( Title ).setTitle( `${environment.COMPANY_NAME} - Attach Files` );
    if ( !this.contactId ) {
      this.loading.set( false );
      return;
    }
    const auth = inject( NetworkAuthService );
    combineLatest( [auth.getUserId(), auth.getTenantId()] )
      .pipe( takeUntilDestroyed( inject( DestroyRef ) ) )
      .subscribe( ( [userId, tenantId] ) => {
        this.userId = userId || '';
        if ( tenantId && tenantId !== this.tenantId ) {
          this.tenantId = tenantId;
          void this.load();
        }
      } );
  }

  onFileSelect ( event: Event ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if ( file ) this.upload( file );
    input.value = '';
  }

  onDrop ( event: DragEvent ): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if ( file ) this.upload( file );
  }

  onDragOver ( event: DragEvent ): void {
    event.preventDefault();
    if ( event.dataTransfer ) event.dataTransfer.dropEffect = 'copy';
  }

  async removeImage ( index: number ): Promise<void> {
    const images = [...( this.contact()?.images || [] )];
    images.splice( index, 1 );
    await this.save( { images }, 'Image removed.' );
  }

  async removeDocument ( index: number ): Promise<void> {
    const documents = [...( this.contact()?.documents || [] )];
    documents.splice( index, 1 );
    await this.save( { documents }, 'File removed.' );
  }

  private async load (): Promise<void> {
    this.loading.set( true );
    try {
      const contact = await this.dataService.getContact( this.tenantId, this.contactId );
      if ( !contact ) this.error.set( 'That contact could not be found.' );
      this.contact.set( contact );
    } catch {
      this.error.set( 'Unable to load this contact.' );
    } finally {
      this.loading.set( false );
    }
  }

  private upload ( file: File ): void {
    const contact = this.contact();
    if ( !contact || this.uploading() ) return;

    this.error.set( '' );
    this.status.set( '' );
    this.uploading.set( true );
    this.progress.set( 0 );
    const folder = this.userId ? `documents/${this.userId}` : 'documents';
    const task = uploadBytesResumable( ref( getStorage(), `${folder}/${file.name}` ), file );

    task.on( 'state_changed',
      snapshot => this.progress.set( Math.round( ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100 ) ),
      err => {
        this.error.set( err.message || 'Upload failed.' );
        this.uploading.set( false );
        this.progress.set( null );
      },
      async () => {
        const src = await getDownloadURL( task.snapshot.ref );
        if ( file.type.startsWith( 'image/' ) ) {
          const image: ContactImage = { src, alt: file.name };
          await this.save( { images: [...( contact.images || [] ), image] }, `${file.name} added.` );
        } else {
          const document: ContactDocument = { src, name: file.name, type: 'document', uploadDate: new Date().toISOString(), contactId: contact.id };
          await this.save( { documents: [...( contact.documents || [] ), document] }, `${file.name} added.` );
        }
        this.uploading.set( false );
        this.progress.set( null );
      }
    );
  }

  /** Saves only the images/documents field that changed (a merge, not an overwrite). */
  private async save ( changes: Pick<Contact, 'images'> | Pick<Contact, 'documents'>, message: string ): Promise<void> {
    const contact = this.contact();
    if ( !contact ) return;
    try {
      await this.dataService.updateContact( this.tenantId, contact.id, changes );
      this.contact.set( { ...contact, ...changes } );
      this.status.set( message );
    } catch {
      this.error.set( 'Could not save the change to this contact.' );
    }
  }
}
