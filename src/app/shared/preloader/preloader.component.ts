import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Trimmed replacement for TODD's PreloaderComponent (1975 lines of CSS for
 * a branded orbit-animation loading screen, in the original) - Network
 * just needs a plain spinner, not a full port of that.
 */
@Component( {
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrl: './preloader.component.css',
} )
export class PreloaderComponent {
  @Input() isLoading = false;
  @Input() message = '';
}
