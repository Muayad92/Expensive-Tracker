// تسجيل مصروف بجملة: تحجيها بالمايك أو تكتبها ("صرفت 50 ألف أكل")
// والتطبيق يفهم المبلغ والتصنيف والتاريخ وطريقة الدفع، ثم يفتح شاشة الإضافة جاهزة لتراجعها وتحفظ.
// الفهم كله داخل الجوال، بدون إنترنت ولا ذكاء اصطناعي.
// يعتمد على app.js: openForm و categories و methods و normalize ...

// ===== الأرقام بالكلام =====

const NUMBER_WORDS = {
  واحد: 1, وحده: 1, اثنين: 2, اثنان: 2, ثنين: 2,
  ثلاث: 3, ثلاثه: 3, تلاث: 3, تلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5,
  ست: 6, سته: 6, سبع: 7, سبعه: 7, ثمان: 8, ثماني: 8, ثمانيه: 8, ثمن: 8, ثمنيه: 8, تمن: 8, تمنيه: 8,
  تسع: 9, تسعه: 9, عشر: 10, عشره: 10,
  احدعش: 11, حداعش: 11, اثنعش: 12, ثنعش: 12, ثلطعش: 13, تلطعش: 13, اربعطعش: 14, خمسطعش: 15,
  سطعش: 16, سبعطعش: 17, ثمنطعش: 18, تمنطعش: 18, تسعطعش: 19,
  عشرين: 20, ثلاثين: 30, تلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70,
  ثمانين: 80, ثمنين: 80, تمانين: 80, تمنين: 80, تسعين: 90,
};
const HUNDRED_WORDS = {
  ميه: 100, مئه: 100, مايه: 100, ميتين: 200, مئتين: 200, ميتان: 200,
  ثلاثميه: 300, تلثميه: 300, تلاثميه: 300, اربعميه: 400, خمسميه: 500, ستميه: 600, سبعميه: 700,
  ثمنميه: 800, ثمانميه: 800, تمنميه: 800, تسعميه: 900,
};
const MULTIPLIER_WORDS = { الف: 1000, الاف: 1000, الفين: 2000, مليون: 1e6, ملايين: 1e6, مليونين: 2e6 };
const FRACTION_WORDS = { ربع: 0.25, نص: 0.5, نصف: 0.5 };

// الأرقام العربية والفارسية إلى إنجليزية
function westernDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

// كلمة رقمية؟ (مع حذف "و" في أولها: "وخمسين")
function numberWord(word) {
  const w = word.startsWith("و") && word.length > 2 && !(word in NUMBER_WORDS) ? word.slice(1) : word;
  if (/^\d+([.,]\d+)*$/.test(w)) return { kind: "digit", value: Number(w.replace(/,(?=\d{3}\b)/g, "").replace(",", ".")) };
  if (w in NUMBER_WORDS) return { kind: "unit", value: NUMBER_WORDS[w] };
  if (w in HUNDRED_WORDS) return { kind: "hundred", value: HUNDRED_WORDS[w] };
  if (w in MULTIPLIER_WORDS) return { kind: "multiplier", value: MULTIPLIER_WORDS[w] };
  if (w in FRACTION_WORDS) return { kind: "fraction", value: FRACTION_WORDS[w] };
  if (w === "الا") return { kind: "minus" };
  if (w === "و") return { kind: "and" };
  return null;
}

