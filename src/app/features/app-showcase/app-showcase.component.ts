import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StatusLedComponent, StatusLedTone } from '../../shared/status-led/status-led.component';

@Component( {
  selector: 'app-network-app-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLedComponent],
  templateUrl: './app-showcase.component.html',
  styleUrl: './app-showcase.component.css'
} )
export class AppShowcaseComponent {
  readonly highlights: {
    screenLabel: string;
    screenRows: { name: string; meta: string; tone: StatusLedTone }[];
    heading: string;
    copy: string;
  }[] = [
    {
      screenLabel: 'Today',
      screenRows: [
        { name: 'Sarah Chen', meta: 'Meridian Group · 14 days quiet', tone: 'attention' },
        { name: 'James Okafor', meta: 'Oakfield Labs · deal stalling', tone: 'attention' },
        { name: 'Priya Nair', meta: 'Kestrel Systems · new contact', tone: 'info' }
      ],
      heading: 'Open the app to your signal, not your inbox',
      copy: 'TODD ranks who needs attention the moment you unlock your phone — no scrolling a contact list to figure out who to reach today.'
    },
    {
      screenLabel: 'Quick Add',
      screenRows: [
        { name: 'New contact', meta: 'Name · company · one tap save', tone: 'positive' }
      ],
      heading: 'Capture a contact the moment you meet them',
      copy: 'Walk out of a meeting and add someone in seconds, right from your pocket. It syncs into the same relationship graph TODD reads from everywhere else.'
    },
    {
      screenLabel: 'Sarah Chen',
      screenRows: [
        { name: 'VP Operations', meta: 'Meridian Group · Active deal', tone: 'positive' }
      ],
      heading: 'Full context, wherever the conversation happens',
      copy: 'Company, role, deal stage, and every past interaction — on your phone before a call, not just at your desk.'
    }
  ];

  readonly stats = [
    { value: '1', label: 'relationship graph, kept current from wherever you are' },
    { value: '360°', label: 'contact context available on the go' },
    { value: '0', label: 'follow-ups lost because you were away from your desk' }
  ];
}
