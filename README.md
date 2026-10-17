# site-watch

Off-box watchdog for **maysanlabs.com**. Twice an hour it fetches the public pages, `/api/health` and
`sitemap.xml` from GitHub's infrastructure and asserts the things an outage actually breaks: HTTP status,
a real `<title>`, exactly one `<h1>`, a self-referencing canonical, a visible-word floor (catches a skeleton
or error shell), sitemap shape, and that the deployed build is recent.

Why a separate public repo: the equivalent checks in the private site repo died when the org's included
GitHub Actions minutes ran out (Free plan, private repo). Public repos are not metered, so this backstop keeps
working at zero cost — and because it runs outside the VPS, it is the only check that still fires when the
box itself is down.

Alerts go to Telegram on a **transition only** (failing → alerted; still failing → quiet), so a sustained
outage does not spam.

No business code, no credentials in the repo — the bot token lives in Actions secrets.