// يقرأ أول مبلغ في الكلمات: يُرجع { amount, used: [أرقام الكلمات المستعملة] }
function readAmount(words, skip = new Set()) {
  for (let start = 0; start < words.length; start++) {
    if (skip.has(start)) continue;
    const first = numberWord(words[start]);
    if (!first || first.kind === "and" || first.kind === "minus") continue;

    let total = 0;
    let current = 0;
    let lastMultiplier = 0;
    let minus = false;
    const used = [];
    let i = start;
    for (; i < words.length && !skip.has(i); i++) {
      const n = numberWord(words[i]);
      if (!n) break;
      const next = numberWord(words[i + 1] || "");
      if (n.kind === "and") {
        if (!next || next.kind === "and") break;
      } else if (n.kind === "minus") {
        if (!next || next.kind !== "fraction") break;
        minus = true;
      } else if (n.kind === "fraction") {
        // "ربع مليون" جزء من الرقم القادم، و"مليون ونص" نصف المضاعف السابق
        if (next && next.kind === "multiplier") current += n.value;
        else if (lastMultiplier) total += (minus ? -1 : 1) * n.value * lastMultiplier;
        else break;
        minus = false;
      } else if (n.kind === "multiplier") {
        const base = n.value === 2000 || n.value === 2e6 ? 2 : 1;
        const unit = n.value / base;
        total += (current || 1) * base * unit;
        current = 0;
        lastMultiplier = unit;
      } else if (n.kind === "hundred" && n.value === 100 && current > 0 && current < 10) {
        current *= 100; // "خمس ميه"
      } else {
        current += n.value;
      }
      used.push(i);
    }
    total += current;
    if (total > 0) {
      // بالعراقي "خمسين" تعني خمسين ألف: المبالغ الصغيرة بدون "ألف" تُضرب بألف (إلا إذا قال "دينار")
      const saidDinar = /^(دينار|دنانير)$/.test(words[i] || "");
      if (!lastMultiplier && total < 1000 && !saidDinar) total *= 1000;
      if (saidDinar) used.push(i);
      return { amount: Math.round(total), used };
    }
  }
  return { amount: 0, used: [] };
}

// ===== التصنيفات بالكلام =====

// كلمات إضافية لكل تصنيف أساسي (مكتوبة بعد normalize: ة ← ه، أ ← ا)
const CATEGORY_KEYWORDS = {
  rent: ["ايجار", "اجار", "كرايه البيت"],
  electricity: ["كهرباء", "كهربا", "الوطنيه", "فاتوره كهرباء"],
  generator: ["مولده", "مولد", "امبيرات", "امبير", "اشتراك المولده"],
  water: ["ماء", "مي", "ماي", "تانكي", "فاتوره ماء"],
  gas: ["غاز", "قنينه", "قنينه غاز"],
  cleaning: ["منظفات", "تنظيف", "صابون", "مناديل", "كلينكس", "تايد"],
  repairs: ["تصليح", "تصليحات", "سباك", "كهربائي", "صيانه البيت"],
  groceries: ["اكل", "سوق", "مواد", "غذائيه", "تموين", "سوبرماركت", "ماركت", "رز", "سكر", "زيت", "معلبات"],
  bread: ["خبز", "صمون", "فرن", "معجنات"],
  meat: ["لحم", "لحمه", "دجاج", "جاج", "سمك", "قصاب", "مسكوف"],
  produce: ["خضار", "خضره", "فواكه", "فاكهه", "طماطه", "بطاطا"],
  restaurants: ["مطعم", "غدا", "غداء", "عشا", "عشاء", "فطور", "ريوك", "شاورما", "برگر", "برجر", "بيتزا", "تكه", "كباب", "دليفري", "سفري", "فلافل", "باچه", "باجه"],
  cafe: ["كافيه", "كوفي", "قهوه", "شاي", "نسكافيه", "عصير", "جايخانه"],
  fuel: ["بنزين", "بانزين", "وقود", "كاز", "محطه"],
  taxi: ["تكسي", "تاكسي", "كيا", "كريم", "باص", "اجره", "اوبر", "بيجو", "كوستر"],
  "car-service": ["ميكانيكي", "تبديل دهن", "دهن السياره", "تاير", "اطار", "غسل السياره", "صيانه السياره", "تصليح السياره"],
  "mobile-credit": ["رصيد", "كارت", "كارتات", "شحن", "اسيا", "زين", "كورك"],
  internet: ["انترنت", "نت", "واي فاي", "وايفاي", "اشتراك النت"],
  education: ["مدرسه", "جامعه", "كليه", "قسط المدرسه", "كتب", "قرطاسيه", "دروس", "خصوصي", "ملازم"],
  kids: ["اطفال", "طفل", "حفاظات", "حفاظه", "حليب اطفال", "العاب", "لعبه"],
  clothes: ["ملابس", "هدوم", "قميص", "حذاء", "قندره", "بنطرون", "دشداشه", "عبايه"],
  grooming: ["حلاقه", "حلاق", "صالون", "عنايه", "عطر"],
  pharmacy: ["صيدليه", "دوا", "دواء", "علاج", "ادويه"],
  doctor: ["طبيب", "دكتور", "مختبر", "تحليل", "سونار", "عياده", "مستشفى", "اشعه"],
  weddings: ["عرس", "زواج", "مناسبه", "نيشان", "خطوبه", "حنه"],
  condolences: ["فاتحه", "عزاء", "تعزيه"],
  gifts: ["هديه", "هدايا", "زياره"],
  charity: ["صدقه", "خيرات", "تبرع", "ثواب"],
  fun: ["ترفيه", "طلعه", "سينما", "مول", "العاب الكترونيه", "مدينه العاب"],
  smoking: ["جكاير", "جگاير", "سكائر", "سجاير", "سيكاره", "اركيله", "نركيله", "معسل"],
};

