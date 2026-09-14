# Loan Calculator · Kosovo

Estimate monthly loan payments, then jump to the Central Bank of Kosovo's
official platform to compare what banks actually offer.

Live: https://endrits-loan-calculator.netlify.app/

## What it does

- **Albanian and English** — AL is the default; the choice persists in
  `localStorage`. Amounts stay in the local euro format (`239,42 €`) in both
  languages, since that is the convention in Kosovo regardless of UI language.
- **Side-by-side layout on desktop** — inputs left, results right, sized to fit
  without scrolling. Stacks to a single column below 820px.
- **Live calculation** — results update as you type, no button press.
- **Live readout on narrow screens** — in the stacked layout the result sits
  below the inputs and behind the keyboard, so an edit appears to do nothing.
  A sticky bar shows the payment while the real figure is off-screen, and
  disappears once you can see it.
- **Loan type presets** — Kredi Personale, Konsumuese, Banesore, Automjet,
  Biznes. Each seeds a typical amount and term.
- **Amortization schedule** — full month-by-month breakdown in a modal, with
  CSV export.
- **Principal vs interest bar** — how much of the total is cost.

## Why rates aren't fetched automatically

The obvious feature would be pulling live rates from the CBK comparison
platform at `krahaso.bqk-kos.org/loans` and ranking banks in-app.

That isn't possible, and not for a technical reason worth working around: the
entire `bqk-kos.org` domain sits behind a Cloudflare managed challenge
(`cf-mitigated: challenge`). That's a deliberate anti-bot control by the
central bank. Defeating it to run a scraper would be circumventing a access
control that the data owner put there on purpose.

There's also no public API — the CBK publishes interest rate data as PDF
bulletins, not a machine-readable feed.

So the app links out instead. It shows you exactly which filters to apply
(`Kredi Personale · mbi €10,000 · normë fikse`), derived from whatever you've
entered, and sends you to the official source for the real numbers. Nothing in
this app claims to be live bank data, because it isn't.

If the CBK ever exposes an API, the link block in `index.html` and
`updateBqkHint()` in `script.js` are the only places that would need to change.

## Icons

`favicon.svg` is drawn as paths rather than a `<text>` element — a favicon
renders outside the page, where the site's webfont isn't guaranteed to have
loaded. `apple-touch-icon.png` is the same mark rendered edge-to-edge without
the rounded corners, because iOS applies its own corner mask and would fill
transparent corners with black.

Regenerate the touch icon from the SVG with:

```bash
sed 's/rx="7.5"//' favicon.svg > /tmp/touch.svg
qlmanage -t -s 180 -o /tmp /tmp/touch.svg
sips -s format png /tmp/touch.svg.png --out apple-touch-icon.png
```

## Why the live readout doesn't use IntersectionObserver

The obvious way to show the bar "only when the result is off-screen" is an
IntersectionObserver on the result. It doesn't work for the case that matters.

An on-screen keyboard shrinks the **visual** viewport but leaves the **layout**
viewport untouched. IntersectionObserver measures against the layout viewport,
so with the keyboard open it still reports the result as comfortably on screen
while the keyboard is sitting on top of it — precisely when you are typing and
need the readout.

So visibility is computed from `window.visualViewport` (its `offsetTop` and
`height`) against the result's rect, recomputed on scroll, resize, visual
viewport changes, and input focus/blur. A result counts as visible only when
more than half of it is inside the visible area; a sliver peeking out doesn't
count.

## Variable rates: scenarios, not forecasts

Selecting **Variabile** flanks the monthly payment with what it becomes if the
rate moves by 1, 1.5 or 2 percentage points — cuts on the left, rises on the
right. Where the panel is too narrow for that, they stack underneath in two
centred columns instead.

That switch is a **container query on the results panel**, not a viewport
media query. The panel is narrow both on a phone and inside the desktop
two-column card, and a viewport breakpoint cannot tell those apart — which is
exactly how the flanks ended up overlapping the number on tablets.

Both directions are shown on purpose. An earlier version listed only rises,
below the payment and with the extra *total* cost alongside; sitting under the
monthly figures those totals read as part of the payment, and showing only the
downside framed a two-sided range as a warning.

These are deliberately scenarios rather than a prediction. A variable rate in
the eurozone tracks EURIBOR plus a fixed bank margin, and EURIBOR's future
path is not forecastable with any useful accuracy — forward curves price in
market expectations, but they are biased predictors, and a random walk beats
most rate forecasts over the horizons that matter for a loan. A tool that
printed "your rate will be X in 2028" would be inventing precision it does
not have.

What *is* knowable is the exposure: how much the payment moves per point of
rate rise. That is arithmetic, not prediction, and it is what the strip shows.

## Interest rate presets

Loan type presets set **amount and term only** — never the interest rate.
Baking in a rate per product would read as a claim about the Kosovo market,
and that claim belongs to the CBK platform, not to this calculator.

## Running locally

No build step, no dependencies. Any static server works:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Maths

Standard amortizing loan formula:

```
monthly = P · r · (1+r)^n / ((1+r)^n − 1)
```

where `r` is the monthly rate (annual ÷ 12 ÷ 100) and `n` the term in months.
A 0% rate falls back to `P / n`. The final schedule row absorbs rounding drift
so the closing balance lands exactly on zero.
