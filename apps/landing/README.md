# MongChi Landing

Official multilingual landing and legal site for [MongChi](https://mongchi.app), a cozy AI pixel-pet garden made by DefineYou.

## Local development

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run dev
```

Production verification:

```bash
npm run build
npm run preview
```

Regenerate the localized landing posters after updating the App Store screenshot set:

```bash
uv run scripts/build_localized_campaign_assets.py
```

Run this command from `apps/landing`. English posters remain in
`public/assets/campaign/`; the other seven locales are written to matching
locale subfolders and are selected by the existing website language control.

Build the social link preview from an approved generated garden scene:

```bash
uv run scripts/build_social_preview.py /absolute/path/to/source.png
```

The final 1200x630 Open Graph image is written to
`public/assets/social/mongchi-social-preview.png` with deterministic brand copy.

## Vercel

Import `defineyou30/mongchi_landing` as a new Vercel project. The repository contains explicit Vite build settings in `vercel.json`, so no Root Directory override is required.

After the first production deployment:

1. Add `mongchi.app` and `www.mongchi.app` in Vercel Domains.
2. Keep `mongchi.app` as the primary domain and redirect `www.mongchi.app` to it.
3. Submit `https://mongchi.app/sitemap.xml` in Google Search Console.
4. Verify the canonical, Open Graph image, and locale alternates on the production URL.

## SEO and localization

- Canonical origin: `https://mongchi.app`
- Supported locales: `en-US`, `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, `es-MX`
- Locale URLs currently use `?lang=` and update the page title, description, canonical URL, Open Graph data, and accessible labels at runtime.
- `robots.txt`, `sitemap.xml`, reciprocal `hreflang`, social cards, and WebSite/Organization structured data are included.
- A future SEO iteration should pre-render locale-specific path URLs before publishing a large editorial content hub.

Support: [lucas@define-you.com](mailto:lucas@define-you.com)

© 2026 DefineYou. All rights reserved.