// كلمات الدخل
const INCOME_VERBS = ["استلمت", "قبضت", "وصلني", "اجاني", "جاني", "اخذت راتب", "نزل الراتب", "نزل راتب"];
const INCOME_TYPE_WORDS = {
  salary: ["راتب", "الراتب", "معاش", "المعاش"],
  extra: ["اضافي", "شغل", "عمل", "مشروع"],
  "rent-in": ["ايجار", "الايجار"],
  "gift-in": ["هديه", "عيديه"],
};

// كلمات لا تُكتب في الملاحظة
const FILLER_WORDS = new Set([
  "صرفت", "دفعت", "اشتريت", "شريت", "شاريت", "خذيت", "اخذت", "حطيت", "عطيت", "سويت", "صار", "راح", "طلع", "كلف", "كلفني",
  "على", "عل", "ب", "في", "ف", "حق", "مال", "من", "الى", "لل", "ل", "و", "د.ع", "دينار", "دنانير", "عراقي", "اليوم",
  "استلمت", "قبضت", "وصلني", "اجاني", "جاني", "نزل",
]);

// الكلمة مع حذف السوابق الشائعة: "بالمولده" ← "مولده"
function wordForms(word) {
  const forms = new Set([word]);
  for (const prefix of ["وبال", "بال", "وال", "لل", "ال", "و", "ب", "ل"]) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) forms.add(word.slice(prefix.length));
  }
  return forms;
}

// هل في الجملة هذه العبارة؟ (كلمة كاملة أو عدة كلمات) تُرجع أرقام كلماتها أو null
function findPhrase(words, phrase) {
  const parts = normalize(phrase).split(/\s+/);
  for (let i = 0; i + parts.length <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < parts.length && ok; k++) {
      const forms = wordForms(words[i + k]);
      ok = forms.has(parts[k]) || forms.has(`ال${parts[k]}`) || (parts[k].startsWith("ال") && forms.has(parts[k].slice(2)));
    }
    if (ok) return parts.map((_, k) => i + k);
  }
  return null;
}

// أطول عبارة مطابقة من قائمة { id, phrases }
function bestMatch(words, options) {
  let best = null;
  for (const option of options) {
    for (const phrase of option.phrases) {
      const at = findPhrase(words, phrase);
      if (at && (!best || phrase.length > best.phrase.length)) best = { id: option.id, phrase, at };
    }
  }
  return best;
}

// ===== فهم الجملة =====

