// الميزانية الشهرية، والمصاريف الثابتة، وأزرار الإضافة السريعة
// يعتمد على الأدوات الموجودة في app.js و seasons.js: $ و el و save و render و formatMoney و parseDate و addDays ...

/*
  الميزانية (budgets): { total: ميزانية الشهر كله أو null, byCategory: { رقم التصنيف: مبلغ } }

  المصروف الثابت (recurring):
  { id, amount, categoryId, note, day: يوم الشهر (1-31), lastMonth: "YYYY-MM" آخر شهر أُضيف فيه }
  المصاريف التي يضيفها تحمل recurringId حتى نعرف أنها ثابتة
*/

// نسبة التحذير: عند 80% من الميزانية يظهر تنبيه، وعند تجاوز 100% يظهر تنبيه أقوى
const BUDGET_WARN_PERCENT = 80;
const QUICK_DAYS = 90; // نبحث عن المصاريف المتكررة في آخر 90 يوماً
const QUICK_MIN_COUNT = 3; // يظهر الزر إذا تكرر المصروف 3 مرات على الأقل
const QUICK_MAX_BUTTONS = 4;
const RECURRING_MAX_CATCH_UP = 24; // لا نضيف أكثر من سنتين من الأشهر الفائتة دفعة واحدة

// ===== أدوات الميزانية =====

function budgetLevel(spent, limit) {
  const percent = Math.round((spent / limit) * 100);
  if (spent > limit) return { percent, level: "over", icon: "⛔" };
  if (percent >= BUDGET_WARN_PERCENT) return { percent, level: "warn", icon: "⚠️" };
  return { percent, level: "ok", icon: "" };
}

function meter(percent, level) {
  const bar = el("div", "meter");
  const fill = el("div", `meter-fill ${level}`);
  fill.style.width = `${Math.min(100, percent)}%`;
  bar.appendChild(fill);
  return bar;
}

function monthSpent(month, categoryId) {
  return expenses
    .filter((e) => e.date.startsWith(month) && (!categoryId || getCategory(e.categoryId).id === categoryId))
    .reduce((s, e) => s + e.amount, 0);
}

// ===== العرض (تستدعيها render في app.js) =====

function renderBudgetSummary(monthExpenses) {
  const box = $("budget-summary");
  box.innerHTML = "";
  box.hidden = !budgets.total;

  if (budgets.total) {
    const spent = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const { percent, level } = budgetLevel(spent, budgets.total);

    const head = el("div", "card-head");
    const title = el("h2", "card-title");
    title.append(icon("target"), "الميزانية");
    // النسبة مع أيقونة وكلمة، حتى لا يعتمد المعنى على اللون وحده
    const chip = el("span", `level-chip ${level}`);
    if (level !== "ok") chip.appendChild(icon(level === "over" ? "octagon-alert" : "triangle-alert", "sm"));
    chip.append(level === "over" ? `تجاوزت · ${percent}%` : `${percent}%`);
    head.append(title, chip);
    box.appendChild(head);

    const line = el("p", "budget-line");
    line.append(el("b", "", fmtNum(spent)), ` من ${formatMoney(budgets.total)}`);
    box.appendChild(line);
    box.appendChild(meter(percent, level));

    const detail = level === "over"
      ? `تجاوزت الميزانية بـ ${formatMoney(spent - budgets.total)}`
      : `بقي ${formatMoney(budgets.total - spent)}`;
    box.appendChild(el("p", "budget-detail", detail));
  }

  renderSafeToSpend(monthExpenses);
  renderBudgetAlerts(monthExpenses);
}

// "تقدر تصرف اليوم": ما بقي من الميزانية (قبل اليوم) مقسوماً على الأيام الباقية، ناقص ما صرفته اليوم
function renderSafeToSpend(monthExpenses) {
  const box = $("safe-spend");
  box.innerHTML = "";
  const today = todayString();
  box.hidden = viewMonth !== today.slice(0, 7);
  if (box.hidden) return;

  if (!budgets.total) {
    // بدون ميزانية لا يمكن الحساب: ندعو المستخدم لوضعها
    const btn = el("button", "safe-setup");
    btn.type = "button";
    btn.append(icon("target"), el("span", "", "حدّد ميزانيتك الشهرية لتعرف كم تقدر تصرف كل يوم"), icon("chevron-left", "sm"));
    btn.addEventListener("click", () => $("open-budget").click());
    box.appendChild(btn);
    box.classList.add("setup");
    return;
  }
  box.classList.remove("setup");

  const now = parseDate(today);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const spentToday = monthExpenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0);
  const spentBefore = monthExpenses.reduce((s, e) => s + e.amount, 0) - spentToday;
  const leftForMonth = budgets.total - spentBefore;
  // حصة اليوم مقرّبة لأقل 250 دينار
  const allowance = Math.max(0, Math.floor(leftForMonth / daysLeft / 250) * 250);
  const left = allowance - spentToday;

  box.appendChild(el("p", "safe-label", "تقدر تصرف اليوم"));
  const value = el("p", left > 0 ? "safe-value" : "safe-value bad");
  setMoney(value, Math.max(0, left));
  box.appendChild(value);

  let note;
  if (leftForMonth <= 0) note = "انتهت ميزانية هذا الشهر";
  else if (left < 0) note = `تجاوزت حصة اليوم بـ ${formatMoney(-left)}`;
  else if (spentToday > 0) note = `حصة اليوم ${formatMoney(allowance)} · صرفت منها ${formatMoney(spentToday)}`;
  else note = `حصتك اليومية حتى نهاية الشهر (${countWord(daysLeft, "يوم", "يومين", "أيام")})`;
  box.appendChild(el("p", left < 0 || leftForMonth <= 0 ? "safe-note bad" : "safe-note", note));
}

