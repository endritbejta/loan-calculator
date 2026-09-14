# Loan Calculator · Kosovo

Estimate monthly loan payments, then jump to the Central Bank of Kosovo's
official platform to compare what banks actually offer.

Live: https://endrits-loan-calculator.netlify.app/

## What it does

- **Side-by-side layout on desktop** — inputs left, results right, sized to fit
  without scrolling. Stacks to a single column below 820px.
- **Live calculation** — results update as you type, no button press.
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

## Variable rates: scenarios, not forecasts

Selecting **Variabile** shows what the payment becomes if the rate rises by 1,
2 or 3 percentage points, with the extra total cost alongside.

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
