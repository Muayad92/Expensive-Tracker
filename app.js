// مفاتيح التخزين في المتصفح
const STORAGE_KEY = "expenses";
const CATEGORIES_KEY = "categories";

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
  } catch {
    alert("تعذّر حفظ البيانات في المتصفح.");
  }
}

let expenses = load(STORAGE_KEY) || [];
let categories = load(CATEGORIES_KEY) || DEFAULT_CATEGORIES.map((c) => ({ ...c }));

if (!categories.some((c) => c.id === OTHER_ID)) {
  categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === OTHER_ID) });
}

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

// ===== أدوات مساعدة =====

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
  return new Date(y, m - 1, 1).toLocaleDateString("ar-IQ-u-nu-latn", { month: "long", year: "numeric" });
}

// الدينار العراقي بدون كسور وبفواصل الآلاف: 25,000 د.ع
function formatMoney(value) {
  return `${Math.round(value).toLocaleString("en-US")} د.ع`;
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

  // الترويسة
  monthNameEl.textContent = monthLabel(viewMonth);
  monthTotalEl.textContent = formatMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));
  thisMonthBtn.hidden = viewMonth === currentMonth;

  renderCategoryTotals(monthExpenses);

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

  const info = el("div", "expense-info");
  info.append(
    el("div", "expense-category", `${cat.icon} ${cat.name}`),
    el("div", "expense-meta", exp.note ? `${exp.date} · ${exp.note}` : exp.date)
  );

  const btn = el("button", "delete-btn", "🗑");
  btn.type = "button";
  btn.setAttribute("aria-label", "حذف");
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteExpense(exp.id);
  });

  item.append(info, el("div", "expense-amount", formatMoney(exp.amount)), btn);
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
  entries.forEach(([id, sum], i) => {
    const cat = getCategory(id);
    const li = el("li");
    li.append(el("span", "", `${cat.icon} ${cat.name}`), el("strong", "", `${formatMoney(sum)} · ${percents[i]}%`));
    categoryTotalsEl.appendChild(li);
  });
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
  fillCategorySelect(exp ? exp.categoryId : categories[0].id);

  if (exp) {
    amountInput.value = exp.amount.toLocaleString("en-US");
    dateInput.value = exp.date;
    noteInput.value = exp.note || "";
  } else {
    // عند إضافة مصروف لشهر سابق، نقترح أول يوم من ذلك الشهر
    const today = todayString();
    dateInput.value = today.startsWith(viewMonth) ? today : `${viewMonth}-01`;
  }

  expenseDialog.showModal();
  if (!exp) amountInput.focus();
}

function deleteExpense(id) {
  if (!confirm("هل تريد حذف هذا المصروف؟")) return false;
  expenses = expenses.filter((e) => e.id !== id);
  save();
  render();
  return true;
}

// تنسيق المبلغ بفواصل الآلاف أثناء الكتابة
amountInput.addEventListener("input", () => {
  const digits = toDigits(amountInput.value).replace(/^0+/, "");
  amountInput.value = digits ? Number(digits).toLocaleString("en-US") : "";
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
  } else {
    expenses.push({ id: Date.now(), ...data });
  }

  // الانتقال إلى شهر المصروف حتى يراه المستخدم
  viewMonth = data.date.slice(0, 7);
  save();
  render();
  expenseDialog.close();
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
      const delBtn = el("button", "delete-btn", "🗑");
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

// ===== إغلاق النوافذ =====

for (const dialog of [expenseDialog, categoriesDialog]) {
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

render();

// تشغيل التطبيق بدون إنترنت (يعمل فقط عند فتحه من رابط https)
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js");
}
