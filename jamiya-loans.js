// صفحة السلفة والديون
// في الكود: "jamiya" = السلفة (الادخار الجماعي الشهري)، و"loan" = الدين
// يعتمد على الأدوات الموجودة في app.js: $ و el و save و formatMoney و toDigits و newId ...
// البيانات نفسها (jamiyas و loans) تُحمَّل وتُحفظ في app.js مع باقي البيانات

/*
  السلفة (jamiya):
  { id, name, amount: القسط الشهري, members: عدد المشتركين (= عدد الأشهر),
    startMonth: "YYYY-MM", myTurn: رقم شهر استلامي أو null إذا لم يُحدد بعد,
    paid: ["YYYY-MM", ...] الأشهر التي دفعت قسطها, receivedOn: تاريخ الاستلام أو null }

  الدين (loan):
  { id, person, direction: "lent" (أعطيت) أو "borrowed" (أخذت), amount, date,
    dueDate: موعد الإرجاع أو "", note, payments: [{ id, amount, date }] }
*/

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ===== أدوات مساعدة =====

function monthsBetween(from, to) {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function thisMonth() {
  return todayString().slice(0, 7);
}

// "10/26" لشهر تشرين الأول 2026
function shortMonth(month) {
  const [y, m] = month.split("-");
  return `${Number(m)}/${y.slice(2)}`;
}

function jamiyaInfo(j) {
  const now = thisMonth();
  const index = monthsBetween(j.startMonth, now) + 1; // رقم الشهر الحالي في السلفة
  const months = Array.from({ length: j.members }, (_, i) => shiftMonth(j.startMonth, i));
  const paid = months.filter((m) => j.paid.includes(m));
  const pastOrNow = months.filter((m) => m <= now);
  return {
    index,
    months,
    started: index >= 1,
    finished: index > j.members,
    endMonth: months[months.length - 1],
    payout: j.amount * j.members,
    paidCount: paid.length,
    paidTotal: paid.length * j.amount,
    dueNow: index >= 1 && index <= j.members && !j.paid.includes(now),
    missed: pastOrNow.filter((m) => m !== now && !j.paid.includes(m)).length,
    turnMonth: j.myTurn ? months[j.myTurn - 1] : null,
  };
}

// التواريخ داخل نص عربي تنقلب (03-10-2026)، فنعزلها لتُقرأ دائماً من اليسار لليمين
function ltr(text) {
  return `\u2066${text}\u2069`;
}

function loanPaid(loan) {
  return loan.payments.reduce((s, p) => s + p.amount, 0);
}

function loanRemaining(loan) {
  return Math.max(0, loan.amount - loanPaid(loan));
}

// عدد الأيام حتى موعد الإرجاع (سالب = متأخرة)
function daysUntil(date) {
  return -daysAgo(date);
}

function isOverdue(loan) {
  return Boolean(loan.dueDate) && loanRemaining(loan) > 0 && daysUntil(loan.dueDate) < 0;
}

function loanTitle(loan) {
  return loan.direction === "lent" ? `📤 أعطيت ${loan.person}` : `📥 أخذت من ${loan.person}`;
}

// ===== التحقق من بيانات النسخة الاحتياطية (يستخدمها app.js عند الاسترجاع) =====

function sanitizeJamiya(j) {
  if (!j || typeof j.id !== "string" || typeof j.name !== "string" || !j.name.trim()) return null;
  const members = Math.round(j.members);
  if (!(j.amount > 0) || !(members >= 2 && members <= 60) || !MONTH_RE.test(j.startMonth)) return null;
  const turn = Math.round(j.myTurn);
  return {
    id: j.id,
    name: j.name.trim().slice(0, 40),
    amount: Math.round(j.amount),
    members,
    startMonth: j.startMonth,
    myTurn: turn >= 1 && turn <= members ? turn : null,
    paid: Array.isArray(j.paid) ? [...new Set(j.paid.filter((m) => MONTH_RE.test(m)))] : [],
    receivedOn: DATE_RE.test(j.receivedOn) ? j.receivedOn : null,
  };
}

function sanitizeLoan(l) {
  if (!l || typeof l.id !== "string" || typeof l.person !== "string" || !l.person.trim()) return null;
  if (!["lent", "borrowed"].includes(l.direction) || !(l.amount > 0) || !DATE_RE.test(l.date)) return null;
  const payments = Array.isArray(l.payments)
    ? l.payments
        .filter((p) => p && typeof p.id === "string" && p.amount > 0 && DATE_RE.test(p.date))
        .map((p) => ({ id: p.id, amount: Math.round(p.amount), date: p.date }))
    : [];
  return {
    id: l.id,
    person: l.person.trim().slice(0, 40),
    direction: l.direction,
    amount: Math.round(l.amount),
    date: l.date,
    dueDate: DATE_RE.test(l.dueDate) ? l.dueDate : "",
    note: typeof l.note === "string" ? l.note.slice(0, 200) : "",
    payments,
  };
}

// ===== التنقل بين الصفحتين =====

const tabs = document.querySelectorAll(".tab");

function showView(viewId) {
  for (const tab of tabs) {
    const active = tab.dataset.view === viewId;
    tab.classList.toggle("active", active);
    $(tab.dataset.view).hidden = !active;
  }
  window.scrollTo(0, 0);
}

for (const tab of tabs) {
  tab.addEventListener("click", () => showView(tab.dataset.view));
}

$("social-reminder").addEventListener("click", () => showView("view-social"));

// ===== العرض =====

function renderSocial() {
  renderSocialSummary();
  renderJamiyas();
  renderLoans();
  renderSocialReminder();
}

function renderSocialSummary() {
  const open = loans.filter((l) => loanRemaining(l) > 0);
  const lent = open.filter((l) => l.direction === "lent").reduce((s, l) => s + loanRemaining(l), 0);
  const borrowed = open.filter((l) => l.direction === "borrowed").reduce((s, l) => s + loanRemaining(l), 0);
  // المدّخر = ما دفعته في السلف التي لم تستلم مبلغها بعد
  const saved = jamiyas.filter((j) => !j.receivedOn).reduce((s, j) => s + jamiyaInfo(j).paidTotal, 0);
  $("sum-lent").textContent = formatMoney(lent);
  $("sum-borrowed").textContent = formatMoney(borrowed);
  $("sum-jamiya").textContent = formatMoney(saved);
}

// تذكير في صفحة المصاريف + نقطة حمراء على زر الصفحة
function renderSocialReminder() {
  const parts = [];
  const due = jamiyas.filter((j) => jamiyaInfo(j).dueNow).length;
  const missed = jamiyas.reduce((s, j) => s + jamiyaInfo(j).missed, 0);
  const overdue = loans.filter(isOverdue).length;
  if (due) parts.push(due === 1 ? "قسط سلفة لم يُدفع هذا الشهر" : `${due} أقساط سلف لم تُدفع هذا الشهر`);
  if (missed) parts.push(missed === 1 ? "قسط سلفة متأخر" : `${countWord(missed, "قسط", "قسطان", "أقساط")} متأخرة`);
  if (overdue) parts.push(overdue === 1 ? "دين فات موعد إرجاعه" : `${overdue} ديون فات موعد إرجاعها`);

  const reminder = $("social-reminder");
  reminder.hidden = parts.length === 0;
  reminder.textContent = `🔔 ${parts.join(" · ")}`;
  $("social-dot").hidden = parts.length === 0;
}

function renderJamiyas() {
  const list = $("jamiya-list");
  list.innerHTML = "";
  if (jamiyas.length === 0) {
    list.appendChild(el("p", "empty", "لا توجد سلف. اضغط \"+ سلفة\" لإضافة واحدة."));
    return;
  }

  // السلف المنتهية في الأسفل
  const sorted = [...jamiyas].sort((a, b) => jamiyaInfo(a).finished - jamiyaInfo(b).finished);
  for (const j of sorted) list.appendChild(renderJamiya(j));
}

function renderJamiya(j) {
  const info = jamiyaInfo(j);
  const now = thisMonth();
  const box = el("div", info.finished ? "jamiya finished" : "jamiya");

  const head = el("div", "item-head");
  head.appendChild(el("strong", "", j.name));
  const editBtn = el("button", "small-btn", "تعديل");
  editBtn.type = "button";
  editBtn.addEventListener("click", () => openJamiyaForm(j));
  head.appendChild(editBtn);
  box.appendChild(head);

  box.appendChild(
    el(
      "p",
      "item-sub",
      `${formatMoney(j.amount)} شهرياً · ${j.members} مشتركين · من ${monthLabel(j.startMonth)} إلى ${monthLabel(info.endMonth)}`
    )
  );

  let status;
  if (!info.started) status = `تبدأ في ${monthLabel(j.startMonth)}`;
  else if (info.finished) status = "✅ انتهت السلفة";
  else status = `الشهر ${info.index} من ${j.members}`;
  box.appendChild(el("p", "item-status", status));

  // شبكة الأشهر: اضغط على شهر لتسجيل دفع قسطه أو إلغائه
  const chips = el("div", "month-chips");
  info.months.forEach((month, i) => {
    const classes = ["chip"];
    if (j.paid.includes(month)) classes.push("paid");
    else if (month < now) classes.push("missed");
    if (month === now) classes.push("current");
    if (j.myTurn === i + 1) classes.push("turn");

    const chip = el("button", classes.join(" "));
    chip.type = "button";
    chip.append(el("span", "chip-num", j.myTurn === i + 1 ? `⭐${i + 1}` : String(i + 1)), el("span", "chip-month", shortMonth(month)));
    chip.disabled = month > now;
    chip.setAttribute("aria-label", `${monthLabel(month)}: ${j.paid.includes(month) ? "مدفوع" : "غير مدفوع"}`);
    chip.addEventListener("click", () => toggleJamiyaPaid(j, month));
    chips.appendChild(chip);
  });
  box.appendChild(chips);
  box.appendChild(el("p", "hint start", "اضغط على أي شهر لتسجيل دفع قسطه أو إلغائه."));

  const stats = el("div", "item-stats");
  stats.appendChild(
    el("p", "", `دفعت ${formatMoney(info.paidTotal)} من ${formatMoney(info.payout)} (${info.paidCount} من ${j.members} أقساط)`)
  );
  if (j.receivedOn) {
    stats.appendChild(el("p", "good", `✅ استلمت ${formatMoney(info.payout)} في ${ltr(j.receivedOn)}`));
  } else if (info.turnMonth) {
    stats.appendChild(el("p", "", `⭐ دورك: الشهر ${j.myTurn} (${monthLabel(info.turnMonth)}) · ستستلم ${formatMoney(info.payout)}`));
  } else {
    stats.appendChild(el("p", "muted", "⭐ دورك لم يُحدد بعد. اضغط \"تعديل\" لإضافته عند معرفته."));
  }
  if (info.missed) {
    stats.appendChild(el("p", "bad", `⚠️ عليك ${countWord(info.missed, "قسط متأخر", "قسطان متأخران", "أقساط متأخرة")}`));
  }
  box.appendChild(stats);

  const actions = el("div", "item-actions");
  if (info.dueNow) {
    const payBtn = el("button", "primary-btn", `✓ دفعت قسط ${monthLabel(now)}`);
    payBtn.type = "button";
    payBtn.addEventListener("click", () => toggleJamiyaPaid(j, now));
    actions.appendChild(payBtn);
  }
  if (!j.receivedOn && j.myTurn && info.index >= j.myTurn) {
    const receiveBtn = el("button", "action-btn", `💰 استلمت ${formatMoney(info.payout)}`);
    receiveBtn.type = "button";
    receiveBtn.addEventListener("click", () => {
      j.receivedOn = todayString();
      save();
    });
    actions.appendChild(receiveBtn);
  }
  if (j.receivedOn) {
    const undoBtn = el("button", "link-btn dark", "تراجع عن الاستلام");
    undoBtn.type = "button";
    undoBtn.addEventListener("click", () => {
      if (!confirm("إلغاء تسجيل استلام المبلغ؟")) return;
      j.receivedOn = null;
      save();
    });
    actions.appendChild(undoBtn);
  }
  if (actions.childElementCount) box.appendChild(actions);
  return box;
}

function toggleJamiyaPaid(j, month) {
  j.paid = j.paid.includes(month) ? j.paid.filter((m) => m !== month) : [...j.paid, month];
  save();
}

function renderLoans() {
  const open = loans.filter((l) => loanRemaining(l) > 0);
  const settled = loans.filter((l) => loanRemaining(l) === 0);

  // المتأخرة أولاً، ثم الأقرب موعداً، ثم الأحدث
  open.sort((a, b) => {
    if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate || b.dueDate) return a.dueDate ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  const list = $("loan-list");
  list.innerHTML = "";
  if (open.length === 0) {
    list.appendChild(el("p", "empty", loans.length ? "لا توجد ديون مفتوحة 👌" : "لا توجد ديون. اضغط \"+ دين\" لإضافة واحد."));
  }
  for (const loan of open) list.appendChild(renderLoan(loan));

  const details = $("settled-loans");
  details.hidden = settled.length === 0;
  $("settled-title").textContent = `✅ الديون المسددة (${settled.length})`;
  const settledList = $("settled-list");
  settledList.innerHTML = "";
  settled.sort((a, b) => b.date.localeCompare(a.date));
  for (const loan of settled) settledList.appendChild(renderLoan(loan));
}

function renderLoan(loan) {
  const remaining = loanRemaining(loan);
  const paid = loanPaid(loan);
  const box = el("div", `loan ${loan.direction}${isOverdue(loan) ? " overdue" : ""}${remaining === 0 ? " settled" : ""}`);

  const head = el("div", "item-head");
  head.append(el("strong", "", loanTitle(loan)), el("strong", "loan-remaining", remaining ? formatMoney(remaining) : "✅ تمت التسوية"));
  box.appendChild(head);

  const sub = [`المبلغ ${formatMoney(loan.amount)}`, ltr(loan.date)];
  if (loan.note) sub.push(loan.note);
  box.appendChild(el("p", "item-sub", sub.join(" · ")));

  if (paid > 0) {
    const bar = el("div", "progress");
    const fill = el("div", "progress-fill");
    fill.style.width = `${Math.min(100, (paid / loan.amount) * 100)}%`;
    bar.appendChild(fill);
    box.appendChild(bar);
    box.appendChild(el("p", "item-sub", `${loan.direction === "lent" ? "أرجع" : "أرجعت"} ${formatMoney(paid)} من ${formatMoney(loan.amount)}`));
  }

  if (loan.dueDate && remaining > 0) {
    const days = daysUntil(loan.dueDate);
    let text;
    if (days < 0) text = `⚠️ فات موعد الإرجاع (${ltr(loan.dueDate)}) منذ ${countWord(-days, "يوم", "يومين", "أيام")}`;
    else if (days === 0) text = "⏰ موعد الإرجاع اليوم";
    else text = `⏰ موعد الإرجاع: ${ltr(loan.dueDate)} (بعد ${countWord(days, "يوم", "يومين", "أيام")})`;
    box.appendChild(el("p", days < 0 ? "bad" : "item-sub", text));
  }

  if (loan.payments.length) {
    const payments = el("ul", "payments");
    for (const p of [...loan.payments].sort((a, b) => a.date.localeCompare(b.date))) {
      const li = el("li");
      li.appendChild(el("span", "", `دفعة ${formatMoney(p.amount)} · ${ltr(p.date)}`));
      const del = el("button", "icon-btn", "✕");
      del.type = "button";
      del.setAttribute("aria-label", "حذف الدفعة");
      del.addEventListener("click", () => {
        if (!confirm(`حذف دفعة ${formatMoney(p.amount)}؟`)) return;
        loan.payments = loan.payments.filter((x) => x.id !== p.id);
        save();
      });
      li.appendChild(del);
      payments.appendChild(li);
    }
    box.appendChild(payments);
  }

  const actions = el("div", "item-actions row");
  if (remaining > 0) {
    const payBtn = el("button", "small-btn", "+ تسجيل دفعة");
    payBtn.type = "button";
    payBtn.addEventListener("click", () => openPaymentForm(loan));
    actions.appendChild(payBtn);
  }
  if (remaining > 0 && loan.direction === "lent") {
    const remindBtn = el("button", "small-btn", "📱 تذكير لطيف");
    remindBtn.type = "button";
    remindBtn.addEventListener("click", () => sendReminder(loan));
    actions.appendChild(remindBtn);
  }
  const editBtn = el("button", "small-btn", "تعديل");
  editBtn.type = "button";
  editBtn.addEventListener("click", () => openLoanForm(loan));
  actions.appendChild(editBtn);
  box.appendChild(actions);
  return box;
}

// رسالة تذكير مهذبة عبر واتساب أو أي تطبيق مراسلة
async function sendReminder(loan) {
  const text = `مرحباً ${loan.person} 🌷\nتذكير لطيف بخصوص مبلغ ${formatMoney(loanRemaining(loan))} المتبقي من الدين. متى ما تيسّر لك، وشكراً 🙏`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

// ===== نموذج السلفة =====

const jamiyaDialog = $("jamiya-dialog");
const jamiyaForm = $("jamiya-form");
const jamiyaName = $("jamiya-name");
const jamiyaAmount = $("jamiya-amount");
const jamiyaMembers = $("jamiya-members");
const jamiyaStart = $("jamiya-start");
const jamiyaTurn = $("jamiya-turn");
let editingJamiya = null;

function fillTurnOptions(selected) {
  const members = Math.round(Number(jamiyaMembers.value));
  const start = MONTH_RE.test(jamiyaStart.value) ? jamiyaStart.value : null;
  jamiyaTurn.innerHTML = "";
  const unknown = el("option", "", "لم يُحدد بعد (قرعة)");
  unknown.value = "";
  jamiyaTurn.appendChild(unknown);
  if (!(members >= 2 && members <= 60)) return;
  for (let i = 1; i <= members; i++) {
    const option = el("option", "", start ? `الشهر ${i} · ${monthLabel(shiftMonth(start, i - 1))}` : `الشهر ${i}`);
    option.value = i;
    jamiyaTurn.appendChild(option);
  }
  jamiyaTurn.value = selected && selected <= members ? selected : "";
}

function updateJamiyaPreview() {
  const amount = Number(toDigits(jamiyaAmount.value));
  const members = Math.round(Number(jamiyaMembers.value));
  const valid = amount > 0 && members >= 2 && members <= 60 && MONTH_RE.test(jamiyaStart.value);
  $("jamiya-preview").textContent = valid
    ? `ستستلم ${formatMoney(amount * members)} · تنتهي في ${monthLabel(shiftMonth(jamiyaStart.value, members - 1))}`
    : "";
}

function openJamiyaForm(j) {
  editingJamiya = j;
  $("jamiya-form-title").textContent = j ? "تعديل سلفة" : "سلفة جديدة";
  $("jamiya-delete").hidden = !j;
  jamiyaName.value = j ? j.name : "";
  jamiyaAmount.value = j ? j.amount.toLocaleString("en-US") : "";
  jamiyaMembers.value = j ? j.members : 10;
  jamiyaStart.value = j ? j.startMonth : thisMonth();
  fillTurnOptions(j ? j.myTurn : null);
  updateJamiyaPreview();
  jamiyaDialog.showModal();
  if (!j) jamiyaName.focus();
}

jamiyaAmount.addEventListener("input", () => {
  formatMoneyInput(jamiyaAmount);
  updateJamiyaPreview();
});
for (const input of [jamiyaMembers, jamiyaStart]) {
  input.addEventListener("input", () => {
    fillTurnOptions(Number(jamiyaTurn.value) || null);
    updateJamiyaPreview();
  });
}

jamiyaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = {
    name: jamiyaName.value.trim(),
    amount: Number(toDigits(jamiyaAmount.value)),
    members: Math.round(Number(jamiyaMembers.value)),
    startMonth: jamiyaStart.value,
    myTurn: Number(jamiyaTurn.value) || null,
  };
  if (!data.name || !(data.amount > 0) || !(data.members >= 2 && data.members <= 60) || !MONTH_RE.test(data.startMonth)) {
    alert("الرجاء إكمال بيانات السلفة بشكل صحيح.");
    return;
  }

  if (editingJamiya) {
    Object.assign(editingJamiya, data);
    // الأشهر المدفوعة التي صارت خارج مدة السلفة بعد التعديل تُحذف
    const months = new Set(jamiyaInfo(editingJamiya).months);
    editingJamiya.paid = editingJamiya.paid.filter((m) => months.has(m));
  } else {
    jamiyas.push({ id: newId(), ...data, paid: [], receivedOn: null });
  }
  save();
  jamiyaDialog.close();
});

$("jamiya-delete").addEventListener("click", () => {
  if (!confirm(`حذف سلفة "${editingJamiya.name}" وكل أقساطها المسجلة؟`)) return;
  jamiyas = jamiyas.filter((j) => j !== editingJamiya);
  save();
  jamiyaDialog.close();
});

$("add-jamiya").addEventListener("click", () => openJamiyaForm(null));

// ===== نموذج الدين =====

const loanDialog = $("loan-dialog");
const loanForm = $("loan-form");
const loanPerson = $("loan-person");
const loanAmount = $("loan-amount");
const loanDate = $("loan-date");
const loanDue = $("loan-due");
const loanNote = $("loan-note");
let editingLoan = null;

function loanDirection() {
  return loanForm.querySelector('input[name="direction"]:checked').value;
}

function updatePersonLabel() {
  $("loan-person-label").textContent = loanDirection() === "lent" ? "لمن؟" : "ممّن؟";
}

function openLoanForm(loan) {
  editingLoan = loan;
  $("loan-form-title").textContent = loan ? "تعديل دين" : "دين جديد";
  $("loan-delete").hidden = !loan;
  loanForm.querySelector(`input[name="direction"][value="${loan ? loan.direction : "lent"}"]`).checked = true;
  loanPerson.value = loan ? loan.person : "";
  loanAmount.value = loan ? loan.amount.toLocaleString("en-US") : "";
  loanDate.value = loan ? loan.date : todayString();
  loanDue.value = loan ? loan.dueDate : "";
  loanNote.value = loan ? loan.note : "";
  updatePersonLabel();

  // اقتراح الأسماء المستخدمة سابقاً
  const people = $("people");
  people.innerHTML = "";
  for (const name of [...new Set(loans.map((l) => l.person))]) {
    const option = el("option");
    option.value = name;
    people.appendChild(option);
  }

  loanDialog.showModal();
  if (!loan) loanPerson.focus();
}

for (const radio of loanForm.querySelectorAll('input[name="direction"]')) {
  radio.addEventListener("change", updatePersonLabel);
}
loanAmount.addEventListener("input", () => formatMoneyInput(loanAmount));

loanForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = {
    person: loanPerson.value.trim(),
    direction: loanDirection(),
    amount: Number(toDigits(loanAmount.value)),
    date: loanDate.value,
    dueDate: loanDue.value,
    note: loanNote.value.trim(),
  };
  if (!data.person || !(data.amount > 0)) {
    alert("الرجاء إدخال الاسم والمبلغ.");
    return;
  }
  if (editingLoan && data.amount < loanPaid(editingLoan)) {
    alert(`المبلغ أقل من الدفعات المسجلة (${formatMoney(loanPaid(editingLoan))}). احذف بعض الدفعات أولاً.`);
    return;
  }

  if (editingLoan) Object.assign(editingLoan, data);
  else loans.push({ id: newId(), ...data, payments: [] });
  save();
  loanDialog.close();
});

