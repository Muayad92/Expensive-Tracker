// ملخص الشهر: بطاقة في الرئيسية أول أسبوع من كل شهر عن الشهر الماضي، ونافذة "ملخص الأشهر" في المزيد
// يعتمد على app.js: expenses و incomes و getCategory و formatMoney و el و icon ...

// الأشهر التي أخفى المستخدم بطاقة ملخصها (إعداد خاص بهذا الجوال)
const DISMISSED_REPORTS_KEY = "dismissedReports";
// تظهر البطاقة في أول 7 أيام من الشهر
const REPORT_CARD_DAYS = 7;

function loadDismissedReports() {
  try {
    const list = JSON.parse(localStorage.getItem(DISMISSED_REPORTS_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// مجموع كل تصنيف في شهر
function totalsByCategory(list) {
  const totals = {};
  for (const e of list) totals[e.categoryId] = (totals[e.categoryId] || 0) + e.amount;
  return totals;
}

function monthReport(month) {
  const prevMonth = shiftMonth(month, -1);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  // الشهر الحالي لم ينتهِ: نقارنه بنفس الأيام من الشهر الماضي
  const today = todayString();
  const partial = month === today.slice(0, 7);
  const prevExpenses = expenses.filter((e) => e.date.startsWith(prevMonth) && (!partial || e.date.slice(8) <= today.slice(8)));
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const income = incomes.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);

  // التصنيفات التي زاد صرفها عن الشهر الماضي (بدون الادخار، فزيادته شيء جيد)
  const now = totalsByCategory(monthExpenses);
  const before = totalsByCategory(prevExpenses);
  const increases = prevTotal === 0 ? [] : Object.keys(now)
    .filter((id) => getCategory(id).group !== "savings")
    .map((id) => ({ category: getCategory(id), amount: now[id], change: now[id] - (before[id] || 0) }))
    .filter((x) => x.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 3);

  const savings = monthExpenses.filter((e) => getCategory(e.categoryId).group === "savings").reduce((s, e) => s + e.amount, 0);
  const left = income - total;
  return {
    month,
    prevMonth,
    partial,
    total,
    prevTotal,
    change: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    income,
    left,
    saved: savings + Math.max(0, left),
    increases,
    regret: monthExpenses.filter((e) => e.worth === "no").reduce((s, e) => s + e.amount, 0),
    empty: monthExpenses.length === 0 && income === 0,
  };
}

// محتوى الملخص (نفسه في البطاقة وفي النافذة)
function renderMonthReport(box, month) {
  const r = monthReport(month);
  box.innerHTML = "";
  if (r.empty) {
    box.appendChild(el("p", "empty", "لا توجد مصاريف أو دخل مسجّل في هذا الشهر."));
    return;
  }

  const head = el("div", "report-total");
  head.append(el("span", "stat-label", r.partial ? "صرفت حتى الآن" : "صرفت"), el("strong", "money", formatMoney(r.total)));
  const than = r.partial ? `نفس الأيام من ${monthLabel(r.prevMonth)}` : monthLabel(r.prevMonth);
  if (r.change !== null && r.change !== 0) {
    const up = r.change > 0;
    head.appendChild(iconText("span", up ? "trending-up" : "trending-down",
      `${up ? "أكثر" : "أقل"} بـ ${Math.abs(r.change)}% من ${than}`, up ? "report-change bad" : "report-change good"));
  } else if (r.change === 0) {
    head.appendChild(el("span", "report-change", `مثل ${than}`));
  }
  box.appendChild(head);

  if (r.income > 0) {
    const grid = el("div", "net-grid report-grid");
    const cell = (label, value, cls) => {
      const c = el("div", "net-cell");
      c.append(el("span", "stat-label", label), el("strong", `money ${cls || ""}`, formatMoney(value)));
      return c;
    };
    grid.append(
      cell("الدخل", r.income, "good"),
      cell(r.left >= 0 ? "بقي لك" : "صرفت أكثر من دخلك", Math.abs(r.left), r.left >= 0 ? "" : "bad"),
      cell("ادّخرت", r.saved)
    );
    box.appendChild(grid);
  } else if (r.saved > 0) {
    box.appendChild(iconText("p", "piggy-bank", `ادّخرت ${formatMoney(r.saved)}`, "report-line"));
  }

  if (r.increases.length) {
    box.appendChild(el("p", "report-sub", `أكثر ما زاد عن ${than}`));
    const ul = el("ul", "report-increases");
    for (const x of r.increases) {
      const li = el("li");
      const badge = el("span", "cat-icon sm");
      badge.style.setProperty("--c", groupColor(x.category.group));
      badge.appendChild(icon(x.category.icon, "sm"));
      li.append(badge, el("span", "report-cat", x.category.name), el("span", "money bad", `+${formatMoney(x.change)}`));
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }

  if (r.regret > 0) box.appendChild(iconText("p", "thumbs-down", `ندمت على ${formatMoney(r.regret)}`, "report-line warn-text"));
}

// ===== بطاقة الرئيسية =====

function renderReportCard() {
  const card = $("month-report");
  const today = todayString();
  const month = shiftMonth(today.slice(0, 7), -1);
  const show =
    Number(today.slice(8, 10)) <= REPORT_CARD_DAYS &&
    expenses.some((e) => e.date.startsWith(month)) &&
    !loadDismissedReports().includes(month);
  card.hidden = !show;
  if (!show) return;
  $("month-report-title").textContent = `ملخص ${monthLabel(month)}`;
  renderMonthReport($("month-report-body"), month);
}

$("month-report-close").addEventListener("click", () => {
  const month = shiftMonth(todayString().slice(0, 7), -1);
  try {
    // نحتفظ بآخر 12 شهراً فقط
    localStorage.setItem(DISMISSED_REPORTS_KEY, JSON.stringify([...loadDismissedReports(), month].slice(-12)));
  } catch {
    // تبقى البطاقة ظاهرة إذا تعذّر الحفظ
  }
  $("month-report").hidden = true;
});

$("month-report-more").addEventListener("click", () => openReports(shiftMonth(todayString().slice(0, 7), -1)));

// ===== نافذة ملخص الأشهر =====

const reportDialog = $("report-dialog");
let reportMonth = null;

function showReportMonth() {
  $("report-month").textContent = monthLabel(reportMonth);
  $("report-next").disabled = reportMonth >= todayString().slice(0, 7);
  renderMonthReport($("report-body"), reportMonth);
}

function openReports(month) {
  // الشهر الماضي افتراضياً، أو الحالي إذا لم يكن في الماضي شيء
  const last = shiftMonth(todayString().slice(0, 7), -1);
  reportMonth = month || (monthReport(last).empty ? todayString().slice(0, 7) : last);
  showReportMonth();
  reportDialog.showModal();
}

$("report-prev").addEventListener("click", () => {
  reportMonth = shiftMonth(reportMonth, -1);
  showReportMonth();
});
$("report-next").addEventListener("click", () => {
  reportMonth = shiftMonth(reportMonth, 1);
  showReportMonth();
});
$("open-reports").addEventListener("click", () => openReports());

// ===== التشغيل =====

setupDialog(reportDialog);
document.addEventListener("data-changed", renderReportCard);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderReportCard();
});
renderReportCard();
