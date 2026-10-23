// الإعداد أول مرة: يظهر مرة واحدة فقط (للمستخدم الجديد، ولمن حدّث التطبيق)
// يعتمد على app.js: categories و budgets و save و render و formatMoneyInput ...

const ONBOARDED_KEY = "onboarded";

// كل سؤال يُظهر أو يُخفي تصنيفات معينة. "yes" هو الجواب الافتراضي لمن ليس عنده مصاريف بعد
const ONBOARD_QUESTIONS = [
  { id: "car", text: "عندك سيارة؟", icon: "car", categories: ["fuel", "car-service"], yes: true },
  { id: "kids", text: "عندك أطفال؟", icon: "baby", categories: ["kids", "education"], yes: true },
  { id: "rent", text: "تدفع إيجار؟", icon: "key-round", categories: ["rent"], yes: true },
  { id: "generator", text: "مشترك بمولدة؟", icon: "plug-zap", categories: ["generator"], yes: true },
  { id: "smoking", text: "تدخّن أو تشرب أركيلة؟", icon: "cigarette", categories: ["smoking"], yes: false },
];

const onboarding = $("onboarding");
const answers = {};

function onboardingDone() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true; // بدون تخزين لا نستطيع تذكّر الإجابات، فلا نزعج المستخدم كل مرة
  }
}

function showStep(n) {
  for (const step of onboarding.querySelectorAll(".onboard-step")) step.hidden = step.dataset.step !== String(n);
  onboarding.querySelectorAll(".onboard-dots span").forEach((dot, i) => dot.classList.toggle("on", i === n - 1));
}

function renderQuestions() {
  const box = $("onboard-questions");
  box.innerHTML = "";
  for (const q of ONBOARD_QUESTIONS) {
    const row = el("div", "onboard-question");
    const label = el("span", "onboard-q-text");
    label.append(el("span", "menu-icon"), q.text);
    label.firstChild.appendChild(icon(q.icon));
    const choice = el("div", "yes-no");
    for (const [value, text] of [[true, "نعم"], [false, "لا"]]) {
      const btn = el("button", answers[q.id] === value ? "selected" : "", text);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(answers[q.id] === value));
      btn.addEventListener("click", () => {
        answers[q.id] = value;
        renderQuestions();
      });
      choice.appendChild(btn);
    }
    row.append(label, choice);
    box.appendChild(row);
  }
}

function finishOnboarding(withBudget) {
  for (const q of ONBOARD_QUESTIONS) {
    for (const id of q.categories) {
      const cat = categories.find((c) => c.id === id);
      if (cat) cat.hidden = !answers[q.id];
    }
  }
  const budget = Number(toDigits($("onboard-budget").value));
  if (withBudget && budget > 0) budgets.total = budget;
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // سيظهر الإعداد مرة أخرى فقط
  }
  save();
  render();
  onboarding.close();
}

function startOnboarding() {
  // من عنده مصاريف سابقة: الجواب الافتراضي حسب ما صرف عليه فعلاً
  for (const q of ONBOARD_QUESTIONS) {
    const used = expenses.some((e) => q.categories.includes(e.categoryId));
    answers[q.id] = used || (expenses.length === 0 && q.yes);
  }
  $("onboard-budget").value = budgets.total ? budgets.total.toLocaleString("en-US") : "";
  renderQuestions();
  showStep(1);
  onboarding.showModal();
}

for (const btn of onboarding.querySelectorAll("[data-next]")) {
  btn.addEventListener("click", () => showStep(Number(btn.closest(".onboard-step").dataset.step) + 1));
}
$("onboard-budget").addEventListener("input", (event) => formatMoneyInput(event.target));
$("onboard-finish").addEventListener("click", () => finishOnboarding(true));
$("onboard-skip").addEventListener("click", () => finishOnboarding(false));
// زر الرجوع في الجوال لا يغلق الإعداد قبل إكماله
onboarding.addEventListener("cancel", (event) => event.preventDefault());

if (!onboardingDone()) document.addEventListener("DOMContentLoaded", startOnboarding);
