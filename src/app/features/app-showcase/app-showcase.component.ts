import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-network-app-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-showcase.component.html',
  styleUrl: './app-showcase.component.css'
} )
export class AppShowcaseComponent {
  readonly highlights = [
    {
      heading: 'Open the app to your signal, not your inbox',
      copy: 'TODD shows you who needs attention and why — so you know where to focus before an opportunity goes quiet.'
    },
    {
      heading: 'Capture the relationship while it’s happening',
      copy: 'Meet someone. Add them in seconds. Network carries the new relationship into the same graph TODD is already watching.'
    },
    {
      heading: 'Walk into every conversation with context',
      copy: 'Know the company, role, deal stage, history, and TODD insight before the call, meeting, or follow-up begins.'
    }
  ];

  readonly stats = [
    { value: '1', label: 'relationship graph, kept current from wherever you are' },
    { value: '360°', label: 'contact context available on the go' },
    { value: '0', label: 'follow-ups lost because you were away from your desk' }
  ];
}
