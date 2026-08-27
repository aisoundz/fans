# fansgametime.com — how this goes live

Same path STATS took, so there is nothing new to learn.

1. `git init` here, push to a repo (e.g. `aisoundz/fans`).
2. GitHub Pages → deploy from `main`, root.
3. `CNAME` in this folder already says **fansgametime.com**. If the domain you
   bought is a different TLD, that one file is the only edit.
4. At the registrar: `A` records for GitHub Pages
   (185.199.108–111.153) on the apex, plus `CNAME www → aisoundz.github.io`.
5. Pages → Enforce HTTPS once the cert issues (10–30 min).

`index.html` is the whole product. One file, no build step, no server —
exactly like statsgametime.com. It will keep serving if the Jetson is unplugged.

**Do not point this at the STATS Firebase project.** A separate project keeps
the two boards, the two prize ledgers and the two rulesets from ever touching.
The engine is shared by copying, not by pointing at the same database.
