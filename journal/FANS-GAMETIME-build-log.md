# FANS GAMETIME — build log and documentation

**26–27 August 2026.** Everything below was built, tested and deployed in one
session on the Jetson. Written so that a person who was not here can pick it up.

---

## What it is

The concert sibling of STATS GAMETIME. A live-show game with one governing rule:

> **The set is sacred. We only play the Gametimes.**

A 221-minute arena night contains about **101 minutes** when nothing is happening
on stage. Those are the product. No question ever fires while a song is playing —
that is enforced in the code, and it is the reason an artist says yes.

**Why it exists now:** an introduction was offered to the Live Nation Innovation
Lab, on condition it was about artist and fan engagement.

---

## The five Gametimes

| | Name | When | Arena | Club |
|---|---|---|---|---|
| 01 | **Soundcheck** | Doors open, nothing on stage | 45 min | 30 min |
| 02 | **Crossfade** | Support off, headliner not on | 25 min | — |
| 03 | **The Bridge** | Mid-set, the band is off | 4 min | 3 min |
| 04 | **One More** | Lights down, the room is chanting | 90 sec | — |
| 05 | **The Outro** / **Last Call** | House lights, on the way out | 25 min | 20 min |

Every name is a real music or production term that also describes the moment.
*The Bridge* is the middle section of a song and the middle break of a set.
*Crossfade* is what a DJ does between two tracks and what a changeover is.
*One More* is not a term at all — it is what twenty thousand people are shouting.

**The gap structure is a function of the room.** A 250-cap club has no support
changeover, no costume change and often no encore, so it gets three, not five.
Forcing the arena shape onto a club is how this fails on the venues that are
easiest to say yes.

---

## The three legal question types

In a Gametime nothing is on stage, so a question can only be one of three things.
The first build got this wrong and it was the founder's main objection.

- **PREDICT** — locks now, is **not graded now**, and settles in a later Gametime.
  It pays at the rate of the Gametime it *lands* in, so a call sealed at
  Soundcheck and settled at The Outro is worth five times what it was worth when
  made. This is what makes 45 minutes of standing around worth playing.
- **RECALL** — about the stretch of show that just ended. Past tense, because it
  is in the past.
- **ROOM** — about the crowd around you. The room's own answer **is** the truth,
  so it can never be wrong and never void — and it is the only data in live music
  nobody has ever collected.

**The settle beat** is the best moment in the product: the Gametime opens not on a
question but on the fan's own greyed card, with how long ago they sealed it, and
then it flips.

---

## How a question actually grades

A concert has no live feed. It has something better — a script handed over before
the show starts.

| Source | Resolves | Share |
|---|---|---|
| The printed setlist, photographed at soundcheck | Song order, opener, closer, encore, covers, total count | ~60% |
| A six-button panel tapped by a production assistant | Dancer counts, costume changes, pyro, who walked off | ~30% |
| The crowd's own consensus | Merch vs bar line, what's on the wall — where the room IS the truth | ~10% |

---

## Bugs found and fixed (all found by rendering, none by reading code)

1. **`#wash` had never painted a single pixel.** `.phone` painted an opaque
   background over a `position:fixed; z-index:0` layer, so the entire lighting
   system — four states, a 1.2s crossfade — had never once been seen. Proved by
   forcing all four states and hashing the screenshots: identical.
2. **Answering produced no moving pixels.** Frames at 120ms and 600ms after a tap
   were byte-identical. Rebuilt as a four-beat, 1200ms sequence.
3. **The clocks ran on `requestAnimationFrame`**, which is suspended in a
   background tab and on a locked phone. The ring froze and the game wedged with
   no way forward. Both clocks now run off a `Date.now()` deadline, and
   `visibilitychange` shifts the deadline instead of running through the blackout.
4. **The Fans tab leaked six of the app's own answers** — it printed all thirteen
   song titles in order, one tap away, at all times.
