// المجموعات والتصنيفات الافتراضية (ما يُصرف عليه فعلاً في البيت العراقي)
// ونقل بيانات النسخ السابقة إليها. يُحمَّل قبل app.js

// لون كل مجموعة ثابت: رقم من ألوان القرص (--series-1 ... --series-8) أو "rest" للرمادي
const DEFAULT_GROUPS = [
  { id: "home", name: "البيت", icon: "house", color: 1 },
  { id: "food", name: "الأكل", icon: "utensils", color: 2 },
  { id: "transport", name: "النقل", icon: "car", color: 3 },
  { id: "telecom", name: "الاتصالات", icon: "smartphone", color: 4 },
  { id: "family", name: "العائلة", icon: "users", color: 5 },
  { id: "health", name: "الصحة", icon: "stethoscope", color: 6 },
  { id: "social", name: "الواجبات الاجتماعية", icon: "heart-handshake", color: 7 },
  { id: "savings", name: "الادخار", icon: "piggy-bank", color: 8 },
  { id: "other", name: "أخرى", icon: "package", color: "rest" },
];

// تصنيف "أخرى" لا يُحذف، وتنتقل إليه مصاريف أي تصنيف محذوف
const OTHER_ID = "other";
// أقساط السلفة تُسجَّل مصاريف بهذا التصنيف
const JAMIYA_CATEGORY_ID = "jamiya-installment";

const DEFAULT_CATEGORIES = [
  { id: "rent", name: "إيجار", icon: "key-round", group: "home" },
  { id: "electricity", name: "كهرباء وطنية", icon: "utility-pole", group: "home" },
  { id: "generator", name: "مولدة", icon: "plug-zap", group: "home" },
  { id: "water", name: "ماء", icon: "droplets", group: "home" },
  { id: "gas", name: "غاز", icon: "flame", group: "home" },
  { id: "cleaning", name: "منظفات ومستلزمات", icon: "spray-can", group: "home" },
  { id: "repairs", name: "تصليحات", icon: "wrench", group: "home" },

  { id: "groceries", name: "مواد غذائية", icon: "shopping-basket", group: "food" },
  { id: "bread", name: "خبز وصمون", icon: "croissant", group: "food" },
  { id: "meat", name: "لحوم ودجاج", icon: "drumstick", group: "food" },
  { id: "produce", name: "خضار وفواكه", icon: "carrot", group: "food" },
  { id: "restaurants", name: "مطاعم", icon: "utensils", group: "food" },
  { id: "cafe", name: "كافيه وشاي", icon: "coffee", group: "food" },

  { id: "fuel", name: "بنزين", icon: "fuel", group: "transport" },
  { id: "taxi", name: "تكسي وكيا", icon: "car-taxi-front", group: "transport" },
  { id: "car-service", name: "صيانة السيارة", icon: "car", group: "transport" },

  { id: "mobile-credit", name: "رصيد وكارتات", icon: "smartphone", group: "telecom" },
  { id: "internet", name: "إنترنت", icon: "wifi", group: "telecom" },

  { id: "education", name: "مدارس وجامعة", icon: "graduation-cap", group: "family" },
  { id: "kids", name: "أطفال", icon: "baby", group: "family" },
  { id: "clothes", name: "ملابس", icon: "shirt", group: "family" },
  { id: "grooming", name: "حلاقة وعناية", icon: "scissors", group: "family" },

  { id: "pharmacy", name: "صيدلية", icon: "pill", group: "health" },
  { id: "doctor", name: "طبيب ومختبر", icon: "stethoscope", group: "health" },

  { id: "weddings", name: "مناسبات وأعراس", icon: "party-popper", group: "social" },
  { id: "condolences", name: "فواتح وعزاء", icon: "flower", group: "social" },
  { id: "gifts", name: "هدايا وزيارات", icon: "gift", group: "social" },
  { id: "charity", name: "صدقات وخيرات", icon: "hand-heart", group: "social" },

  { id: "fun", name: "ترفيه وطلعات", icon: "ticket", group: "other" },
  { id: "smoking", name: "سكائر وأركيلة", icon: "cigarette", group: "other" },
  { id: OTHER_ID, name: "أخرى", icon: "package", group: "other" },

  // تصنيف ثابت: يُضاف تلقائياً عند تسجيل دفع قسط سلفة (لا يُختار يدوياً ولا يُحذف)
  { id: JAMIYA_CATEGORY_ID, name: "قسط سلفة", icon: "piggy-bank", group: "savings", system: true },
];

// الأيقونات التي يختار منها المستخدم عند إضافة تصنيف (كلها في icons/sprite.svg)
const CATEGORY_ICON_CHOICES = [
  "tag", "shopping-basket", "shopping-bag", "receipt", "utensils", "coffee", "croissant", "drumstick",
  "carrot", "apple", "egg", "fish", "sandwich", "pizza", "ice-cream-cone", "cake",
  "house", "key-round", "sofa", "lamp", "plug", "plug-zap", "utility-pole", "droplets",
  "flame", "spray-can", "wrench", "hammer", "paint-roller", "car", "car-taxi-front", "fuel",
  "bus", "train-front", "plane", "bike", "truck", "smartphone", "wifi", "tv",
  "graduation-cap", "backpack", "book-open", "pen-line", "baby", "milk", "shirt", "scissors",
  "glasses", "watch", "gem", "pill", "stethoscope", "dumbbell", "heart", "party-popper",
  "flower", "gift", "hand-heart", "landmark", "moon", "ticket", "gamepad-2", "music",
  "camera", "dice-5", "trophy", "dog", "cigarette", "banknote", "credit-card", "coins",
  "sparkles", "star", "sun", "umbrella", "package", "wallet",
];

