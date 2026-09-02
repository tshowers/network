import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component( {
  selector: 'app-quick-action-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-action-card.component.html',
  styleUrl: './quick-action-card.component.css'
} )
export class QuickActionCardComponent {
  @Input() eyebrow = '';
  @Input() heading = '';
  @Input() isSubmitting = false;
  @Input() errorMessage = '';
}
