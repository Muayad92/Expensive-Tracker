// مفتاح التخزين في المتصفح
const STORAGE_KEY = "expenses";

const form = document.getElementById("expense-form");
const dialog = document.getElementById("expense-dialog");
const addBtn = document.getElementById("add-btn");
const closeBtn = document.getElementById("close-btn");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const listEl = document.getElementById("expense-list");
const emptyEl = document.getElementById("empty-message");
const monthNameEl = document.getElementById("month-name");
const monthTotalEl = document.getElementById("month-total");
const categoryTotalsEl = document.getElementById("category-totals");

// تحميل المصاريف المحفوظة
function loadExpenses() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// حفظ المصاريف
function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch {
    alert("تعذّر حفظ البيانات في المتصفح.");
  }
}

let expenses = loadExpenses();

// تاريخ اليوم بصيغة YYYY-MM-DD حسب التوقيت المحلي
function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
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

// تنسيق المبلغ بفواصل الآلاف أثناء الكتابة
amountInput.addEventListener("input", () => {
  const digits = toDigits(amountInput.value).replace(/^0+/, "");
  amountInput.value = digits ? Number(digits).toLocaleString("en-US") : "";
});

// عرض كل شيء على الصفحة
function render() {
  // القائمة (الأحدث أولاً)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  listEl.innerHTML = "";
  for (const exp of sorted) {
    const item = document.createElement("li");
    item.className = "expense-item";

    const info = document.createElement("div");
    info.className = "expense-info";
    const category = document.createElement("div");
    category.className = "expense-category";
    category.textContent = exp.category;
    const meta = document.createElement("div");
    meta.className = "expense-meta";
    meta.textContent = exp.note ? `${exp.date} · ${exp.note}` : exp.date;
    info.append(category, meta);

    const amount = document.createElement("div");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(exp.amount);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "delete-btn";
    btn.textContent = "🗑";
    btn.setAttribute("aria-label", "حذف");
    btn.addEventListener("click", () => deleteExpense(exp.id));

    item.append(info, amount, btn);
    listEl.appendChild(item);
  }

  emptyEl.hidden = expenses.length > 0;

  // مجموع الشهر الحالي ومجموع كل تصنيف
  const currentMonth = todayString().slice(0, 7); // YYYY-MM
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));

  monthNameEl.textContent = new Date().toLocaleDateString("ar-IQ-u-nu-latn", { month: "long", year: "numeric" });
  monthTotalEl.textContent = formatMoney(monthExpenses.reduce((sum, e) => sum + e.amount, 0));

  const byCategory = {};
  for (const e of monthExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  categoryTotalsEl.innerHTML = "";
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "لا توجد مصاريف في هذا الشهر.";
    categoryTotalsEl.appendChild(li);
  }
  for (const [category, total] of entries) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = category;
    const value = document.createElement("strong");
    value.textContent = formatMoney(total);
    li.append(name, value);
    categoryTotalsEl.appendChild(li);
  }
}

function deleteExpense(id) {
  if (!confirm("هل تريد حذف هذا المصروف؟")) return;
  expenses = expenses.filter((e) => e.id !== id);
  saveExpenses();
  render();
}

function openForm() {
  form.reset();
  dateInput.value = todayString();
  dialog.showModal();
  amountInput.focus();
}

addBtn.addEventListener("click", openForm);
closeBtn.addEventListener("click", () => dialog.close());

// إغلاق النافذة عند الضغط خارجها
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(toDigits(amountInput.value));
  if (!(amount > 0)) {
    alert("الرجاء إدخال مبلغ صحيح أكبر من صفر.");
    return;
  }

  expenses.push({
    id: Date.now(),
    amount,
    category: categoryInput.value,
    date: dateInput.value,
    note: noteInput.value.trim(),
  });
  saveExpenses();
  render();
  dialog.close();
});

render();

// تشغيل التطبيق بدون إنترنت (يعمل فقط عند فتحه من رابط https)
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js");
}
