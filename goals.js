// أهداف الادخار (في صفحة السلفة والديون)
// يعتمد على app.js: goals و expenses و save و render و formatMoney و buildIconPicker ...

/*
  الهدف:
  { id, name, icon, target: المبلغ المطلوب, dueMonth: "YYYY-MM" أو "" ,
    allocations: [{ id, amount, date, note }] مبالغ أُضيفت من خارج المصاريف (مثل مبلغ السلفة عند استلامه) }
  ما يضيفه المستخدم من مصروفه يُسجَّل مصروفاً بتصنيف "إيداع لهدف" ومعه goalId،
  فيُخصم من مصروف الشهر ويُحسب ادخاراً (مثل قسط السلفة)
*/

// نحسب سرعة الادخار من آخر 3 أشهر
const GOAL_PACE_MONTHS = 3;

function goalContributions(goal) {
  const fromSpending = expenses
    .filter((e) => e.goalId === goal.id)
    .map((e) => ({ id: e.id, amount: e.amount, date: e.date, expense: true }));
  const allocated = goal.allocations.map((a) => ({ ...a, expense: false }));
  return [...fromSpending, ...allocated].sort((a, b) => b.date.localeCompare(a.date));
}

function goalInfo(goal) {
  const contributions = goalContributions(goal);
  const saved = contributions.reduce((s, c) => s + c.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const percent = Math.min(100, Math.round((saved / goal.target) * 100));

  let plan = "";
  if (remaining > 0 && goal.dueMonth) {
    const monthsLeft = monthsBetween(thisMonth(), goal.dueMonth) + 1;
    plan = monthsLeft > 0
      ? `تحتاج ${formatMoney(Math.ceil(remaining / monthsLeft / 1000) * 1000)} شهرياً لتصل في ${monthLabel(goal.dueMonth)}`
      : `فات موعد ${monthLabel(goal.dueMonth)} وبقي ${formatMoney(remaining)}`;
  } else if (remaining > 0) {
    // بمعدل آخر 3 أشهر
    const since = shiftMonth(thisMonth(), -(GOAL_PACE_MONTHS - 1));
    const recent = contributions.filter((c) => c.date.slice(0, 7) >= since).reduce((s, c) => s + c.amount, 0);
    const perMonth = recent / GOAL_PACE_MONTHS;
    if (perMonth > 0) {
      const months = Math.ceil(remaining / perMonth);
      plan = `بمعدلك الحالي (${formatMoney(Math.round(perMonth))} شهرياً) تصل بعد ${countWord(months, "شهر", "شهرين", "أشهر")}`;
    }
  }
  return { contributions, saved, remaining, percent, plan, done: remaining === 0 };
}

function sanitizeGoal(g) {
  if (!g || typeof g.id !== "string" || typeof g.name !== "string" || !g.name.trim() || !(g.target > 0)) return null;
  return {
    id: g.id,
    name: g.name.trim().slice(0, 30),
    icon: CATEGORY_ICON_CHOICES.includes(g.icon) ? g.icon : "target",
    target: Math.round(g.target),
    dueMonth: /^\d{4}-\d{2}$/.test(g.dueMonth) ? g.dueMonth : "",
    allocations: Array.isArray(g.allocations)
      ? g.allocations
          .filter((a) => a && typeof a.id === "string" && a.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(a.date))
          .map((a) => ({ id: a.id, amount: Math.round(a.amount), date: a.date, note: typeof a.note === "string" ? a.note.slice(0, 100) : "" }))
      : [],
  };
}

// ===== العرض =====

function renderGoals() {
  const list = $("goal-list");
  list.innerHTML = "";
  if (goals.length === 0) {
    list.appendChild(el("p", "empty", "لا توجد أهداف. أضف هدفاً مثل سيارة أو سفر وتابع تقدمك."));
    return;
  }
  for (const goal of goals) list.appendChild(renderGoal(goal));
}

function renderGoal(goal) {
  const info = goalInfo(goal);
  const box = el("div", info.done ? "goal done" : "goal");

  const head = el("div", "item-head");
  const title = el("strong", "loan-title");
  const badge = el("span", "cat-icon sm goal-icon");
  badge.appendChild(icon(goal.icon, "sm"));
  title.append(badge, goal.name);
  const edit = el("button", "small-btn", "تعديل");
  edit.type = "button";
  edit.addEventListener("click", () => openGoalForm(goal));
  head.append(title, edit);
  box.appendChild(head);

  const bar = el("div", "progress");
  const fill = el("div", "progress-fill");
  fill.style.width = `${info.percent}%`;
  bar.appendChild(fill);
  box.appendChild(bar);
  box.appendChild(el("p", "item-sub", `جمعت ${formatMoney(info.saved)} من ${formatMoney(goal.target)} · ${info.percent}%`));

  if (info.done) box.appendChild(iconText("p", "check", "وصلت للهدف، مبروك!", "good goal-line"));
  else {
    box.appendChild(el("p", "goal-line", `بقي ${formatMoney(info.remaining)}`));
    if (info.plan) box.appendChild(iconText("p", "sparkles", info.plan, "item-sub"));
  }

  // آخر الإضافات، مع إمكانية حذف ما أُضيف بالخطأ
  if (info.contributions.length) {
    const ul = el("ul", "payments");
    for (const c of info.contributions.slice(0, 3)) {
      const li = el("li");
      li.appendChild(el("span", "", `${c.expense ? "من مصروفي" : c.note || "إضافة"} ${formatMoney(c.amount)} · ${ltr(c.date)}`));
      const del = el("button", "icon-btn");
      del.type = "button";
      del.setAttribute("aria-label", "حذف");
      del.appendChild(icon("x", "sm"));
      del.addEventListener("click", () => {
        if (!confirm(`حذف إضافة ${formatMoney(c.amount)} من هدف "${goal.name}"؟`)) return;
        if (c.expense) expenses = expenses.filter((e) => e.id !== c.id);
        else goal.allocations = goal.allocations.filter((a) => a.id !== c.id);
        save();
        render();
      });
      li.appendChild(del);
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }

  if (!info.done) {
    const add = iconText("button", "plus", "أضف للهدف", "small-btn");
    add.type = "button";
    add.addEventListener("click", () => openGoalAdd(goal));
    const actions = el("div", "item-actions row");
    actions.appendChild(add);
    box.appendChild(actions);
  }
  return box;
}

// ===== نموذج الهدف =====

const goalDialog = $("goal-dialog");
let editingGoal = null;
let goalIcon = "target";

function updateGoalPreview() {
  const badge = el("span", "cat-icon big goal-icon");
  badge.appendChild(icon(goalIcon));
  $("goal-preview").replaceChildren(badge);
}

function openGoalForm(goal) {
  editingGoal = goal;
  goalIcon = goal ? goal.icon : "target";
  $("goal-form-title").textContent = goal ? "تعديل هدف" : "هدف جديد";
  $("goal-save").textContent = goal ? "حفظ" : "إضافة";
  $("goal-delete").hidden = !goal;
  $("goal-name").value = goal ? goal.name : "";
  $("goal-target").value = goal ? goal.target.toLocaleString("en-US") : "";
  $("goal-due").value = goal ? goal.dueMonth : "";
  buildIconPicker($("goal-icons"), goalIcon, (name) => {
    goalIcon = name;
    updateGoalPreview();
  });
  updateGoalPreview();
  goalDialog.showModal();
  if (!goal) $("goal-name").focus();
}

$("goal-target").addEventListener("input", (event) => formatMoneyInput(event.target));

$("goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = {
    name: $("goal-name").value.trim(),
    target: Number(toDigits($("goal-target").value)),
    dueMonth: $("goal-due").value,
    icon: goalIcon,
  };
  if (!data.name || !(data.target > 0)) {
    alert("الرجاء كتابة اسم الهدف والمبلغ المطلوب.");
    return;
  }
  if (editingGoal) Object.assign(editingGoal, data);
  else goals.push({ id: newId(), ...data, allocations: [] });
  save();
  render();
  goalDialog.close();
});

