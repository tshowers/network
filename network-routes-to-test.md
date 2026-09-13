# Network — Live Routes to Test

Base URL: https://network.taliferro.tech

## Public routes

- https://network.taliferro.tech/
- https://network.taliferro.tech/ios
- https://network.taliferro.tech/pricing
- https://network.taliferro.tech/login
- https://network.taliferro.tech/login?returnUrl=%2Fcontact-list
- https://network.taliferro.tech/auth/callback
- https://network.taliferro.tech/success
- https://network.taliferro.tech/not-found

## Signed-in app routes

- https://network.taliferro.tech/app
- https://network.taliferro.tech/contact-edit
- https://network.taliferro.tech/contact-import
- https://network.taliferro.tech/contact-deal-flow
- https://network.taliferro.tech/contact-deal-flow-dashboard
- https://network.taliferro.tech/contact-list
- https://network.taliferro.tech/contact/CONTACT_ID
- https://network.taliferro.tech/contact-edit?id=CONTACT_ID

Replace `CONTACT_ID` with the ID of a real contact.

## Fallback route

- https://network.taliferro.tech/this-route-does-not-exist

This should render the Network not-found page.

## Route testing notes

- `/login` redirects to TODD's hosted login flow.
- `/auth/callback` requires valid `token` and `state` query parameters from the hosted login flow.
- `/success` requires a valid `session_id` query parameter from checkout.
- The app and contact routes require authentication.
