import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';

interface HelpOutcome {
  icon: string;
  title: string;
  copy: string;
}

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
  route: string;
  action: string;
}

interface HelpStage {
  label: string;
  meaning: string;
  statuses: string;
  nextMove: string;
}

interface HelpRoutineStep {
  when: string;
  title: string;
  copy: string;
  route: string;
  action: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageTitle = 'Network Help — How to work your relationships | Taliferro Tech';
    const description = 'A walkthrough of Network: import or add contacts, give each relationship a stage, check relationship health, and act on TODD\'s weekly priorities.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://network.taliferro.tech/help' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://network.taliferro.tech/help');
  }

  readonly outcomes: HelpOutcome[] = [
    {
      icon: 'fa-bell',
      title: 'Stop losing follow-ups',
      copy: 'Every person has a stage, so you can see who is waiting on you instead of trying to remember it.',
    },
    {
      icon: 'fa-bullseye',
      title: 'Know who to contact this week',
      copy: 'TODD Action Priorities point to the relationships that need a closer look right now.',
    },
    {
      icon: 'fa-chart-line',
      title: 'See your network turn into results',
      copy: 'Watch people move from first contact to real opportunities and customers, and spot where they stall.',
    },
  ];

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Bring in the people you already know',
      copy: 'Most people already have a network in a spreadsheet, phone export, or CRM. Import it first, because Network can only help with relationships it knows about.',
      details: [
        'Choose a CSV file, or use the sample data to see how the flow works first.',
        'Match your CSV headers to Network fields. A header row is required, and first name, last name, email, and phone are the most useful columns.',
        'Review the matched rows, confirm the count, and finish. Your Contacts list opens when the import is done.',
        'Sign in first. Guest mode lets you explore, but it can’t save contacts.',
      ],
      route: '/contact-import',
      action: 'Import contacts',
    },
    {
      number: '02',
      title: 'Or add people one at a time',
      copy: 'Met someone new? Add them while the conversation is fresh. The guided form asks for the details Network uses to understand the relationship.',
      details: [
        'Use Next and Previous to move through the form.',
        'Add the person’s company, profession, email, phone, and notes on how you met and what you talked about.',
        'Pick a status (see “What the stages mean” below) so the person shows up in your pipeline.',
      ],
      route: '/contact-edit',
      action: 'Add a contact',
    },
    {
      number: '03',
      title: 'Give each relationship a stage',
      copy: 'This is the step that turns a contact list into a network you can work. A stage says where things stand today, so Network knows who needs attention.',
      details: [
        'Open Contacts, search by name, company, or email, and select a person.',
        'Edit their status to match where the relationship really is. Honest stages give better priorities.',
        'Start with your 10–20 most important people. You don’t need to stage everyone on day one.',
      ],
      route: '/contact-list',
      action: 'Open Contacts',
    },
    {
      number: '04',
      title: 'Check your relationship health',
      copy: 'Once people have stages, the Relationships page shows how healthy your network is and what to fix first.',
      details: [
        'The health meters score relationship health, data readiness (how complete your records are), reachability (whether you can contact people), and relief progress.',
        'Each diagnosis row reads left to right: the problem, what to do about it, how that helps, and the evidence it is working.',
        'Low data readiness or reachability usually means you should add missing emails, phones, or stages.',
      ],
      route: '/app',
      action: 'Open Relationships',
    },
    {
      number: '05',
      title: 'Act on your priorities',
      copy: 'Networking Progress shows where every relationship stands and which ones TODD thinks need a closer look.',
      details: [
        'Start with TODD Action Priorities. These are the people to reach out to next.',
        'Pipeline Flow shows how many people are at each stage and where momentum is building or stalling.',
        'Lane View lists the people behind each stage. Select anyone to open their record.',
        'Want a simpler board of cards by stage? Use Pipeline for a quick visual check.',
      ],
      route: '/contact-deal-flow-dashboard',
      action: 'Open Networking Progress',
    },
  ];

  readonly stages: HelpStage[] = [
    {
      label: 'Contacted',
      meaning: 'You made the first move.',
      statuses: 'Lead Generation',
      nextMove: 'Follow up if you haven’t heard back within a week.',
    },
    {
      label: 'Engaged',
      meaning: 'They replied or showed real interest.',
      statuses: 'Engagement',
      nextMove: 'Find out what they need and whether you can help.',
    },
    {
      label: 'Qualified',
      meaning: 'It’s worth a focused follow-up.',
      statuses: 'Qualification',
      nextMove: 'Set up a real conversation or meeting.',
    },
    {
      label: 'Opportunity',
      meaning: 'The conversation could become business.',
      statuses: 'Proposal, Negotiation',
      nextMove: 'Send the proposal, agree on terms, and set a date.',
    },
    {
      label: 'Customer',
      meaning: 'The relationship is producing value.',
      statuses: 'Closing, Post-Sale, Closed Won',
      nextMove: 'Keep in touch, look after them, and ask for introductions.',
    },
  ];

  readonly routine: HelpRoutineStep[] = [
    {
      when: 'Monday',
      title: 'Check your health',
      copy: 'Open Relationships and look at which meter is lowest. That is this week’s focus.',
      route: '/app',
      action: 'Relationships',
    },
    {
      when: 'Monday',
      title: 'Pick 3–5 people',
      copy: 'Choose from TODD Action Priorities on Networking Progress. Keep the list small enough to finish.',
      route: '/contact-deal-flow-dashboard',
      action: 'Priorities',
    },
    {
      when: 'During the week',
      title: 'Reach out',
      copy: 'Send the email, make the call, share the article. After each one, write a line in their notes.',
      route: '/contact-list',
      action: 'Contacts',
    },
    {
      when: 'Friday',
      title: 'Update stages',
      copy: 'Move anyone whose relationship changed. This keeps next week’s priorities accurate.',
      route: '/contact-deal-flow',
      action: 'Pipeline',
    },
  ];

  scrollTo ( id: string ): void {
    document.getElementById( id )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }
}
