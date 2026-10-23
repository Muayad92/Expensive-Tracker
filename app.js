// مفاتيح التخزين في المتصفح
const STORAGE_KEY = "expenses";
const CATEGORIES_KEY = "categories";
const JAMIYAS_KEY = "jamiyas";
const LOANS_KEY = "loans";
const SEASONS_KEY = "seasons";
const BUDGETS_KEY = "budgets";
const RECURRING_KEY = "recurring";

// تصنيف "أخرى" لا يُحذف، وتنتقل إليه مصاريف أي تصنيف محذوف
const OTHER_ID = "other";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "طعام", icon: "🍽️" },
  { id: "transport", name: "مواصلات", icon: "🚕" },
  { id: "housing", name: "سكن", icon: "🏠" },
  { id: "bills", name: "فواتير", icon: "🧾" },
  { id: "health", name: "صحة", icon: "💊" },
  { id: "fun", name: "ترفيه", icon: "🎮" },
  { id: "shopping", name: "تسوق", icon: "🛍️" },
  { id: OTHER_ID, name: "أخرى", icon: "📦" },
];

const ICON_CHOICES = [
  "🍽️", "☕", "🛒", "🚕", "⛽", "🏠", "💡", "🧾", "📱", "💊", "🎓", "👶",
  "👕", "🛍️", "🎮", "✈️", "🎁", "🕌", "🤝", "🐑", "🔧", "🚗", "💇", "📦",
];

const $ = (id) => document.getElementById(id);

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    localStorage.setItem(JAMIYAS_KEY, JSON.stringify(jamiyas));
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    if (seasons) localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    localStorage.setItem(RECURRING_KEY, JSON.stringify(recurring));
  } catch {
    alert("تعذّر حفظ البيانات في المتصفح.");
  }
  // تُحدَّث صفحة السلفة والديون عند أي تغيير في البيانات
  document.dispatchEvent(new Event("data-changed"));
}

let expenses = load(STORAGE_KEY) || [];
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
    cat = { id: newId(), name: e.category || "أخرى", icon: "🏷️" };
    categories.splice(categories.findIndex((c) => c.id === OTHER_ID), 0, cat);
  }
  e.categoryId = cat.id;
  delete e.category;
  migrated = true;
}
if (migrated) save();

// ===== ألوان القرص الدائري =====

// 8 ألوان مختبرة لعمى الألوان (معرّفة في style.css باسم --series-1 إلى --series-8،
// ولها درجات خاصة بالوضع الليلي). كل تصنيف يأخذ لوناً ثابتاً (colorSlot) يبقى معه دائماً،
// حتى لا تتغير ألوان التصنيفات عند تغيّر ترتيبها أو حذف غيرها
const CHART_SLOTS = 8;
const CHART_REST_COLOR = "var(--series-rest)"; // رمادي لـ "باقي التصنيفات"

function assignColorSlots() {
  const used = new Set(categories.map((c) => c.colorSlot).filter((n) => Number.isInteger(n)));
  // كل لون يُعطى لتصنيف واحد فقط (احتياطاً لو تكرر بعد استرجاع نسخة)
  for (const cat of categories) {
    if (!Number.isInteger(cat.colorSlot)) continue;
    if (categories.find((c) => c.colorSlot === cat.colorSlot) !== cat) delete cat.colorSlot;
  }
  for (const cat of categories) {
    if (Number.isInteger(cat.colorSlot)) continue;
    const free = [...Array(CHART_SLOTS).keys()].findIndex((i) => !used.has(i));
    if (free === -1) return; // نفدت الألوان: التصنيفات الباقية تظهر ضمن "باقي التصنيفات"
    cat.colorSlot = free;
    used.add(free);
  }
}
assignColorSlots();

