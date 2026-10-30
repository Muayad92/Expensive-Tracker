// تسجيل مصروف بجملة: تحجيها بالمايك أو تكتبها ("صرفت 50 ألف أكل")
// والتطبيق يفهم المبلغ والتصنيف والتاريخ وطريقة الدفع، ثم يفتح شاشة الإضافة جاهزة لتراجعها وتحفظ.
// الفهم كله داخل الجوال، بدون إنترنت ولا ذكاء اصطناعي.
// يعتمد على app.js: openForm و categories و methods و normalize ...

// ===== الأرقام بالكلام =====

// بالعراقي وبالفصحى (مكتوبة بعد normalize: ة ← ه، أ ← ا، والتنوين محذوف)
const NUMBER_WORDS = {
  واحد: 1, وحده: 1, اثنين: 2, اثنان: 2, ثنين: 2, اثني: 2, اثنتين: 2, اثنتان: 2,
  ثلاث: 3, ثلاثه: 3, تلاث: 3, تلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5,
  ست: 6, سته: 6, سبع: 7, سبعه: 7, ثمان: 8, ثماني: 8, ثمانيه: 8, ثمن: 8, ثمنيه: 8, تمن: 8, تمنيه: 8,
  تسع: 9, تسعه: 9, عشر: 10, عشره: 10,
  احدعش: 11, حداعش: 11, اثنعش: 12, ثنعش: 12, ثلطعش: 13, تلطعش: 13, اربعطعش: 14, خمسطعش: 15,
  سطعش: 16, سبعطعش: 17, ثمنطعش: 18, تمنطعش: 18, تسعطعش: 19,
  اربعتعش: 14, خمستعش: 15, ستعش: 16, سبعتعش: 17, ثمنتعش: 18, تسعتعش: 19,
  عشرين: 20, ثلاثين: 30, تلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70,
  ثمانين: 80, ثمنين: 80, تمانين: 80, تمنين: 80, تسعين: 90,
  عشرون: 20, ثلاثون: 30, اربعون: 40, خمسون: 50, ستون: 60, سبعون: 70, ثمانون: 80, تسعون: 90,
};
const HUNDRED_WORDS = {
  ميه: 100, مئه: 100, مايه: 100, مائه: 100, ميت: 100, ميتين: 200, مئتين: 200, ميتان: 200,
  مائتين: 200, مائتان: 200, مئتان: 200,
  ثلاثميه: 300, تلثميه: 300, تلاثميه: 300, ثلثميه: 300, اربعميه: 400, خمسميه: 500, ستميه: 600, سبعميه: 700,
  ثمنميه: 800, ثمانميه: 800, تمنميه: 800, تسعميه: 900,
  ثلاثمائه: 300, ثلثمائه: 300, اربعمائه: 400, خمسمائه: 500, ستمائه: 600, سبعمائه: 700,
  ثمانمائه: 800, ثمانيمائه: 800, تسعمائه: 900,
};
// [المضاعف، كم مرة]: "الفين" = ألف مرتين
const MULTIPLIER_WORDS = {
  الف: [1000, 1], الفا: [1000, 1], الاف: [1000, 1], تلاف: [1000, 1], تالاف: [1000, 1],
  الفين: [1000, 2], الفان: [1000, 2],
  مليون: [1e6, 1], مليونا: [1e6, 1], ملايين: [1e6, 1], مليونين: [1e6, 2], مليونان: [1e6, 2],
};
const FRACTION_WORDS = { ربع: 0.25, نص: 0.5, نصف: 0.5 };

// الأرقام العربية والفارسية إلى إنجليزية
function westernDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

