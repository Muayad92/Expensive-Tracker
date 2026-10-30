// مفاتيح التخزين في المتصفح
const STORAGE_KEY = "expenses";
const CATEGORIES_KEY = "categories";
const JAMIYAS_KEY = "jamiyas";
const LOANS_KEY = "loans";
const SEASONS_KEY = "seasons";
const BUDGETS_KEY = "budgets";
const RECURRING_KEY = "recurring";
const GROUPS_KEY = "groups";
const METHODS_KEY = "methods";
const INCOMES_KEY = "incomes";
const GOALS_KEY = "goals";
const LAST_METHOD_KEY = "lastMethod";
// خيار "+ مجموعة جديدة…" في قوائم المجموعات
const NEW_GROUP_OPTION = "__new";

// المجموعات والتصنيفات الافتراضية في ملف categories.js

const $ = (id) => document.getElementById(id);

// عنصر فيه أيقونة صغيرة ثم نص، مثل: iconText("p", "clock", "موعد الإرجاع اليوم", "muted")
function iconText(tag, name, text, className = "") {
  const node = el(tag, className ? `with-icon ${className}` : "with-icon");
  node.append(icon(name, "sm"), text);
  return node;
}

// أيقونة من icons/sprite.svg، مثلاً icon("trash-2") أو icon("plus", "sm")
function icon(name, size = "") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", size ? `ic ${size}` : "ic");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `icons/sprite.svg#i-${name}`);
  svg.appendChild(use);
  return svg;
}

const expenseDialog = $("expense-dialog");
const form = $("expense-form");
const formTitle = $("form-title");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const noteInput = $("note");
const deleteInFormBtn = $("delete-in-form");
const listEl = $("expense-list");
const listTitleEl = $("list-title");
const emptyEl = $("empty-message");
const editHintEl = $("edit-hint");
const searchInput = $("search");
const searchSummaryEl = $("search-summary");
const monthNameEl = $("month-name");
const monthTotalEl = $("month-total");
const thisMonthBtn = $("this-month");
const categoryTotalsEl = $("category-totals");
const categoriesDialog = $("categories-dialog");
const categoryListEl = $("category-list");
const categoryForm = $("category-form");
const categoryFormTitle = $("category-form-title");
const categoryNameInput = $("category-name");
const categorySaveBtn = $("category-save");
const categoryCancelBtn = $("category-cancel");
const iconPickerEl = $("icon-picker");
const chosenIconEl = $("chosen-icon");
const workSummaryEl = $("work-summary");
const setupWorkBtn = $("setup-work");
const worthField = $("worth-field");
const amountHoursEl = $("amount-hours");

// ===== التخزين =====

function load(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function save() {
  // أقساط السلفة المدفوعة تبقى مسجّلة مصاريف (الدالة في jamiya-loans.js، وقد لا تكون حُمّلت بعد)
  if (typeof syncJamiyaExpenses === "function") syncJamiyaExpenses();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    localStorage.setItem(JAMIYAS_KEY, JSON.stringify(jamiyas));
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    if (seasons) localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    localStorage.setItem(RECURRING_KEY, JSON.stringify(recurring));
    localStorage.setItem(GROUPS_KEY, JSON.stringify(customGroups));
    localStorage.setItem(METHODS_KEY, JSON.stringify(methods));
    localStorage.setItem(INCOMES_KEY, JSON.stringify(incomes));
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch {
    alert("تعذّر حفظ البيانات في المتصفح.");
  }
  // تُحدَّث صفحة السلفة والديون عند أي تغيير في البيانات
  document.dispatchEvent(new Event("data-changed"));
}

// مجموعات أضافها المستخدم (تُدمج مع الأساسية في categories.js)
let customGroups = (load(GROUPS_KEY) || []).map(sanitizeGroup).filter(Boolean);
applyCustomGroups(customGroups);

// طرق الدفع (كاش، كي كارد...). المصروف بلا طريقة يُعتبر كاش
let methods = (load(METHODS_KEY) || DEFAULT_METHODS).map(sanitizeMethod).filter(Boolean);
if (!methods.some((m) => m.id === CASH_ID)) methods.unshift({ ...DEFAULT_METHODS[0] });

let expenses = load(STORAGE_KEY) || [];
// الدخل: { id, amount, type: نوع الدخل, date, note, method, recurringId? } (منفصل عن المصاريف)
let incomes = load(INCOMES_KEY) || [];
// أهداف الادخار (طريقة عرضها في ملف goals.js)
let goals = load(GOALS_KEY) || [];
let categories = load(CATEGORIES_KEY) || DEFAULT_CATEGORIES.map((c) => ({ ...c }));
// السلف (الادخار الجماعي) والديون (طريقة عرضها وتعديلها في ملف jamiya-loans.js)
let jamiyas = load(JAMIYAS_KEY) || [];
let loans = load(LOANS_KEY) || [];
// المواسم (في ملف seasons.js). null = لم تُحفظ بعد، فتُستخدم المواسم الافتراضية
let seasons = load(SEASONS_KEY);
// الميزانية والمصاريف الثابتة (طريقة عرضها وتعديلها في ملف planning.js)
let budgets = loadBudgets();
let recurring = load(RECURRING_KEY) || [];

// الميزانية: { total: مبلغ أو null, byCategory: { رقم التصنيف: مبلغ } }
function loadBudgets() {
  try {
    const b = JSON.parse(localStorage.getItem(BUDGETS_KEY));
    if (b && typeof b === "object") return { total: b.total > 0 ? b.total : null, byCategory: b.byCategory || {} };
  } catch {
    // نعتبرها غير موجودة
  }
  return { total: null, byCategory: {} };
}

function ensureOtherCategory() {
  if (!categories.some((c) => c.id === OTHER_ID)) {
    categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === OTHER_ID) });
  }
}
ensureOtherCategory();

// المصاريف القديمة كانت تحفظ اسم التصنيف، والآن نحفظ رقمه حتى لا تتأثر بتغيير الاسم
let migrated = false;
for (const e of expenses) {
  if (e.categoryId) continue;
  let cat = categories.find((c) => c.name === e.category);
  if (!cat) {
    cat = { id: newId(), name: e.category || "أخرى", icon: "tag" };
    categories.splice(categories.findIndex((c) => c.id === OTHER_ID), 0, cat);
  }
  e.categoryId = cat.id;
  delete e.category;
  migrated = true;
}
if (migrated) save();

// نقل البيانات القديمة إلى التصنيفات العراقية ومجموعاتها (مرة واحدة)
{
  const state = { categories, expenses, recurring, budgets };
  if (migrateToGroups(state)) {
    categories = state.categories;
    budgets = state.budgets;
    save();
  }
}

// التصنيفات الثابتة (مثل "قسط سلفة") تُضاف لمن حدّث التطبيق، وبعد استرجاع نسخة قديمة
function ensureSystemCategories() {
  for (const d of DEFAULT_CATEGORIES.filter((c) => c.system)) {
    if (!categories.some((c) => c.id === d.id)) categories = sortCategories([...categories, { ...d }]);
  }
}
ensureSystemCategories();

// لون التصنيف هو لون مجموعته
function categoryColor(id) {
  return groupColor(getCategory(id).group);
}

// أيقونة التصنيف داخل دائرة بلون مجموعته
function catBadge(cat, size = "") {
  const badge = el("span", size ? `cat-icon ${size}` : "cat-icon");
  badge.style.setProperty("--c", groupColor(cat.group));
  badge.appendChild(icon(cat.icon || "tag", size === "sm" ? "sm" : ""));
  return badge;
}

// الراتب وساعات العمل: { salary, days, hours } أو null إذا لم يُدخلها المستخدم
const WORK_KEY = "work";

function loadWork() {
  try {
    const w = JSON.parse(localStorage.getItem(WORK_KEY));
    if (w && w.salary > 0 && w.days > 0 && w.hours > 0) return w;
  } catch {
    // نعتبرها غير موجودة
  }
  return null;
}

function saveWork() {
  try {
    if (work) localStorage.setItem(WORK_KEY, JSON.stringify(work));
    else localStorage.removeItem(WORK_KEY);
  } catch {
    alert("تعذّر حفظ البيانات في المتصفح.");
  }
}

let work = loadWork();

// ===== أدوات مساعدة =====

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nextExpenseId() {
  return Math.max(Date.now(), ...expenses.map((e) => e.id + 1), ...incomes.map((i) => i.id + 1));
}

function getCategory(id) {
  return categories.find((c) => c.id === id) || categories.find((c) => c.id === OTHER_ID);
}

// تاريخ اليوم بصيغة YYYY-MM-DD حسب التوقيت المحلي
function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// تاريخ اليوم مضافاً إليه (أو مطروحاً منه) عدد من الأيام، بصيغة YYYY-MM-DD
function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// إضافة أشهر إلى شهر بصيغة YYYY-MM
function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  // أسماء الأشهر بالإنجليزية: October 2026
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// إخفاء المبالغ (زر 👁): الأرقام تظهر •••• عند فتح التطبيق أمام الناس. إعداد خاص بهذا الجوال
const PRIVACY_KEY = "privacy";
let privacy = false;
try {
  privacy = localStorage.getItem(PRIVACY_KEY) === "1";
} catch {
  // يبقى الإخفاء متوقفاً
}

// رقم بفواصل الآلاف: 25,000 (أو •••• عند إخفاء المبالغ)
function fmtNum(value) {
  return privacy ? "••••" : Math.round(value).toLocaleString("en-US");
}

// الدينار العراقي بدون كسور وبفواصل الآلاف: 25,000 د.ع
function formatMoney(value) {
  return `${fmtNum(value)} د.ع`;
}

// المبلغ كبيراً و"د.ع" بعده بخط أصغر
function setMoney(element, value) {
  element.replaceChildren(
    document.createTextNode(fmtNum(value)),
    el("small", "money-unit", "د.ع")
  );
}

// تحويل الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى إنجليزية وحذف ما ليس رقماً
function toDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
    .replace(/\D/g, "");
}

// توحيد الحروف المتشابهة حتى يجد البحث "أكل" عند كتابة "اكل"
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ً-ْ]/g, "")
    .trim();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ===== حالة العرض =====

let viewMonth = todayString().slice(0, 7);
let editingId = null;
let editingCategoryId = null;
let chosenIcon = "tag";

// ===== العرض =====