$("loan-delete").addEventListener("click", () => {
  if (!confirm(`حذف هذا الدين (${loanTitle(editingLoan)}) وكل دفعاته؟`)) return;
  loans = loans.filter((l) => l !== editingLoan);
  save();
  loanDialog.close();
});

$("add-loan").addEventListener("click", () => openLoanForm(null));

// ===== نموذج الدفعة =====

const paymentDialog = $("payment-dialog");
const paymentAmount = $("payment-amount");
const paymentDate = $("payment-date");
let payingLoan = null;

function openPaymentForm(loan) {
  payingLoan = loan;
  const remaining = loanRemaining(loan);
  $("payment-title").textContent = loan.direction === "lent" ? `دفعة من ${loan.person}` : `دفعة إلى ${loan.person}`;
  $("payment-remaining").textContent = `المتبقي: ${formatMoney(remaining)}`;
  paymentAmount.value = remaining.toLocaleString("en-US");
  paymentDate.value = todayString();
  paymentDialog.showModal();
}

paymentAmount.addEventListener("input", () => formatMoneyInput(paymentAmount));

$("payment-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(toDigits(paymentAmount.value));
  const remaining = loanRemaining(payingLoan);
  if (!(amount > 0)) {
    alert("الرجاء إدخال مبلغ الدفعة.");
    return;
  }
  if (amount > remaining) {
    alert(`الدفعة أكبر من المتبقي (${formatMoney(remaining)}).`);
    return;
  }
  payingLoan.payments.push({ id: newId(), amount, date: paymentDate.value });
  save();
  paymentDialog.close();
  if (amount === remaining) alert(`✅ تمت تسوية الدين مع ${payingLoan.person} بالكامل.`);
});

// ===== التشغيل =====

[jamiyaDialog, loanDialog, paymentDialog].forEach(setupDialog);
document.addEventListener("data-changed", renderSocial);
renderSocial();