function plainNumberWord(w) {
  if (/^\d+([.,]\d+)*$/.test(w)) return { kind: "digit", value: Number(w.replace(/,(?=\d{3}\b)/g, "").replace(",", ".")) };
  if (w in NUMBER_WORDS) return { kind: "unit", value: NUMBER_WORDS[w] };
  if (w in HUNDRED_WORDS) return { kind: "hundred", value: HUNDRED_WORDS[w] };
  if (w in MULTIPLIER_WORDS) return { kind: "multiplier", unit: MULTIPLIER_WORDS[w][0], count: MULTIPLIER_WORDS[w][1] };
  if (w in FRACTION_WORDS) return { kind: "fraction", value: FRACTION_WORDS[w] };
  // بالعراقي تنلفظ ملصوقة: "خمستالاف" = خمسة آلاف
  const merged = w.match(/^(.+?)ت(?:ا)?لاف$/);
  if (merged && (merged[1] in NUMBER_WORDS || `${merged[1]}ه` in NUMBER_WORDS)) {
    return { kind: "multiplier", unit: 1000, count: NUMBER_WORDS[merged[1]] || NUMBER_WORDS[`${merged[1]}ه`] };
  }
  return null;
}

// كلمة رقمية؟ (مع حذف "و" أو "ب" في أولها: "وخمسين"، "بخمسين")
function numberWord(word) {
  if (word === "الا") return { kind: "minus" };
  if (word === "و") return { kind: "and" };
  for (const prefix of ["", "و", "ب", "وب"]) {
    if (prefix && (!word.startsWith(prefix) || word.length - prefix.length < 2)) continue;
    const n = plainNumberWord(word.slice(prefix.length));
    if (n) return n;
  }
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
        total += (current || 1) * n.count * n.unit;
        current = 0;
        lastMultiplier = n.unit;
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
  rent: ["ايجار", "اجار", "كرايه البيت", "الايجار", "اجار البيت", "ايجار البيت", "ايجار الشقه"],
  electricity: ["كهرباء", "كهربا", "الوطنيه", "فاتوره كهرباء", "كهربه", "الكهرباء", "كهرباء الوطنيه", "فاتوره الكهرباء"],
  generator: ["مولده", "مولد", "امبيرات", "امبير", "اشتراك المولده", "كهرباء المولده", "سحب المولده", "المولده"],
  water: ["ماء", "مي", "ماي", "تانكي", "فاتوره ماء", "مياه", "فاتوره الماء", "فاتوره المياه", "اساله"],
  gas: ["غاز", "قنينه", "قنينه غاز", "غاز الطبخ", "نفط"],
  cleaning: ["منظفات", "تنظيف", "صابون", "مناديل", "كلينكس", "تايد", "مسحوق", "معقم", "كلور", "فلاش", "مواد تنظيف"],
  repairs: ["تصليح", "تصليحات", "سباك", "كهربائي", "صيانه البيت", "صيانه", "فني", "تصليح البيت"],
  groceries: ["اكل", "سوق", "مواد", "غذائيه", "تموين", "سوبرماركت", "ماركت", "رز", "سكر", "زيت", "معلبات", "طعام", "مسواك", "مسواگ", "تسوق", "بقاله", "علوه", "اغراض البيت", "اغراض", "مواد غذائيه", "سوبر ماركت", "اكل البيت"],
  bread: ["خبز", "صمون", "فرن", "معجنات", "صمون حجري", "مخبز"],
  meat: ["لحم", "لحمه", "دجاج", "جاج", "سمك", "قصاب", "مسكوف", "لحوم", "دواجن", "كباب البيت"],
  produce: ["خضار", "خضره", "فواكه", "فاكهه", "طماطه", "بطاطا", "خضروات", "خضراوات"],
  restaurants: ["مطعم", "غدا", "غداء", "عشا", "عشاء", "فطور", "ريوك", "شاورما", "برگر", "برجر", "بيتزا", "تكه", "كباب", "دليفري", "سفري", "فلافل", "باچه", "باجه", "مطاعم", "وجبه", "سندويش", "سندويشه", "لفه", "كص", "گص", "همبركر", "همبرگر", "مشويات", "مشوي", "اكله", "دلفري"],
  cafe: ["كافيه", "كوفي", "قهوه", "شاي", "نسكافيه", "عصير", "جايخانه", "جاي", "چاي", "كهوه", "مقهى", "كافي", "عصائر", "كوفي شوب"],
  fuel: ["بنزين", "بانزين", "وقود", "كاز", "محطه", "بنزينه", "محطه وقود", "تعبئه", "تفويل", "فولت", "ديزل", "كاز اويل"],
  taxi: ["تكسي", "تاكسي", "كيا", "كريم", "باص", "اجره", "اوبر", "بيجو", "كوستر", "سياره اجره", "مواصلات", "نقل", "حافله", "كيه", "خط", "اجره التكسي"],
  "car-service": ["ميكانيكي", "تبديل دهن", "دهن السياره", "تاير", "اطار", "غسل السياره", "صيانه السياره", "تصليح السياره", "تصليح سياره", "كراج", "فيتر", "بنجرجي", "بنچرچي", "زيت السياره", "غسيل السياره", "دهن مكينه"],
  "mobile-credit": ["رصيد", "كارت", "كارتات", "شحن", "اسيا", "زين", "كورك", "رصيد الهاتف", "كارت رصيد", "تعبئه رصيد", "شحن رصيد", "هاتف", "موبايل", "تلفون"],
  internet: ["انترنت", "نت", "واي فاي", "وايفاي", "اشتراك النت", "الانترنت", "اشتراك الانترنت", "فايبر", "الواي فاي"],
  education: ["مدرسه", "جامعه", "كليه", "قسط المدرسه", "كتب", "قرطاسيه", "دروس", "خصوصي", "ملازم", "رسوم", "رسوم دراسيه", "مدارس", "اقساط المدرسه", "مدرس خصوصي"],
  kids: ["اطفال", "طفل", "حفاظات", "حفاظه", "حليب اطفال", "العاب", "لعبه", "الاطفال", "الجهال", "جهال", "حليب الطفل", "بامبرز"],
  clothes: ["ملابس", "هدوم", "قميص", "حذاء", "قندره", "بنطرون", "دشداشه", "عبايه", "ثياب", "احذيه", "قاط", "بدله", "جواريب", "تيشيرت"],
  grooming: ["حلاقه", "حلاق", "صالون", "عنايه", "عطر", "كوافير", "مكياج", "عطور"],
  pharmacy: ["صيدليه", "دوا", "دواء", "علاج", "ادويه", "الصيدليه", "حبوب", "علاجات"],
  doctor: ["طبيب", "دكتور", "مختبر", "تحليل", "سونار", "عياده", "مستشفى", "اشعه", "طبيبه", "الدكتور", "مستوصف", "فحص", "تحاليل", "طوارئ", "مراجعه"],
  weddings: ["عرس", "زواج", "مناسبه", "نيشان", "خطوبه", "حنه", "زفاف", "حفله", "عزيمه"],
  condolences: ["فاتحه", "عزاء", "تعزيه", "مجلس عزاء", "الفاتحه"],
  gifts: ["هديه", "هدايا", "زياره", "عيديه"],
  charity: ["صدقه", "خيرات", "تبرع", "ثواب", "صدقات"],
  fun: ["ترفيه", "طلعه", "سينما", "مول", "العاب الكترونيه", "مدينه العاب", "سفره", "نزهه", "ملاهي", "بلايستيشن"],
  smoking: ["جكاير", "جگاير", "سكائر", "سجاير", "سيكاره", "اركيله", "نركيله", "معسل", "سجائر", "سكاير", "دخان", "تتن", "شيشه"],
};