function render() {
  const currentMonth = todayString().slice(0, 7);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(viewMonth));
  const query = normalize(searchInput.value);

  renderBackupStatus();

  // الترويسة
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  monthNameEl.textContent = monthLabel(viewMonth);
  $("list-month-name").textContent = monthLabel(viewMonth);
  setMoney(monthTotalEl, monthTotal);
  thisMonthBtn.hidden = viewMonth === currentMonth;
  workSummaryEl.hidden = !work || monthTotal === 0;
  if (work && monthTotal > 0) {
    const ofSalary = Math.round((monthTotal / work.salary) * 100);
    workSummaryEl.replaceChildren(icon("clock", "sm"), `${workTime(monthTotal)} · ${ofSalary}% من راتبك`);
  }
  setupWorkBtn.hidden = Boolean(work) || expenses.length === 0;

  renderNetCard(monthExpenses);
  renderBudgetSummary(monthExpenses);
  renderQuickAdd();
  renderRegretAsk();
  renderCategoryTotals(monthExpenses);
  renderMethodTotals(monthExpenses);
  renderRegretStats(monthExpenses);
  // رسم آخر 6 أشهر (في summary.js) يميّز الشهر المعروض
  if (typeof renderTrendCard === "function") renderTrendCard();

  // القائمة: نتائج البحث من كل الأشهر، أو مصاريف الشهر المختار (ومعها الدخل)
  let shown;
  let shownIncomes;
  if (query) {
    shown = expenses.filter((e) => {
      const cat = getCategory(e.categoryId);
      return [e.note || "", cat.name, getGroup(cat.group).name].some((t) => normalize(t).includes(query));
    });
    shownIncomes = incomes.filter((i) => [i.note || "", getIncomeType(i.type).name, "دخل"].some((t) => normalize(t).includes(query)));
    listTitleEl.textContent = "نتائج البحث";
    searchSummaryEl.hidden = false;
    searchSummaryEl.textContent = `${shown.length} نتيجة · المجموع ${formatMoney(shown.reduce((s, e) => s + e.amount, 0))}`;
    emptyEl.textContent = "لا توجد نتائج.";
  } else {
    shown = monthExpenses;
    shownIncomes = incomes.filter((i) => i.date.startsWith(viewMonth));
    listTitleEl.textContent = `مصاريف ${monthLabel(viewMonth)}`;
    searchSummaryEl.hidden = true;
    emptyEl.innerHTML = expenses.length
      ? "لا توجد مصاريف في هذا الشهر."
      : "لا توجد مصاريف بعد.<br>اضغط زر <strong>+</strong> لإضافة أول مصروف.";
  }

  // أزرار التصفية: "الكل" والمجموعات الموجودة في القائمة و"الدخل"
  const presentGroups = new Set(shown.map((e) => getCategory(e.categoryId).group));
  if (listGroup === INCOME_FILTER ? shownIncomes.length === 0 : listGroup && !presentGroups.has(listGroup)) listGroup = null;
  renderGroupFilter(presentGroups, shownIncomes.length > 0);
  if (listGroup === INCOME_FILTER) shown = [];
  else if (listGroup) {
    shown = shown.filter((e) => getCategory(e.categoryId).group === listGroup);
    shownIncomes = [];
  }
  const presentMethods = new Set([...shown, ...shownIncomes].map((e) => e.method || CASH_ID));
  if (listMethod && !presentMethods.has(listMethod)) listMethod = null;
  renderMethodFilter(presentMethods);
  if (listMethod) {
    shown = shown.filter((e) => (e.method || CASH_ID) === listMethod);
    shownIncomes = shownIncomes.filter((i) => (i.method || CASH_ID) === listMethod);
  }

  const rows = [...shown.map((e) => ({ income: false, item: e })), ...shownIncomes.map((i) => ({ income: true, item: i }))];
  rows.sort((a, b) => b.item.date.localeCompare(a.item.date) || b.item.id - a.item.id);
  listEl.innerHTML = "";
  // مجمّعة حسب الأيام، ولكل يوم مجموع مصاريفه
  let dayList = null;
  let lastDate = null;
  for (const row of rows) {
    const date = row.item.date;
    if (date !== lastDate) {
      lastDate = date;
      const dayTotal = shown.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0);
      const head = el("div", "day-head");
      head.append(el("span", "", dayLabel(date, Boolean(query))), el("b", "money", dayTotal ? fmtNum(dayTotal) : ""));
      dayList = el("ul", "card expense-day");
      listEl.append(head, dayList);
    }
    dayList.appendChild(row.income ? renderIncome(row.item) : renderExpense(row.item));
  }

  emptyEl.hidden = rows.length > 0;
  editHintEl.hidden = rows.length === 0;
}

const INCOME_FILTER = "__income";

// سطر الدخل: بالأخضر وبإشارة +
function renderIncome(inc) {
  const type = getIncomeType(inc.type);
  const item = el("li", "expense-item income-item");
  const back = el("div", "swipe-back");
  back.append(icon("trash-2"), icon("trash-2"));
  const row = el("div", "expense-row");
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.addEventListener("click", () => {
    if (!item.dataset.swiped) openForm(inc, "income");
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openForm(inc, "income");
    if (event.key === "Delete") deleteIncome(inc.id);
  });
  const badge = el("span", "cat-icon income");
  badge.appendChild(icon(type.icon));
  const info = el("div", "expense-info");
  const title = el("div", "expense-category", type.name);
  title.appendChild(el("span", "tag good", "دخل"));
  if (inc.recurringId) title.appendChild(el("span", "tag", "ثابت"));
  info.appendChild(title);
  if (inc.note) info.appendChild(el("div", "expense-meta", inc.note));
  row.append(badge, info, el("div", "expense-amount income-amount", `+${fmtNum(inc.amount)}`));
  item.append(back, row);
  enableSwipe(item, row, () => deleteIncome(inc.id));
  return item;
}

let listGroup = null;
let listMethod = null;

function renderMethodFilter(presentMethods) {
  const box = $("method-filter");
  box.innerHTML = "";
  box.hidden = presentMethods.size < 2 && !listMethod;
  if (box.hidden) return;
  for (const m of methods.filter((x) => presentMethods.has(x.id))) {
    const btn = iconText("button", m.icon, m.name, listMethod === m.id ? "filter-chip active" : "filter-chip");
    btn.type = "button";
    btn.addEventListener("click", () => {
      listMethod = listMethod === m.id ? null : m.id;
      render();
    });
    box.appendChild(btn);
  }
}

function renderGroupFilter(presentGroups, hasIncome) {
  const box = $("group-filter");
  box.innerHTML = "";
  // لا داعي للتصفية إذا كانت القائمة كلها من نوع واحد
  box.hidden = presentGroups.size + (hasIncome ? 1 : 0) < 2;
  const chip = (id, name) => {
    const btn = el("button", (listGroup || null) === id ? "filter-chip active" : "filter-chip", name);
    btn.type = "button";
    btn.addEventListener("click", () => {
      listGroup = id;
      render();
    });
    return btn;
  };
  box.appendChild(chip(null, "الكل"));
  if (hasIncome) box.appendChild(chip(INCOME_FILTER, "الدخل"));
  for (const group of GROUPS) {
    if (presentGroups.has(group.id)) box.appendChild(chip(group.id, group.name));
  }
}

