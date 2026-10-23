// مفتاح التخزين في المتصفح
const STORAGE_KEY = "expenses";

const form = document.getElementById("expense-form");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const listEl = document.getElementById("expense-list");
const tableEl = document.getElementById("expense-table");
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

function formatMoney(value) {
  return value.toLocaleString("ar", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// عرض كل شيء على الصفحة
function render() {
  // القائمة (الأحدث أولاً)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  listEl.innerHTML = "";
  for (const exp of sorted) {
    const row = document.createElement("tr");

    for (const text of [exp.date, exp.category, formatMoney(exp.amount), exp.note]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "delete-btn";
    btn.textContent = "حذف";
    btn.addEventListener("click", () => deleteExpense(exp.id));
    actionCell.appendChild(btn);
    row.appendChild(actionCell);

    listEl.appendChild(row);
  }

  const hasItems = expenses.length > 0;
  tableEl.hidden = !hasItems;
  emptyEl.hidden = hasItems;

  // مجموع الشهر الحالي ومجموع كل تصنيف
  const currentMonth = todayString().slice(0, 7); // YYYY-MM
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));

  monthNameEl.textContent = new Date().toLocaleDateString("ar", { month: "long", year: "numeric" });
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

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = parseFloat(amountInput.value);
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

  form.reset();
  dateInput.value = todayString();
  amountInput.focus();
});

dateInput.value = todayString();
render();
