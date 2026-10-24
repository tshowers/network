import { Component, Input } from '@angular/core';

/**
 * What a main page shows before there's data (design_handoff_network_onboarding
 * 08): the page name, a soft illustration, what will appear here, and the
 * one action that gets it there (projected as content).
 */
@Component( {
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="es" [attr.aria-label]="heading">
      <span class="nw-eyebrow">{{ kicker }}</span>
      <div class="es-art" aria-hidden="true"><span></span><span></span><span></span></div>
      <h2>{{ heading }}</h2>
      <p>{{ body }}</p>
      <div class="es-actions"><ng-content /></div>
    </section>
  `,
  styles: `
    .es { display: flex; flex-direction: column; gap: 14px; max-width: 560px; padding: 32px; border-radius: 24px; background: var(--surface); }
    .es-art { position: relative; height: 96px; }
    .es-art span { position: absolute; border-radius: 50%; }
    .es-art span:nth-child(1) { left: 0; top: 8px; width: 80px; height: 80px; background: var(--t-blue); }
    .es-art span:nth-child(2) { left: 52px; top: 0; width: 56px; height: 56px; background: var(--t-green); }
    .es-art span:nth-child(3) { left: 92px; top: 44px; width: 40px; height: 40px; background: var(--bg); }
    h2 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
    p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--muted); }
    .es-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  `,
} )
export class EmptyStateComponent {
  @Input( { required: true } ) kicker!: string;
  @Input( { required: true } ) heading!: string;
  @Input( { required: true } ) body!: string;
}
