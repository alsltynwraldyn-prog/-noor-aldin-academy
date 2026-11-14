# ARVYQEN account and membership setup

## 1) Create Supabase project
Use the published site URL exactly, including the GitHub Pages repository path if present. For this repository the expected Pages URL is `https://alsltynwraldyn-prog.github.io/-noor-aldin-academy/`. The callback URL is on Supabase, not GitHub Pages: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paytabs-callback`.

Create a project in Supabase. In Authentication > URL Configuration set the production Site URL to the published site URL and add `/account.html` as an allowed redirect URL. Enable email confirmations and configure SMTP before public launch.

## 2) Database
Run `schema.sql` in the Supabase SQL Editor. It creates profiles, plans, orders and subscriptions with Row Level Security. Clients can read only their own profile/orders/subscriptions. The client cannot create or mark paid orders.

## 3) Public browser config
Copy `config.example.js` to the repository root as `supabase-config.js`, then replace the project URL and anon key with values from Project Settings > API. The anon key is public by design; NEVER expose the service_role key in a browser file or GitHub repository. Add `supabase-config.js` to .gitignore if you work locally with real project details.

## 4) Plan prices
The two VIP plan rows are intentionally inactive and have zero amount until the owner sets approved prices. Update `amount_minor` in the database using the smallest currency unit (for JOD, fils; 1 JOD = 1000 fils) and set `active=true` only after legal terms, taxes, renewal/cancellation rules, and the payment merchant account are ready.

## 5) Payment provider
For a Jordan-registered merchant, do not assume Stripe onboarding is available. PayTabs publishes a Jordan endpoint and repeat-billing documentation. Merchant onboarding and recurring-payment enablement are subject to PayTabs approval. The integration must run server-side (Supabase Edge Functions), never from browser JavaScript. Keep the server key and profile ID in Supabase Function Secrets.

PayTabs Jordan payment endpoint: `https://secure-jordan.paytabs.com/payment/request`.
A production flow must:
- Require an authenticated Supabase user.
- Load the plan amount from the database (never trust an amount sent by the browser).
- Create a pending order on the server.
- Request a hosted checkout URL from PayTabs.
- Confirm payment server-to-server using PayTabs' verification/query flow before activating a subscription.
- Make callbacks idempotent; never activate access based only on the browser return URL.
- Define recurring billing, cancellation, refunds, failed-payment handling, and expiry rules with the provider.

## 6) Before launch
Configure SMTP, domain and HTTPS; set real plan prices; complete merchant KYC; configure PayTabs recurring billing and webhook verification; review privacy/terms and tax obligations; test signup, email confirmation, password reset, checkout success/failure, refunds, renewal, cancellation and expiry. The current static GitHub Pages deployment alone cannot safely hold payment secrets or run a trusted webhook.

## 7) Deploy server functions
Install the Supabase CLI, link the project, and deploy both functions:
```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set PAYTABS_SERVER_KEY=YOUR_SERVER_KEY PAYTABS_PROFILE_ID=YOUR_PROFILE_ID SITE_URL=https://YOUR_PUBLISHED_SITE_URL
supabase functions deploy create-checkout
supabase functions deploy paytabs-callback --no-verify-jwt
```
The callback is intentionally public because PayTabs calls it server-to-server; it independently verifies the transaction by querying PayTabs with the server key before activating a membership. Keep `SUPABASE_SERVICE_ROLE_KEY` and `PAYTABS_SERVER_KEY` only in Supabase-managed secrets, never in the repository or browser.

## 8) Subscription model limitation
The included checkout creates a paid fixed-term membership (one month or one year) and calculates its expiry. It does not silently auto-charge a card. Automatic renewal requires PayTabs recurring billing/tokenization to be enabled for the merchant profile, a compliant customer consent flow, stored payment tokens handled server-side, retry/cancellation logic, and separate testing. Until that is implemented and approved, renewals are manual.
