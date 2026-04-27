# Data Protection Impact Assessment — NurseryMatch

A DPIA is required by UK GDPR (Article 35) when processing is "likely to
result in a high risk to the rights and freedoms of natural persons".
Processing children's data at scale and combining it with location and
behavioural data passes that threshold, so a DPIA is mandatory.

This document is a working draft. Sections marked **[FILL]** need the
data controller (Byron) to add specifics; sections marked **[LAWYER]**
should be reviewed by a UK SRA-registered lawyer before publication.

Status: DRAFT (for lawyer review)
Last updated: 2026-04-27
Reviewer: **[FILL — name + role]**

---

## 1 · Why we are doing this DPIA

NurseryMatch processes:

- Adult parents' personal data (name, email, postcode, search history,
  enquiries, reviews, payment metadata via Stripe).
- Children's personal data (name, date of birth or age, ages of
  interest), entered by their parents to receive better-matched
  nursery recommendations and to send enquiries on their behalf.
- Provider personal data (nursery owner / manager name, role, email,
  phone, payment metadata).

Because we knowingly process children's data and combine it with
location and behavioural signals, a DPIA is required.

---

## 2 · Description of the processing

### 2.1 Nature

| Operation | Data | Purpose |
|---|---|---|
| Account creation | email, password (hashed by Supabase), display name | Authentication |
| Search & comparison | postcode, filters, results viewed | Service delivery |
| Shortlists / saved searches | nursery URNs, search criteria | Service delivery |
| Reviews | rating, review text, hashed IP | User-generated content + abuse prevention |
| Enquiries to nurseries | child name (optional), DOB / age, preferred start date, message | Brokering enquiries between parents and providers |
| Provider claims | name, role, contact email/phone, evidence notes | Verifying provider identity |
| Provider subscriptions | Stripe customer ID, billing email | Paid tier management |
| Email marketing (opt-in) | email address only | Service updates, drips |
| Anonymous analytics | URL paths only (Plausible cookieless) | Product improvement |

### 2.2 Scope

- **Geographic:** UK only at launch.
- **Data subjects:** UK parents using the service; UK nursery providers
  who claim listings; UK children whose parents enter their details.
- **Volume estimate at launch:** **[FILL — your forecast for first 6
  months]**.

### 2.3 Context

- The service is provided over the public internet at
  `https://nurserymatch.com`.
- Parents engage voluntarily; providers engage either voluntarily
  (claiming a listing) or are listed automatically from the public
  Ofsted register.
- The relationship is between NurseryMatch and the parent / provider —
  not with the child directly. Children's data is provided by a parent
  on the child's behalf.

### 2.4 Purposes

| Purpose | Legal basis (UK GDPR Art 6) | Children's data special basis |
|---|---|---|
| Account, search, comparison | Contract (Art 6(1)(b)) | n/a (parent enters as part of contracted service) |
| Marketing emails | Consent (Art 6(1)(a)) | Parental consent gates child-related drips |
| Anonymous analytics | Legitimate interests (Art 6(1)(f)) | n/a (no child data in analytics) |
| Enquiries to providers | Contract (Art 6(1)(b)) | Parental consent for child name/age included in message |
| Fraud / abuse prevention | Legitimate interests (Art 6(1)(f)) | n/a |
| Tax / accounting on paid subscriptions | Legal obligation (Art 6(1)(c)) | n/a |
| Safeguarding disclosures (if ever required) | Legal obligation (Art 6(1)(c)) | Special-category provisions Art 9(2)(g)/(b) may apply |

---

## 3 · Necessity and proportionality

For each data point, can we achieve the purpose with less / no personal
data?

| Data point | Why we collect it | Could we achieve without it? |
|---|---|---|
| Parent email | Account access, transactional email | No — need a unique, owned identifier |
| Parent postcode | Local nursery results | Could use lat/lng but parents enter postcodes naturally |
| Child name | Personalised enquiry to provider | Optional; clearly flagged; default empty |
| Child age | Match nurseries that accept that age | Yes for browsing (anonymous); no for enquiry-to-provider |
| Hashed IP on reviews | Per-IP rate limit / spam | Could omit but spam burden becomes unmanageable |
| Provider phone | Enquiry routing for non-claimed nurseries | Optional; not displayed to parents |

We collect the minimum we need to deliver the service. Anonymous browsing
is the default; sign-in is required only for shortlist persistence,
reviews, and enquiries.

---

## 4 · Risk assessment

For each identified risk, score likelihood (1–3) × severity (1–3) for an
overall rating, and document mitigations.

### 4.1 Identified risks