$("goal-delete").addEventListener("click", () => {
  const goal = editingGoal;
  if (!confirm(`حذف هدف "${goal.name}"؟ المبالغ التي أضفتها من مصروفك تبقى مسجّلة ادخاراً.`)) return;
  for (const e of expenses) {
    if (e.goalId === goal.id) delete e.goalId;
  }
  goals = goals.filter((g) => g !== goal);
  save();
  render();
  goalDialog.close();
});

$("add-goal").addEventListener("click", () => openGoalForm(null));

// ===== إضافة مبلغ لهدف =====

const goalAddDialog = $("goal-add-dialog");
// "spending": من مصروف الشهر (يُسجَّل مصروفاً)، "allocation": من مبلغ مستلم (مثل السلفة)
let goalAddMode = "spending";
let goalAddTarget = null;
let allocationNote = "";

function openGoalAdd(goal) {
  goalAddMode = "spending";
  goalAddTarget = goal;
  $("goal-add-title").textContent = `أضف لهدف "${goal.name}"`;
  $("goal-add-hint").textContent = `بقي ${formatMoney(goalInfo(goal).remaining)} · المبلغ يُخصم من مصروف الشهر`;
  $("goal-pick-row").hidden = true;
  $("goal-add-date-row").hidden = false;
  $("goal-add-skip").hidden = true;
  $("goal-add-amount").value = "";
  $("goal-add-date").value = todayString();
  goalAddDialog.showModal();
  $("goal-add-amount").focus();
}