// كلمات الدخل
const INCOME_VERBS = [
  "استلمت", "استلمنا", "قبضت", "قبضنا", "تقاضيت", "وصلني", "اجاني", "جاني", "اخذت راتب", "حصلت على",
  "نزل الراتب", "نزل راتب", "طلع الراتب", "وصل الراتب", "اجا الراتب",
];
const INCOME_TYPE_WORDS = {
  salary: ["راتب", "الراتب", "راتبي", "معاش", "المعاش", "معاشي"],
  extra: ["اضافي", "شغل", "شغله", "عمل", "مشروع", "اوفر تايم", "اجور"],
  "rent-in": ["ايجار", "الايجار"],
  "gift-in": ["هديه", "عيديه"],
};

// كلمات لا تُكتب في الملاحظة
const FILLER_LIST = [
  "صرفت", "دفعت", "اشتريت", "شريت", "شاريت", "خذيت", "اخذت", "حطيت", "عطيت", "سويت", "صار", "راح", "طلع", "كلف", "كلفني",
  "على", "عل", "ب", "في", "ف", "حق", "مال", "من", "الى", "لل", "ل", "و", "د.ع", "دينار", "دنانير", "عراقي", "اليوم",
  "استلمت", "قبضت", "وصلني", "اجاني", "جاني", "نزل",
  // فصحى وكلام عام
  "انفقت", "انفقنا", "صرفنا", "دفعنا", "اشترينا", "جبت", "جبنا", "خذينا", "لقد", "قمت", "بشراء", "شراء", "ثمن", "سعر",
  "مبلغ", "بمبلغ", "بقيمه", "قيمه", "مقابل", "عن", "مع", "هذا", "هذه", "الصبح", "الصباح", "المساء", "العصر", "بالليل",
  "حوالي", "تقريبا", "يعني", "هسه", "توا", "بس", "شي", "تقاضيت", "حصلت", "رحت", "رحنا", "يوم",
];
// نفس طريقة كتابة كلمات الجملة (ى ← ي، ة ← ه ...)
const FILLER_WORDS = new Set(FILLER_LIST.map((w) => normalize(w)));

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

