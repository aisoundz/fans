# Security headers on fansgametime.com

Status as of 2026-10-13. Agent Wisdom reported seven warnings on this site.
Four are fixed here. Three are not reachable from this host.

## Fixed

| | |
|---|---|
| Content Security Policy | A meta tag on all six pages. Pages cannot set response headers, so this is the only route. |
| Referrer policy | `<meta name="referrer">`, which browsers honour. |
| security.txt | `.well-known/security.txt`, at the RFC 9116 path, with an `Expires` field. |
| Secret scanning | A free TruffleHog workflow, since GitHub's own needs a paid plan on a private repo. |

`.nojekyll` was already in the root, which is what keeps `.well-known` from
being dropped: Jekyll excludes every path beginning with a dot or underscore,
so without it the file 404s while the repository looks correct.

## What the CSP allows, and why

`script-src` lists `https://assets.mailerlite.com` on the three full pages
because the signup on `/vmas` uses **JSONP**: it builds a `<script>` element
pointing at that origin and appends it to the head. Remove the origin and the
signup silently stops working. The three report fragments carry no form, so
their policy omits it.

`'unsafe-inline'` stays in `script-src` and `style-src` because every script
and style on these pages is inline. Removing it means moving them into files
first.

`artifact.html`, `report/plan.html` and `report/moat.html` had **no charset
meta at all**, and no doctype, `<html>` or `<head>`. They begin at `<title>`.
A charset was added alongside the policy, inside the first 1024 bytes, since
without one the browser guesses the encoding.

## Not reachable from GitHub Pages

`Strict-Transport-Security`, `X-Content-Type-Options` and `X-Frame-Options`
are header-only, and browsers ignore all three in a `<meta http-equiv>`. The
CSP spec also requires a meta-delivered policy to ignore `frame-ancestors`, so
there is no meta route to clickjacking protection either.

Adding those tags anyway would turn the Agent Wisdom board green while the
browser ignored every one of them, which is worse than the warning, so they
are deliberately absent.

**The free route, if you want these three:** put Cloudflare in front of
fansgametime.com and set the headers with Transform Rules. Free tier, the site
stays on GitHub Pages, and nothing in this repository changes.

## Rollback

The policy is inert markup. Deleting the two meta tags returns the page to
exactly its previous behaviour, with no other effect.