function categoryColor(id) {
  const slot = getCategory(id).colorSlot;
  return Number.isInteger(slot) ? `var(--series-${slot + 1})` : null;
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
  return Math.max(Date.now(), ...expenses.map((e) => e.id + 1));
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

// الدينار العراقي بدون كسور وبفواصل الآلاف: 25,000 د.ع
function formatMoney(value) {
  return `${Math.round(value).toLocaleString("en-US")} د.ع`;
}

// المبلغ كبيراً و"د.ع" بعده بخط أصغر
function setMoney(element, value) {
  element.replaceChildren(
    document.createTextNode(Math.round(value).toLocaleString("en-US")),
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
let chosenIcon = "🏷️";

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

  renderBudgetSummary(monthExpenses);
  renderQuickAdd();
  renderRegretAsk();
  renderCategoryTotals(monthExpenses);
  renderRegretStats(monthExpenses);

  // القائمة: نتائج البحث من كل الأشهر، أو مصاريف الشهر المختار
  let shown;
  if (query) {
    shown = expenses.filter((e) => {
      const cat = getCategory(e.categoryId);
      return normalize(e.note || "").includes(query) || normalize(cat.name).includes(query);
    });
    listTitleEl.textContent = "نتائج البحث";
    searchSummaryEl.hidden = false;
    searchSummaryEl.textContent = `${shown.length} نتيجة · المجموع ${formatMoney(shown.reduce((s, e) => s + e.amount, 0))}`;
    emptyEl.textContent = "لا توجد نتائج.";
  } else {
    shown = monthExpenses;
    listTitleEl.textContent = `مصاريف ${monthLabel(viewMonth)}`;
    searchSummaryEl.hidden = true;
    emptyEl.innerHTML = expenses.length
      ? "لا توجد مصاريف في هذا الشهر."
      : "لا توجد مصاريف بعد.<br>اضغط زر <strong>+</strong> لإضافة أول مصروف.";
  }

  shown.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  listEl.innerHTML = "";
  for (const exp of shown) listEl.appendChild(renderExpense(exp));

  emptyEl.hidden = shown.length > 0;
  editHintEl.hidden = shown.length === 0;
}

function renderExpense(exp) {
  const cat = getCategory(exp.categoryId);
  const item = el("li", "expense-item");
  item.tabIndex = 0;
  item.addEventListener("click", () => openForm(exp));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openForm(exp);
  });

  // أيقونة التصنيف داخل دائرة بلونه
  const badge = el("span", "cat-icon", cat.icon);
  const color = categoryColor(cat.id);
  if (color) badge.style.setProperty("--c", color);

  const info = el("div", "expense-info");
  const title = el("div", "expense-category", cat.name);
  if (exp.worth === "no") title.appendChild(el("span", "tag bad", "ندمت"));
  if (exp.worth === "yes") title.appendChild(el("span", "tag good", "يستحق"));
  if (exp.recurringId) title.appendChild(el("span", "tag", "ثابت"));
  info.append(title, el("div", "expense-meta", exp.note ? `${exp.date} · ${exp.note}` : exp.date));

  const amount = el("div", "expense-amount", Math.round(exp.amount).toLocaleString("en-US"));
  if (work) amount.appendChild(el("div", "expense-hours", workTime(exp.amount)));

  const btn = el("button", "delete-btn");
  btn.type = "button";
  btn.setAttribute("aria-label", "حذف");
  btn.appendChild(icon("trash-2"));
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteExpense(exp.id);
  });

  item.append(badge, info, amount, btn);
  return item;
}

function renderCategoryTotals(monthExpenses) {
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  for (const e of monthExpenses) {
    const id = getCategory(e.categoryId).id;
    byCategory[id] = (byCategory[id] || 0) + e.amount;
  }

  categoryTotalsEl.innerHTML = "";
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    categoryTotalsEl.appendChild(el("li", "", "لا توجد مصاريف في هذا الشهر."));
  }
  const percents = roundedPercents(entries.map(([, sum]) => sum), total);
  const slices = pieSlices(entries, total);
  const restIds = new Set(slices.find((s) => s.rest)?.ids || []);

  entries.forEach(([id, sum], i) => {
    const cat = getCategory(id);
    const li = el("li", "category-total");
    li.dataset.slice = restIds.has(id) ? "rest" : id;
    // مربع اللون يربط السطر بشريحته في القرص (والنص يبقى بلونه العادي)
    const swatch = el("span", "swatch");
    swatch.style.background = restIds.has(id) ? CHART_REST_COLOR : categoryColor(id);
    const name = el("span", "category-name");
    name.append(swatch, document.createTextNode(`${cat.icon} ${cat.name}`));
    li.append(name, el("strong", "", `${formatMoney(sum)} · ${percents[i]}%`));
    const budgetRow = categoryBudgetRow(id, sum);
    if (budgetRow) li.appendChild(budgetRow);
    li.addEventListener("click", () => highlightSlice(li.dataset.slice === activeSlice ? null : li.dataset.slice));
    categoryTotalsEl.appendChild(li);
  });

  renderPie(slices, total);
}