// تنبيه بالتصنيفات القريبة من ميزانيتها أو المتجاوزة لها (للشهر الحالي فقط)
function renderBudgetAlerts(monthExpenses) {
  const box = $("budget-alerts");
  box.innerHTML = "";
  const lines = [];
  let anyOver = false;
  if (viewMonth === todayString().slice(0, 7)) {
    for (const [id, limit] of Object.entries(budgets.byCategory)) {
      if (!categories.some((c) => c.id === id)) continue;
      const spent = monthExpenses.filter((e) => getCategory(e.categoryId).id === id).reduce((s, e) => s + e.amount, 0);
      const { percent, level } = budgetLevel(spent, limit);
      const cat = getCategory(id);
      if (level === "over") anyOver = true;
      if (level === "over") lines.push({ level, text: `${cat.name}: تجاوز ميزانيته بـ ${formatMoney(spent - limit)}` });
      else if (level === "warn") lines.push({ level, text: `${cat.name}: وصل ${percent}% من ميزانيته` });
    }
  }
  box.hidden = lines.length === 0;
  box.classList.toggle("over", anyOver);
  for (const line of lines) {
    const row = el("div", "notice-line");
    row.append(icon(line.level === "over" ? "octagon-alert" : "triangle-alert", "sm"), line.text);
    box.appendChild(row);
  }
}

// سطر الميزانية تحت التصنيف في قائمة "حسب التصنيف"
function categoryBudgetRow(id, spent) {
  const limit = budgets.byCategory[id];
  if (!limit) return null;
  const { percent, level } = budgetLevel(spent, limit);
  const row = el("div", "budget-row");
  row.appendChild(meter(percent, level));
  const text = el("span", `budget-row-text ${level}`);
  if (level !== "ok") text.appendChild(icon(level === "over" ? "octagon-alert" : "triangle-alert", "sm"));
  text.append(`${percent}% من ${formatMoney(limit)}`);
  row.appendChild(text);
  return row;
}

// رسالة فورية عندما يوصلك مصروف جديد إلى 80% أو يتجاوز الميزانية
function notifyBudget(exp) {
  const month = exp.date.slice(0, 7);
  const messages = [];
  const check = (limit, spentAfter, label) => {
    if (!limit) return;
    const before = budgetLevel(spentAfter - exp.amount, limit).level;
    const after = budgetLevel(spentAfter, limit);
    if (after.level === before || after.level === "ok") return;
    messages.push(
      after.level === "over"
        ? `⛔ تجاوزت ${label} بـ ${formatMoney(spentAfter - limit)}`
        : `⚠️ وصلت ${after.percent}% من ${label}`
    );
  };
  check(budgets.total, monthSpent(month), "ميزانية الشهر");
  const cat = getCategory(exp.categoryId);
  check(budgets.byCategory[cat.id], monthSpent(month, cat.id), `ميزانية ${cat.name}`);
  if (messages.length) showToast(messages.join(" · "), null, true);
}

// ===== نافذة الميزانية =====

const budgetDialog = $("budget-dialog");
const budgetTotalInput = $("budget-total");

function updateBudgetSum() {
  const sum = [...budgetDialog.querySelectorAll(".budget-category-input")].reduce(
    (s, input) => s + Number(toDigits(input.value)),
    0
  );
  const total = Number(toDigits(budgetTotalInput.value));
  let text = sum ? `مجموع ميزانيات التصنيفات: ${formatMoney(sum)}` : "";
  if (sum && total && sum > total) text += " · ⚠️ أكبر من ميزانية الشهر كله";
  $("budget-sum").textContent = text;
}

