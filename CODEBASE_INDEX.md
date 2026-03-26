# Codebase Index

Last indexed: 2026-03-26 (Asia/Karachi)

## Snapshot
- Total files in repo (via `rg --files`): 30
- App shape: static multi-page marketing site + one serverless mail API
- Primary languages: HTML, CSS, JavaScript (inline), Node.js (CommonJS)

## Directory Map
- `api/`
- `assets/`
- `css/`
- `js/` (currently empty)
- `services/`
- Root HTML/config files (`index.html`, `about-us.html`, `privacy-policy.html`, `robots.txt`, `sitemap.xml`, `CNAME`, `package.json`)

## Runtime Architecture
- Frontend is page-based static HTML with inline CSS/JS on major pages.
- Service catalog and service detail pages are under `/services/`.
- Contact form in homepage posts JSON to `/api/send-mail`.
- Backend endpoint `api/send-mail.js` sends email through SMTP using `nodemailer`.

## Routing and Page Index
- `/` -> `index.html`
- `/about-us.html` -> `about-us.html`
- `/privacy-policy.html` -> `privacy-policy.html`
- `/services/` and `/services/index.html` -> `services/index.html`
- Service detail pages:
- `/services/service-mental-health-crisis-support.html`
- `/services/service-weight-management.html`
- `/services/service-smoking-cessation.html`
- `/services/service-quit-vape.html`
- `/services/service-alcohol-harm-liver-health.html`
- `/services/service-young-peoples-mental-health.html`
- `/services/service-university-student-mental-health.html`
- `/services/service-maternal-mental-health.html`
- `/services/service-workplace-wellness.html`
- `/services/service-social-prescribing.html`
- `/services/service-medication-adherence.html`
- `/services/service-respiratory-support.html`
- `/services/service-sexual-health-sti.html`

## Core Files
- `index.html`
- Main marketing homepage with hero, services preview, security/compliance, technologies, and contact form.
- Contains JSON-LD structured data, inline design system, and contact form JS.
- Form behavior:
- Collects `firstName`, `lastName`, `email`, `organisation`, `areaOfInterest`, `message`
- Sends `POST /api/send-mail` as JSON
- Renders success/error blocks in-page

- `about-us.html`
- Company profile page with mission, values, leadership, timeline, service capability summaries, CTA.
- Uses inline CSS and small inline JS for reveal animations and nav shadow.

- `privacy-policy.html`
- Long-form policy page with anchored sections (`s1`..`s14`) and sticky table-of-contents behavior.
- Uses `css/privacy-policy.css` plus inline JS for reveal, active TOC highlighting, and back-to-top button.

- `services/index.html`
- Service catalog grid for 13 service pages.
- Uses `css/services.css` plus additional page-specific inline CSS and reveal/nav JS.

- `services/service-*.html` (13 files)
- Shared template pattern: hero, need statement, service features, pathway fit, delivery model, technology block, compliance block, CTA, shared footer.
- Shared behavior: reveal animation + nav shadow script.
- Shared stylesheet: `css/services.css`.

- `api/send-mail.js`
- Single API endpoint module (`module.exports = async (req, res) => { ... }`).
- Handles:
- CORS headers for `POST, OPTIONS`
- Origin allowlist enforcement (`ALLOWED_ORIGINS` or `ALLOWED_ORIGIN`)
- JSON request body extraction
- Required field validation (`firstName`, `lastName`, `email`)
- SMTP transport verify + send
- Error logging and configurable error exposure (`SHOW_MAIL_ERRORS`)

## Styles and UI System
- `css/services.css`
- Shared design tokens and reusable layout/components for services pages.
- Includes nav, hero, cards, stats, footer, CTA, reveal animations, responsive breakpoints.

- `css/privacy-policy.css`
- Policy-page-focused layout with sticky sidebar TOC, cards, tables, rights/contact blocks, and responsive behavior.
- Shares visual language with services and homepage (same color family and typography).

- `index.html` and `about-us.html`
- Carry large inline style blocks rather than external stylesheet files.

## Assets
- `assets/logo.png`
- `assets/logo.ico`
- `assets/favicon.ico`
- `assets/apple-touch-icon.png`
- `assets/android-chrome-512x512.png`
- `assets/download.jpg`
- `assets/.gitkeep`

## Configuration and Infra Files
- `package.json`
- CommonJS project with dependencies: `cors`, `dotenv`, `express`, `nodemailer`
- Scripts currently point to `node send-mail.js` (no root `send-mail.js` exists in this repo; API file is `api/send-mail.js`)

- `.env` (local only, gitignored)
- Observed keys:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- `MAIL_TO`, `MAIL_FROM`, `MAIL_SUBJECT`
- `ALLOWED_ORIGIN`, `PORT`, `API_SECRET`

- `.gitignore`
- Ignores `.env`, `.env*.local`, and `node_modules/`.

- `CNAME`
- Custom domain: `www.welltechai.co.uk`

- `robots.txt`
- Allows crawl for site pages, disallows `/api/`, references sitemap.

- `sitemap.xml`
- Includes homepage, about, privacy, services index, and all 13 service detail URLs with `lastmod` set to `2026-03-26`.

## Shared Frontend Behavior Patterns
- Mobile menu toggled by inline `onclick` and `.mob.show`.
- Scroll reveal via `IntersectionObserver` and `.rv` / `.rv.in`.
- Navbar shadow deepens after scroll threshold.
- JSON-LD present on key pages for SEO.

## Cross-File Linking Patterns
- Top nav and footer are repeated across pages (copy-based, not componentized).
- Most internal links target absolute-like paths for services (`/services/...`) and hash anchors for homepage sections.
- Services and policy pages reuse external Google Font (`Outfit`) and consistent color tokens.

## Notes Observed During Indexing
- `index.html` contains an extra closing `</script>` directly after the contact-form script block.
- `js/` directory exists but has no files.
- API origin logic is strict by default: if no allowed origins are configured, all requests are denied.
