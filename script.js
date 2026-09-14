document.addEventListener("DOMContentLoaded", () => {
  const amountInput = document.getElementById("amount");
  const rateInput = document.getElementById("rate");
  const monthsInput = document.getElementById("months");
  const loanTypeSelect = document.getElementById("loan-type");
  const rateTypeGroup = document.getElementById("rate-type");
  const langSwitch = document.getElementById("lang-switch");
  const errorEl = document.getElementById("error-message");

  const monthlyPaymentEl = document.getElementById("monthly-payment");
  const totalPaymentEl = document.getElementById("total-payment");
  const totalInterestEl = document.getElementById("total-interest");
  const splitPrincipalEl = document.getElementById("split-principal");
  const splitInterestEl = document.getElementById("split-interest");
  const bqkFiltersEl = document.getElementById("bqk-filters");
  const flankDownEl = document.getElementById("flank-down");
  const flankUpEl = document.getElementById("flank-up");
  const flankNoteEl = document.getElementById("flank-note");
  const liveBar = document.getElementById("live-bar");
  const liveValueEl = document.getElementById("live-value");

  const scheduleBtn = document.getElementById("schedule-btn");
  const scheduleModal = document.getElementById("schedule-modal");
  const scheduleBody = document.querySelector("#schedule-table tbody");
  const csvBtn = document.getElementById("csv-btn");

  /* ── Strings ───────────────────────────────────────────────── */

  const STRINGS = {
    sq: {
      title: "Kalkulatori i Kredisë",
      subtitle: "Llogarit këstet, pastaj krahaso ofertat reale të bankave",
      loanType: "Lloji i Kredisë",
      optPersonale: "Kredi Personale",
      optKonsumuese: "Kredi Konsumuese",
      optBanesore: "Kredi Banesore",
      optAutomjeti: "Kredi për Automjet",
      optBiznes: "Kredi për Biznes",
      amount: "Shuma e Kredisë",
      rate: "Norma e Interesit",
      term: "Afati",
      mo: "muaj",
      rateType: "Lloji i Normës",
      fixed: "Fikse",
      variable: "Variabile",
      error: "Shëno një shumë pozitive, normë 0 ose më shumë, dhe afat së paku një muaj.",
      viewSchedule: "Shiko planin e amortizimit",
      monthly: "Kësti Mujor",
      flankNote: "Normat variabile ndjekin EURIBOR-in — kësti lëviz bashkë me të. Skenarë, jo parashikim.",
      principal: "Principali",
      interest: "Interesi",
      totalPayment: "Pagesa Totale",
      totalInterest: "Interesi Total",
      compare: "Krahaso ofertat e bankave në BQK",
      bqkHint: "Platforma zyrtare krahasuese e Bankës Qendrore të Kosovës. Filtro për",
      disclaimer: "Vetëm vlerësime — bankat rrumbullakosin ndryshe dhe mund të shtojnë tarifa. Gjithmonë konfirmo me bankën.",
      scheduleTitle: "Plani i Amortizimit",
      thPayment: "Kësti",
      thPrincipal: "Principali",
      thInterest: "Interesi",
      thBalance: "Bilanci",
      downloadCsv: "Shkarko CSV",
      bandOver: "mbi €10,000",
      bandUnder: "deri €10,000",
      normFixed: "normë fikse",
      normVariable: "normë variabile",
    },
    en: {
      title: "Loan Calculator",
      subtitle: "Estimate your payments, then compare real bank offers",
      loanType: "Loan Type",
      optPersonale: "Kredi Personale — Personal",
      optKonsumuese: "Kredi Konsumuese — Consumer",
      optBanesore: "Kredi Banesore — Mortgage",
      optAutomjeti: "Kredi për Automjet — Car",
      optBiznes: "Kredi për Biznes — Business",
      amount: "Loan Amount",
      rate: "Interest Rate",
      term: "Term",
      mo: "mo",
      rateType: "Rate Type",
      fixed: "Fixed",
      variable: "Variable",
      error: "Enter a positive amount, a rate of 0 or more, and a term of at least one month.",
      viewSchedule: "View amortization schedule",
      monthly: "Monthly Payment",
      flankNote: "Variable rates track EURIBOR — the payment moves with it. Scenarios, not a forecast.",
      principal: "Principal",
      interest: "Interest",
      totalPayment: "Total Payment",
      totalInterest: "Total Interest",
      compare: "Compare real bank offers at BQK",
      bqkHint: "Official comparison platform of the Central Bank of Kosovo. Filter for",
      disclaimer: "Estimates only — banks round differently and may add fees. Always confirm with the lender.",
      scheduleTitle: "Amortization Schedule",
      thPayment: "Payment",
      thPrincipal: "Principal",
      thInterest: "Interest",
      thBalance: "Balance",
      downloadCsv: "Download CSV",
      bandOver: "over €10,000",
      bandUnder: "up to €10,000",
      normFixed: "fixed rate",
      normVariable: "variable rate",
    },
  };

  // Product names stay Albanian in both languages — they are what the BQK
  // platform actually labels these loans, so translating them would stop the
  // filter hint matching what you see over there.
  const PRESETS = {
    personale:  { label: "Kredi Personale",    amount: 10000, months: 48 },
    konsumuese: { label: "Kredi Konsumuese",   amount: 5000,  months: 24 },
    banesore:   { label: "Kredi Banesore",     amount: 80000, months: 240 },
    automjeti:  { label: "Kredi për Automjet", amount: 15000, months: 60 },
    biznes:     { label: "Kredi për Biznes",   amount: 30000, months: 60 },
  };

  // Rate moves in percentage points, shown in both directions: a variable rate
  // can fall as easily as rise, and showing only rises reads as a warning
  // rather than as the range it actually is.
  const SHOCKS = [1, 1.5, 2];

  let syncLiveBar = null;
  let lang = localStorage.getItem("lang") === "en" ? "en" : "sq";
  let rateType = "fikse";
  let schedule = [];

  const t = (key) => STRINGS[lang][key];

  // Kosovo uses the euro with comma decimals whichever language the interface
  // is in, so the number format stays put when the language changes.
  const euro = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /* ── Maths ─────────────────────────────────────────────────── */

  const readInputs = () => ({
    amount: parseFloat(amountInput.value),
    rate: parseFloat(rateInput.value),
    months: parseInt(monthsInput.value, 10),
  });

  const validate = ({ amount, rate, months }) => {
    const bad = [];
    if (isNaN(amount) || amount <= 0) bad.push(amountInput);
    if (isNaN(rate) || rate < 0) bad.push(rateInput);
    if (isNaN(months) || months <= 0) bad.push(monthsInput);

    [amountInput, rateInput, monthsInput].forEach((el) =>
      el.classList.toggle("input-error", bad.includes(el))
    );
    errorEl.classList.toggle("hidden", bad.length === 0);
    return bad.length === 0;
  };

  const payment = (amount, rate, months) => {
    if (rate === 0) return amount / months;
    const r = rate / 100 / 12;
    const x = Math.pow(1 + r, months);
    return (amount * x * r) / (x - 1);
  };

  // Rebuilt each run so the modal and the CSV never disagree with the summary.
  const buildSchedule = (amount, rate, months, monthly) => {
    const r = rate / 100 / 12;
    let balance = amount;
    const rows = [];

    for (let i = 1; i <= months; i++) {
      const interest = balance * r;
      // Final row absorbs rounding drift so the balance lands exactly on zero.
      const principal = i === months ? balance : monthly - interest;
      const paid = principal + interest;
      balance = Math.max(0, balance - principal);
      rows.push({ n: i, paid, principal, interest, balance });
    }
    return rows;
  };

  /* ── Rendering ─────────────────────────────────────────────── */

  const animate = (el, to, duration = 550) => {
    const from = parseFloat(el.dataset.value || 0);
    el.dataset.value = to;
    if (Math.abs(to - from) < 0.01) {
      el.textContent = euro.format(to);
      return;
    }

    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = euro.format(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = euro.format(to);
    };
    requestAnimationFrame(step);
  };

  const updateBqkHint = () => {
    const { amount } = readInputs();
    const label = PRESETS[loanTypeSelect.value].label;
    const band = !isNaN(amount) && amount > 10000 ? t("bandOver") : t("bandUnder");
    const norm = rateType === "fikse" ? t("normFixed") : t("normVariable");
    bqkFiltersEl.textContent = `${label} · ${band} · ${norm}`;
  };

  const renderFlanks = (amount, rate, months) => {
    const visible = rateType === "variabile";
    flankNoteEl.classList.toggle("hidden", !visible);
    flankDownEl.innerHTML = "";
    flankUpEl.innerHTML = "";
    if (!visible) return;

    const row = (label, value) => {
      const el = document.createElement("span");
      el.className = "flank-row";
      el.innerHTML = `<i class="pt">${label}</i><b class="amt">${euro.format(value)}</b>`;
      return el;
    };

    SHOCKS.forEach((shock) => {
      // A rate cannot go below zero, so deep cuts flatten rather than invert.
      const down = Math.max(0, rate - shock);
      flankDownEl.appendChild(row(`−${shock} pt`, payment(amount, down, months)));
      flankUpEl.appendChild(row(`+${shock} pt`, payment(amount, rate + shock, months)));
    });
  };

  const recalculate = () => {
    updateBqkHint();

    const values = readInputs();
    if (!validate(values)) return;

    const { amount, rate, months } = values;
    const monthly = payment(amount, rate, months);
    const total = monthly * months;
    const interest = total - amount;

    animate(monthlyPaymentEl, monthly);
    animate(totalPaymentEl, total);
    animate(totalInterestEl, interest);

    // Set directly rather than counting up: this is a live readout while
    // typing, so it should land on the figure immediately.
    const formatted = euro.format(monthly);
    if (liveValueEl.textContent !== formatted) {
      liveValueEl.textContent = formatted;
      liveValueEl.classList.remove("bump");
      void liveValueEl.offsetWidth; // restart the animation
      liveValueEl.classList.add("bump");
    }

    const interestShare = total > 0 ? (interest / total) * 100 : 0;
    splitPrincipalEl.style.width = `${100 - interestShare}%`;
    splitInterestEl.style.width = `${interestShare}%`;

    renderFlanks(amount, rate, months);
    schedule = buildSchedule(amount, rate, months, monthly);
    if (syncLiveBar) syncLiveBar();
  };

  /* ── Language ──────────────────────────────────────────────── */

  const applyLanguage = () => {
    document.documentElement.lang = lang;
    document.title = `${t("title")} · ${lang === "sq" ? "Kosovë" : "Kosovo"}`;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = STRINGS[lang][el.dataset.i18n];
      if (value !== undefined) el.textContent = value;
    });

    langSwitch.querySelectorAll(".seg").forEach((el) => {
      const on = el.dataset.lang === lang;
      el.classList.toggle("active", on);
      el.setAttribute("aria-checked", String(on));
    });

    recalculate();
  };

  /* ── Schedule modal ────────────────────────────────────────── */

  const renderSchedule = () => {
    scheduleBody.innerHTML = "";
    const frag = document.createDocumentFragment();

    schedule.forEach((row) => {
      const tr = document.createElement("tr");
      [row.n, row.paid, row.principal, row.interest, row.balance].forEach((cell, i) => {
        const td = document.createElement("td");
        td.textContent = i === 0 ? cell : euro.format(cell);
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });

    scheduleBody.appendChild(frag);
  };

  const openModal = () => {
    if (!schedule.length) return;
    renderSchedule();
    scheduleModal.classList.remove("hidden");
  };

  const closeModal = () => scheduleModal.classList.add("hidden");

  const downloadCsv = () => {
    const header = ["#", t("thPayment"), t("thPrincipal"), t("thInterest"), t("thBalance")];
    const body = schedule
      .map((r) =>
        [r.n, r.paid, r.principal, r.interest, r.balance]
          .map((v, i) => (i === 0 ? v : v.toFixed(2)))
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${header.join(",")}\n${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan-schedule-${loanTypeSelect.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Wiring ────────────────────────────────────────────────── */

  [amountInput, rateInput, monthsInput].forEach((el) =>
    el.addEventListener("input", recalculate)
  );

  loanTypeSelect.addEventListener("change", () => {
    const preset = PRESETS[loanTypeSelect.value];
    amountInput.value = preset.amount;
    monthsInput.value = preset.months;
    recalculate();
  });

  rateTypeGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg");
    if (!btn) return;
    rateType = btn.dataset.value;
    rateTypeGroup.querySelectorAll(".seg").forEach((el) => {
      const on = el === btn;
      el.classList.toggle("active", on);
      el.setAttribute("aria-checked", String(on));
    });
    recalculate();
  });

  langSwitch.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg");
    if (!btn || btn.dataset.lang === lang) return;
    lang = btn.dataset.lang;
    localStorage.setItem("lang", lang);
    applyLanguage();
  });

  // Show the readout only while the real figure is off-screen, so it never
  // duplicates something already in front of you.
  //
  // This deliberately uses visualViewport rather than IntersectionObserver:
  // an open keyboard shrinks the *visual* viewport but leaves the layout
  // viewport untouched, so an observer still reports the result as on-screen
  // while the keyboard is covering it — which is the exact moment the readout
  // is needed.
  const vv = window.visualViewport;
  const headlineEl = document.querySelector(".headline");

  const resultOnScreen = () => {
    const r = headlineEl.getBoundingClientRect();
    const top = vv ? vv.offsetTop : 0;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const shown = Math.min(r.bottom, bottom) - Math.max(r.top, top);
    return shown > r.height * 0.5; // a sliver doesn't count as visible
  };

  syncLiveBar = () => {
    liveBar.classList.toggle("visible", !resultOnScreen());
  };

  ["scroll", "resize"].forEach((e) =>
    window.addEventListener(e, syncLiveBar, { passive: true })
  );
  if (vv) {
    ["resize", "scroll"].forEach((e) =>
      vv.addEventListener(e, syncLiveBar, { passive: true })
    );
  }
  // The keyboard animates in, so re-check once it has settled.
  [amountInput, rateInput, monthsInput].forEach((el) => {
    el.addEventListener("focus", () => setTimeout(syncLiveBar, 350));
    el.addEventListener("blur", () => setTimeout(syncLiveBar, 350));
  });

  scheduleBtn.addEventListener("click", openModal);
  csvBtn.addEventListener("click", downloadCsv);
  scheduleModal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  applyLanguage();
  syncLiveBar();
});
