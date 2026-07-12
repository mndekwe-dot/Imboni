import client from './client'

// ── Billing (school Admin, multi-tenant SaaS) ─────────────────────────────────
// Both calls go through the shared authenticated `client`, so they carry the
// bearer token and target the current school subdomain, same-origin.

// GET current plan + subscription status for this school.
export const getBillingStatus = () => client.get('/imboni/billing/status/')

// POST to start a Stripe Checkout session for `plan`; resolves to
// { checkout_url } which the caller redirects the browser to.
export const startCheckout = (plan) => client.post('/imboni/billing/checkout/', { plan })