5. **The dancers question asked about Pump It (song 9) during a break after song 6.**
6. **`filter: grayscale()` on the settle card's front face** created a containing
   block, which flattens the 3D rendering context and silently disables
   `backface-visibility` — both faces painted at once, one mirrored.
7. **The confetti canvas was `position:fixed`**, spraying across the whole desktop
   browser instead of staying in the phone frame. Two competing `#celeb` rules,
   later one winning.
8. **"% of the night" divided by 78**, which was the maximum of nothing, and
   counted carry-in points not earned at the show.
9. **The room picker was a horizontal scroller with the scrollbar hidden** —
   unreachable with a desktop mouse.
10. **The 3D flip failed twice.** `backface-visibility` computed to `hidden` on
   both faces, the parent was `preserve-3d`, no ancestor flattened it — and the
   browser painted both anyway, one mirrored. Replaced with a `scaleY` squash
   that swaps its contents at the midpoint: same beat, no 3D context, and
   structurally incapable of showing two faces.
11. **Room questions were never counted as correct.** The reward screen compared
   the answer to `q.a`, and a ROOM question has no `q.a` — its answer is whatever
   the building said. A round could pay +20 and print "Nothing that round" on the
   same screen. One owner now: `wasRight()`.
12. **The settle screen congratulated you for being wrong** — it printed the
   you-got-it reaction line under a red card and a +0.
13. **The reward screen led on a grade, not a reward.** "1/4" is a report card;
   the points earned that round appeared nowhere. It leads on `+80` now, counted
   up, with position shown as a *change* rather than a static ordinal.

---

## Infrastructure

- **Repo:** `github.com/aisoundz/fans` → GitHub Pages → **fansgametime.com**
- **HTTPS:** Let's Encrypt, issued 27 Aug 12:25 UTC, auto-renews.
- **DNS:** written through the GoDaddy API. The token is a **Personal Access
  Token** and needs `Bearer`, *not* the old `sso-key KEY:SECRET`. Lives at
  `~/.secrets/godaddy-api`; `~/fans/go-live.sh` auto-detects and reads before it
  writes. Pre-change records saved to `~/fans/dns-before-*.json`.
  **MX, SPF, DKIM and DMARC were left untouched.**
- **The cert took 12 hours and needed a nudge.** `is_https_eligible:true` with
  `https_error: peer_failed_verification` means DNS is fine and GitHub's queue has
  not fired. Fix: `gh api -X PUT repos/aisoundz/fans/pages -f cname=""` then set it
  again. **This rewrites the CNAME file in the repo**, so pull before your next push.
  Cloudflare was considered and rejected — it would have meant moving nameservers
  off GoDaddy and risking the domain's email records for no gain.

---

## The naming, and why "Gametime 02" was wrong

A serial number counts our array index at the fan. Nobody at a show thinks in
terms of Gametime 02 — they think the band is in a break. It also buried the
name we had gone to trouble to choose. The number is now used for the one thing
a number is good for: **position** ("2 of 5"). Buttons name their destination —
*Play Cutaway*, *Go to The Bridge* — never an index.

## Deliverables

| | Where |
|---|---|
| Prototype | https://fansgametime.com · artifact `d183141c-f2c5-4c48-883c-789015d430f7` |
| Strategy & product plan — *Playing the Gaps* | artifact `be9f2f1c-ba2f-4253-ac50-0ee189d66c74` |
| Defensibility memo — *The Grading Is the Moat* | artifact `372e8d23-6ffe-470c-b20d-a4ea6d90b0d6` |
| Pitch deck — *Where The Show Isn't* | 15 slides, PPTX + PDF, in this folder |
| Source | `~/fans/` on the Jetson, mirrored to GitHub |

---

## What is decided

- **The moat is not the mechanic.** Anyone ships the game loop in a weekend.
  Almost nobody can grade a live show at six thousand venues a night. The moat is
  the resolution network, a question corpus proven to resolve and to be fun, the
  day-30/90 recall dataset, the room's own verdict data, and a fan's cross-show
  record. Say the first part out loud — it is what makes the rest credible.
