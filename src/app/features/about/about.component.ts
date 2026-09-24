import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';

@Component({
  selector: 'app-network-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent implements OnInit, OnDestroy {
  private schemaScript: HTMLScriptElement | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2,
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'About Network | Taliferro Tech';
    const description = 'Network is Taliferro Tech\'s relationship system: every contact gets a stage, so TODD can surface who needs attention and what to do next.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://network.taliferro.tech/about' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://network.taliferro.tech/about');
    this.addStructuredData();
  }

  ngOnDestroy(): void {
    this.schemaScript?.remove();
  }

  // Same shared Organization @id Find's About page uses — schema.org
  // convention for "this is the same real-world entity" across pages,
  // rather than each product page implying an unrelated, duplicate
  // organization. Gives an AI/search system unambiguous, structured facts
  // (name, category, creator) rather than needing to parse free-text prose.
  private addStructuredData(): void {
    this.schemaScript = this.renderer.createElement('script') as HTMLScriptElement;
    this.schemaScript.type = 'application/ld+json';
    this.schemaScript.id = 'network-about-structured-data';
    this.schemaScript.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://taliferro.com/#organization',
          name: 'Taliferro Tech, LLC',
          url: 'https://taliferro.com',
          logo: 'https://network.taliferro.tech/assets/find/entities/taliferro-tech/logo.png',
          description: 'Taliferro Tech creates software products that help people find information, build momentum, and act on useful context.',
        },
        {
          '@type': 'SoftwareApplication',
          '@id': 'https://network.taliferro.tech/#software',
          name: 'Network',
          url: 'https://network.taliferro.tech/',
          description: 'Network is a relationship-intelligence application: every contact gets a stage, so TODD can surface who needs attention and what to do next, instead of just storing names and emails.',
          applicationCategory: 'BusinessApplication',
          applicationSubCategory: 'Relationship management',
          operatingSystem: 'Web',
          image: 'https://network.taliferro.tech/assets/seo/network-card.webp',
          creator: { '@id': 'https://taliferro.com/#organization' },
          publisher: { '@id': 'https://taliferro.com/#organization' },
        },
      ],
    });
    this.renderer.appendChild(this.document.head, this.schemaScript);
  }
}