$("open-budget").addEventListener("click", () => {
  budgetTotalInput.value = budgets.total ? budgets.total.toLocaleString("en-US") : "";
  const list = $("budget-categories");
  list.innerHTML = "";
  let lastGroup = null;
  for (const cat of sortCategories(categories)) {
    if (cat.group !== lastGroup) {
      list.appendChild(el("p", "category-group-title", getGroup(cat.group).name));
      lastGroup = cat.group;
    }
    const label = el("label", "budget-category");
    const name = el("span", "category-name");
    name.append(catBadge(cat, "sm"), cat.name);
    label.appendChild(name);
    const input = el("input", "budget-category-input money-input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.placeholder = "—";
    input.dataset.category = cat.id;
    input.value = budgets.byCategory[cat.id] ? budgets.byCategory[cat.id].toLocaleString("en-US") : "";
    label.appendChild(input);
    list.appendChild(label);
  }
  updateBudgetSum();
  budgetDialog.showModal();
});

// تنسيق كل خانات المبالغ في النافذة أثناء الكتابة
budgetDialog.addEventListener("input", (event) => {
  if (event.target.classList.contains("money-input")) {
    formatMoneyInput(event.target);
    updateBudgetSum();
  }
});

$("budget-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const byCategory = {};
  for (const input of budgetDialog.querySelectorAll(".budget-category-input")) {
    const amount = Number(toDigits(input.value));
    if (amount > 0) byCategory[input.dataset.category] = amount;
  }
  budgets = { total: Number(toDigits(budgetTotalInput.value)) || null, byCategory };
  save();
  render();
  budgetDialog.close();
});

// ===== المصاريف الثابتة =====

// يستدعيها app.js عند إضافة مصروف مع اختيار "يتكرر كل شهر"
function createRecurring(exp) {
  const id = newId();
  recurring.push({
    id,
    amount: exp.amount,
    categoryId: exp.categoryId,
    note: exp.note,
    day: Number(exp.date.slice(8, 10)),
    lastMonth: exp.date.slice(0, 7),
  });
  return id;
}

// إضافة المصاريف الثابتة التي حلّ موعدها (عند فتح التطبيق أو الرجوع إليه)
function addDueRecurring() {
  const today = todayString();
  const currentMonth = today.slice(0, 7);
  let added = 0;
  for (const r of recurring) {
    let month = shiftMonth(r.lastMonth, 1);
    for (let i = 0; i < RECURRING_MAX_CATCH_UP && month <= currentMonth; i++) {
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate(); // يوم 31 يصبح 30 أو 28 في الأشهر الأقصر
      const date = `${month}-${String(Math.min(r.day, lastDay)).padStart(2, "0")}`;
      if (date > today) break;
      expenses.push({ id: nextExpenseId(), amount: r.amount, categoryId: r.categoryId, date, note: r.note, recurringId: r.id });
      r.lastMonth = month;
      added++;
      month = shiftMonth(month, 1);
    }
  }
  if (added) save();
  return added;
}

function renderRecurringList() {
  const list = $("recurring-list");
  list.innerHTML = "";
  if (recurring.length === 0) {
    list.appendChild(el("li", "muted", "لا توجد مصاريف ثابتة بعد."));
    return;
  }
  for (const r of recurring) {
    const cat = getCategory(r.categoryId);
    const li = el("li", "category-row");
    li.appendChild(catBadge(cat, "sm"));
    const info = el("div", "season-info");
    info.append(
      el("strong", "", r.note || cat.name),
      el("span", "muted", `${formatMoney(r.amount)} · يوم ${r.day} من كل شهر`)
    );

    const editBtn = el("button", "small-btn", "تعديل المبلغ");
    editBtn.type = "button";
    editBtn.addEventListener("click", () => {
      const answer = prompt("المبلغ الجديد (يُطبّق على الأشهر القادمة):", r.amount.toLocaleString("en-US"));
      if (answer === null) return;
      const amount = Number(toDigits(answer));
      if (!(amount > 0)) {
        alert("الرجاء إدخال مبلغ صحيح.");
        return;
      }
      r.amount = amount;
      save();
      renderRecurringList();
    });

    const stopBtn = el("button", "small-btn danger", "إيقاف");
    stopBtn.type = "button";
    stopBtn.addEventListener("click", () => {
      if (!confirm(`إيقاف "${r.note || cat.name}"؟ المصاريف المسجلة سابقاً تبقى كما هي.`)) return;
      recurring = recurring.filter((x) => x !== r);
      save();
      renderRecurringList();
    });

    li.append(info, editBtn, stopBtn);
    list.appendChild(li);
  }
}

$("open-recurring").addEventListener("click", () => {
  renderRecurringList();
  $("recurring-dialog").showModal();
});