// ===== القرص الدائري =====

// 6 شرائح كحد أقصى حتى يبقى القرص مقروءاً: الأكبر بألوانها، والباقي شريحة رمادية واحدة
const PIE_MAX_SLICES = 6;
let activeSlice = null;

function pieSlices(entries, total) {
  const limit = entries.length > PIE_MAX_SLICES ? PIE_MAX_SLICES - 1 : PIE_MAX_SLICES;
  const slices = [];
  const rest = { id: "rest", rest: true, ids: [], sum: 0, color: CHART_REST_COLOR, label: "باقي التصنيفات" };
  for (const [id, sum] of entries) {
    const color = categoryColor(id);
    if (color && slices.length < limit) {
      const cat = getCategory(id);
      slices.push({ id, sum, color, label: `${cat.icon} ${cat.name}` });
    } else {
      rest.ids.push(id);
      rest.sum += sum;
    }
  }
  if (rest.sum > 0) slices.push(rest);
  const percents = roundedPercents(slices.map((s) => s.sum), total);
  slices.forEach((s, i) => (s.percent = percents[i]));
  return slices;
}

function renderPie(slices, total) {
  const wrap = $("pie-wrap");
  const svg = $("pie");
  // شريحة واحدة ليست قرصاً مفيداً: المجموع وحده يكفي
  wrap.hidden = slices.length < 2;
  svg.innerHTML = "";
  activeSlice = null;
  $("pie-caption").textContent = "اضغط على أي شريحة لمعرفة تفاصيلها";
  if (wrap.hidden) return;

  const NS = "http://www.w3.org/2000/svg";
  const r = 96;
  let angle = -Math.PI / 2; // نبدأ من الأعلى ونمشي مع عقارب الساعة
  for (const slice of slices) {
    const sweep = (slice.sum / total) * Math.PI * 2;
    const x1 = r * Math.cos(angle);
    const y1 = r * Math.sin(angle);
    const x2 = r * Math.cos(angle + sweep);
    const y2 = r * Math.sin(angle + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
    path.style.fill = slice.color;
    path.setAttribute("class", "pie-slice");
    path.dataset.slice = slice.id;
    const title = document.createElementNS(NS, "title");
    title.textContent = `${slice.label}: ${formatMoney(slice.sum)} (${slice.percent}%)`;
    path.appendChild(title);
    path.addEventListener("click", () => highlightSlice(activeSlice === slice.id ? null : slice.id));
    svg.appendChild(path);
    angle += sweep;
  }
  svg.setAttribute("aria-label", slices.map((s) => `${s.label} ${s.percent}%`).join("، "));
  svg.slices = slices;
}

// إبراز شريحة وسطرها في القائمة، وإظهار تفاصيلها تحت القرص
function highlightSlice(id) {
  activeSlice = id;
  const svg = $("pie");
  for (const path of svg.querySelectorAll(".pie-slice")) {
    path.classList.toggle("dimmed", id !== null && path.dataset.slice !== id);
  }
  for (const li of categoryTotalsEl.querySelectorAll(".category-total")) {
    li.classList.toggle("active", id !== null && li.dataset.slice === id);
  }
  const slice = (svg.slices || []).find((s) => s.id === id);
  $("pie-caption").textContent = slice
    ? `${slice.label}: ${formatMoney(slice.sum)} · ${slice.percent}%`
    : "اضغط على أي شريحة لمعرفة تفاصيلها";
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

// قائمة التصنيفات داخل نموذج المصروف
function fillCategorySelect(selectedId) {
  categoryInput.innerHTML = "";
  for (const cat of categories) {
    const option = el("option", "", `${cat.icon} ${cat.name}`);
    option.value = cat.id;
    categoryInput.appendChild(option);
  }
  categoryInput.value = getCategory(selectedId)?.id || categories[0].id;
}

// ===== إضافة وتعديل وحذف المصاريف =====

function openForm(exp) {
  form.reset();
  editingId = exp ? exp.id : null;
  formTitle.textContent = exp ? "تعديل مصروف" : "إضافة مصروف";
  deleteInFormBtn.hidden = !exp;
  // التقييم يظهر عند التعديل فقط، حتى تبقى الإضافة سريعة
  worthField.hidden = !exp;
  // التكرار الشهري يُختار عند الإضافة فقط
  $("recurring-row").hidden = Boolean(exp);
  fillCategorySelect(exp ? exp.categoryId : categories[0].id);

  if (exp) {
    amountInput.value = exp.amount.toLocaleString("en-US");
    dateInput.value = exp.date;
    noteInput.value = exp.note || "";
    const worth = exp.worth === "yes" || exp.worth === "no" ? exp.worth : "";
    form.querySelector(`input[name="worth"][value="${worth}"]`).checked = true;
  } else {
    // عند إضافة مصروف لشهر سابق، نقترح أول يوم من ذلك الشهر
    const today = todayString();
    dateInput.value = today.startsWith(viewMonth) ? today : `${viewMonth}-01`;
  }

  updateAmountHours();
  expenseDialog.showModal();
  if (!exp) amountInput.focus();
}

// "= ساعتان عمل" تحت خانة المبلغ أثناء الكتابة
function updateAmountHours() {
  const amount = Number(toDigits(amountInput.value));
  amountHoursEl.hidden = !work || !(amount > 0);
  if (!amountHoursEl.hidden) amountHoursEl.textContent = `= ${workTime(amount)}`;
}

function deleteExpense(id) {
  if (!confirm("هل تريد حذف هذا المصروف؟")) return false;
  expenses = expenses.filter((e) => e.id !== id);
  save();
  render();
  return true;
}

// تنسيق المبلغ بفواصل الآلاف أثناء الكتابة
function formatMoneyInput(input) {
  const digits = toDigits(input.value).replace(/^0+/, "");
  input.value = digits ? Number(digits).toLocaleString("en-US") : "";
}

amountInput.addEventListener("input", () => {
  formatMoneyInput(amountInput);
  updateAmountHours();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(toDigits(amountInput.value));
  if (!(amount > 0)) {
    alert("الرجاء إدخال مبلغ صحيح أكبر من صفر.");
    return;
  }

  const data = {
    amount,
    categoryId: categoryInput.value,
    date: dateInput.value,
    note: noteInput.value.trim(),
  };

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
  if (editingId === null) notifyBudget(data);
});

deleteInFormBtn.addEventListener("click", () => {
  if (deleteExpense(editingId)) expenseDialog.close();
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
  categoryListEl.innerHTML = "";
  for (const cat of categories) {
    const count = expenses.filter((e) => e.categoryId === cat.id).length;
    const li = el("li", "category-row");
    li.append(el("span", "category-row-name", `${cat.icon} ${cat.name}`), el("span", "category-count", `${count} مصروف`));

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

function renderIconPicker() {
  iconPickerEl.innerHTML = "";
  for (const icon of ICON_CHOICES) {
    const btn = el("button", icon === chosenIcon ? "icon-choice selected" : "icon-choice", icon);
    btn.type = "button";
    btn.addEventListener("click", () => {
      chosenIcon = icon;
      chosenIconEl.textContent = icon;
      renderIconPicker();
    });
    iconPickerEl.appendChild(btn);
  }
}

function resetCategoryForm() {
  editingCategoryId = null;
  chosenIcon = "🏷️";
  chosenIconEl.textContent = chosenIcon;
  categoryNameInput.value = "";
  categoryFormTitle.textContent = "إضافة تصنيف جديد";
  categorySaveBtn.textContent = "إضافة";
  categoryCancelBtn.hidden = true;
  renderIconPicker();
}

function startEditCategory(cat) {
  editingCategoryId = cat.id;
  chosenIcon = cat.icon;
  chosenIconEl.textContent = cat.icon;
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
    alert(`يوجد تصنيف بهذا الاسم: ${duplicate.icon} ${duplicate.name}`);
    return;
  }

  if (editingCategoryId) {
    Object.assign(getCategory(editingCategoryId), { name, icon: chosenIcon });
  } else {
    // التصنيف الجديد يوضع قبل "أخرى"
    const otherIndex = categories.findIndex((c) => c.id === OTHER_ID);
    categories.splice(otherIndex, 0, { id: newId(), name, icon: chosenIcon });
    assignColorSlots();
  }

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
      return !e.worth && !e.recurringId && age >= REGRET_DELAY_DAYS && age <= REGRET_WINDOW_DAYS;
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
    el("strong", "", `${cat.icon} ${cat.name} · ${formatMoney(exp.amount)}`),
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
    content.appendChild(el("p", "regret-total good", "👏 لم تندم على أي مصروف قيّمته هذا الشهر"));
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
      li.append(el("span", "", `${cat.icon} ${cat.name}`), el("strong", "", formatMoney(sum)));
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
  else if (days === 0) status = "آخر نسخة احتياطية: اليوم ✅";
  else if (days === 1) status = "آخر نسخة احتياطية: أمس";
  else status = `آخر نسخة احتياطية: قبل ${days} يوم`;
  $("backup-status").textContent = status;

  const needsReminder =
    expenses.length >= BACKUP_REMIND_MIN_EXPENSES && (days === null || days >= BACKUP_REMIND_DAYS);
  $("backup-reminder").hidden = !needsReminder;
  $("backup-reminder-text").textContent =
    days === null ? "⚠️ لم تحفظ نسخة احتياطية من مصاريفك بعد." : `⚠️ مرّ ${days} يوم على آخر نسخة احتياطية.`;
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
  const rows = [["التاريخ", "التصنيف", "المبلغ (د.ع)", "ملاحظة", "هل كان يستحق؟"].map(cell).join(",")];
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const e of sorted) {
    rows.push(
      [e.date, getCategory(e.categoryId).name, e.amount, e.note || "", worthText[e.worth] || ""].map(cell).join(",")
    );
  }
  deliverFile("\uFEFF" + rows.join("\r\n"), `masarifi-${todayString()}.csv`, "text/csv");
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

  const cats = [];
  for (const c of data.categories) {
    if (!c || typeof c.id !== "string" || typeof c.name !== "string" || !c.name.trim()) continue;
    if (cats.some((x) => x.id === c.id)) continue;
    cats.push({
      id: c.id,
      name: c.name.trim().slice(0, 30),
      icon: typeof c.icon === "string" ? c.icon.slice(0, 8) : "🏷️",
      ...(Number.isInteger(c.colorSlot) && c.colorSlot >= 0 && c.colorSlot < CHART_SLOTS ? { colorSlot: c.colorSlot } : {}),
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
    });
  }

  // النسخ القديمة (قبل المرحلة 5) ليس فيها سلف وديون: null تعني "اتركها كما هي"
  const cleanList = (list, sanitize) => (Array.isArray(list) ? list.map(sanitize).filter(Boolean) : null);

  return {
    categories: cats,
    expenses: exps,
    jamiyas: cleanList(data.jamiyas, sanitizeJamiya),
    loans: cleanList(data.loans, sanitizeLoan),
    seasons: cleanList(data.seasons, sanitizeSeason),
    budgets: sanitizeBudgets(data.budgets),
    recurring: cleanList(data.recurring, sanitizeRecurring),
    skipped,
    exportedAt: data.exportedAt,
  };
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
      // التصنيف القادم من جهاز آخر يأخذ لوناً جديداً حتى لا يأخذ لون أحد تصنيفاتي
      const { colorSlot, ...rest } = cat;
      categories.splice(categories.findIndex((c) => c.id === OTHER_ID), 0, rest);
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
  assignColorSlots();
  return { expenses: added, jamiyas: addedJamiyas, loans: addedLoans };
}

function replaceWithImport(backup) {
  categories = backup.categories.map((c) => ({ ...c }));
  ensureOtherCategory();
  const ids = new Set(categories.map((c) => c.id));
  expenses = backup.expenses.map((e) => ({ ...e, categoryId: ids.has(e.categoryId) ? e.categoryId : OTHER_ID }));
  if (backup.jamiyas) jamiyas = backup.jamiyas;
  if (backup.loans) loans = backup.loans;
  if (backup.seasons) seasons = backup.seasons;
  if (backup.budgets) budgets = backup.budgets;
  if (backup.recurring) {
    recurring = backup.recurring.map((r) => ({ ...r, categoryId: ids.has(r.categoryId) ? r.categoryId : OTHER_ID }));
  }
  assignColorSlots();
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

[expenseDialog, categoriesDialog, importDialog, workDialog].forEach(setupDialog);

// أول عرض بعد تحميل كل الملفات، لأن العرض يستخدم دوال من planning.js
document.addEventListener("DOMContentLoaded", render);

// تشغيل التطبيق بدون إنترنت (يعمل فقط عند فتحه من رابط https)
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js");
}