- **Start at the club, not the arena.** One text to a yes, the artist writes the
  setlist, failure is cheap and private. What a developing artist actually wants is
  **a list of who was in the room** — they currently have none.
- **It does not need a concert.** The next concrete move is the **VMAs on 27
  September** (CBS / MTV / Paramount+) as a free play-along. No permission needed,
  same as the sports sibling never asks the NBA.

## What is not proven

STATS GAMETIME has had **thirteen humans play it, ever**, and an audit found most
rooms were the founder alone. Retention is strong (2.8 nights a person, no push,
no streaks); acquisition is zero. Product quality and audience size are
uncorrelated in this operation's own data. **Do not walk into Live Nation with a
prototype and nothing else** — run one real room first, however small.

---

# 27 August 2026 — The artist tier ships

**Live:** `https://fansgametime.com/advance.html` (the artist tool) and any link
it produces. Built to be handed to a real artist the same night.

## Why this is the strongest move the product has had

The moat argument was *"almost nobody can grade a live show at six thousand venues
a night."* True — and it caps growth at one tour at a time, because relationships
do not go faster for money. **At the artist tier the grading problem dissolves:
the artist wrote the setlist.** The resolution network we cannot buy, one artist
hands over free about their own show, in exchange for the one thing nobody gives
them — the list of who was in the room.

It also attacks the only number that is actually broken. Thirteen humans ever,
retention 2.8 nights, acquisition zero. This is the first design here where
**somebody else is motivated to bring the audience.**

## What was built

- **`advance.html`** — three facts (act, venue, running order) become a link.
  **Voice for the coarse pass, thumb for the fine pass:** who and where are spoken;
  the setlist is typed or pasted, because a misheard song title becomes a question
  that grades a real fan wrong in front of a real artist.
- **The show travels inside the URL** (`?s=<base64url>` of `{a,v,s}`, ~220 chars).
  There is no backend on `fans/` at all — zero network calls, by design.
- **`makeShow()` is the only generator and index.html the only decoder**, so an
  artist-made night and a hand-built room are the same document and the engine
  never learns the difference. Three gametimes, predict + recall only, every
  answer graded off the artist's own setlist. A malformed `?s=` falls back
  silently to the demo app.

## The harder half: everything it now refuses to say

The four demo rooms are illustrations and their crowd data is hash-derived —
`split()`'s own comment says *"in production is a live count of submissions."*
Fine for a fictional band. In front of a real artist's real fans it is inventing
numbers. **Seven fabrications had to be found and suppressed, every one by
rendering the app and reading the screen, none by reading the code:**

1. the crowd bar and per-tile percentages
2. "N answering with you"
3. "9th of 90" in the header
4. four invented usernames with invented scores in invented sections
5. the section heat map and the six-show season history
6. two invented Spotify play counts under the artist's own name
7. a prize list promising soundcheck passes the artist never offered

One owner — **`showsCrowd()`**, false when `SHOW.real`. Generated nights carry
**no room questions at all**: a room question with nobody counting it is a guess
wearing a percentage. Where the truth is missing the app now says so plainly —
*"we would rather show you nothing than show you people who are not here."*

## What it does NOT do yet — say this to any artist

Every question grades for real; **each fan's score lives on their own phone.**
No shared leaderboard, no live room, **no list back to the artist** — all three
need a server. Tonight's version proves *the game*, not *the data*, and the data
is the half the artist actually wants. That backend is the next thing.

## Verification

Four Playwright suites, green against the **live** site: wizard round-trip, a full
three-gametime playthrough, the seal-and-settle path paying at the landing
gametime's rate, and a per-tab scan for invented data. The four demo rooms are
behaviourally unchanged.

## Staged, not deployed

`/artists/` — the tool as its own installable app (own manifest, add-to-homescreen)
at `fansgametime.com/artists`, with `advance.html` left as a redirect. Built and
syntax-clean; **held back deliberately.** The one real change it needs is
`siteRoot()`: the link must point at the player at `/`, not at the directory the
tool is served from.