// ===== الإضافة السريعة =====

// أكثر المصاريف تكراراً (نفس التصنيف والمبلغ والملاحظة) في آخر 90 يوماً
function quickSuggestions() {
  const since = isoDate(addDays(parseDate(todayString()), -QUICK_DAYS));
  const groups = new Map();
  for (const e of expenses) {
    if (e.recurringId || e.date < since) continue;
    const key = `${e.categoryId}|${e.amount}|${e.note || ""}`;
    const g = groups.get(key) || { categoryId: e.categoryId, amount: e.amount, note: e.note || "", count: 0, last: "" };
    g.count++;
    if (e.date > g.last) g.last = e.date;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= QUICK_MIN_COUNT)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, QUICK_MAX_BUTTONS);
}

function renderQuickAdd() {
  const suggestions = quickSuggestions();
  $("quick-add").hidden = suggestions.length === 0;
  const box = $("quick-buttons");
  box.innerHTML = "";
  for (const s of suggestions) {
    const cat = getCategory(s.categoryId);
    const btn = el("button", "quick-btn");
    btn.type = "button";
    const text = el("span", "quick-text");
    text.append(el("span", "", s.note || cat.name), el("strong", "money", fmtNum(s.amount)));
    btn.append(catBadge(cat, "sm"), text);
    btn.addEventListener("click", () => quickAdd(s));
    box.appendChild(btn);
  }
}

function quickAdd(s) {
  const exp = { id: nextExpenseId(), amount: s.amount, categoryId: s.categoryId, date: todayString(), note: s.note };
  expenses.push(exp);
  viewMonth = exp.date.slice(0, 7);
  save();
  render();
  const cat = getCategory(s.categoryId);
  showToast(`أُضيف ${s.note || cat.name} ${formatMoney(s.amount)}`, () => {
    expenses = expenses.filter((e) => e.id !== exp.id);
    save();
    render();
  });
  notifyBudget(exp);
}

// ===== الرسالة القصيرة أسفل الشاشة =====

let toastTimer = null;
let toastUndo = null;

// append: تُضاف الرسالة تحت الرسالة الظاهرة بدل أن تحل محلها (مثل تنبيه الميزانية بعد "أُضيف")
function showToast(text, undo, append = false) {
  const toast = $("toast");
  const keep = append && !toast.hidden;
  $("toast-text").textContent = keep ? `${$("toast-text").textContent}\n${text}` : text;
  if (!keep) toastUndo = null;
  if (undo) toastUndo = undo;
  $("toast-undo").hidden = !toastUndo;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
  $("toast").hidden = true;
  toastUndo = null;
  toastTimer = null;
}

$("toast-undo").addEventListener("click", () => {
  if (toastUndo) toastUndo();
  hideToast();
});

// ===== التحقق من بيانات النسخة الاحتياطية (يستخدمها app.js عند الاسترجاع) =====

function sanitizeBudgets(b) {
  if (!b || typeof b !== "object") return null;
  const byCategory = {};
  if (b.byCategory && typeof b.byCategory === "object") {
    for (const [id, amount] of Object.entries(b.byCategory)) {
      if (amount > 0) byCategory[id] = Math.round(amount);
    }
  }
  return { total: b.total > 0 ? Math.round(b.total) : null, byCategory };
}

function sanitizeRecurring(r) {
  if (!r || typeof r.id !== "string" || !(r.amount > 0) || typeof r.categoryId !== "string") return null;
  const day = Math.round(r.day);
  if (!(day >= 1 && day <= 31) || !/^\d{4}-\d{2}$/.test(r.lastMonth)) return null;
  return {
    id: r.id,
    amount: Math.round(r.amount),
    categoryId: r.categoryId,
    note: typeof r.note === "string" ? r.note.slice(0, 200) : "",
    day,
    lastMonth: r.lastMonth,
  };
}

// ===== التشغيل =====

[budgetDialog, $("recurring-dialog")].forEach(setupDialog);

// المصاريف الثابتة المستحقة تُضاف قبل أول عرض للصفحة
const addedOnOpen = addDueRecurring();
if (addedOnOpen) {
  document.addEventListener("DOMContentLoaded", () =>
    showToast(`🔁 أُضيف ${countWord(addedOnOpen, "مصروف ثابت", "مصروفان ثابتان", "مصاريف ثابتة")}`)
  );
}

// عند الرجوع إلى التطبيق بعد أن كان في الخلفية (قد يكون يوم جديد بدأ)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const added = addDueRecurring();
  render();
  if (added) showToast(`🔁 أُضيف ${countWord(added, "مصروف ثابت", "مصروفان ثابتان", "مصاريف ثابتة")}`);
});
