# ARVYQEN account and membership setup

## 1) Create Supabase project
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