// المجموعات المعروضة: الأساسية، ثم مجموعات المستخدم، و"أخرى" دائماً في الآخر
let GROUPS = [...DEFAULT_GROUPS];

// ألوان يختار منها المستخدم لمجموعته: الثمانية المختبرة والرمادي
const GROUP_COLOR_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, "rest"];

function applyCustomGroups(custom) {
  const other = DEFAULT_GROUPS.filter((g) => g.id === "other");
  GROUPS = [...DEFAULT_GROUPS.filter((g) => g.id !== "other"), ...custom, ...other];
}

// اللون الأقل استخداماً بين المجموعات، يُقترح للمجموعة الجديدة
function suggestGroupColor() {
  const counts = GROUP_COLOR_CHOICES.filter((c) => c !== "rest").map((c) => [c, GROUPS.filter((g) => g.color === c).length]);
  counts.sort((a, b) => a[1] - b[1] || b[0] - a[0]);
  return counts[0][0];
}

function sanitizeGroup(g) {
  if (!g || typeof g.id !== "string" || typeof g.name !== "string" || !g.name.trim()) return null;
  if (DEFAULT_GROUPS.some((d) => d.id === g.id)) return null;
  return {
    id: g.id,
    name: g.name.trim().slice(0, 30),
    icon: CATEGORY_ICON_CHOICES.includes(g.icon) ? g.icon : "tag",
    color: GROUP_COLOR_CHOICES.includes(g.color) ? g.color : "rest",
    custom: true,
  };
}

function getGroup(id) {
  return GROUPS.find((g) => g.id === id) || GROUPS[GROUPS.length - 1];
}

function groupColor(id) {
  const color = getGroup(id).color;
  return color === "rest" ? "var(--series-rest)" : `var(--series-${color})`;
}

// ===== نقل بيانات النسخ السابقة (قبل المجموعات) =====

// التصنيفات القديمة التي لها مقابل في القائمة الجديدة
const LEGACY_CATEGORY_MAP = {
  food: "groceries",
  transport: "taxi",
  housing: "rent",
  health: "pharmacy",
  fun: "fun",
  other: OTHER_ID,
};

// تصنيفات قديمة بلا مقابل واضح: تبقى باسمها في المجموعة الأقرب
const LEGACY_KEEP = {
  bills: { group: "home", icon: "receipt" },
  shopping: { group: "other", icon: "shopping-bag" },
};

// تنقل state = { categories, expenses, recurring, budgets } إلى المجموعات. تُرجع true إذا غيّرت شيئاً
function migrateToGroups(state) {
  const old = state.categories || [];
  if (old.length && old.every((c) => typeof c.group === "string")) return false;

  const idMap = {};
  const kept = [];
  for (const c of old) {
    if (typeof c.group === "string") {
      kept.push(c);
    } else if (LEGACY_CATEGORY_MAP[c.id]) {
      idMap[c.id] = LEGACY_CATEGORY_MAP[c.id];
    } else {
      // تصنيف أضافه المستخدم بنفسه (أو قديم بلا مقابل): يبقى باسمه
      const extra = LEGACY_KEEP[c.id] || { group: "other", icon: "tag" };
      kept.push({ id: c.id, name: c.name, icon: extra.icon, group: extra.group });
    }
  }

  const defaults = DEFAULT_CATEGORIES.filter((d) => !kept.some((k) => k.id === d.id)).map((d) => ({ ...d }));
  state.categories = [...defaults, ...kept];
  const remap = (id) => idMap[id] || id;

  for (const e of state.expenses || []) e.categoryId = remap(e.categoryId);
  for (const r of state.recurring || []) r.categoryId = remap(r.categoryId);
  if (state.budgets && state.budgets.byCategory) {
    const byCategory = {};
    for (const [id, amount] of Object.entries(state.budgets.byCategory)) {
      byCategory[remap(id)] = (byCategory[remap(id)] || 0) + amount;
    }
    state.budgets.byCategory = byCategory;
  }
  return true;
}

// التصنيفات مرتبة حسب المجموعات
function sortCategories(list) {
  const order = (c) => GROUPS.findIndex((g) => g.id === c.group);
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => order(a.c) - order(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

// ===== طرق الدفع =====

// "كاش" لا يُحذف، وهو طريقة الدفع لكل مصروف لم تُحدَّد طريقته (مثل المصاريف القديمة)
const CASH_ID = "cash";

const DEFAULT_METHODS = [
  { id: CASH_ID, name: "كاش", icon: "banknote" },
  { id: "qi-card", name: "كي كارد", icon: "credit-card" },
  { id: "zain-cash", name: "زين كاش", icon: "smartphone" },
  { id: "bank-card", name: "بطاقة مصرفية", icon: "landmark" },
];

function sanitizeMethod(m) {
  if (!m || typeof m.id !== "string" || typeof m.name !== "string" || !m.name.trim()) return null;
  return { id: m.id, name: m.name.trim().slice(0, 30), icon: CATEGORY_ICON_CHOICES.includes(m.icon) ? m.icon : "wallet" };
}

// ===== أنواع الدخل =====

const INCOME_TYPES = [
  { id: "salary", name: "راتب", icon: "briefcase" },
  { id: "extra", name: "عمل إضافي", icon: "hammer" },
  { id: "rent-in", name: "إيجار أستلمه", icon: "key-round" },
  { id: "gift-in", name: "هدية", icon: "gift" },
  { id: "other-in", name: "دخل آخر", icon: "coins" },
];

function getIncomeType(id) {
  return INCOME_TYPES.find((t) => t.id === id) || INCOME_TYPES[INCOME_TYPES.length - 1];
}