function parseSentence(text) {
  const original = westernDigits(text).replace(/[،,.!؟?]+(?=\s|$)/g, " ").split(/\s+/).filter(Boolean);
  const words = original.map((w) => normalize(w));
  const used = new Set();

  // التاريخ أولاً، حتى لا يُقرأ "قبل 3 أيام" مبلغاً
  let daysAgo = 0;
  const dateWords = [
    { id: 2, phrases: ["اول امس", "اول البارحه", "قبل يومين"] },
    { id: 1, phrases: ["امس", "البارحه", "مبارح", "البارح"] },
  ];
  const dateMatch = bestMatch(words, dateWords);
  const before = words.findIndex((w, i) => w === "قبل" && /^\d+$/.test(words[i + 1] || "") && /^(ايام|يوم)$/.test(words[i + 2] || ""));
  if (dateMatch) {
    daysAgo = dateMatch.id;
    dateMatch.at.forEach((i) => used.add(i));
  } else if (before >= 0 && Number(words[before + 1]) <= 60) {
    daysAgo = Number(words[before + 1]);
    [before, before + 1, before + 2].forEach((i) => used.add(i));
  }

  const { amount, used: amountWords } = readAmount(words, used);
  amountWords.forEach((i) => used.add(i));

  // دخل أم مصروف
  const incomeVerb = bestMatch(words, [{ id: "verb", phrases: INCOME_VERBS }]);
  const incomeTypeMatch = bestMatch(words, INCOME_TYPES.filter((t) => INCOME_TYPE_WORDS[t.id]).map((t) => ({ id: t.id, phrases: INCOME_TYPE_WORDS[t.id] })));
  const isIncome = Boolean(incomeVerb) || incomeTypeMatch?.id === "salary";

  let categoryId = null;
  let incomeType = null;
  if (isIncome) {
    incomeType = incomeTypeMatch ? incomeTypeMatch.id : "other-in";
    incomeTypeMatch?.at.forEach((i) => used.add(i));
  } else {
    // تصنيفات المستخدم بأسمائها، والأساسية بكلماتها الإضافية أيضاً
    const options = categories
      .filter((c) => !c.hidden && !c.system)
      .map((c) => ({ id: c.id, phrases: [c.name, ...(CATEGORY_KEYWORDS[c.id] || [])] }));
    const match = bestMatch(words, options);
    if (match) {
      categoryId = match.id;
      // اسم التصنيف نفسه لا يُكرَّر في الملاحظة، أما "شاورما" مثلاً فتبقى
      if (normalize(getCategory(match.id).name).includes(normalize(match.phrase))) match.at.forEach((i) => used.add(i));
      else if (match.phrase === "اكل") match.at.forEach((i) => used.add(i));
    }
  }

  // طريقة الدفع
  const methodAliases = { "qi-card": ["كي كارد", "كيكارد", "الكي"], "zain-cash": ["زين كاش", "زينكاش"], "bank-card": ["فيزا", "ماستر", "ماستر كارد", "البطاقه", "بطاقه"], [CASH_ID]: ["كاش", "نقد", "نقدي"] };
  const methodMatch = bestMatch(words, methods.map((m) => ({ id: m.id, phrases: [m.name, ...(methodAliases[m.id] || [])] })));
  // "زين" وحدها رصيد، لكن "زين كاش" طريقة دفع: نقدّم طريقة الدفع إذا كانت أطول
  if (methodMatch) {
    methodMatch.at.forEach((i) => used.add(i));
    if (categoryId === "mobile-credit" && findPhrase(words, "زين كاش") && !findPhrase(words, "رصيد") && !findPhrase(words, "كارت")) categoryId = null;
  }

  // الملاحظة: ما بقي من كلمات مفيدة
  const note = original.filter((w, i) => !used.has(i) && !FILLER_WORDS.has(words[i]) && !numberWord(words[i])).join(" ");

  return {
    income: isIncome,
    amount,
    categoryId,
    incomeType,
    daysAgo,
    method: methodMatch ? methodMatch.id : null,
    note: note.slice(0, 100),
  };
}

// ===== النافذة =====

const sentenceDialog = $("sentence-dialog");
const sentenceInput = $("sentence-input");
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let parsed = null;

function relativeDayLabel(daysAgo) {
  return daysAgo === 0 ? "اليوم" : daysAgo === 1 ? "أمس" : `قبل ${countWord(daysAgo, "يوم", "يومين", "أيام")}`;
}

