document.addEventListener("DOMContentLoaded", () => {
  const amountInput = document.getElementById("amount");
  const rateInput = document.getElementById("rate");
  const monthsInput = document.getElementById("months");
  const loanTypeSelect = document.getElementById("loan-type");
  const rateTypeGroup = document.getElementById("rate-type");
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

  const scheduleBtn = document.getElementById("schedule-btn");
  const scheduleModal = document.getElementById("schedule-modal");
  const scheduleBody = document.querySelector("#schedule-table tbody");
  const csvBtn = document.getElementById("csv-btn");

  const euro = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Typical shape of each product, used only to seed the form. Rates are
  // deliberately left alone — the BQK platform is the source of truth for
  // those, and inventing one here would read as a claim about the market.
  const PRESETS = {
    personale:  { label: "Kredi Personale",     amount: 10000, months: 48 },
    konsumuese: { label: "Kredi Konsumuese",    amount: 5000,  months: 24 },
    banesore:   { label: "Kredi Banesore",      amount: 80000, months: 240 },
    automjeti:  { label: "Kredi për Automjet",  amount: 15000, months: 60 },
    biznes:     { label: "Kredi për Biznes",    amount: 30000, months: 60 },
  };

  // Rate moves in percentage points, shown in both directions: a variable rate
  // can fall as easily as rise, and showing only rises reads as a warning
  // rather than as the range it actually is. Scenarios, not a forecast —
  // EURIBOR's path is not predictable to any useful accuracy.
  const SHOCKS = [1, 1.5, 2];

  let rateType = "fikse";
  let schedule = [];

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
    const band = !isNaN(amount) && amount > 10000 ? "mbi €10,000" : "deri €10,000";
    const norm = rateType === "fikse" ? "normë fikse" : "normë variabile";
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
      flankDownEl.appendChild(row(`−${shock}`, payment(amount, down, months)));
      flankUpEl.appendChild(row(`+${shock}`, payment(amount, rate + shock, months)));
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

    const interestShare = total > 0 ? (interest / total) * 100 : 0;
    splitPrincipalEl.style.width = `${100 - interestShare}%`;
    splitInterestEl.style.width = `${interestShare}%`;

    renderFlanks(amount, rate, months);
    schedule = buildSchedule(amount, rate, months, monthly);
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
    const header = "Month,Payment,Principal,Interest,Balance";
    const body = schedule
      .map((r) =>
        [r.n, r.paid, r.principal, r.interest, r.balance]
          .map((v, i) => (i === 0 ? v : v.toFixed(2)))
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
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

  scheduleBtn.addEventListener("click", openModal);
  csvBtn.addEventListener("click", downloadCsv);
  scheduleModal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  recalculate();
});
