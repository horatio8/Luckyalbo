# Albo's Luck

A single-page satirical campaign site. Voters pledge not to vote for any
politician who supports the 2026 CGT changes — the angle being that the Prime
Minister sold his own investment property under the 50% CGT discount *before*
abolishing it for everyone else.

This is a faithful, pixel-for-pixel implementation of the Claude Design
prototype (`Albos Luck.dc.html`), rebuilt as a self-contained static site
(vanilla HTML/CSS/JS — no build step) so it can be hosted anywhere.

## Run it

It's a static site. Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

- `index.html` — all page markup (nav, hero, timeline, property trail,
  calculator, "rules for thee", quiz, live dashboard, pledge form, footer).
- `styles.css` — keyframe animations and the mobile-first responsive overrides.
- `app.js` — all interactivity, ported from the prototype's component logic.
- `assets/` — the Albo caricature and the Lucky Albo logo.

## Features

- **Live pledge counter** ticking up across the hero and the dashboard, with a
  goal bar and a state-by-state breakdown.
- **Lucky Timeline** — six events that drop in with a "pokies reel" animation on
  scroll, including a rolling slot-machine on the cash-out row.
- **The Property Trail** — factual property history cards.
- **Hypocrisy Calculator** — sliders + marginal-rate selector computing what
  Albo paid (old 50%-discount rules) vs. what you'd pay (new rules).
- **Rules for Thee** — three-box comparison with a gold money-rain burst on
  scroll-in.
- **How Lucky Are You?** — three-question satirical quiz with a verdict.
- **Pledge flow** — form (with AU postcode→state validation) → donation step
  ($26 / $65 / $265 / $550 / $1,500 + custom, one-off/monthly) → confirmation
  with a generated senator email and shareable cards.

## Notes

The form, senator email, donation and counter are **front-end only** — exactly
as in the prototype. Wiring them to a real backend (pledge persistence,
postcode→senator email dispatch, payment processor, real-time counter) is the
production work the brief calls for. The postcode→state lookup is real and
accurate. All calculator figures are illustrative and labelled as such; the
site is political commentary and satire, not financial or legal advice.
