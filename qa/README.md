# The gate

```
node qa/all.js                                    # against the working tree
TARGET=https://fansgametime.com node qa/all.js    # against what is actually live
```

Green is required before a deploy and again after one. The second run is
not ceremony: on 14 September every fix was verified locally and then
found to be different on production twice, because GitHub Pages serves a
build that lags the push by about a minute.

## Why these exist

Every check here was written on the night of the Emmys shadow run, while
the defect it describes was live on the site. Fifteen defects in
seventy-two minutes, **every one found by looking at a phone and not one
by reading the code** — so these suites all drive a rendered browser and
measure pixels, state and the words on screen. None of them read source.

## What each one guards

| suite | the bug it was written for |
|---|---|
| `verify` | a campaign link landing in the wrong room; first-touch attribution |
| `vma` | Game Night Zero readiness: no baked answers, no room questions, full nominee lists, void logic |
| `emmys` | the resolution panel, and a host answer reaching `q.a` at the source |
| `bank` | a question whose correct answer is not among its options |
| `fab` | inventing an audience, a sponsor, a placing or a percentage over 100 |
| `panel` | the panel covering the game, the nav, or lying about what is unset |
| `tab` | the tab bar claiming you are in a Gametime you are not in |
| `pace` | playing the whole night before the show has happened |
| `persist` | a reload destroying every sealed card |
| `reveal` | a miss that reads as though points were banked |
| `ux` | a button that names a destination and then hits a wall |
| `reach` | the bottom of a screen being unreachable behind the panel |
| `journey` | **the whole night, end to end** — seal, open, play, call, settle |
| `sabotage` | proves the reachability check actually goes red when the bug returns |

`journey` is the one that matters most. Fourteen of the fifteen Emmys
defects were found from screenshots; the one that actually blocked the
night — `OPEN THE ENVELOPE` opening the Envelope and leaving you in Right
Back — was invisible in every screenshot and fell out of the first honest
playthrough in under a minute.

## The other tool

`host/resolve.js` is not a test. It audits a host's call against
Wikipedia's parse API:

```
node host/resolve.js 2026_MTV_Video_Music_Awards --category "Video of the Year"
node host/resolve.js 78th_Primetime_Emmy_Awards --check "Outstanding Drama Series=The Pitt"
```

It never drives the game — a scraper that learns a result before the
viewer's broadcast shows it would spoil the best moment in the product.
It checks the human afterwards, and says so when they disagree.
