# Ad Swipe Studio

Find the longest-running / most duplicated ads in Meta Ad Library for any country, keep them in a winners sheet, and let Claude write 2 ad copies + 2 headlines for your product in the same winning styles.

## Flow
1. **Country & winner search**: pick the country (language is preset; you can change it). Click a keyword: it opens the Ad Library search for that country. On that page click the **⚡ Swipe Collector** bookmark, then **Send to platform**.
2. **Winners sheet**: ads are grouped by copy and scored `days running + 10 × duplicates`. Untick ads that aren't direct-response selling. **Analyze style with Claude** tags hook types and names the 2-3 swipe patterns. Copy the sheet into Google Sheets or download a CSV.
3. **Product → 2 ads**: enter the product name, landing page, Alibaba link and notes. Claude reads your landing page (web fetch), then writes 2 copies + 2 headlines, each based on a different winning pattern, using only facts from your page (placeholders like `[PRIX]` otherwise) and soft, Meta-safe health wording.

## Setup
- Open the site, go to **Settings** and paste your Claude API key (from console.anthropic.com). It stays in your browser only.
- Drag **⚡ Swipe Collector** to the bookmarks bar. Set Facebook to English.

## Notes
- Everything is stored in your browser (localStorage). Use **Settings → Backup** to save or move it.
- GitHub Pages can't read Facebook by itself, so the bookmark reads the Ad Library page you have open.
- Long-running ads are a strong hint of a winner, not sales data.
