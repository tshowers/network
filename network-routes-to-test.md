# Network — Live Routes to Test

Base URL: https://network.16ahead.com

## Public routes

- https://network.16ahead.com/
- https://network.16ahead.com/ios
- https://network.16ahead.com/pricing
- https://network.16ahead.com/login
- https://network.16ahead.com/login?returnUrl=%2Fcontact-list
- https://network.16ahead.com/auth/callback
- https://network.16ahead.com/success
- https://network.16ahead.com/not-found

## Signed-in app routes

- https://network.16ahead.com/app
- https://network.16ahead.com/contact-edit
- https://network.16ahead.com/contact-import
- https://network.16ahead.com/contact-deal-flow
- https://network.16ahead.com/contact-deal-flow-dashboard
- https://network.16ahead.com/contact-list
- https://network.16ahead.com/contact/CONTACT_ID
- https://network.16ahead.com/contact-edit?id=CONTACT_ID

Replace `CONTACT_ID` with the ID of a real contact.

## Fallback route

- https://network.16ahead.com/this-route-does-not-exist

This should render the Network not-found page.

## Route testing notes

- `/login` redirects to the 16Ahead hosted login flow (app.16ahead.com).
- `/auth/callback` requires valid `token` and `state` query parameters from the hosted login flow.
- `/success` requires a valid `session_id` query parameter from checkout.
- The app and contact routes require authentication.
