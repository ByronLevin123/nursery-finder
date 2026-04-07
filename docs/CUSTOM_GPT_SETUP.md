# NurseryFinder — ChatGPT Custom GPT Setup

This guide turns the public NurseryFinder API into a ChatGPT Custom GPT in ~5 minutes.

## Prerequisites

- A ChatGPT Plus / Team / Enterprise account (Custom GPTs require a paid plan)
- The public OpenAPI URL: `https://nursery-finder-6u7r.onrender.com/api/openapi.json`

## Steps

1. Open ChatGPT and go to **Explore GPTs > Create**.
2. In the **Create** tab, give it a name (e.g. `NurseryFinder UK`) and short description:
   > Free UK nursery + family-relocation assistant. Real Ofsted ratings, area family scores, sold prices.
3. Upload a logo. (Placeholder: use the `/og-default.png` from the live site, or generate one in DALL-E from inside the GPT builder.)
4. Switch to the **Configure** tab.
5. Paste the **system prompt** below into the Instructions field.
6. Add **Conversation starters** (suggested below).
7. Scroll to **Actions** and click **Create new action**.
8. In the **Schema** field, click **Import from URL** and paste:
   ```
   https://nursery-finder-6u7r.onrender.com/api/openapi.json
   ```
9. Authentication: **None** (the API is public read-only).
10. Privacy policy URL:
    ```
    https://nursery-finder.vercel.app/privacy
    ```
11. Click **Save** and choose visibility (Only me / Anyone with a link / Public).

## System prompt

```
You are NurseryFinder UK, an assistant that helps UK parents find Ofsted-rated nurseries and family-friendly areas to live. Always cite Ofsted when quoting grades. For each recommendation, include the nursery name, district, Ofsted grade, and a link. When discussing areas, prefer to call out family score, nursery quality, crime, and affordability. If asked something you can't verify from the API, say so.
```

## Suggested conversation starters

- "Find Outstanding nurseries near SW11"
- "What is the family score for BS6?"
- "Compare nurseries in N16 and E8"
- "Where in London can I afford a 3-bed family home with great nurseries?"

## Tips

- The OpenAPI exposes JSON endpoints **and** markdown endpoints at
  `/api/v1/public/nursery/{urn}.md` and `/api/v1/public/area/{district}.md` —
  these are the easiest for the GPT to read aloud or quote verbatim.
- Rate limit: 100 requests / 15 min per IP. The GPT will get throttled if it
  fan-outs too aggressively.
- Always cite **Ofsted** as the source of nursery grades — this is a condition
  of the Open Government Licence under which the data is republished.

## Useful links

- Public docs page: https://nursery-finder.vercel.app/api
- llms.txt: https://nursery-finder.vercel.app/llms.txt
- llms-full.txt: https://nursery-finder.vercel.app/llms-full.txt
- OpenAPI JSON: https://nursery-finder-6u7r.onrender.com/api/openapi.json
- Privacy: https://nursery-finder.vercel.app/privacy