// "اليوم"، "أمس · الخميس 22"، "الأربعاء 21" (مع الشهر في نتائج البحث)
function dayLabel(date, withMonth) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const weekday = day.toLocaleDateString("ar", { weekday: "long" });
  const month = withMonth ? ` ${day.toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "";
  const ago = daysAgo(date);
  if (ago === 0) return "اليوم";
  if (ago === 1) return `أمس · ${weekday} ${d}${month}`;
  return `${weekday} ${d}${month}`;
}

function renderExpense(exp) {
  const cat = getCategory(exp.categoryId);
  const item = el("li", "expense-item");

  // خلفية حمراء تظهر عند السحب
  const back = el("div", "swipe-back");
  back.append(icon("trash-2"), icon("trash-2"));

  const row = el("div", "expense-row");
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  // قسط السلفة يُعدَّل أو يُلغى من صفحة السلفة والديون، حتى يبقى الاثنان متطابقين
  const linked = exp.jamiyaId || exp.goalId;
  const open = () => {
    if (!linked) return openForm(exp);
    showView("view-social");
    showToast(exp.jamiyaId ? "قسط السلفة يُسجَّل ويُلغى من شبكة أشهر السلفة" : "مبالغ الأهداف تُعدَّل من بطاقة الهدف");
  };
  row.addEventListener("click", () => {
    if (!item.dataset.swiped) open();
  });
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter") open();
    if (event.key === "Delete" && !linked) deleteExpense(exp.id);
  });

  const info = el("div", "expense-info");
  const title = el("div", "expense-category", cat.name);
  if (exp.worth === "no") title.appendChild(el("span", "tag bad", "ندمت"));
  if (exp.worth === "yes") title.appendChild(el("span", "tag good", "يستحق"));
  if (exp.recurringId) title.appendChild(el("span", "tag", "ثابت"));
  if (linked) title.appendChild(el("span", "tag", "ادخار"));
  if (exp.method && exp.method !== CASH_ID) title.appendChild(el("span", "tag", getMethod(exp.method).name));
  info.appendChild(title);
  if (exp.note) info.appendChild(el("div", "expense-meta", exp.note));

  const amount = el("div", "expense-amount", fmtNum(exp.amount));
  if (work) amount.appendChild(el("div", "expense-hours", workTime(exp.amount)));

  row.append(catBadge(cat), info, amount);
  item.append(back, row);
  if (!linked) enableSwipe(item, row, () => deleteExpense(exp.id));
  return item;
}

// السحب أفقياً لأكثر من ثلث العرض يحذف المصروف (والحذف فيه "تراجع")
const SWIPE_DELETE_RATIO = 0.35;

function enableSwipe(item, row, onDelete) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let tracking = false;
  let swiping = false;

  item.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    tracking = true;
    swiping = false;
    dx = 0;
    startX = event.clientX;
    startY = event.clientY;
  });

  item.addEventListener("pointermove", (event) => {
    if (!tracking) return;
    const mx = event.clientX - startX;
    const my = event.clientY - startY;
    if (!swiping) {
      // نبدأ السحب فقط إذا كانت الحركة أفقية بوضوح، حتى لا نعطّل تمرير الصفحة
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) {
        swiping = true;
        item.classList.add("swiping");
        item.setPointerCapture(event.pointerId);
      } else if (Math.abs(my) > 12) {
        tracking = false;
      }
      return;
    }
    dx = mx;
    row.style.transform = `translateX(${dx}px)`;
    item.classList.toggle("armed", Math.abs(dx) > item.offsetWidth * SWIPE_DELETE_RATIO);
  });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!swiping) return;
    item.classList.remove("swiping");
    // نمنع فتح نافذة التعديل بالضغطة التي تأتي بعد السحب
    item.dataset.swiped = "1";
    setTimeout(() => delete item.dataset.swiped, 300);
    if (Math.abs(dx) > item.offsetWidth * SWIPE_DELETE_RATIO) {
      row.style.transform = `translateX(${Math.sign(dx) * item.offsetWidth}px)`;
      setTimeout(onDelete, 180);
    } else {
      row.style.transform = "";
      item.classList.remove("armed");
    }
  };
  item.addEventListener("pointerup", end);
  item.addEventListener("pointercancel", end);
}

function renderCategoryTotals(monthExpenses) {
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const byGroup = {};
  const byCategory = {};
  for (const e of monthExpenses) {
    const cat = getCategory(e.categoryId);
    byCategory[cat.id] = (byCategory[cat.id] || 0) + e.amount;
    byGroup[cat.group] = (byGroup[cat.group] || 0) + e.amount;
  }

  let groups = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);
  // أكثر من 8 مجموعات: الأكبر 7، والباقي جزء رمادي واحد حتى يبقى القرص مقروءاً
  restGroupIds = new Set();
  if (groups.length > PIE_MAX_GROUPS) {
    const rest = groups.slice(PIE_MAX_GROUPS - 1);
    rest.forEach(([id]) => restGroupIds.add(id));
    groups = [...groups.slice(0, PIE_MAX_GROUPS - 1), [REST_GROUP, rest.reduce((s, [, sum]) => s + sum, 0)]];
  }
  const percents = roundedPercents(groups.map(([, sum]) => sum), total);
  const slices = groups.map(([id, sum], i) => ({
    id,
    sum,
    percent: percents[i],
    color: id === REST_GROUP ? "var(--series-rest)" : groupColor(id),
    name: id === REST_GROUP ? "باقي المجموعات" : getGroup(id).name,
  }));
  if (activeGroup && !groups.some(([id]) => id === activeGroup)) activeGroup = null;

  renderPie(slices, total);
  renderGroupLegend(slices);
  renderCategoryBreakdown(byCategory);
}

// ===== القرص الدائري: توزيع المصاريف على المجموعات =====

// النسبة تُكتب داخل الشريحة إذا كانت 6% أو أكثر، وإلا خارج القرص مع خط قصير
const PIE_INSIDE_PERCENT = 6;
const PIE_R = 100; // نصف القطر الخارجي
const PIE_R0 = 60; // نصف القطر الداخلي (الفراغ في الوسط للمجموع)
// الألوان الفاتحة تُكتب عليها النسبة بلون غامق حتى تُقرأ
const LIGHT_SERIES = new Set(["var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-rest)"]);
let activeGroup = null;
const PIE_MAX_GROUPS = 8;
const REST_GROUP = "__rest";
let restGroupIds = new Set();

// هل ينتمي التصنيف للمجموعة المختارة في القرص (أو لـ"باقي المجموعات")
function inActiveGroup(cat) {
  return activeGroup === REST_GROUP ? restGroupIds.has(cat.group) : cat.group === activeGroup;
}

function svgEl(tag, attrs, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPie(slices, total) {
  const wrap = $("pie-wrap");
  const svg = $("pie");
  wrap.hidden = slices.length === 0;
  svg.innerHTML = "";
  if (wrap.hidden) return;

  const f = (n) => n.toFixed(1);
  const outside = [];
  // ندوّر القرص حتى تقع الشرائح الصغيرة في الجهة اليسرى، فتصطف نسبها عمودياً بخطوط قصيرة
  const small = slices.map((s, i) => (s.percent < PIE_INSIDE_PERCENT ? i : -1)).filter((i) => i >= 0);
  let angle = -Math.PI / 2;
  if (small.length && slices.length > 1) {
    const before = slices.slice(0, small[0]).reduce((s, x) => s + x.sum, 0) / total;
    const size = small.reduce((s, i) => s + slices[i].sum, 0) / total;
    angle = Math.PI - 2 * Math.PI * (before + size / 2);
  }

  for (const slice of slices) {
    const sweep = (slice.sum / total) * Math.PI * 2;
    let shape;
    if (slices.length === 1) {
      // مجموعة واحدة: حلقة كاملة
      shape = svgEl("circle", { r: (PIE_R + PIE_R0) / 2, fill: "none", "stroke-width": PIE_R - PIE_R0, class: "pie-ring" });
      shape.style.stroke = slice.color;
    } else {
      const [c1, s1, c2, s2] = [Math.cos(angle), Math.sin(angle), Math.cos(angle + sweep), Math.sin(angle + sweep)];
      const large = sweep > Math.PI ? 1 : 0;
      shape = svgEl("path", {
        d: `M${f(PIE_R * c1)} ${f(PIE_R * s1)} A${PIE_R} ${PIE_R} 0 ${large} 1 ${f(PIE_R * c2)} ${f(PIE_R * s2)} ` +
          `L${f(PIE_R0 * c2)} ${f(PIE_R0 * s2)} A${PIE_R0} ${PIE_R0} 0 ${large} 0 ${f(PIE_R0 * c1)} ${f(PIE_R0 * s1)}Z`,
        class: "pie-slice",
      });
      shape.style.fill = slice.color;
    }
    if (activeGroup && activeGroup !== slice.id) shape.classList.add("dimmed");
    shape.appendChild(svgEl("title", {}, `${slice.name}: ${formatMoney(slice.sum)} (${slice.percent}%)`));
    shape.addEventListener("click", () => setActiveGroup(slice.id));
    svg.appendChild(shape);

    if (slices.length > 1) {
      const mid = angle + sweep / 2;
      if (slice.percent >= PIE_INSIDE_PERCENT) {
        const r = (PIE_R + PIE_R0) / 2;
        const cls = LIGHT_SERIES.has(slice.color) ? "pie-label on-light" : "pie-label";
        svg.appendChild(svgEl("text", { x: f(r * Math.cos(mid)), y: f(r * Math.sin(mid)), class: cls }, `${slice.percent}%`));
      } else {
        outside.push({ mid, percent: slice.percent });
      }
    }
    angle += sweep;
  }

  // النسب الصغيرة: عمود في كل جهة، بمسافة 15 على الأقل بينها حتى لا تتداخل
  for (const side of [1, -1]) {
    const items = outside.filter((o) => (Math.cos(o.mid) >= 0) === (side === 1)).sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));
    let lastY = -Infinity;
    for (const { mid, percent } of items) {
      const y = Math.max((PIE_R + 10) * Math.sin(mid), lastY + 15);
      lastY = y;
      const x = side * (PIE_R + 18);
      svg.appendChild(svgEl("polyline", {
        points: `${f((PIE_R + 1) * Math.cos(mid))},${f((PIE_R + 1) * Math.sin(mid))} ${f((PIE_R + 10) * Math.cos(mid))},${f((PIE_R + 10) * Math.sin(mid))} ${f(x)},${f(y)}`,
        class: "pie-leader",
      }));
      svg.appendChild(svgEl("text", { x: f(x + side * 3), y: f(y), "text-anchor": side === 1 ? "start" : "end", class: "pie-out" }, `${percent}%`));
    }
  }

  // في الوسط: مجموع الشهر، أو المجموعة المختارة
  const active = slices.find((s) => s.id === activeGroup);
  svg.appendChild(svgEl("text", { y: -14, class: "pie-center-label" }, active ? active.name : "مصاريف الشهر"));
  svg.appendChild(svgEl("text", { y: 10, class: "pie-center-value money" }, fmtNum(active ? active.sum : total)));
  svg.appendChild(svgEl("text", { y: 30, class: "pie-center-label" }, active ? `${active.percent}% · د.ع` : "د.ع"));

  svg.setAttribute("aria-label", slices.map((s) => `${s.name} ${s.percent}%`).join("، "));
  $("pie-caption").textContent = active ? "اضغط مرة أخرى لعرض كل المجموعات" : "اضغط على أي جزء لعرض تصنيفاته";
}

function setActiveGroup(id) {
  activeGroup = activeGroup === id ? null : id;
  render();
}

// المجموعات بألوانها ومبالغها تحت القرص
function renderGroupLegend(slices) {
  const legend = $("group-legend");
  legend.innerHTML = "";
  for (const slice of slices) {
    const item = el("button", "legend-item");
    item.type = "button";
    if (activeGroup === slice.id) item.classList.add("active");
    if (activeGroup && activeGroup !== slice.id) item.classList.add("dimmed");
    const dot = el("span", "swatch");
    dot.style.background = slice.color;
    item.append(dot, el("span", "legend-name", slice.name), el("b", "money", fmtNum(slice.sum)));
    item.addEventListener("click", () => setActiveGroup(slice.id));
    legend.appendChild(item);
  }
}

// التصنيفات بمبالغها وميزانياتها (كلها، أو تصنيفات المجموعة المختارة فقط)
function renderCategoryBreakdown(byCategory) {
  categoryTotalsEl.innerHTML = "";
  const ids = new Set([...Object.keys(byCategory), ...Object.keys(budgets.byCategory)]);
  const rows = [...ids]
    .map((id) => getCategory(id))
    .filter((cat, i, arr) => arr.indexOf(cat) === i && (!activeGroup || inActiveGroup(cat)))
    .map((cat) => ({ cat, sum: byCategory[cat.id] || 0 }))
    .filter(({ cat, sum }) => sum > 0 || budgets.byCategory[cat.id])
    .sort((a, b) => b.sum - a.sum);

  const activeName = activeGroup === REST_GROUP ? "باقي المجموعات" : activeGroup && getGroup(activeGroup).name;
  $("breakdown-title").textContent = activeGroup ? `تصنيفات ${activeName}` : "حسب التصنيف";
  if (rows.length === 0) {
    categoryTotalsEl.appendChild(el("li", "muted", "لا توجد مصاريف في هذا الشهر."));
    return;
  }
  for (const { cat, sum } of rows) {
    const li = el("li", "category-total");
    const name = el("span", "category-name");
    name.append(catBadge(cat, "sm"), cat.name);
    li.append(name, el("strong", "money", formatMoney(sum)));
    const budgetRow = categoryBudgetRow(cat.id, sum);
    if (budgetRow) li.appendChild(budgetRow);
    categoryTotalsEl.appendChild(li);
  }
}

// نسب مئوية صحيحة مجموعها 100% بالضبط (تُعطى الكسور المتبقية للأكبر كسراً)
function roundedPercents(values, total) {
  const raw = values.map((v) => (v / total) * 100);
  const result = raw.map(Math.floor);
  let remaining = 100 - result.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (remaining <= 0) break;
    result[i]++;
    remaining--;
  }
  return result;
}

// ===== نافذة الإضافة: لوحة الأرقام =====

// المبلغ يُكتب كعملية جمع بسيطة، مثل "5000+3000"
let amountExpr = "";
const AMOUNT_MAX_DIGITS = 12;

function amountTerms() {
  return amountExpr.split("+").filter(Boolean).map(Number);
}

function pressKey(key) {
  const last = amountExpr.split("+").pop();
  if (/^\d$/.test(key)) {
    if (last.length >= AMOUNT_MAX_DIGITS) return;
    // لا أصفار في بداية الرقم
    amountExpr = last === "0" ? amountExpr.slice(0, -1) + key : amountExpr + key;
  } else if (key === "000") {
    if (last && last !== "0" && last.length + 3 <= AMOUNT_MAX_DIGITS) amountExpr += "000";
  } else if (key === "plus") {
    if (last) amountExpr += "+";
  } else if (key === "back") {
    amountExpr = amountExpr.slice(0, -1);
  } else if (key === "clear") {
    amountExpr = "";
  }
  updateAmountDisplay();
}

function updateAmountDisplay() {
  const terms = amountTerms();
  const total = terms.reduce((a, b) => a + b, 0);
  $("amount-value").textContent = total.toLocaleString("en-US");
  const expr = $("amount-expr");
  expr.hidden = !amountExpr.includes("+");
  expr.textContent = amountExpr
    .split("+")
    .map((t) => (t ? Number(t).toLocaleString("en-US") : ""))
    .join(" + ");
  amountInput.value = total || "";
  updateAmountHours();
}

for (const btn of document.querySelectorAll("#keypad button")) {
  btn.addEventListener("click", () => pressKey(btn.dataset.key));
}

// لوحة مفاتيح الكمبيوتر أيضاً: الأرقام (العربية والإنجليزية) و+ والمسح وEnter للحفظ
document.addEventListener("keydown", (event) => {
  if (!expenseDialog.open) return;
  const target = event.target;
  if (target instanceof Element && target.matches("input[type=text], input[type=date], input[type=search]")) return;
  const digit = toDigits(event.key);
  if (event.key.length === 1 && digit.length === 1) pressKey(digit);
  else if (event.key === "+") pressKey("plus");
  else if (event.key === "Backspace") pressKey("back");
  else if (event.key === "Delete") pressKey("clear");
  else if (event.key === "Enter") form.requestSubmit();
  else return;
  event.preventDefault();
});

// ===== نافذة الإضافة: اختيار التصنيف =====

// 5 تصنيفات + زر "تصنيف جديد" = صفّان من 3
const QUICK_CATEGORY_COUNT = 5;
const QUICK_CATEGORY_DAYS = 90;
// قبل أن يتجمع تاريخ استخدام كافٍ: أكثر ما يُصرف عليه يومياً
const STARTER_CATEGORIES = ["groceries", "bread", "fuel", "taxi", "cafe", "mobile-credit"];
let pickerGroup = null;

function visibleCategories() {
  return categories.filter((c) => !c.hidden && !c.system);
}

// أكثر التصنيفات استخداماً في آخر 3 أشهر، ثم نكمل من القائمة الافتراضية
function topCategories() {
  const since = isoDateOffset(-QUICK_CATEGORY_DAYS);
  const counts = {};
  for (const e of expenses) {
    if (e.recurringId || e.jamiyaId || e.goalId || e.date < since) continue;
    counts[e.categoryId] = (counts[e.categoryId] || 0) + 1;
  }
  const visible = visibleCategories();
  const ids = Object.keys(counts)
    .filter((id) => visible.some((c) => c.id === id))
    .sort((a, b) => counts[b] - counts[a]);
  for (const id of [...STARTER_CATEGORIES, ...visible.map((c) => c.id)]) {
    if (ids.length >= QUICK_CATEGORY_COUNT) break;
    if (!ids.includes(id) && visible.some((c) => c.id === id)) ids.push(id);
  }
  return ids.slice(0, QUICK_CATEGORY_COUNT).map(getCategory);
}

function categoryButton(cat, className) {
  const btn = el("button", className);
  btn.type = "button";
  btn.dataset.category = cat.id;
  if (categoryInput.value === cat.id) btn.classList.add("selected");
  btn.append(catBadge(cat, className === "cat-tile" ? "big" : "sm"), el("span", "", cat.name));
  btn.addEventListener("click", () => selectCategory(cat.id));
  return btn;
}

function renderCategoryPicker() {
  const top = topCategories();
  // التصنيف المختار يظهر في الصف الأول دائماً
  const selected = categoryInput.value && getCategory(categoryInput.value);
  if (selected && !top.includes(selected)) {
    top.unshift(selected);
    top.pop();
  }
  const newChip = iconText("button", "plus", "تصنيف جديد", "cat-chip new-cat");
  newChip.type = "button";
  newChip.addEventListener("click", openQuickCategory);
  $("top-categories").replaceChildren(...top.map((cat) => categoryButton(cat, "cat-chip")), newChip);

  const tabs = $("group-tabs");
  tabs.innerHTML = "";
  for (const group of GROUPS) {
    if (!visibleCategories().some((c) => c.group === group.id)) continue;
    const tab = el("button", group.id === pickerGroup ? "group-tab active" : "group-tab");
    tab.type = "button";
    tab.style.setProperty("--c", groupColor(group.id));
    tab.append(icon(group.icon, "sm"), group.name);
    tab.addEventListener("click", () => {
      pickerGroup = group.id;
      renderCategoryPicker();
    });
    tabs.appendChild(tab);
  }
  const inGroup = categories.filter((c) => c.group === pickerGroup && !c.system && (!c.hidden || c === selected));
  const newTile = el("button", "cat-tile new-cat");
  newTile.type = "button";
  const plus = el("span", "cat-icon big");
  plus.appendChild(icon("plus"));
  newTile.append(plus, el("span", "", "تصنيف جديد"));
  newTile.addEventListener("click", openQuickCategory);
  $("category-grid").replaceChildren(...inGroup.map((cat) => categoryButton(cat, "cat-tile")), newTile);
}

function selectCategory(id) {
  categoryInput.value = id;
  pickerGroup = getCategory(id).group;
  renderCategoryPicker();
}

$("show-all-cats").addEventListener("click", () => {
  const all = $("all-categories");
  all.hidden = !all.hidden;
  $("show-all-cats").classList.toggle("open", !all.hidden);
});

// ===== طرق الدفع =====

let chosenMethod = CASH_ID;

function getMethod(id) {
  return methods.find((m) => m.id === id) || methods.find((m) => m.id === CASH_ID);
}

function lastMethod() {
  try {
    const id = localStorage.getItem(LAST_METHOD_KEY);
    return methods.some((m) => m.id === id) ? id : CASH_ID;
  } catch {
    return CASH_ID;
  }
}

function renderMethodChips() {
  const box = $("method-chips");
  box.innerHTML = "";
  for (const m of methods) {
    const btn = iconText("button", m.icon, m.name, m.id === chosenMethod ? "method-chip selected" : "method-chip");
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(m.id === chosenMethod));
    btn.addEventListener("click", () => {
      chosenMethod = m.id;
      renderMethodChips();
    });
    box.appendChild(btn);
  }
  const add = iconText("button", "plus", "", "method-chip add");
  add.type = "button";
  add.setAttribute("aria-label", "طريقة دفع جديدة");
  add.addEventListener("click", () => {
    const m = addMethod();
    if (m) {
      chosenMethod = m.id;
      renderMethodChips();
    }
  });
  box.appendChild(add);
}

// طريقة دفع جديدة باسم يكتبه المستخدم (مثل FastPay أو آسيا حوالة)
function addMethod() {
  const name = (prompt("اسم طريقة الدفع (مثال: FastPay أو آسيا حوالة):") || "").trim();
  if (!name) return null;
  const existing = methods.find((m) => normalize(m.name) === normalize(name));
  if (existing) return existing;
  const m = { id: newId(), name: name.slice(0, 30), icon: "wallet" };
  methods.push(m);
  save();
  return m;
}

function renderMethodsList() {
  const list = $("methods-list");
  list.innerHTML = "";
  for (const m of methods) {
    const count = expenses.filter((e) => (e.method || CASH_ID) === m.id).length;
    const li = el("li", "category-row");
    const badge = el("span", "cat-icon sm");
    badge.appendChild(icon(m.icon, "sm"));
    const info = el("span", "category-row-name");
    info.append(m.name, el("small", "category-count", `${count} مصروف`));
    const rename = el("button", "small-btn", "تعديل");
    rename.type = "button";
    rename.addEventListener("click", () => {
      const name = (prompt("الاسم الجديد:", m.name) || "").trim();
      if (!name) return;
      m.name = name.slice(0, 30);
      save();
      renderMethodsList();
      render();
    });
    li.append(badge, info, rename);
    if (m.id !== CASH_ID) {
      const del = el("button", "delete-btn");
      del.type = "button";
      del.setAttribute("aria-label", `حذف ${m.name}`);
      del.appendChild(icon("trash-2"));
      del.addEventListener("click", () => {
        if (!confirm(count ? `حذف "${m.name}"؟ مصاريفها (${count}) تُعتبر كاش.` : `حذف "${m.name}"؟`)) return;
        for (const e of expenses) if (e.method === m.id) e.method = CASH_ID;
        for (const r of recurring) if (r.method === m.id) r.method = CASH_ID;
        methods = methods.filter((x) => x !== m);
        save();
        renderMethodsList();
        render();
      });
      li.appendChild(del);
    } else {
      li.appendChild(el("span", "delete-placeholder"));
    }
    list.appendChild(li);
  }
}

$("open-methods").addEventListener("click", () => {
  renderMethodsList();
  $("methods-dialog").showModal();
});
$("add-method").addEventListener("click", () => {
  if (addMethod()) renderMethodsList();
});

// مجموع كل طريقة دفع في الشهر (يظهر عند استخدام أكثر من طريقة)
function renderMethodTotals(monthExpenses) {
  const totals = {};
  for (const e of monthExpenses) totals[e.method || CASH_ID] = (totals[e.method || CASH_ID] || 0) + e.amount;
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  $("methods-card").hidden = entries.length < 2;
  const list = $("method-totals");
  list.innerHTML = "";
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const percents = roundedPercents(entries.map(([, v]) => v), total);
  entries.forEach(([id, sum], i) => {
    const m = getMethod(id);
    const li = el("li", "method-total");
    const name = el("span", "category-name");
    const badge = el("span", "cat-icon sm");
    badge.appendChild(icon(m.icon, "sm"));
    name.append(badge, m.name);
    li.append(name, el("strong", "money", `${formatMoney(sum)} · ${percents[i]}%`));
    const bar = el("div", "meter");
    const fill = el("div", "meter-fill");
    fill.style.width = `${percents[i]}%`;
    bar.appendChild(fill);
    li.appendChild(bar);
    list.appendChild(li);
  });
}

// ===== إضافة وتعديل وحذف المصاريف =====

// mode: "expense" أو "income". عند تعديل دخل يكون exp هو الدخل نفسه
function openForm(exp, mode = "expense") {
  form.reset();
  editingId = exp ? exp.id : null;
  deleteInFormBtn.hidden = !exp;
  incomeType = exp && mode === "income" ? exp.type : INCOME_TYPES[0].id;
  // التقييم يظهر عند التعديل فقط، حتى تبقى الإضافة سريعة
  worthField.hidden = !exp;
  // التكرار الشهري يُختار عند الإضافة فقط
  $("recurring-row").hidden = Boolean(exp);

  amountExpr = exp ? String(exp.amount) : "";
  categoryInput.value = exp && mode === "expense" ? getCategory(exp.categoryId).id : "";
  pickerGroup = exp && mode === "expense" ? getCategory(exp.categoryId).group : GROUPS[0].id;
  $("all-categories").hidden = true;
  $("show-all-cats").classList.remove("open");

  if (exp) {
    dateInput.value = exp.date;
    noteInput.value = exp.note || "";
    const worth = exp.worth === "yes" || exp.worth === "no" ? exp.worth : "";
    if (mode === "expense") form.querySelector(`input[name="worth"][value="${worth}"]`).checked = true;
  } else {
    // عند إضافة مصروف لشهر سابق، نقترح أول يوم من ذلك الشهر
    const today = todayString();
    dateInput.value = today.startsWith(viewMonth) ? today : `${viewMonth}-01`;
  }

  chosenMethod = exp ? exp.method || CASH_ID : lastMethod();
  renderMethodChips();
  updateAmountDisplay();
  renderCategoryPicker();
  renderIncomeTypes();
  setFormMode(mode, Boolean(exp));
  expenseDialog.showModal();
  // لا نضع التركيز على أي خانة حتى لا تظهر لوحة مفاتيح الجوال فوق لوحة الأرقام
  document.activeElement?.blur();
}

let formMode = "expense";
let incomeType = INCOME_TYPES[0].id;

function setFormMode(mode, editing) {
  formMode = mode;
  const income = mode === "income";
  form.querySelector(`input[name="entry-mode"][value="${mode}"]`).checked = true;
  // عند التعديل لا يتحول المصروف إلى دخل أو العكس
  $("mode-switch").hidden = editing;
  $("form-title").textContent = editing ? (income ? "تعديل دخل" : "تعديل مصروف") : income ? "دخل جديد" : "مصروف جديد";
  $("category-picker").hidden = income;
  $("income-picker").hidden = !income;
  $("method-label").textContent = income ? "استلمته عبر" : "طريقة الدفع";
  worthField.hidden = income || !editing;
  deleteInFormBtn.textContent = income ? "حذف هذا الدخل" : "حذف هذا المصروف";
  form.classList.toggle("income-mode", income);
  updateAmountHours();
}

for (const radio of form.querySelectorAll('input[name="entry-mode"]')) {
  radio.addEventListener("change", () => setFormMode(radio.value, false));
}

function renderIncomeTypes() {
  const box = $("income-types");
  box.innerHTML = "";
  for (const t of INCOME_TYPES) {
    const btn = el("button", t.id === incomeType ? "cat-chip selected" : "cat-chip");
    btn.type = "button";
    const badge = el("span", "cat-icon sm income");
    badge.appendChild(icon(t.icon, "sm"));
    btn.append(badge, el("span", "", t.name));
    btn.addEventListener("click", () => {
      incomeType = t.id;
      renderIncomeTypes();
    });
    box.appendChild(btn);
  }
}

function deleteIncome(id) {
  const index = incomes.findIndex((i) => i.id === id);
  if (index === -1) return false;
  const [removed] = incomes.splice(index, 1);
  save();
  render();
  showToast(`حُذف دخل ${getIncomeType(removed.type).name} ${formatMoney(removed.amount)}`, () => {
    incomes.splice(Math.min(index, incomes.length), 0, removed);
    save();
    render();
  });
  return true;
}

// "= ساعتان عمل" تحت المبلغ أثناء الكتابة
function updateAmountHours() {
  const amount = Number(amountInput.value);
  amountHoursEl.hidden = !work || !(amount > 0) || formMode === "income";
  if (!amountHoursEl.hidden) amountHoursEl.textContent = `= ${workTime(amount)}`;
}

// الحذف بلا سؤال، مع زر "تراجع" لبضع ثوانٍ
function deleteExpense(id) {
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const [removed] = expenses.splice(index, 1);
  save();
  render();
  showToast(`حُذف ${getCategory(removed.categoryId).name} ${formatMoney(removed.amount)}`, () => {
    expenses.splice(Math.min(index, expenses.length), 0, removed);
    save();
    render();
  });
  return true;
}

// تنسيق المبلغ بفواصل الآلاف أثناء الكتابة (لخانات المبالغ الأخرى في التطبيق)
function formatMoneyInput(input) {
  const digits = toDigits(input.value).replace(/^0+/, "");
  input.value = digits ? Number(digits).toLocaleString("en-US") : "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  if (!(amount > 0)) {
    showToast("اكتب المبلغ أولاً");
    return;
  }
  if (formMode === "income") {
    saveIncome(amount);
    return;
  }
  if (!categoryInput.value) {
    showToast("اختر التصنيف");
    return;
  }

  const data = {
    amount,
    categoryId: categoryInput.value,
    date: dateInput.value,
    note: noteInput.value.trim(),
    method: chosenMethod,
  };
  try {
    localStorage.setItem(LAST_METHOD_KEY, chosenMethod);
  } catch {
    // يبقى الاختيار الافتراضي كاش
  }

  if (editingId !== null) {
    const exp = expenses.find((e) => e.id === editingId);
    Object.assign(exp, data);
    const worth = form.querySelector('input[name="worth"]:checked')?.value;
    if (worth === "yes" || worth === "no") exp.worth = worth;
    else if (exp.worth !== "skip") delete exp.worth;
  } else {
    const exp = { id: nextExpenseId(), ...data };
    if ($("recurring").checked) exp.recurringId = createRecurring(data);
    expenses.push(exp);
  }

  // الانتقال إلى شهر المصروف حتى يراه المستخدم
  viewMonth = data.date.slice(0, 7);
  save();
  render();
  expenseDialog.close();
  showToast(editingId === null ? `أُضيف ${getCategory(data.categoryId).name} ${formatMoney(amount)}` : "حُفظ التعديل");
  if (editingId === null) notifyBudget(data);
});

function saveIncome(amount) {
  const data = { amount, type: incomeType, date: dateInput.value, note: noteInput.value.trim(), method: chosenMethod };
  if (editingId !== null) {
    Object.assign(incomes.find((i) => i.id === editingId), data);
  } else {
    const income = { id: nextExpenseId(), ...data };
    if ($("recurring").checked) income.recurringId = createRecurring(data, "income");
    incomes.push(income);
  }
  viewMonth = data.date.slice(0, 7);
  save();
  render();
  expenseDialog.close();
  showToast(editingId === null ? `أُضيف دخل ${getIncomeType(data.type).name} ${formatMoney(amount)}` : "حُفظ التعديل");
}

deleteInFormBtn.addEventListener("click", () => {
  const removed = formMode === "income" ? deleteIncome(editingId) : deleteExpense(editingId);
  if (removed) expenseDialog.close();
});

$("add-btn").addEventListener("click", () => openForm(null));

// ===== التنقل بين الأشهر والبحث =====

$("prev-month").addEventListener("click", () => {
  viewMonth = shiftMonth(viewMonth, -1);
  render();
});

$("next-month").addEventListener("click", () => {
  viewMonth = shiftMonth(viewMonth, 1);
  render();
});

$("list-prev-month").addEventListener("click", () => $("prev-month").click());
$("list-next-month").addEventListener("click", () => $("next-month").click());

thisMonthBtn.addEventListener("click", () => {
  viewMonth = todayString().slice(0, 7);
  render();
});

searchInput.addEventListener("input", render);

// ===== إدارة التصنيفات =====

function renderCategoryList() {
  renderMyGroups();
  categoryListEl.innerHTML = "";
  for (const group of GROUPS) {
    const inGroup = categories.filter((c) => c.group === group.id);
    if (inGroup.length === 0) continue;
    categoryListEl.appendChild(el("li", "category-group-title", group.name));
    for (const cat of inGroup) {
      const count = expenses.filter((e) => e.categoryId === cat.id).length;
      const li = el("li", cat.hidden ? "category-row is-hidden" : "category-row");
      const info = el("span", "category-row-name");
      info.append(cat.name, el("small", "category-count", cat.hidden ? `مخفي · ${count} مصروف` : `${count} مصروف`));
      li.append(catBadge(cat, "sm"), info);

      if (cat.system) {
        info.lastChild.textContent = `${count} مصروف · يُضاف تلقائياً`;
        li.append(el("span", "delete-placeholder"), el("span", "delete-placeholder"));
        categoryListEl.appendChild(li);
        continue;
      }

      // التصنيف المخفي لا يظهر عند إضافة مصروف، لكن مصاريفه السابقة تبقى كما هي
      const toggle = el("button", "icon-btn");
      toggle.type = "button";
      toggle.setAttribute("aria-label", cat.hidden ? `إظهار ${cat.name}` : `إخفاء ${cat.name}`);
      toggle.appendChild(icon(cat.hidden ? "eye-off" : "eye"));
      toggle.addEventListener("click", () => {
        cat.hidden = !cat.hidden;
        save();
        renderCategoryList();
      });
      li.appendChild(toggle);

      const editBtn = el("button", "small-btn", "تعديل");
      editBtn.type = "button";
      editBtn.addEventListener("click", () => startEditCategory(cat));
      li.appendChild(editBtn);

      if (cat.id !== OTHER_ID) {
        const delBtn = el("button", "delete-btn");
        delBtn.appendChild(icon("trash-2"));
        delBtn.type = "button";
        delBtn.setAttribute("aria-label", `حذف ${cat.name}`);
        delBtn.addEventListener("click", () => deleteCategory(cat, count));
        li.appendChild(delBtn);
      } else {
        li.appendChild(el("span", "delete-placeholder"));
      }
      categoryListEl.appendChild(li);
    }
  }
}

const categoryGroupInput = $("category-group");

fillGroupOptions(categoryGroupInput, "other");
watchNewGroupOption(categoryGroupInput, updateChosenIcon);

function updateChosenIcon() {
  chosenIconEl.replaceChildren(catBadge({ icon: chosenIcon, group: categoryGroupInput.value }, "big"));
}

function renderIconPicker() {
  iconPickerEl.innerHTML = "";
  for (const name of CATEGORY_ICON_CHOICES) {
    const btn = el("button", name === chosenIcon ? "icon-choice selected" : "icon-choice");
    btn.type = "button";
    btn.setAttribute("aria-label", name);
    btn.appendChild(icon(name));
    btn.addEventListener("click", () => {
      chosenIcon = name;
      updateChosenIcon();
      renderIconPicker();
    });
    iconPickerEl.appendChild(btn);
  }
  updateChosenIcon();
}


function resetCategoryForm() {
  editingCategoryId = null;
  chosenIcon = "tag";
  fillGroupOptions(categoryGroupInput, "other");
  categoryGroupInput.value = "other";
  categoryNameInput.value = "";
  categoryFormTitle.textContent = "إضافة تصنيف جديد";
  categorySaveBtn.textContent = "إضافة";
  categoryCancelBtn.hidden = true;
  renderIconPicker();
}

function startEditCategory(cat) {
  editingCategoryId = cat.id;
  chosenIcon = cat.icon || "tag";
  fillGroupOptions(categoryGroupInput, cat.group);
  categoryGroupInput.value = cat.group;
  categoryNameInput.value = cat.name;
  categoryFormTitle.textContent = `تعديل تصنيف "${cat.name}"`;
  categorySaveBtn.textContent = "حفظ التعديل";
  categoryCancelBtn.hidden = false;
  renderIconPicker();
  categoryForm.scrollIntoView({ behavior: "smooth" });
}

function deleteCategory(cat, count) {
  const other = getCategory(OTHER_ID);
  const message = count
    ? `حذف تصنيف "${cat.name}"؟\nسيتم نقل ${count} مصروف إلى تصنيف "${other.name}".`
    : `حذف تصنيف "${cat.name}"؟`;
  if (!confirm(message)) return;

  for (const e of expenses) {
    if (e.categoryId === cat.id) e.categoryId = OTHER_ID;
  }
  for (const r of recurring) {
    if (r.categoryId === cat.id) r.categoryId = OTHER_ID;
  }
  delete budgets.byCategory[cat.id];
  categories = categories.filter((c) => c.id !== cat.id);
  if (editingCategoryId === cat.id) resetCategoryForm();
  save();
  renderCategoryList();
  render();
}

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryNameInput.value.trim();
  if (!name) return;

  const duplicate = categories.find((c) => normalize(c.name) === normalize(name) && c.id !== editingCategoryId);
  if (duplicate) {
    alert(`يوجد تصنيف بهذا الاسم: ${duplicate.name}`);
    return;
  }

  const data = { name, icon: chosenIcon, group: categoryGroupInput.value };
  if (editingCategoryId) Object.assign(getCategory(editingCategoryId), data);
  else categories.push({ id: newId(), ...data });
  categories = sortCategories(categories);

  save();
  resetCategoryForm();
  renderCategoryList();
  render();
});

categoryCancelBtn.addEventListener("click", resetCategoryForm);

$("manage-categories").addEventListener("click", () => {
  resetCategoryForm();
  renderCategoryList();
  categoriesDialog.showModal();
});

// ===== مجموعات المستخدم، وإضافة تصنيف من نافذة الإضافة =====

// قائمة المجموعات في أي نموذج، وفي آخرها "+ مجموعة جديدة…"
function fillGroupOptions(select, selectedId) {
  select.innerHTML = "";
  for (const group of GROUPS) {
    const option = el("option", "", group.name);
    option.value = group.id;
    select.appendChild(option);
  }
  const add = el("option", "", "+ مجموعة جديدة…");
  add.value = NEW_GROUP_OPTION;
  select.appendChild(add);
  select.value = GROUPS.some((g) => g.id === selectedId) ? selectedId : "other";
  select.dataset.previous = select.value;
}

// اختيار "+ مجموعة جديدة…" يفتح نافذة المجموعة، ثم يختار المجموعة الجديدة
function watchNewGroupOption(select, onChange) {
  select.addEventListener("change", () => {
    if (select.value !== NEW_GROUP_OPTION) {
      select.dataset.previous = select.value;
      onChange();
      return;
    }
    select.value = select.dataset.previous;
    openGroupDialog(null, (group) => {
      fillGroupOptions(select, group.id);
      onChange();
    });
  });
}

// شبكة أيقونات يختار منها المستخدم
function buildIconPicker(container, selected, onPick) {
  container.innerHTML = "";
  for (const name of CATEGORY_ICON_CHOICES) {
    const btn = el("button", name === selected ? "icon-choice selected" : "icon-choice");
    btn.type = "button";
    btn.setAttribute("aria-label", name);
    btn.appendChild(icon(name));
    btn.addEventListener("click", () => {
      for (const other of container.querySelectorAll(".selected")) other.classList.remove("selected");
      btn.classList.add("selected");
      onPick(name);
    });
    container.appendChild(btn);
  }
}

// --- نافذة المجموعة ---

const groupDialog = $("group-dialog");
let editingGroup = null;
let groupDone = null;
let groupIcon = "tag";
let groupColorChoice = 1;

function updateGroupPreview() {
  $("group-preview").replaceChildren(catBadge({ icon: groupIcon, group: "__preview" }, "big"));
  $("group-preview").firstChild.style.setProperty("--c", groupColorChoice === "rest" ? "var(--series-rest)" : `var(--series-${groupColorChoice})`);
}

function renderGroupColors() {
  const box = $("group-colors");
  box.innerHTML = "";
  for (const color of GROUP_COLOR_CHOICES) {
    const btn = el("button", color === groupColorChoice ? "swatch-btn selected" : "swatch-btn");
    btn.type = "button";
    btn.style.background = color === "rest" ? "var(--series-rest)" : `var(--series-${color})`;
    // اسم المجموعات التي تستخدم هذا اللون، حتى يعرف المستخدم إن كان سيتكرر
    const users = GROUPS.filter((g) => g.color === color && g !== editingGroup).map((g) => g.name);
    btn.setAttribute("aria-label", users.length ? `لون ${users.join("، ")}` : "لون غير مستخدم");
    btn.title = users.length ? users.join("، ") : "غير مستخدم";
    btn.addEventListener("click", () => {
      groupColorChoice = color;
      renderGroupColors();
      updateGroupPreview();
    });
    box.appendChild(btn);
  }
}

function openGroupDialog(group, onDone) {
  editingGroup = group;
  groupDone = onDone || null;
  groupIcon = group ? group.icon : "tag";
  groupColorChoice = group ? group.color : suggestGroupColor();
  $("group-form-title").textContent = group ? "تعديل مجموعة" : "مجموعة جديدة";
  $("group-save").textContent = group ? "حفظ" : "إضافة";
  $("group-delete").hidden = !group;
  $("group-name").value = group ? group.name : "";
  buildIconPicker($("group-icons"), groupIcon, (name) => {
    groupIcon = name;
    updateGroupPreview();
  });
  renderGroupColors();
  updateGroupPreview();
  groupDialog.showModal();
}

$("group-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("group-name").value.trim();
  if (!name) return;
  const duplicate = GROUPS.find((g) => normalize(g.name) === normalize(name) && g !== editingGroup);
  if (duplicate) {
    alert(`توجد مجموعة بهذا الاسم: ${duplicate.name}`);
    return;
  }
  let group = editingGroup;
  if (group) Object.assign(group, { name, icon: groupIcon, color: groupColorChoice });
  else {
    group = { id: newId(), name, icon: groupIcon, color: groupColorChoice, custom: true };
    customGroups.push(group);
  }
  applyCustomGroups(customGroups);
  categories = sortCategories(categories);
  save();
  groupDialog.close();
  if (groupDone) groupDone(group);
  if (categoriesDialog.open) renderCategoryList();
  render();
});

$("group-delete").addEventListener("click", () => {
  const group = editingGroup;
  const count = categories.filter((c) => c.group === group.id).length;
  const message = count
    ? `حذف مجموعة "${group.name}"؟\nتنتقل تصنيفاتها (${count}) إلى مجموعة "أخرى"، ولا يُحذف أي مصروف.`
    : `حذف مجموعة "${group.name}"؟`;
  if (!confirm(message)) return;
  for (const cat of categories) {
    if (cat.group === group.id) cat.group = "other";
  }
  customGroups = customGroups.filter((g) => g !== group);
  applyCustomGroups(customGroups);
  categories = sortCategories(categories);
  save();
  groupDialog.close();
  if (categoriesDialog.open) {
    resetCategoryForm();
    renderCategoryList();
  }
  render();
});

// "مجموعاتي" في نافذة التصنيفات
function renderMyGroups() {
  const list = $("my-groups");
  list.innerHTML = "";
  if (customGroups.length === 0) {
    list.appendChild(el("li", "muted small-note", "لم تُضف مجموعات بعد."));
    return;
  }
  for (const group of customGroups) {
    const li = el("li", "category-row");
    const badge = catBadge({ icon: group.icon, group: group.id }, "sm");
    const count = categories.filter((c) => c.group === group.id).length;
    const info = el("span", "category-row-name");
    info.append(group.name, el("small", "category-count", `${count} تصنيف`));
    const edit = el("button", "small-btn", "تعديل");
    edit.type = "button";
    edit.addEventListener("click", () => openGroupDialog(group));
    li.append(badge, info, edit);
    list.appendChild(li);
  }
}

$("add-group").addEventListener("click", () => openGroupDialog(null));

// --- تصنيف جديد من نافذة الإضافة ---

const quickCategoryDialog = $("quick-category-dialog");
const qcGroup = $("qc-group");
let qcIcon = "tag";

function updateQuickPreview() {
  $("qc-preview").replaceChildren(catBadge({ icon: qcIcon, group: qcGroup.value }, "big"));
}

function openQuickCategory() {
  qcIcon = "tag";
  $("qc-name").value = "";
  fillGroupOptions(qcGroup, pickerGroup && pickerGroup !== "savings" ? pickerGroup : "other");
  buildIconPicker($("qc-icons"), qcIcon, (name) => {
    qcIcon = name;
    updateQuickPreview();
  });
  updateQuickPreview();
  quickCategoryDialog.showModal();
  $("qc-name").focus();
}

watchNewGroupOption(qcGroup, updateQuickPreview);

$("quick-category-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("qc-name").value.trim();
  if (!name) return;
  // اسم موجود: نختار التصنيف الموجود بدل تكراره
  const existing = categories.find((c) => normalize(c.name) === normalize(name));
  let cat = existing;
  if (existing) {
    existing.hidden = false;
    showToast(`"${existing.name}" موجود، فاخترناه`);
  } else {
    cat = { id: newId(), name, icon: qcIcon, group: qcGroup.value };
    categories = sortCategories([...categories, cat]);
    showToast(`أُضيف تصنيف "${name}"`);
  }
  save();
  quickCategoryDialog.close();
  selectCategory(cat.id);
});

// ===== المبالغ بساعات العمل =====

// متوسط عدد الأسابيع في الشهر = 52 أسبوعاً ÷ 12 شهراً
const WEEKS_PER_MONTH = 52 / 12;

function hourlyRate(w) {
  return w.salary / (w.days * w.hours * WEEKS_PER_MONTH);
}

// العدد مع المعدود بالعربية: ساعة، ساعتان، 3 ساعات، 11 ساعة
function countWord(n, one, two, few) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${one}`;
}