function renderSentencePreview() {
  parsed = parseSentence(sentenceInput.value);
  const box = $("sentence-preview");
  box.innerHTML = "";
  if (!sentenceInput.value.trim()) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const chip = (iconName, text, cls = "") => {
    const c = el("span", `parse-chip ${cls}`);
    c.append(icon(iconName, "sm"), el("span", "", text));
    return c;
  };
  box.appendChild(parsed.amount ? chip("banknote", formatMoney(parsed.amount)) : chip("info", "ما فهمت المبلغ", "missing"));
  if (parsed.income) {
    box.appendChild(chip(getIncomeType(parsed.incomeType).icon, `دخل: ${getIncomeType(parsed.incomeType).name}`, "income"));
  } else if (parsed.categoryId) {
    const cat = getCategory(parsed.categoryId);
    box.appendChild(chip(cat.icon, cat.name));
  } else {
    box.appendChild(chip("tag", "اختر التصنيف بعدين", "missing"));
  }
  box.appendChild(chip("calendar", relativeDayLabel(parsed.daysAgo)));
  if (parsed.method) box.appendChild(chip(methods.find((m) => m.id === parsed.method).icon, methods.find((m) => m.id === parsed.method).name));
  if (parsed.note) box.appendChild(chip("pencil", parsed.note));
}

function openSentence() {
  stopListening();
  sentenceInput.value = "";
  $("mic-status").textContent = SpeechRecognitionApi ? "اضغط المايك واحجي" : "اكتب الجملة، أو استعمل مايك الكيبورد";
  renderSentencePreview();
  sentenceDialog.showModal();
  if (!SpeechRecognitionApi) sentenceInput.focus();
}

function stopListening() {
  if (recognition) recognition.abort();
  recognition = null;
  $("mic-btn").classList.remove("listening");
}

function startListening() {
  const rec = new SpeechRecognitionApi();
  recognition = rec;
  rec.lang = "ar-IQ";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  $("mic-btn").classList.add("listening");
  $("mic-status").textContent = "أسمعك…";
  rec.onresult = (event) => {
    sentenceInput.value = [...event.results].map((r) => r[0].transcript).join(" ");
    renderSentencePreview();
  };
  rec.onerror = (event) => {
    if (recognition !== rec) return;
    $("mic-status").textContent =
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "المايك غير مسموح. اسمح به من إعدادات المتصفح، أو اكتب الجملة"
        : event.error === "no-speech"
          ? "ما سمعت شي، جرّب مرة ثانية"
          : "المايك ما اشتغل هنا، اكتب الجملة أو استعمل مايك الكيبورد";
  };
  rec.onend = () => {
    if (recognition !== rec) return;
    recognition = null;
    $("mic-btn").classList.remove("listening");
    if ($("mic-status").textContent === "أسمعك…") {
      $("mic-status").textContent = sentenceInput.value.trim() ? "راجع الفهم تحت واضغط متابعة" : "ما سمعت شي، جرّب مرة ثانية";
    }
  };
  try {
    rec.start();
  } catch {
    stopListening();
    $("mic-status").textContent = "المايك ما اشتغل هنا، اكتب الجملة أو استعمل مايك الكيبورد";
  }
}

$("mic-btn").hidden = !SpeechRecognitionApi;
$("mic-btn").addEventListener("click", () => (recognition ? recognition.stop() : startListening()));
sentenceInput.addEventListener("input", renderSentencePreview);

for (const example of document.querySelectorAll("#sentence-examples button")) {
  example.addEventListener("click", () => {
    sentenceInput.value = example.textContent.trim();
    renderSentencePreview();
  });
}

// فتح شاشة الإضافة بما فُهم من الجملة، حتى تراجعه وتحفظ
function openFormFromSentence(p) {
  openForm(null, p.income ? "income" : "expense");
  if (p.amount) amountExpr = String(p.amount);
  if (p.income) {
    incomeType = p.incomeType;
    renderIncomeTypes();
  } else if (p.categoryId) {
    categoryInput.value = p.categoryId;
    pickerGroup = getCategory(p.categoryId).group;
    renderCategoryPicker();
  }
  dateInput.value = isoDateOffset(-p.daysAgo);
  noteInput.value = p.note;
  if (p.method) {
    chosenMethod = p.method;
    renderMethodChips();
  }
  updateAmountDisplay();
}

$("sentence-form").addEventListener("submit", (event) => {
  event.preventDefault();
  stopListening();
  const p = parseSentence(sentenceInput.value);
  sentenceDialog.close();
  openFormFromSentence(p);
});

$("open-sentence").addEventListener("click", () => {
  expenseDialog.close();
  openSentence();
});

sentenceDialog.addEventListener("close", stopListening);
setupDialog(sentenceDialog);
