// صفحة السلفة والديون
// في الكود: "jamiya" = السلفة (الادخار الجماعي الشهري)، و"loan" = الدين
// يعتمد على الأدوات الموجودة في app.js: $ و el و save و formatMoney و toDigits و newId ...
// البيانات نفسها (jamiyas و loans) تُحمَّل وتُحفظ في app.js مع باقي البيانات

/*
  السلفة (jamiya):
  { id, name, shareAmount: ما يدفعه الاسم الواحد شهرياً, shares: عدد أسمائي,
    members: كل الأسماء في السلفة (= عدد الأشهر), startMonth: "YYYY-MM",
    turns: [{ turn: رقم شهر استلام هذا الاسم أو null قبل القرعة, receivedOn: تاريخ الاستلام أو null }] لكل اسم من أسمائي,
    paid: ["YYYY-MM", ...] الأشهر التي دفعت قسطها,
    amount: قسطي الشهري = shareAmount × shares (محسوب، تستخدمه مصاريف الأقساط) }
  كل شهر يستلم اسم واحد: shareAmount × members

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

// السلف المحفوظة قبل دعم عدة أسماء: اسم واحد قسطه كل المبلغ
function upgradeJamiya(j) {
  if (!(j.shares >= 1) || !Array.isArray(j.turns)) {
    j.shares = 1;
    j.shareAmount = j.amount;
    j.turns = [{ turn: j.myTurn || null, receivedOn: j.receivedOn || null }];
    delete j.myTurn;
    delete j.receivedOn;
  }
  j.amount = j.shareAmount * j.shares;
  return j;
}

function jamiyaInfo(j) {
  const now = thisMonth();
  const index = monthsBetween(j.startMonth, now) + 1; // رقم الشهر الحالي في السلفة
  const months = Array.from({ length: j.members }, (_, i) => shiftMonth(j.startMonth, i));
  const paid = months.filter((m) => j.paid.includes(m));
  const pastOrNow = months.filter((m) => m <= now);
  const payout = j.shareAmount * j.members; // ما يستلمه الاسم الواحد
  const paidTotal = paid.length * j.amount;
  const receivedTotal = j.turns.filter((t) => t.receivedOn).length * payout;
  return {
    index,
    months,
    started: index >= 1,
    finished: index > j.members,
    endMonth: months[months.length - 1],
    payout,
    paidCount: paid.length,
    paidTotal,
    receivedTotal,
    // ما دفعته ناقص ما استلمته: موجب = مدّخر لك، سالب = استلمت أكثر وتسدده من الأقساط القادمة
    balance: paidTotal - receivedTotal,
    dueNow: index >= 1 && index <= j.members && !j.paid.includes(now),
    missed: pastOrNow.filter((m) => m !== now && !j.paid.includes(m)).length,
    turnMonths: new Set(j.turns.filter((t) => t.turn).map((t) => months[t.turn - 1])),
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
  return loan.direction === "lent" ? `أعطيت ${loan.person}` : `أخذت من ${loan.person}`;
}

// ===== التحقق من بيانات النسخة الاحتياطية (يستخدمها app.js عند الاسترجاع) =====

function sanitizeJamiya(j) {
  if (!j || typeof j.id !== "string" || typeof j.name !== "string" || !j.name.trim()) return null;
  const members = Math.round(j.members);
  if (!(members >= 2 && members <= 60) || !MONTH_RE.test(j.startMonth)) return null;
  const clean = {
    id: j.id,
    name: j.name.trim().slice(0, 40),
    amount: Math.round(j.amount),
    members,
    startMonth: j.startMonth,
    paid: Array.isArray(j.paid) ? [...new Set(j.paid.filter((m) => MONTH_RE.test(m)))] : [],
  };
  if (j.shares >= 1 && Array.isArray(j.turns)) {
    clean.shares = Math.min(members, Math.round(j.shares));
    clean.shareAmount = Math.round(j.shareAmount);
    clean.turns = Array.from({ length: clean.shares }, (_, i) => {
      const t = j.turns[i] || {};
      const turn = Math.round(t.turn);
      return { turn: turn >= 1 && turn <= members ? turn : null, receivedOn: DATE_RE.test(t.receivedOn) ? t.receivedOn : null };
    });
    if (!(clean.shareAmount > 0)) return null;
  } else {
    // نسخة قديمة: اسم واحد
    if (!(clean.amount > 0)) return null;
    const turn = Math.round(j.myTurn);
    clean.myTurn = turn >= 1 && turn <= members ? turn : null;
    clean.receivedOn = DATE_RE.test(j.receivedOn) ? j.receivedOn : null;
  }
  return upgradeJamiya(clean);
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
  // المدّخر = ما دفعته في السلف ناقص ما استلمته منها
  const saved = jamiyas.reduce((s, j) => s + jamiyaInfo(j).balance, 0);
  $("sum-lent").textContent = formatMoney(lent);
  $("sum-borrowed").textContent = formatMoney(borrowed);
  const savedEl = $("sum-jamiya");
  savedEl.textContent = formatMoney(Math.abs(saved));
  savedEl.classList.toggle("bad", saved < 0);
  savedEl.previousElementSibling.textContent = saved < 0 ? "عليك للسلف" : "مدّخر في السلف";
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
  reminder.replaceChildren(icon("bell"), el("span", "notice-text", parts.join(" · ")), icon("chevron-left", "sm"));
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

  const namesText = j.shares > 1 ? `${countWord(j.shares, "اسم", "اسمان", "أسماء")} × ${formatMoney(j.shareAmount)} = ` : "";
  box.appendChild(el("p", "item-sub", `${namesText}${formatMoney(j.amount)} شهرياً`));
  box.appendChild(
    el("p", "item-sub", `${j.members} اسماً في السلفة · من ${monthLabel(j.startMonth)} إلى ${monthLabel(info.endMonth)}`)
  );

  let status;
  if (!info.started) status = `تبدأ في ${monthLabel(j.startMonth)}`;
  else if (info.finished) status = "انتهت السلفة";
  else status = `الشهر ${info.index} من ${j.members}`;
  box.appendChild(el("p", "item-status", status));

  // شبكة الأشهر: اضغط على شهر لتسجيل دفع قسطه أو إلغائه
  const chips = el("div", "month-chips");
  info.months.forEach((month, i) => {
    const classes = ["chip"];
    if (j.paid.includes(month)) classes.push("paid");
    else if (month < now) classes.push("missed");
    if (month === now) classes.push("current");
    if (info.turnMonths.has(month)) classes.push("turn");

    const chip = el("button", classes.join(" "));
    chip.type = "button";
    const num = el("span", "chip-num", String(i + 1));
    if (info.turnMonths.has(month)) num.prepend(icon("star", "sm"));
    chip.append(num, el("span", "chip-month", shortMonth(month)));
    chip.disabled = month > now;
    chip.setAttribute("aria-label", `${monthLabel(month)}: ${j.paid.includes(month) ? "مدفوع" : "غير مدفوع"}`);
    chip.addEventListener("click", () => toggleJamiyaPaid(j, month));
    chips.appendChild(chip);
  });
  box.appendChild(chips);
  box.appendChild(el("p", "hint start", "اضغط على أي شهر لتسجيل دفع قسطه أو إلغائه."));

  const stats = el("div", "item-stats");
  stats.appendChild(
    el("p", "", `دفعت ${formatMoney(info.paidTotal)} من ${formatMoney(j.amount * j.members)} (${info.paidCount} من ${j.members} أقساط)`)
  );
  if (info.missed) {
    stats.appendChild(iconText("p", "triangle-alert", `عليك ${countWord(info.missed, "قسط متأخر", "قسطان متأخران", "أقساط متأخرة")}`, "bad"));
  }
  box.appendChild(stats);

  // أسمائي: لكل اسم دوره واستلامه
  const turnList = el("ul", "turn-list");
  j.turns.forEach((t, k) => {
    const li = el("li", "turn-row");
    li.appendChild(el("span", "turn-name", j.shares > 1 ? `الاسم ${k + 1}` : "اسمي"));
    const status = el("div", "turn-status");
    if (t.receivedOn) {
      status.appendChild(iconText("span", "check", `استلمت ${formatMoney(info.payout)} في ${ltr(t.receivedOn)}`, "good"));
      const undo = el("button", "link-btn dark", "تراجع");
      undo.type = "button";
      undo.addEventListener("click", () => {
        if (!confirm("إلغاء تسجيل استلام المبلغ؟")) return;
        t.receivedOn = null;
        save();
      });
      status.appendChild(undo);
    } else if (t.turn && info.index >= t.turn) {
      const receive = iconText("button", "banknote", `استلمت ${formatMoney(info.payout)}`, "small-btn");
      receive.type = "button";
      receive.addEventListener("click", () => receiveJamiya(j, t));
      status.append(el("span", "", `الشهر ${t.turn} (${monthLabel(info.months[t.turn - 1])})`), receive);
    } else if (t.turn) {
      status.appendChild(iconText("span", "star", `الشهر ${t.turn} (${monthLabel(info.months[t.turn - 1])}) · ستستلم ${formatMoney(info.payout)}`));
    } else {
      status.appendChild(el("span", "muted", "لم يطلع بالقرعة بعد"));
      const setTurn = el("button", "link-btn", "حدّد الدور");
      setTurn.type = "button";
      setTurn.addEventListener("click", () => openJamiyaForm(j));
      status.appendChild(setTurn);
    }
    li.appendChild(status);
    turnList.appendChild(li);
  });
  box.appendChild(turnList);

  // الرصيد: ما دفعته ناقص ما استلمته
  if (info.receivedTotal > 0) {
    box.appendChild(
      info.balance >= 0
        ? iconText("p", "piggy-bank", `مدّخر لك في هذه السلفة: ${formatMoney(info.balance)}`, "jamiya-balance good")
        : iconText("p", "info", `استلمت أكثر مما دفعت بـ ${formatMoney(-info.balance)}، تسدده من الأقساط القادمة`, "jamiya-balance warn-text")
    );
  }

  if (info.dueNow) {
    const actions = el("div", "item-actions");
    const payBtn = iconText("button", "check", `دفعت قسط ${monthLabel(now)}`, "primary-btn");
    payBtn.type = "button";
    payBtn.addEventListener("click", () => toggleJamiyaPaid(j, now));
    actions.appendChild(payBtn);
    box.appendChild(actions);
  }
  return box;
}

// تسجيل استلام مبلغ أحد أسمائي
function receiveJamiya(j, turn) {
  turn.receivedOn = todayString();
  save();
  const payout = jamiyaInfo(j).payout;
  showToast(`استلمت ${formatMoney(payout)} من ${j.name}`);
  // إذا كانت عندك أهداف: هل تضيف المبلغ لأحدها؟
  if (typeof offerGoalAllocation === "function") offerGoalAllocation(payout, `سلفة ${j.name}`);
}

// القسط الذي سُجّل للتو في الشهر الحالي يأخذ تاريخ اليوم، وغيره يأخذ أول يوم في شهره
let justPaidKey = null;

function toggleJamiyaPaid(j, month) {
  const paying = !j.paid.includes(month);
  j.paid = paying ? [...j.paid, month] : j.paid.filter((m) => m !== month);
  justPaidKey = paying ? `${j.id}|${month}` : null;
  save();
  justPaidKey = null;
  render();
  if (paying) {
    showToast(`سُجّل قسط ${monthLabel(month)}: ${formatMoney(j.amount)} من مصروف الشهر إلى الادخار`);
    const exp = expenses.find((e) => e.jamiyaId === j.id && e.date.startsWith(month));
    if (exp) notifyBudget(exp);
  }
}

// ===== أقساط السلفة كمصاريف =====

// كل شهر مدفوع في سلفة = مصروف بتصنيف "قسط سلفة" في ذلك الشهر، يُخصم من مصروف الشهر ويُحسب ادخاراً.
// تُستدعى من save() في app.js، فتبقى المصاريف مطابقة للأشهر المدفوعة بعد أي تعديل أو حذف أو استرجاع
function syncJamiyaExpenses() {
  const today = todayString();
  const wanted = new Map();
  for (const j of jamiyas) {
    for (const month of jamiyaInfo(j).months) {
      if (j.paid.includes(month)) wanted.set(`${j.id}|${month}`, j);
    }
  }

  // نحذف ما لم يعد مدفوعاً، ونحدّث مبلغ واسم الموجود
  const kept = new Set();
  expenses = expenses.filter((e) => {
    if (!e.jamiyaId) return true;
    const key = `${e.jamiyaId}|${e.date.slice(0, 7)}`;
    const j = wanted.get(key);
    if (!j || kept.has(key)) return false;
    kept.add(key);
    e.amount = j.amount;
    e.categoryId = JAMIYA_CATEGORY_ID;
    e.note = `قسط ${j.name}`;
    return true;
  });

  // ونضيف الناقص: ما سُجّل للتو في هذا الشهر بتاريخ اليوم، والباقي بأول يوم في شهره
  for (const [key, j] of wanted) {
    if (kept.has(key)) continue;
    const month = key.split("|")[1];
    expenses.push({
      id: nextExpenseId(),
      amount: j.amount,
      categoryId: JAMIYA_CATEGORY_ID,
      date: key === justPaidKey && month === today.slice(0, 7) ? today : `${month}-01`,
      note: `قسط ${j.name}`,
      jamiyaId: j.id,
    });
  }
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
    list.appendChild(el("p", "empty", loans.length ? "لا توجد ديون مفتوحة" : "لا توجد ديون. اضغط \"+ دين\" لإضافة واحد."));
  }
  for (const loan of open) list.appendChild(renderLoan(loan));

  const details = $("settled-loans");
  details.hidden = settled.length === 0;
  $("settled-title").textContent = `الديون المسددة (${settled.length})`;
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
  const title = el("strong", "loan-title");
  title.append(el("span", "loan-dir"), loanTitle(loan));
  title.firstChild.appendChild(icon(loan.direction === "lent" ? "arrow-up-right" : "arrow-down-left", "sm"));
  head.append(title, el("strong", "loan-remaining", remaining ? formatMoney(remaining) : "تمت التسوية"));
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
    if (days < 0) text = `فات موعد الإرجاع (${ltr(loan.dueDate)}) منذ ${countWord(-days, "يوم", "يومين", "أيام")}`;
    else if (days === 0) text = "موعد الإرجاع اليوم";
    else text = `موعد الإرجاع: ${ltr(loan.dueDate)} (بعد ${countWord(days, "يوم", "يومين", "أيام")})`;
    box.appendChild(iconText("p", days < 0 ? "triangle-alert" : "clock", text, days < 0 ? "bad due" : "item-sub due"));
  }

  if (loan.payments.length) {
    const payments = el("ul", "payments");
    for (const p of [...loan.payments].sort((a, b) => a.date.localeCompare(b.date))) {
      const li = el("li");
      li.appendChild(el("span", "", `دفعة ${formatMoney(p.amount)} · ${ltr(p.date)}`));
      const del = el("button", "icon-btn");
      del.appendChild(icon("x", "sm"));
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
    const remindBtn = iconText("button", "share-2", "تذكير لطيف", "small-btn");
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
let editingJamiya = null;

const jamiyaShares = $("jamiya-shares");

// قائمة لكل اسم من أسمائي لاختيار دوره (رقم الشهر)، مع الإبقاء على ما اختير سابقاً
function renderTurnSelects(turns) {
  const box = $("jamiya-turns");
  const members = Math.round(Number(jamiyaMembers.value));
  const shares = Math.round(Number(jamiyaShares.value));
  const start = MONTH_RE.test(jamiyaStart.value) ? jamiyaStart.value : null;
  const current = turns || [...box.querySelectorAll("select")].map((sel) => Number(sel.value) || null);
  box.innerHTML = "";
  if (!(members >= 2 && members <= 60) || !(shares >= 1 && shares <= members)) return;
  for (let k = 0; k < shares; k++) {
    const label = el("label", "", shares > 1 ? `دور الاسم ${k + 1}` : "دوري في الاستلام");
    const select = el("select");
    const unknown = el("option", "", "لم يطلع بعد (قرعة)");
    unknown.value = "";
    select.appendChild(unknown);
    for (let i = 1; i <= members; i++) {
      const option = el("option", "", start ? `الشهر ${i} · ${monthLabel(shiftMonth(start, i - 1))}` : `الشهر ${i}`);
      option.value = i;
      select.appendChild(option);
    }
    const value = current[k];
    select.value = value && value <= members ? value : "";
    label.appendChild(select);
    box.appendChild(label);
  }
}

function updateJamiyaPreview() {
  const share = Number(toDigits(jamiyaAmount.value));
  const members = Math.round(Number(jamiyaMembers.value));
  const shares = Math.round(Number(jamiyaShares.value));
  const valid = share > 0 && members >= 2 && members <= 60 && shares >= 1 && shares <= members && MONTH_RE.test(jamiyaStart.value);
  $("jamiya-preview").textContent = valid
    ? `قسطك الشهري ${formatMoney(share * shares)} · كل اسم يستلم ${formatMoney(share * members)}` +
      (shares > 1 ? ` · المجموع ${formatMoney(share * members * shares)}` : "") +
      ` · تنتهي في ${monthLabel(shiftMonth(jamiyaStart.value, members - 1))}`
    : "";
}

function openJamiyaForm(j) {
  editingJamiya = j;
  $("jamiya-form-title").textContent = j ? "تعديل سلفة" : "سلفة جديدة";
  $("jamiya-delete").hidden = !j;
  jamiyaName.value = j ? j.name : "";
  jamiyaAmount.value = j ? j.shareAmount.toLocaleString("en-US") : "";
  jamiyaShares.value = j ? j.shares : 1;
  jamiyaMembers.value = j ? j.members : 10;
  jamiyaStart.value = j ? j.startMonth : thisMonth();
  renderTurnSelects(j ? j.turns.map((t) => t.turn) : []);
  updateJamiyaPreview();
  jamiyaDialog.showModal();
  if (!j) jamiyaName.focus();
}

jamiyaAmount.addEventListener("input", () => {
  formatMoneyInput(jamiyaAmount);
  updateJamiyaPreview();
});
for (const input of [jamiyaMembers, jamiyaStart, jamiyaShares]) {
  input.addEventListener("input", () => {
    renderTurnSelects();
    updateJamiyaPreview();
  });
}

jamiyaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const shareAmount = Number(toDigits(jamiyaAmount.value));
  const shares = Math.round(Number(jamiyaShares.value));
  const data = {
    name: jamiyaName.value.trim(),
    shareAmount,
    shares,
    amount: shareAmount * shares,
    members: Math.round(Number(jamiyaMembers.value)),
    startMonth: jamiyaStart.value,
  };
  if (!data.name || !(shareAmount > 0) || !(data.members >= 2 && data.members <= 60) || !MONTH_RE.test(data.startMonth)) {
    alert("الرجاء إكمال بيانات السلفة بشكل صحيح.");
    return;
  }
  if (!(shares >= 1 && shares <= data.members)) {
    alert("عدد أسمائك يجب أن يكون بين 1 وعدد كل الأسماء في السلفة.");
    return;
  }
  const chosen = [...$("jamiya-turns").querySelectorAll("select")].map((sel) => Number(sel.value) || null);
  const taken = chosen.filter(Boolean);
  if (new Set(taken).size !== taken.length) {
    alert("كل شهر يستلم فيه اسم واحد فقط: اختر شهراً مختلفاً لكل اسم.");
    return;
  }

  // نحتفظ بتاريخ الاستلام لكل اسم بقي دوره كما هو
  const oldTurns = editingJamiya ? editingJamiya.turns : [];
  data.turns = chosen.map((turn, k) => ({
    turn,
    receivedOn: turn && oldTurns[k] && oldTurns[k].turn === turn ? oldTurns[k].receivedOn : null,
  }));

  if (editingJamiya) {
    Object.assign(editingJamiya, data);
    // الأشهر المدفوعة التي صارت خارج مدة السلفة بعد التعديل تُحذف
    const months = new Set(jamiyaInfo(editingJamiya).months);
    editingJamiya.paid = editingJamiya.paid.filter((m) => months.has(m));
  } else {
    jamiyas.push({ id: newId(), ...data, paid: [] });
  }
  save();
  render();
  jamiyaDialog.close();
});

$("jamiya-delete").addEventListener("click", () => {
  if (!confirm(`حذف سلفة "${editingJamiya.name}" وكل أقساطها المسجلة؟`)) return;
  jamiyas = jamiyas.filter((j) => j !== editingJamiya);
  save();
  render();
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
  showToast(amount === remaining ? `تمت تسوية الدين مع ${payingLoan.person} بالكامل` : `سُجّلت دفعة ${formatMoney(amount)}`);
});

// ===== التشغيل =====

[jamiyaDialog, loanDialog, paymentDialog].forEach(setupDialog);

// عند فتح التطبيق: ترقية السلف القديمة (اسم واحد)، والأقساط المدفوعة سابقاً تُسجَّل مصاريف في أشهرها
{
  const upgraded = jamiyas.some((j) => !Array.isArray(j.turns));
  jamiyas.forEach(upgradeJamiya);
  if (upgraded) save();
  const before = JSON.stringify(expenses.filter((e) => e.jamiyaId));
  syncJamiyaExpenses();
  if (JSON.stringify(expenses.filter((e) => e.jamiyaId)) !== before) save();
}
document.addEventListener("data-changed", renderSocial);
renderSocial();
