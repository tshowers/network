import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';

@Component({ selector: 'app-theme-toggle', standalone: true, template: `<button class="theme-toggle" type="button" (click)="toggle()" [attr.aria-label]="isDark ? 'Switch to light mode' : 'Switch to dark mode'"><span aria-hidden="true">{{ isDark ? '☼' : '☾' }}</span><span>{{ isDark ? 'Light' : 'Dark' }}</span></button>`, styleUrl: './theme-toggle.component.css' })
export class ThemeToggleComponent implements OnInit {
  isDark = false;
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // Prerendering/SSR runs this in Node, where localStorage/window/document
  // don't exist — the toggle is a no-op there (isDark stays its default,
  // false) and only reads/applies the real preference once it's actually
  // running in a browser. A prerendered page briefly shows the light theme
  // until hydration applies the saved preference, same tradeoff as most
  // SSR apps take rather than inlining a theme-detection script in index.html.
  ngOnInit(): void {
    if (!this.isBrowser) return;
    const saved = localStorage.getItem('platform-theme');
    this.isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.apply();
  }
  toggle(): void {
    if (!this.isBrowser) return;
    this.isDark = !this.isDark;
    this.apply();
    localStorage.setItem('platform-theme', this.isDark ? 'dark' : 'light');
  }
  private apply(): void { const theme = this.isDark ? 'dark' : 'light'; document.documentElement.classList.toggle('dark', this.isDark); document.documentElement.dataset['theme'] = theme; window.dispatchEvent(new CustomEvent('platform-theme-change', { detail: { theme } })); }
}
