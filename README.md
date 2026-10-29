# Network

![Network banner](docs/network-banner.png)

Network is 16Ahead's relationship graph — every contact, company, deal, and interaction, read continuously by 16Ahead to surface who needs attention, which relationships are gaining momentum, and what's at risk of going cold. Built by [Taliferro Tech](https://taliferro.com) as part of the [16Ahead](https://app.16ahead.com) product family.

**Live:** [network.16ahead.com](https://network.16ahead.com)

Extracted from the 16Ahead hub's own `features/contact/*` into its own standalone Angular app — same shared `taliferrotech` Firebase project and `api.taliferro.tech` backend as the hub (and as the other extracted products, `find`/`sayit`/`email-signature-builder`), just a separate frontend deployment. Nothing about the data layer or backend routes changes; the hub's own contact-data services stay in place for the other modules (Outreach, Docs, Lead Vault, etc.) that depend on them internally.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```