// تحويل مبلغ إلى وقت عمل: "52 دقيقة عمل"، "4 ساعات و20 دقيقة عمل"، "يوما عمل"
function workTime(amount) {
  const minutes = Math.round((amount / hourlyRate(work)) * 60);
  if (minutes < 1) return "أقل من دقيقة عمل";
  if (minutes < 60) return `${countWord(minutes, "دقيقة", "دقيقتان", "دقائق")} عمل`;

  if (minutes < work.hours * 60) {
    let h = Math.floor(minutes / 60);
    let m = Math.round((minutes - h * 60) / 5) * 5;
    if (m === 60) {
      h++;
      m = 0;
    }
    const hoursText = countWord(h, "ساعة", "ساعتان", "ساعات");
    return m ? `${hoursText} و${countWord(m, "دقيقة", "دقيقتان", "دقائق")} عمل` : `${hoursText} عمل`;
  }

  // أيام العمل مقرّبة لأقرب نصف يوم
  const days = Math.round((minutes / 60 / work.hours) * 2) / 2;
  if (days % 1) return `${days} يوم عمل`;
  return countWord(days, "يوم عمل", "يوما عمل", "أيام عمل");
}

const workDialog = $("work-dialog");
const workForm = $("work-form");
const salaryInput = $("salary");
const workDaysInput = $("work-days");
const workHoursInput = $("work-hours");

