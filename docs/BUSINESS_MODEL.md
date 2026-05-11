# Statvora — Business Model

## What Statvora Does

Statvora is a creator intelligence platform that sits between **content creators** and **marketing teams / agencies**.

Creators connect their YouTube and Instagram accounts. Statvora pulls live metrics and generates a verified public profile page at `statvora.in/c/<username>`. When a creator pitches a brand, they share this link instead of a PDF media kit or screenshots — the brand sees real, live numbers.

Brands and agencies use Statvora's discovery and search tools to find verified creators for campaigns, review their metrics before reaching out, and message them directly.

---

## Customer Segments

### Creators (supply side)

Content creators who monetise through brand deals. They need:
- A professional, real-time media kit they can share in a link
- Proof their numbers are real (not fake/inflated)
- A way to be discovered by brands without cold outreach

Typical creator: YouTube channel with 5K–500K subscribers monetising via sponsorships; may also have Instagram.

### Businesses (demand side)

Marketing managers, brand managers, and talent agencies who run influencer campaigns. They need:
- A searchable database of verified creators with real metrics
- Filters by category, subscriber count, average views, etc.
- Direct messaging to creators
- A programmatic API for integrating creator data into their own tools

Typical customer: Brand with a recurring influencer budget; agency managing multiple brand accounts.

---

## Revenue Model

Freemium SaaS with separate pricing tracks for creators and businesses.

### Creator Plans

| Tier | Price | Intended for |
|---|---|---|
| **Starter** | Free | Getting started; basic dashboard + public profile |
| **Specialist** | $9/mo or $90/yr | Active creators who need advanced analytics |
| **Growth** | $19/mo or $190/yr | Creators with multiple brand deal pipelines |
| **Enterprise** | Contact sales | Large creators / MCNs with custom needs |

Annual billing saves ~17% (2 months free).

### Business Plans

| Tier | Price | Intended for |
|---|---|---|
| **Starter** | Free | Small teams trying the platform |
| **Specialist** | $49/mo or $490/yr | Growing marketing teams |
| **Growth** | $99/mo or $990/yr | Agencies running multiple campaigns |
| **Enterprise** | Contact sales | Large agencies with API integration needs |

Business plans are priced at ~5× creator plans, reflecting higher value delivered (access to the full creator database).

### Revenue Levers

1. **Subscription upgrades** — users hit feature gates or rate limits on the free tier and upgrade
2. **Annual upsell** — ~17% discount drives annual commits, reducing churn
3. **Enterprise contracts** — custom pricing for large clients via `sales_email` (admin-configurable)
4. **API access** — developer API keys available on paid business plans; usage-based rate limits create natural upgrade pressure

---

## Feature Gates by Plan

Feature access is enforced server-side via `lib/featureGuard.ts`. The feature matrix is managed in `/admin/subscriptions` and stored in `plan_features`.

### Creator features

| Feature | Starter | Specialist | Growth | Enterprise |
|---|---|---|---|---|
| Public profile link | ✓ | ✓ | ✓ | ✓ |
| YouTube analytics | ✓ | ✓ | ✓ | ✓ |
| Instagram analytics | ✓ | ✓ | ✓ | ✓ |
| Metric visibility controls | ✓ | ✓ | ✓ | ✓ |
| Profile view stats | ✓ | ✓ | ✓ | ✓ |
| Message businesses | Limited | ✓ | ✓ | ✓ |
| Browse business profiles | ✓ | ✓ | ✓ | ✓ |
| Advanced analytics (geo, device, referrer) | — | ✓ | ✓ | ✓ |
| Priority discovery ranking | — | — | ✓ | ✓ |

### Business features

| Feature | Starter | Specialist | Growth | Enterprise |
|---|---|---|---|---|
| Creator search & discovery | ✓ | ✓ | ✓ | ✓ |
| Save creators | Up to 10 | Unlimited | Unlimited | Unlimited |
| Message creators | Limited | ✓ | ✓ | ✓ |
| View creator analytics | Basic | Full | Full | Full |
| API access | — | ✓ | ✓ | ✓ |
| API rate limit (per day) | — | 100 req/day | 1000 req/day | Unlimited |
| Bulk export | — | — | ✓ | ✓ |
| Dedicated account manager | — | — | — | ✓ |

> Note: The feature matrix above reflects the seeded defaults. All limits and feature toggles are live-editable by admins at `/admin/subscriptions` without code changes.

---

## Technical Enforcement

### Feature guard flow

Every gated API route calls `checkFeatureAccess(userId, featureKey)`:

```
1. Look up user_subscriptions.plan_id
   → Fall back to Starter plan if no subscription row exists (free tier by default)
2. Check plan_features.is_enabled for this feature
   → If false: return 403 Forbidden
3. If rate_limit is set:
   → Read feature_usage for current period
   → If usage >= rate_limit: return 429 Too Many Requests
4. Atomically increment feature_usage via Postgres RPC
5. Return { allowed: true, remaining: N }
```

### Stripe integration

Checkout and billing portal routes are built (`/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook`). Currently inactive (`stripe_enabled: 'false'` in `platform_settings`). To activate:

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the backend Vercel project
2. `/admin/settings` → set `stripe_enabled = true`
3. `/admin/subscriptions` → paste Stripe Price IDs for each paid plan

When a user completes Stripe Checkout, the webhook (`checkout.session.completed`) creates a `user_subscriptions` row and unlocks the corresponding feature set.

---

## Go-to-Market Notes

### Creator acquisition

- Organic: creators searching for "media kit" or "creator analytics" tools
- SEO: public profile pages (`/c/:username`) are indexed by Google; each creator becomes a landing page
- Referral: creators share their Statvora link in pitches → brands see the platform → conversion to business accounts

### Business acquisition

- Inbound from public profile views (brands land on a creator's profile and sign up)
- Direct sales via Enterprise contact form
- API integration — agencies that embed creator data in their own tools become high-retention customers

### Retention

- Creators: daily/weekly habit of checking dashboard; social proof of having a verified profile link
- Businesses: active campaign pipeline; Saved Creators list becomes their ongoing roster
- Messaging: creates direct communication channel, increasing stickiness for both sides

---

## Metrics That Matter

| Metric | Signal |
|---|---|
| Creators with a connected platform | Core activation event |
| Public profile page views | Organic reach / virality |
| Business saves per creator | Product-market fit signal |
| Conversation starts | Monetisation pipeline activity |
| Free → paid conversion rate | Revenue efficiency |
| Annual plan attach rate | Commitment / low churn indicator |
| API key creation | High-value business tier indicator |