| # | Risk | L × S | Mitigation |
|---|---|---|---|
| R1 | Account takeover via stolen credentials | 2 × 3 = **6** | Supabase password hashing; rate-limit per-IP (Supabase) and per-email (mediated `/auth/login`); email verification before sensitive actions |
| R2 | Brute force on a known parent email | 2 × 3 = **6** | Email-keyed lockout (5 fails / 15 min) on top of Supabase per-IP limit |
| R3 | Reviews containing children's identifying data | 2 × 2 = **4** | Pre-publish moderation; takedown process at /dmca |
| R4 | Enquiries forwarded to spammers / fake providers | 1 × 3 = **3** | Provider claims verified by admin; unclaimed enquiries are queued for admin review, not auto-forwarded |
| R5 | Unverified accounts spamming providers | 2 × 2 = **4** | Email pre-verification gate on enquiries / reviews / claims; per-user rate limits; Cloudflare Turnstile on enquiry form |
| R6 | Data breach exposing parent + child data | 1 × 3 = **3** | Supabase encryption at rest; RLS on every user-data table; secrets in env vars only; Sentry to detect unusual error patterns |
| R7 | Third-party processor breach (Resend, Stripe, Supabase) | 1 × 3 = **3** | Each is a UK GDPR-aligned controller with their own ROPA; we hold DPAs from each |
| R8 | Stale data (wrong nursery info) misleading parents | 2 × 2 = **4** | Inspection-staleness banner; enforcement-notice banner; OGL attribution surfacing data provenance |
| R9 | Children's data retained beyond need | 2 × 2 = **4** | Account deletion immediately removes child fields; no retention beyond account lifetime; no aggregated profiling on child data |
| R10 | Profiling / automated decisions affecting child | 1 × 3 = **3** | Match scores are advisory; explicit copy that the parent stays in control; no Article 22 automated decision-making with legal effects |
| R11 | Provider posing as a different provider | 1 × 2 = **2** | Manual claim review by admin; evidence_notes captured; revocation process documented |

### 4.2 Residual risks after mitigation

R1 (account takeover) is the most consequential residual risk. Mitigation
gap: 2FA is post-launch, not pre-launch. **[LAWYER: confirm acceptable
for parent-tier launch given lockout is in place; admin role should be
2FA-enforced sooner.]**

---

## 5 · Data subject rights

| Right (UK GDPR) | How NurseryMatch fulfils it |
|---|---|
| Access (Art 15) | `/account` → Download my data. JSON export of all account-linked rows. Manual SAR fallback to `privacy@nurserymatch.com`. |
| Rectification (Art 16) | Self-serve from `/account` and `/provider/[urn]/edit`. |
| Erasure (Art 17) | `/account` → Delete my account. Backend wipes all linked tables. |
| Restriction (Art 18) | Manual via `privacy@nurserymatch.com`. **[LAWYER: confirm a self-serve mechanism is not strictly required given low expected volume.]** |
| Portability (Art 20) | Same JSON export covers this; format is machine-readable. |
| Objection (Art 21) | Marketing opt-out via `/account?tab=notifications`. Other processing is contract-basis where objection doesn't apply. |
| Not subject to automated decision-making (Art 22) | We don't make Article 22 decisions. Match scores are advisory; the parent decides. |

---

## 6 · International data transfers

| Processor | Country | Safeguards |
|---|---|---|
| Vercel | US | EU-US DPF + SCCs in DPA |
| Render | US | SCCs in DPA |
| Supabase | EU (region: eu-west-2 London if confirmed) | Verify region setting; SCCs as backup |
| Resend | EU (eu-west-1) configurable | Pick EU region; SCCs in DPA |
| Cloudflare (Turnstile) | Global | SCCs + UK addendum |
| Anthropic | US | SCCs + UK addendum; data not used for training under business terms |
| Stripe | US | UK-US DPF, SCCs |
| Plausible | EU (Germany) | EU-resident, no transfer issue |

**[FILL — confirm Supabase region is eu-west-2 (London) for our project.
If not, change before launch and migrate the database.]**

---

## 7 · Consultations

- **Internal:** N/A (solo founder).
- **External:** UK SRA-registered lawyer engaged for privacy + terms
  review (see `docs/LAUNCH_CHECKLIST.md`). Lawyer should review this
  DPIA in the same engagement.
- **ICO:** No prior consultation needed unless residual high risks
  remain after mitigation. **[LAWYER: confirm.]**

---

## 8 · Decision

The proposed processing is **necessary and proportionate** for the
purposes described, with the mitigations in Section 4. The residual
risks are acceptable for launch, contingent on:

1. Lawyer sign-off on this DPIA.
2. ICO registration completed before public launch.
3. 2FA on admin accounts deployed within 30 days post-launch (R1
   mitigation).
4. UptimeRobot + Sentry monitoring active before public launch (R6
   detection).

Approved by: **[FILL — Byron, signature + date]**
Reviewed by: **[LAWYER — name + date]**

---

## 9 · Review cadence

This DPIA should be re-reviewed:

- Annually, on or before each anniversary of launch.
- Whenever processing materially changes (new data category, new
  processor, expansion outside the UK, new automated decision-making).
- Whenever a data breach involving NurseryMatch data occurs.