function readWorkForm() {
  return {
    salary: Number(toDigits(salaryInput.value)),
    days: Number(workDaysInput.value),
    hours: Number(workHoursInput.value),
  };
}

function updateHourlyPreview() {
  const w = readWorkForm();
  const valid = w.salary > 0 && w.days >= 1 && w.days <= 7 && w.hours > 0 && w.hours <= 24;
  $("hourly-preview").textContent = valid ? `أجرك تقريباً: ${formatMoney(hourlyRate(w))} في الساعة` : "";
}

function openWorkDialog() {
  salaryInput.value = work ? work.salary.toLocaleString("en-US") : "";
  workDaysInput.value = work ? work.days : 5;
  workHoursInput.value = work ? work.hours : 8;
  $("work-clear").hidden = !work;
  updateHourlyPreview();
  workDialog.showModal();
  if (!work) salaryInput.focus();
}

salaryInput.addEventListener("input", () => {
  formatMoneyInput(salaryInput);
  updateHourlyPreview();
});
workDaysInput.addEventListener("input", updateHourlyPreview);
workHoursInput.addEventListener("input", updateHourlyPreview);

workForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const w = readWorkForm();
  if (!(w.salary > 0)) {
    alert("الرجاء إدخال الراتب الشهري.");
    return;
  }
  work = w;
  saveWork();
  render();
  workDialog.close();
});

