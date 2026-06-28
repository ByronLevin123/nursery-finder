# NurseryMatch — Support inbox triage

What lands in `hello@nurserymatch.com`, how to triage it, and SLAs to aim
for. Designed for solo support — keep it simple; upgrade to a help desk
(HelpScout / Intercom) only when the volume justifies it.

Last reviewed: 2026-04-27

---

## Inbox setup

- `hello@nurserymatch.com` — primary inbox, all general enquiries
- `support@nurserymatch.com` — alias forwarded to `hello@`
- `legal@nurserymatch.com` — DMCA / takedown requests (referenced on /dmca)
- `privacy@nurserymatch.com` — GDPR data requests (referenced on /privacy)
- `dpo@nurserymatch.com` — Data Protection Officer (referenced on /privacy)

All five hosted in Namecheap PrivateEmail. PrivateEmail forwards aliases
to a single inbox so you only check one place. Set up Gmail/Apple Mail
labels per alias if you want visual separation.

---

## Categories of mail

### 1 · Parent (consumer) questions

**What they look like:** "How do I…", "I can't find…", "Is this nursery…",
"Is your data correct?".

**SLA:** Best effort within 48 hours. Most of these can be answered with
a link to `/faq`.

**Common asks + canned responses:**

- *Wrong nursery info* → see Category 5 below.
- *Forgot password and reset email didn't arrive* → check spam, then
  generate a recovery link manually from Supabase dashboard.
- *Want to delete account* → point them at `/account` → "Delete my
  account" button.
- *Want to export their data* → point them at `/account` → "Download my
  data".
- *Privacy question* → respond from your email; if it's a formal SAR,
  treat as Category 4 (legal).

### 2 · Provider questions

**What they look like:** "How do I claim my nursery?", "I claimed but
haven't been approved", "How do I cancel my subscription?", billing issues.

**SLA:** 24 hours during the working week. Providers are paying customers
(or potential ones) — quicker response = better conversion.

**Common asks + canned responses:**

- *Claim approval* → check `/admin/claims`, approve or follow up for
  evidence.
- *Cancel subscription* → point them at `/provider/billing` → "Manage
  billing" (Stripe portal).
- *Refund request* → see `/refund` for policy. Process via Stripe
  dashboard if eligible.
- *Profile not showing* → claim status check; provider tier check;
  search index check.

### 3 · Press / partnerships / business

**What they look like:** journalist asking for stats, council wanting
data, prospective integration partner.

**SLA:** 48 hours, but flag the high-value ones to Byron immediately.

Forward to a separate label/folder. Reply with a short acknowledgement
within 24 hours so you don't drop a press window.

### 4 · GDPR / legal / safeguarding

**What they look like:** Subject Access Request (SAR), Right-to-Erasure,
"a child's safety…", DMCA / copyright takedown, ICO complaint.

**SLA:** Acknowledge within 2 working days; respond fully within
**1 calendar month** (statutory under UK GDPR). Safeguarding allegations
are immediate.

**Process:**

1. Move to a dedicated folder/label so nothing slips.
2. Time-stamp receipt — the GDPR clock starts on receipt date.
3. For SARs: confirm the requester's identity (matching account email).
   Pull their data from `/api/v1/profile/export` (or trigger from the
   user's own account if you can guide them). Send within 30 days.
4. For erasure: trigger via the Supabase admin API or the user's own
   `/account` → Delete button. Confirm in writing within 30 days.
5. For DMCA: follow the process in `/dmca` (page already published).
6. **For safeguarding allegations**: stop, breathe, escalate. Do not
   engage publicly. Forward to a lawyer or relevant authority. Document
   what was alleged, when received, what was done.

### 5 · Data corrections (provider or parent)

**What they look like:** "Our nursery hours are wrong", "the address
listed is the old building", "the inspection grade on your site is older
than what we have".

**SLA:** 48 hours.

**Process:**

- Provider-editable fields (description, hours, fees, contact) → tell
  them to claim and edit themselves; offer to assist with the claim if
  stuck.
- Ofsted-managed fields (grade, inspection date, registration status) →
  redirect them to Ofsted; explain that the official register is the
  source of truth and that data flows back to us on the next refresh.
- Genuinely broken records (orphaned URN, duplicates) → fix manually in
  Supabase via the admin UI or SQL editor.

### 6 · Spam / out of scope

**What they look like:** SEO outreach, link-building pitches, cold
sales, irrelevant.

**SLA:** None — delete or set up a Gmail filter to auto-archive.

---

## Daily routine (for solo support)

- **Morning (15 min):** scan inbox; flag urgent (Categories 1 redress,
  2 billing, 4 legal, 5 corrections); reply to anything 5-min-or-less.
- **Mid-day (15 min):** work through flagged items.
- **End of day (5 min):** ensure no Category 4 mail older than 24h is
  un-acknowledged.

---

## Escalation triggers

Stop and call a lawyer / take legal advice if:

- Letter from a regulator (ICO, Ofsted, council).
- Safeguarding allegation involving an identifiable child.
- Defamation claim from a nursery about a review.
- Subpoena / court order / police request.
- Data breach (real or suspected) — see `docs/INCIDENT_RESPONSE.md`
  Section 4 first, then call the lawyer.

---

## Templates

Drafts for the most common replies. Customise per-message; never copy/paste
unedited.

### Account help

> Hi [name],
>
> Thanks for getting in touch. To help: [diagnose].
>
> If that doesn't fix it, reply with a screenshot and I'll dig in.
>
> Best,
> NurseryMatch team

### Claim approval

> Hi [name],
>
> Thanks for claiming [nursery]. I've approved your claim — you should
> have full access now at /provider. The first thing I'd suggest is
> uploading photos and setting your opening hours so the listing looks
> complete to parents.
>
> Reach out if anything looks off.
>
> Best,
> NurseryMatch team

### Refund request (eligible)

> Hi [name],
>
> No problem — I've issued a refund of £X to the original card. It usually
> shows up in 3–10 working days depending on your bank. You'll keep
> access until [date], after which the subscription ends.
>
> Best,
> NurseryMatch team

### Refund request (not eligible)

> Hi [name],
>
> Thanks for reaching out. Looking at your subscription, [explain why it
> falls outside our refund policy at /refund]. I can offer [alternative,
> e.g. cancellation at next renewal, downgrade, etc.].
>
> Let me know how you'd like to proceed.
>
> Best,
> NurseryMatch team

### SAR (subject access request)

> Hi [name],
>
> Thanks — I'm treating this as a Subject Access Request under UK GDPR.
> Could you confirm the email address on the account you're asking
> about? I'll send a full export within one calendar month from today
> ([receipt date + 1 month]). In most cases I respond well inside that
> window.
>
> If you'd rather pull it yourself right now, you can also export your
> data from your account page at https://nurserymatch.com/account →
> "Download my data".
>
> Best,
> NurseryMatch team

---

## When to upgrade off email

You're outgrowing email-only support when one of these is true:

- More than ~10 support emails a day.
- You're missing the 30-day GDPR window.
- You need a teammate to share the load.

At that point, migrate to **HelpScout** (~£15/user/month) or
**Crisp** (free tier with paid upgrades). Both export the inbox into
threaded conversations and tags. Don't migrate earlier — the overhead is
larger than email.