// هل الكلمتان تختلفان في آخر حرف فقط؟ (أكثر أخطاء المايك: "مولدا" بدل "مولده"، "صيدلي" بدل "صيدليه")
function lastLetterApart(a, b) {
  if (a === b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  return long.length === short.length ? a.slice(0, -1) === b.slice(0, -1) : long.slice(0, -1) === short;
}

function fuzzyMatch(words, options, skip) {
  for (let i = 0; i < words.length; i++) {
    if (skip.has(i) || numberWord(words[i]) || FILLER_WORDS.has(words[i])) continue;
    for (const form of wordForms(words[i])) {
      if (form.length < 4) continue;
      for (const option of options) {
        const phrase = option.phrases.find((ph) => !ph.includes(" ") && normalize(ph).length >= 4 && lastLetterApart(form, normalize(ph)));
        if (phrase) return { id: option.id, phrase, at: [i] };
      }
    }
  }
  return null;
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
    { id: 1, phrases: ["امس", "البارحه", "مبارح", "البارح", "قبل يوم"] },
    { id: 7, phrases: ["قبل اسبوع", "قبل جمعه"] },
  ];
  // أيام الأسبوع: "يوم الأحد" = آخر أحد (أو اليوم إذا كان أحداً)
  const weekdays = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعه", "السبت"];
  const today = new Date().getDay();
  weekdays.forEach((day, k) => dateWords.push({ id: (today - k + 7) % 7, phrases: [day, `يوم ${day}`] }));
  const dateMatch = bestMatch(words, dateWords);
  // "قبل 3 أيام" أو "قبل ثلاثة أيام"
  const before = words.findIndex((w, i) => w === "قبل" && /^(ايام|يوم)$/.test(words[i + 2] || "") && numberWord(words[i + 1] || "")?.value > 0);
  if (dateMatch) {
    daysAgo = dateMatch.id;
    dateMatch.at.forEach((i) => used.add(i));
  } else if (before >= 0 && numberWord(words[before + 1]).value <= 60) {
    daysAgo = numberWord(words[before + 1]).value;
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
    incomeVerb?.at.forEach((i) => used.add(i));
  } else {
    // تصنيفات المستخدم بأسمائها، والأساسية بكلماتها الإضافية أيضاً
    const options = categories
      .filter((c) => !c.hidden && !c.system)
      .map((c) => ({ id: c.id, phrases: [c.name, ...(CATEGORY_KEYWORDS[c.id] || [])] }));
    const match = bestMatch(words, options) || fuzzyMatch(words, options, used);
    if (match) {
      categoryId = match.id;
      // كلمات التصنيف لا تتكرر في الملاحظة (التصنيف يظهر وحده)
      match.at.forEach((i) => used.add(i));
      const phrases = options.find((o) => o.id === match.id).phrases.map((ph) => normalize(ph)).filter((ph) => !ph.includes(" "));
      words.forEach((w, i) => {
        if ([...wordForms(w)].some((f) => phrases.includes(f) || phrases.includes(`ال${f}`))) used.add(i);
      });
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
  setMicStatus(SpeechRecognitionApi ? "اضغط المايك واحجي، بالعراقي أو بالفصحى" : "اكتب الجملة، أو " + MIC_FALLBACK);
  renderSentencePreview();
  sentenceDialog.showModal();
  if (!SpeechRecognitionApi) sentenceInput.focus();
}

// ===== المايك =====
// متصفح الآيفون أحياناً يعلّق: لا يبدأ، أو لا يُبلغ أنه انتهى، فيبقى المايك "مشغولاً" للأبد.
// لذلك: نسخة جديدة في كل مرة، ومؤقتات تُرجع كل شي لوضعه الطبيعي إذا علّق.

// العراقية أولاً؛ إذا المتصفح ما يدعمها نجرب السعودية (تفهم الفصحى أيضاً) ونتذكر اللي اشتغلت
const SPEECH_LANGS = ["ar-IQ", "ar-SA", "ar"];
const SPEECH_LANG_KEY = "speechLang";
const START_TIMEOUT_MS = 4000; // إذا ما بدأ يسمع خلال 4 ثوانٍ
const STOP_TIMEOUT_MS = 1500; // إذا ما انتهى بعد طلب الإيقاف
const MAX_LISTEN_MS = 15000; // أطول مدة استماع

let recognition = null;
let micState = "idle"; // "idle" | "starting" | "listening"
let micTimers = [];
let startRetried = false;

function speechLang() {
  try {
    const saved = localStorage.getItem(SPEECH_LANG_KEY);
    return SPEECH_LANGS.includes(saved) ? saved : SPEECH_LANGS[0];
  } catch {
    return SPEECH_LANGS[0];
  }
}

function setMicStatus(text) {
  $("mic-status").textContent = text;
}

function clearMicTimers() {
  micTimers.forEach(clearTimeout);
  micTimers = [];
}

// يُرجع المايك لوضعه الطبيعي مهما كان حال المتصفح
function resetMic() {
  clearMicTimers();
  const rec = recognition;
  recognition = null;
  micState = "idle";
  $("mic-btn").classList.remove("listening");
  if (rec) {
    rec.onresult = rec.onerror = rec.onend = rec.onstart = rec.onaudiostart = null;
    try {
      rec.abort();
    } catch {
      // انتهى أصلاً
    }
  }
}

function stopListening() {
  resetMic();
}

// المتصفح يعطي أحياناً أكثر من احتمال للكلام: نختار الذي يُفهم منه مبلغ وتصنيف
function bestTranscript(results) {
  const list = [...results];
  const maxAlternatives = Math.max(...list.map((r) => r.length));
  let best = null;
  for (let k = 0; k < maxAlternatives; k++) {
    const text = list.map((r) => (r[k] || r[0]).transcript.trim()).join(" ");
    const p = parseSentence(text);
    const score = (p.amount ? 2 : 0) + (p.categoryId || p.income ? 1 : 0) + (p.method ? 0.25 : 0);
    if (!best || score > best.score) best = { text, score };
  }
  return best ? best.text : "";
}

const MIC_FALLBACK = "اضغط على خانة الكتابة واستعمل مايك الكيبورد 🎤";

function startListening() {
  resetMic();
  const rec = new SpeechRecognitionApi();
  recognition = rec;
  micState = "starting";
  rec.lang = speechLang();
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 5;
  $("mic-btn").classList.add("listening");
  setMicStatus("لحظة…");

  const started = () => {
    if (recognition !== rec || micState === "listening") return;
    micState = "listening";
    clearMicTimers();
    setMicStatus("أسمعك… احجي وبعدها اسكت لحظة");
    micTimers.push(setTimeout(() => recognition === rec && finishListening(), MAX_LISTEN_MS));
  };
  rec.onstart = started;
  rec.onaudiostart = started;
  rec.onresult = (event) => {
    if (recognition !== rec) return;
    started();
    sentenceInput.value = bestTranscript(event.results);
    renderSentencePreview();
  };
  rec.onerror = (event) => {
    if (recognition !== rec) return;
    if (event.error === "language-not-supported" || event.error === "bad-grammar") {
      // نجرب اللغة التالية مباشرة
      const next = SPEECH_LANGS[SPEECH_LANGS.indexOf(rec.lang) + 1];
      if (next) {
        try {
          localStorage.setItem(SPEECH_LANG_KEY, next);
        } catch {
          // نجربها هذه المرة فقط
        }
        resetMic();
        startListening();
        return;
      }
    }
    const messages = {
      "not-allowed": "المايك غير مسموح. اسمح به من إعدادات الجوال للمتصفح، أو " + MIC_FALLBACK,
      "service-not-allowed": "المتصفح ما يسمح بالمايك هنا. " + MIC_FALLBACK,
      "no-speech": "ما سمعت شي، اضغط المايك وجرّب مرة ثانية",
      "audio-capture": "المايك مشغول أو مو شغّال. " + MIC_FALLBACK,
      network: "التعرّف على الصوت يحتاج إنترنت. " + MIC_FALLBACK,
      aborted: "",
    };
    const text = event.error in messages ? messages[event.error] : "المايك ما اشتغل. " + MIC_FALLBACK;
    resetMic();
    if (text) setMicStatus(text);
  };
  rec.onend = () => {
    if (recognition !== rec) return;
    resetMic();
    setMicStatus(sentenceInput.value.trim() ? "راجع الفهم تحت، وصحّح الكتابة إذا تحتاج، واضغط متابعة" : "ما سمعت شي، اضغط المايك وجرّب مرة ثانية");
    renderSentencePreview();
  };

  // إذا ما بدأ: نعيد المحاولة مرة وحدة بنسخة جديدة، وبعدها ننصح بمايك الكيبورد
  micTimers.push(setTimeout(() => {
    if (recognition !== rec || micState !== "starting") return;
    resetMic();
    if (!startRetried) {
      startRetried = true;
      startListening();
    } else {
      startRetried = false;
      setMicStatus("المايك ما استجاب. " + MIC_FALLBACK);
    }
  }, START_TIMEOUT_MS));

  try {
    rec.start();
  } catch {
    resetMic();
    setMicStatus("المايك ما اشتغل. " + MIC_FALLBACK);
  }
}

// إيقاف بطلب المستخدم (أو بعد أطول مدة): ننتظر النتيجة الأخيرة قليلاً، وإذا ما انتهى نُنهيه بأنفسنا
function finishListening() {
  const rec = recognition;
  if (!rec) return;
  try {
    rec.stop();
  } catch {
    // انتهى أصلاً
  }
  micTimers.push(setTimeout(() => {
    if (recognition !== rec) return;
    resetMic();
    setMicStatus(sentenceInput.value.trim() ? "راجع الفهم تحت واضغط متابعة" : "ما سمعت شي، اضغط المايك وجرّب مرة ثانية");
  }, STOP_TIMEOUT_MS));
}

$("mic-btn").hidden = !SpeechRecognitionApi;
$("mic-btn").addEventListener("click", () => {
  if (micState === "listening") finishListening();
  else {
    startRetried = false;
    startListening();
  }
});
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