$("work-clear").addEventListener("click", () => {
  if (!confirm("حذف الراتب وإيقاف عرض ساعات العمل؟")) return;
  work = null;
  saveWork();
  render();
  workDialog.close();
});

$("open-work").addEventListener("click", openWorkDialog);
setupWorkBtn.addEventListener("click", openWorkDialog);

// ===== ميزان الندم =====

// نسأل عن المصروف بعد يومين من تاريخه، ولا نسأل عن مصاريف أقدم من شهر
const REGRET_DELAY_DAYS = 2;
const REGRET_WINDOW_DAYS = 30;

function daysAgo(date) {
  const [y, m, d] = date.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - new Date(y, m - 1, d)) / 86400000);
}

function relativeDay(date) {
  const n = daysAgo(date);
  if (n === 0) return "اليوم";
  if (n === 1) return "أمس";
  return `قبل ${countWord(n, "يوم", "يومين", "أيام")}`;
}

// المصاريف التي تنتظر رأي المستخدم، الأقدم أولاً
function regretQueue() {
  return expenses
    .filter((e) => {
      const age = daysAgo(e.date);
      return !e.worth && !e.recurringId && !e.jamiyaId && !e.goalId && age >= REGRET_DELAY_DAYS && age <= REGRET_WINDOW_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

function renderRegretAsk() {
  const queue = regretQueue();
  $("regret-ask").hidden = queue.length === 0;
  if (queue.length === 0) return;

  const exp = queue[0];
  const cat = getCategory(exp.categoryId);
  const box = $("regret-expense");
  box.innerHTML = "";
  box.append(
    el("strong", "", `${cat.name} · ${formatMoney(exp.amount)}`),
    el("span", "regret-when", exp.note ? `${relativeDay(exp.date)} · ${exp.note}` : relativeDay(exp.date))
  );
  $("regret-queue").textContent = queue.length > 1 ? `${queue.length} بانتظار رأيك` : "";
}

function rateFirstInQueue(worth) {
  const exp = regretQueue()[0];
  if (!exp) return;
  exp.worth = worth;
  save();
  render();
}

for (const btn of document.querySelectorAll(".worth-btn")) {
  btn.addEventListener("click", () => rateFirstInQueue(btn.dataset.worth));
}
$("regret-skip").addEventListener("click", () => rateFirstInQueue("skip"));

function renderRegretStats(monthExpenses) {
  const card = $("regret-stats");
  const content = $("regret-content");
  card.hidden = monthExpenses.length === 0;
  content.innerHTML = "";
  if (card.hidden) return;

  const rated = monthExpenses.filter((e) => e.worth === "yes" || e.worth === "no");
  if (rated.length === 0) {
    content.appendChild(
      el("p", "hint start", "بعد يومين من كل مصروف سأسألك: هل كان يستحق؟ وهنا ستظهر النتيجة في نهاية الشهر.")
    );
    return;
  }

  const regretted = rated.filter((e) => e.worth === "no");
  const regretSum = regretted.reduce((s, e) => s + e.amount, 0);
  const ratedSum = rated.reduce((s, e) => s + e.amount, 0);

  if (regretSum === 0) {
    content.appendChild(el("p", "regret-total good", "لم تندم على أي مصروف قيّمته هذا الشهر"));
  } else {
    const percent = Math.round((regretSum / ratedSum) * 100);
    content.appendChild(el("p", "regret-total", `ندمت على ${formatMoney(regretSum)}`));
    if (work) content.appendChild(el("p", "regret-detail", `أي ${workTime(regretSum)}`));
    content.appendChild(el("p", "regret-detail", `${percent}% من المبلغ الذي قيّمته`));

    const bar = el("div", "regret-bar");
    const fill = el("div", "regret-bar-fill");
    fill.style.width = `${percent}%`;
    bar.appendChild(fill);
    content.appendChild(bar);

    // أكثر التصنيفات ندماً
    const byCategory = {};
    for (const e of regretted) {
      const id = getCategory(e.categoryId).id;
      byCategory[id] = (byCategory[id] || 0) + e.amount;
    }
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
    content.appendChild(el("h3", "", "أكثر ما ندمت عليه"));
    const list = el("ul", "totals");
    for (const [id, sum] of top) {
      const cat = getCategory(id);
      const li = el("li");
      const name = el("span", "category-name");
      name.append(catBadge(cat, "sm"), cat.name);
      li.append(name, el("strong", "", formatMoney(sum)));
      list.appendChild(li);
    }
    content.appendChild(list);
  }

  const unrated = monthExpenses.length - rated.length;
  content.appendChild(
    el(
      "p",
      "hint start",
      unrated ? `قيّمت ${rated.length} من ${monthExpenses.length} مصروف هذا الشهر.` : `قيّمت كل مصاريف هذا الشهر (${rated.length}).`
    )
  );
}

// ===== النسخ الاحتياطي والتصدير =====

const BACKUP_DATE_KEY = "lastBackup";
const BACKUP_APP_NAME = "masarifi";
// نذكّر بالنسخ الاحتياطي بعد هذا العدد من الأيام، إذا كانت هناك مصاريف كافية
const BACKUP_REMIND_DAYS = 14;
const BACKUP_REMIND_MIN_EXPENSES = 5;

const importDialog = $("import-dialog");
const importFileInput = $("import-file");
let pendingImport = null;

function daysSinceBackup() {
  try {
    const last = localStorage.getItem(BACKUP_DATE_KEY);
    if (!last) return null;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  } catch {
    return null;
  }
}

function renderBackupStatus() {
  const days = daysSinceBackup();
  let status;
  if (days === null) status = "لم تحفظ أي نسخة احتياطية بعد.";
  else if (days === 0) status = "آخر نسخة احتياطية: اليوم";
  else if (days === 1) status = "آخر نسخة احتياطية: أمس";
  else status = `آخر نسخة احتياطية: قبل ${days} يوم`;
  $("backup-status").textContent = status;

  const needsReminder =
    expenses.length >= BACKUP_REMIND_MIN_EXPENSES && (days === null || days >= BACKUP_REMIND_DAYS);
  $("backup-reminder").hidden = !needsReminder;
  $("backup-reminder-text").textContent =
    days === null ? "لم تحفظ نسخة احتياطية من مصاريفك بعد." : `مرّ ${days} يوم على آخر نسخة احتياطية.`;
}

// على الجوال نفتح قائمة المشاركة (حفظ في الملفات، واتساب...). على الكمبيوتر نحمّل الملف مباشرة
async function deliverFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  if (isTouch && navigator.canShare) {
    const file = new File([blob], filename, { type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return true;
      } catch (err) {
        if (err.name === "AbortError") return false;
        // إذا فشلت المشاركة لأي سبب آخر نجرّب التحميل العادي
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

async function exportBackup() {
  const backup = {
    app: BACKUP_APP_NAME,
    version: 3,
    exportedAt: new Date().toISOString(),
    categories,
    expenses,
    jamiyas,
    loans,
    seasons,
    budgets,
    recurring,
    groups: customGroups,
    methods,
    incomes,
    goals,
  };
  const saved = await deliverFile(
    JSON.stringify(backup, null, 2),
    `masarifi-backup-${todayString()}.json`,
    "application/json"
  );
  if (saved) {
    try {
      localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString());
    } catch {
      // لا مشكلة: سيظهر التذكير مرة أخرى فقط
    }
    renderBackupStatus();
  }
}

// ملف CSV يفتحه Excel بالعربية بشكل صحيح (العلامة \uFEFF في البداية ضرورية لذلك)
function exportCsv() {
  if (expenses.length === 0) {
    alert("لا توجد مصاريف لتصديرها.");
    return;
  }
  const cell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const worthText = { yes: "يستحق", no: "ندمت" };
  const rows = [["التاريخ", "التصنيف", "المبلغ (د.ع)", "طريقة الدفع", "ملاحظة", "هل كان يستحق؟"].map(cell).join(",")];
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const e of sorted) {
    rows.push(
      [e.date, getCategory(e.categoryId).name, e.amount, getMethod(e.method).name, e.note || "", worthText[e.worth] || ""].map(cell).join(",")
    );
  }
  if (incomes.length) {
    rows.push("", ["التاريخ", "الدخل", "المبلغ (د.ع)", "استلمته عبر", "ملاحظة"].map(cell).join(","));
    for (const i of [...incomes].sort((a, b) => a.date.localeCompare(b.date))) {
      rows.push([i.date, getIncomeType(i.type).name, i.amount, getMethod(i.method).name, i.note || ""].map(cell).join(","));
    }
  }
  deliverFile("\uFEFF" + rows.join("\r\n"), `masarifi-${todayString()}.csv`, "text/csv");
}

function sanitizeIncome(i) {
  if (!i || !Number.isFinite(i.id) || !(i.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return null;
  return {
    id: i.id,
    amount: Math.round(i.amount),
    type: INCOME_TYPES.some((t) => t.id === i.type) ? i.type : "other-in",
    date: i.date,
    note: typeof i.note === "string" ? i.note.slice(0, 200) : "",
    ...(typeof i.method === "string" ? { method: i.method } : {}),
    ...(typeof i.recurringId === "string" ? { recurringId: i.recurringId } : {}),
  };
}

// التحقق من ملف النسخة الاحتياطية وتنظيفه قبل استخدامه
function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("الملف ليس نسخة احتياطية صالحة.");
  }
  if (!data || data.app !== BACKUP_APP_NAME || !Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
    throw new Error("هذا الملف ليس نسخة احتياطية من تطبيق مصاريفي.");
  }

  const backupGroups = Array.isArray(data.groups) ? data.groups.map(sanitizeGroup).filter(Boolean) : null;
  const backupGroupIds = new Set((backupGroups || []).map((g) => g.id));
  const cats = [];
  for (const c of data.categories) {
    if (!c || typeof c.id !== "string" || typeof c.name !== "string" || !c.name.trim()) continue;
    if (cats.some((x) => x.id === c.id)) continue;
    cats.push({
      id: c.id,
      name: c.name.trim().slice(0, 30),
      // نسخة قديمة: الأيقونة رمز تعبيري والمجموعة غير موجودة، فينقلها migrateToGroups في الأسفل
      icon: CATEGORY_ICON_CHOICES.includes(c.icon) || DEFAULT_CATEGORIES.some((d) => d.icon === c.icon) ? c.icon : "tag",
      ...(GROUPS.some((g) => g.id === c.group) || backupGroupIds.has(c.group) ? { group: c.group } : {}),
    });
  }

  const exps = [];
  let skipped = 0;
  for (const e of data.expenses) {
    const valid =
      e && Number.isFinite(e.id) && Number.isFinite(e.amount) && e.amount > 0 &&
      typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.categoryId === "string";
    if (!valid || exps.some((x) => x.id === e.id)) {
      skipped++;
      continue;
    }
    exps.push({
      id: e.id,
      amount: Math.round(e.amount),
      categoryId: e.categoryId,
      date: e.date,
      note: typeof e.note === "string" ? e.note.slice(0, 200) : "",
      ...(["yes", "no", "skip"].includes(e.worth) ? { worth: e.worth } : {}),
      ...(typeof e.recurringId === "string" ? { recurringId: e.recurringId } : {}),
      ...(typeof e.jamiyaId === "string" ? { jamiyaId: e.jamiyaId } : {}),
      ...(typeof e.method === "string" ? { method: e.method } : {}),
      ...(typeof e.goalId === "string" ? { goalId: e.goalId } : {}),
    });
  }

  // النسخ القديمة (قبل المرحلة 5) ليس فيها سلف وديون: null تعني "اتركها كما هي"
  const cleanList = (list, sanitize) => (Array.isArray(list) ? list.map(sanitize).filter(Boolean) : null);

  const backup = {
    categories: cats,
    expenses: exps,
    jamiyas: cleanList(data.jamiyas, sanitizeJamiya),
    loans: cleanList(data.loans, sanitizeLoan),
    seasons: cleanList(data.seasons, sanitizeSeason),
    budgets: sanitizeBudgets(data.budgets),
    groups: backupGroups,
    methods: cleanList(data.methods, sanitizeMethod),
    incomes: cleanList(data.incomes, sanitizeIncome),
    goals: cleanList(data.goals, sanitizeGoal),
    recurring: cleanList(data.recurring, sanitizeRecurring),
    skipped,
    exportedAt: data.exportedAt,
  };
  // التصنيفات القديمة (قبل المجموعات) تُنقل إلى التصنيفات الجديدة كما حدث لبيانات الجوال
  migrateToGroups(backup);
  for (const c of backup.categories) c.group = c.group || "other";
  return backup;
}

// "سلفة واحدة"، "سلفتان"، "3 سلف" · "دين واحد"، "دينان"، "3 ديون"
function countJamiyas(n) {
  return n === 0 ? "0 سلفة" : n === 1 ? "سلفة واحدة" : countWord(n, "سلفة", "سلفتان", "سلف");
}

function countLoans(n) {
  return n === 0 ? "0 دين" : n === 1 ? "دين واحد" : countWord(n, "دين", "دينان", "ديون");
}

function showImportDialog(backup) {
  pendingImport = backup;
  const date = new Date(backup.exportedAt);
  const dateText = isNaN(date) ? "" : ` (محفوظة في ${date.toLocaleDateString("ar-IQ-u-nu-latn")})`;
  const total = backup.expenses.reduce((s, e) => s + e.amount, 0);
  let summary = `النسخة${dateText} فيها ${backup.expenses.length} مصروف بمجموع ${formatMoney(total)}، و${backup.categories.length} تصنيف.`;
  if (backup.jamiyas?.length || backup.loans?.length) {
    summary += `\nوفيها أيضاً ${countJamiyas(backup.jamiyas.length)} و${countLoans(backup.loans.length)}.`;
  }
  if (backup.skipped) summary += `\nتم تجاهل ${backup.skipped} مصروف غير صالح.`;
  $("import-summary").textContent = summary;
  importDialog.showModal();
}

function mergeImport(backup) {
  // ربط تصنيفات النسخة بتصنيفاتي: بالرقم نفسه، أو بالاسم نفسه، وإلا يُضاف تصنيف جديد
  const idMap = {};
  for (const cat of backup.categories) {
    const sameId = categories.find((c) => c.id === cat.id);
    const sameName = categories.find((c) => normalize(c.name) === normalize(cat.name));
    if (sameId) idMap[cat.id] = sameId.id;
    else if (sameName) idMap[cat.id] = sameName.id;
    else {
      categories.push({ ...cat });
      idMap[cat.id] = cat.id;
    }
  }

  const existingIds = new Set(expenses.map((e) => e.id));
  let added = 0;
  for (const e of backup.expenses) {
    if (existingIds.has(e.id)) continue;
    expenses.push({ ...e, categoryId: idMap[e.categoryId] || OTHER_ID });
    added++;
  }

  // السلف والديون: يُضاف الجديد فقط، ودفعات الدين الموجود تُدمج
  let addedJamiyas = 0;
  let addedLoans = 0;
  for (const j of backup.jamiyas || []) {
    if (jamiyas.some((x) => x.id === j.id)) continue;
    jamiyas.push(j);
    addedJamiyas++;
  }
  for (const loan of backup.loans || []) {
    const existing = loans.find((x) => x.id === loan.id);
    if (!existing) {
      loans.push(loan);
      addedLoans++;
      continue;
    }
    for (const payment of loan.payments) {
      if (!existing.payments.some((x) => x.id === payment.id)) existing.payments.push(payment);
    }
  }
  // المواسم: تُضاف المواسم غير الموجودة فقط
  for (const season of backup.seasons || []) {
    if (!seasons.some((x) => x.id === season.id)) seasons.push(season);
  }
  // الأهداف: يُضاف الهدف الجديد، وإضافات الهدف الموجود تُدمج
  let addedGoals = 0;
  for (const goal of backup.goals || []) {
    const mine = goals.find((x) => x.id === goal.id);
    if (!mine) {
      goals.push(goal);
      addedGoals++;
    } else for (const a of goal.allocations) if (!mine.allocations.some((x) => x.id === a.id)) mine.allocations.push(a);
  }
  // الدخل وطرق الدفع والمجموعات: يُضاف غير الموجود
  let addedIncomes = 0;
  for (const inc of backup.incomes || []) {
    if (incomes.some((x) => x.id === inc.id)) continue;
    incomes.push(inc);
    addedIncomes++;
  }
  for (const m of backup.methods || []) {
    if (!methods.some((x) => x.id === m.id)) methods.push(m);
  }
  for (const g of backup.groups || []) {
    if (!customGroups.some((x) => x.id === g.id)) customGroups.push(g);
  }
  applyCustomGroups(customGroups);
  // المصاريف الثابتة: تُضاف غير الموجودة، والميزانية تؤخذ من النسخة فقط إذا لم تضع ميزانية بعد
  for (const r of backup.recurring || []) {
    if (!recurring.some((x) => x.id === r.id)) recurring.push({ ...r, categoryId: idMap[r.categoryId] || OTHER_ID });
  }
  const hasBudget = budgets.total || Object.keys(budgets.byCategory).length;
  if (backup.budgets && !hasBudget) {
    budgets = { total: backup.budgets.total, byCategory: {} };
    for (const [id, amount] of Object.entries(backup.budgets.byCategory)) {
      if (idMap[id]) budgets.byCategory[idMap[id]] = amount;
    }
  }
  categories = sortCategories(categories);
  return { expenses: added, jamiyas: addedJamiyas, loans: addedLoans, incomes: addedIncomes, goals: addedGoals };
}

function replaceWithImport(backup) {
  if (backup.incomes) incomes = backup.incomes;
  if (backup.goals) goals = backup.goals;
  if (backup.methods) {
    methods = backup.methods;
    if (!methods.some((m) => m.id === CASH_ID)) methods.unshift({ ...DEFAULT_METHODS[0] });
  }
  if (backup.groups) {
    customGroups = backup.groups;
    applyCustomGroups(customGroups);
  }
  categories = backup.categories.map((c) => ({ ...c, group: GROUPS.some((g) => g.id === c.group) ? c.group : "other" }));
  ensureOtherCategory();
  ensureSystemCategories();
  const ids = new Set(categories.map((c) => c.id));
  expenses = backup.expenses.map((e) => ({ ...e, categoryId: ids.has(e.categoryId) ? e.categoryId : OTHER_ID }));
  if (backup.jamiyas) jamiyas = backup.jamiyas;
  if (backup.loans) loans = backup.loans;
  if (backup.seasons) seasons = backup.seasons;
  if (backup.budgets) budgets = backup.budgets;
  if (backup.recurring) {
    recurring = backup.recurring.map((r) => ({ ...r, categoryId: ids.has(r.categoryId) ? r.categoryId : OTHER_ID }));
  }
  categories = sortCategories(categories);
}

$("export-backup").addEventListener("click", exportBackup);
$("backup-now").addEventListener("click", exportBackup);
$("export-csv").addEventListener("click", exportCsv);
$("import-backup").addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  importFileInput.value = "";
  if (!file) return;
  try {
    showImportDialog(parseBackup(await file.text()));
  } catch (err) {
    alert(err.message);
  }
});

$("import-merge").addEventListener("click", () => {
  const added = mergeImport(pendingImport);
  save();
  render();
  importDialog.close();
  const parts = [];
  if (added.expenses) parts.push(`${added.expenses} مصروف`);
  if (added.jamiyas) parts.push(countJamiyas(added.jamiyas));
  if (added.loans) parts.push(countLoans(added.loans));
  if (added.incomes) parts.push(`${added.incomes} دخل`);
  if (added.goals) parts.push(countWord(added.goals, "هدف", "هدفين", "أهداف"));
  alert(parts.length ? `تمت إضافة ${parts.join(" و")}.` : "كل ما في النسخة موجود لديك مسبقاً.");
});

$("import-replace").addEventListener("click", () => {
  if (!confirm("سيتم حذف كل بياناتك الحالية واستبدالها بالنسخة. هل أنت متأكد؟")) return;
  replaceWithImport(pendingImport);
  save();
  render();
  importDialog.close();
  alert(`تم الاسترجاع: ${expenses.length} مصروف و${countJamiyas(jamiyas.length)} و${countLoans(loans.length)}.`);
});

importDialog.addEventListener("close", () => {
  pendingImport = null;
});

// ===== إغلاق النوافذ =====

function setupDialog(dialog) {
  dialog.querySelector(".close-btn").addEventListener("click", () => dialog.close());
  // إغلاق النافذة عند الضغط خارجها (على الخلفية المعتمة فقط)
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right &&
      event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}

[expenseDialog, categoriesDialog, importDialog, workDialog, groupDialog, quickCategoryDialog, $("methods-dialog")].forEach(setupDialog);

// ===== إخفاء المبالغ =====

function applyPrivacy() {
  const btn = $("privacy-toggle");
  btn.setAttribute("aria-pressed", String(privacy));
  btn.setAttribute("aria-label", privacy ? "إظهار المبالغ" : "إخفاء المبالغ");
  btn.replaceChildren(icon(privacy ? "eye-off" : "eye"));
  btn.classList.toggle("on", privacy);
}

$("privacy-toggle").addEventListener("click", () => {
  privacy = !privacy;
  try {
    localStorage.setItem(PRIVACY_KEY, privacy ? "1" : "0");
  } catch {
    // يبقى الإعداد لهذه الجلسة فقط
  }
  applyPrivacy();
  render();
  // تحديث صفحة السلفة والديون والمواسم أيضاً
  document.dispatchEvent(new Event("data-changed"));
  showToast(privacy ? "المبالغ مخفية" : "المبالغ ظاهرة");
});
applyPrivacy();

// أول عرض بعد تحميل كل الملفات، لأن العرض يستخدم دوال من planning.js
document.addEventListener("DOMContentLoaded", render);

// تشغيل التطبيق بدون إنترنت (يعمل فقط عند فتحه من رابط https)
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js");
}