// يُستدعى عند استلام مبلغ السلفة: هل تضيفه لهدف؟ (لا يُخصم من المصروف مرة ثانية)
function offerGoalAllocation(amount, source) {
  const open = goals.filter((g) => !goalInfo(g).done);
  if (open.length === 0) return;
  goalAddMode = "allocation";
  allocationNote = `من ${source}`;
  $("goal-add-title").textContent = `استلمت ${formatMoney(amount)}، تضيفه لهدف؟`;
  $("goal-add-hint").textContent = "لا يُخصم من مصروفك مرة ثانية، لأن أقساط السلفة خُصمت سابقاً.";
  const pick = $("goal-pick");
  pick.innerHTML = "";
  for (const g of open) {
    const option = el("option", "", `${g.name} (بقي ${formatMoney(goalInfo(g).remaining)})`);
    option.value = g.id;
    pick.appendChild(option);
  }
  $("goal-pick-row").hidden = false;
  $("goal-add-date-row").hidden = true;
  $("goal-add-skip").hidden = false;
  $("goal-add-amount").value = amount.toLocaleString("en-US");
  goalAddDialog.showModal();
}

$("goal-add-amount").addEventListener("input", (event) => formatMoneyInput(event.target));
$("goal-add-skip").addEventListener("click", () => goalAddDialog.close());

$("goal-add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(toDigits($("goal-add-amount").value));
  if (!(amount > 0)) {
    alert("الرجاء كتابة المبلغ.");
    return;
  }
  if (goalAddMode === "allocation") {
    const goal = goals.find((g) => g.id === $("goal-pick").value);
    goal.allocations.push({ id: newId(), amount, date: todayString(), note: allocationNote });
    showToast(`أُضيف ${formatMoney(amount)} لهدف "${goal.name}"`);
  } else {
    const goal = goalAddTarget;
    const exp = {
      id: nextExpenseId(),
      amount,
      categoryId: GOAL_CATEGORY_ID,
      date: $("goal-add-date").value,
      note: `ادخار: ${goal.name}`,
      method: lastMethod(),
      goalId: goal.id,
    };
    expenses.push(exp);
    showToast(`أُضيف ${formatMoney(amount)} لهدف "${goal.name}" من مصروف الشهر`);
    save();
    render();
    goalAddDialog.close();
    notifyBudget(exp);
    return;
  }
  save();
  render();
  goalAddDialog.close();
});

// ===== التشغيل =====

[goalDialog, goalAddDialog].forEach(setupDialog);
document.addEventListener("data-changed", renderGoals);
renderGoals();
