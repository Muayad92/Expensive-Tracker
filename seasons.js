// المواسم: تنبيه قبل الموسم بحسب ما صرفته في الموسم نفسه العام الماضي
// يعتمد على الأدوات الموجودة في app.js: $ و el و save و formatMoney و todayString و countWord ...

/*
  الموسم:
  { id, name, icon, calendar: "hijri" أو "gregorian", month, day: يوم البداية,
    before: أيام الاستعداد قبل البداية (تُحسب مصاريفها من الموسم),
    length: مدة الموسم بالأيام, enabled }
*/

const DEFAULT_SEASONS = [
  { id: "ramadan", name: "رمضان وعيد الفطر", icon: "🌙", calendar: "hijri", month: 9, day: 1, before: 7, length: 33, enabled: true },
  { id: "adha", name: "عيد الأضحى", icon: "🐑", calendar: "hijri", month: 12, day: 10, before: 10, length: 4, enabled: true },
  { id: "school", name: "بداية المدارس", icon: "🎒", calendar: "gregorian", month: 9, day: 25, before: 14, length: 21, enabled: true },
];

// موسم يضيفه المستخدم: أسبوع استعداد قبله
const CUSTOM_SEASON_BEFORE = 7;

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];
// أسماء الأشهر الميلادية بالإنجليزية: January ... December
const GREGORIAN_MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString("en-US", { month: "long" })
);

if (!seasons) seasons = DEFAULT_SEASONS.map((s) => ({ ...s }));

// إعدادات خاصة بهذا الجوال: مدة التنبيه، والتنبيهات التي أغلقها المستخدم
const SEASON_SETTINGS_KEY = "seasonSettings";
let seasonSettings = { leadDays: 30, dismissed: [] };
try {
  const stored = JSON.parse(localStorage.getItem(SEASON_SETTINGS_KEY));
  if (stored && stored.leadDays > 0) seasonSettings = { leadDays: stored.leadDays, dismissed: stored.dismissed || [] };
} catch {
  // نستخدم الإعدادات الافتراضية
}

function saveSeasonSettings() {
  try {
    localStorage.setItem(SEASON_SETTINGS_KEY, JSON.stringify(seasonSettings));
  } catch {
    // ليست بيانات مهمة: أسوأ الاحتمالات أن يظهر التنبيه مرة أخرى
  }
}

// ===== التقويم الهجري (أم القرى، مدمج في المتصفح ويعمل بدون إنترنت) =====

let hijriFormat = null;
try {
  const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric" });
  if (f.resolvedOptions().calendar === "islamic-umalqura") hijriFormat = f;
} catch {
  // المتصفح لا يدعم التقويم الهجري: تُخفى المواسم الهجرية
}

function hijriMonthDay(date) {
  const parts = Object.fromEntries(hijriFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { month: Number(parts.month), day: Number(parts.day) };
}

// ===== أدوات التاريخ =====

const SEARCH_RANGE_DAYS = 400; // نبحث عن مواعيد المواسم في سنة قبل اليوم وسنة بعده

function parseDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function dayDiff(from, to) {
  return Math.round((to - from) / 86400000);
}

function longDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); // 8 February 2027
}

// جدول التاريخ الهجري لكل يوم في نطاق البحث، يُحسب مرة واحدة في اليوم
let hijriTable = { day: null, rows: [] };

function getHijriTable() {
  const today = todayString();
  if (hijriTable.day !== today) {
    const base = parseDate(today);
    const rows = [];
    for (let i = -SEARCH_RANGE_DAYS; i <= SEARCH_RANGE_DAYS; i++) {
      const date = addDays(base, i);
      rows.push({ date, ...hijriMonthDay(date) });
    }
    hijriTable = { day: today, rows };
  }
  return hijriTable.rows;
}

// كل تواريخ بداية الموسم في نطاق البحث، مرتبة
function seasonStarts(season) {
  if (season.calendar === "hijri") {
    if (!hijriFormat) return [];
    return getHijriTable()
      .filter((r) => r.month === season.month && r.day === season.day)
      .map((r) => r.date);
  }
  const year = parseDate(todayString()).getFullYear();
  return [year - 1, year, year + 1].map((y) => {
    const lastDay = new Date(y, season.month, 0).getDate(); // مثلاً 30 شباط تصبح 28
    return new Date(y, season.month - 1, Math.min(season.day, lastDay));
  });
}

// الموسم الحالي أو القادم، والموسم الذي قبله للمقارنة
function seasonTimeline(season) {
  const today = parseDate(todayString());
  const starts = seasonStarts(season);
  const index = starts.findIndex((start) => addDays(start, season.length) > today);
  if (index === -1) return null;
  const start = starts[index];
  return {
    start,
    previous: starts[index - 1] || null,
    daysLeft: dayDiff(today, start),
    active: start <= today,
  };
}

// مصاريف الموسم: من أيام الاستعداد قبله حتى نهايته
function seasonSpending(season, start) {
  const from = isoDate(addDays(start, -season.before));
  const to = isoDate(addDays(start, season.length));
  return expenses.filter((e) => e.date >= from && e.date < to).reduce((s, e) => s + e.amount, 0);
}

function seasonDateText(season, date) {
  return season.calendar === "hijri" ? `تقريباً ${longDate(date)}` : longDate(date);
}

function describeSeason(season) {
  const month = season.calendar === "hijri" ? HIJRI_MONTHS[season.month - 1] : GREGORIAN_MONTHS[season.month - 1];
  const calendar = season.calendar === "hijri" ? "هجري" : "ميلادي";
  return `${season.day} ${month} (${calendar}) · ${countWord(season.length, "يوم", "يومان", "أيام")}`;
}

// ===== التحقق من بيانات النسخة الاحتياطية (يستخدمها app.js عند الاسترجاع) =====

function sanitizeSeason(s) {
  if (!s || typeof s.id !== "string" || typeof s.name !== "string" || !s.name.trim()) return null;
  if (!["hijri", "gregorian"].includes(s.calendar)) return null;
  const month = Math.round(s.month);
  const day = Math.round(s.day);
  const maxDay = s.calendar === "hijri" ? 29 : 31;
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= maxDay)) return null;
  const clamp = (n, min, max, fallback) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback);
  return {
    id: s.id,
    name: s.name.trim().slice(0, 30),
    icon: typeof s.icon === "string" && s.icon.trim() ? s.icon.trim().slice(0, 4) : "📅",
    calendar: s.calendar,
    month,
    day,
    before: clamp(s.before, 0, 30, CUSTOM_SEASON_BEFORE),
    length: clamp(s.length, 1, 90, 7),
    enabled: s.enabled !== false,
  };
}

// ===== العرض =====

function renderSeasons() {
  renderSeasonAlerts();
  renderSeasonList();
}

function renderSeasonAlerts() {
  const box = $("season-alerts");
  box.innerHTML = "";

  for (const season of seasons.filter((s) => s.enabled)) {
    const t = seasonTimeline(season);
    if (!t) continue;
    const key = `${season.id}:${isoDate(t.start)}`;
    if (seasonSettings.dismissed.includes(key)) continue;
    if (!t.active && t.daysLeft > seasonSettings.leadDays) continue;

    const previousSpend = t.previous ? seasonSpending(season, t.previous) : 0;
    const card = el("section", "card season-alert");

    if (t.active) {
      card.appendChild(el("h2", "", `${season.icon} أنت الآن في موسم ${season.name}`));
      const current = seasonSpending(season, t.start);
      card.appendChild(el("p", "", `صرفت فيه حتى الآن ${formatMoney(current)}`));
      if (previousSpend) {
        const percent = Math.round((current / previousSpend) * 100);
        card.appendChild(el("p", "muted", `الموسم الماضي صرفت ${formatMoney(previousSpend)} · أنت الآن عند ${percent}% منه`));
      }
    } else {
      card.appendChild(el("h2", "", `${season.icon} ${season.name} بعد ${countWord(t.daysLeft, "يوم", "يومين", "أيام")}`));
      card.appendChild(el("p", "muted", seasonDateText(season, t.start)));
      if (previousSpend) {
        const hours = work ? ` (${workTime(previousSpend)})` : "";
        card.appendChild(el("p", "", `الموسم الماضي صرفت ${formatMoney(previousSpend)}${hours}`));
        // المبلغ اليومي مقرّب لأعلى لأقرب ألف دينار
        const daily = Math.ceil(previousSpend / t.daysLeft / 1000) * 1000;
        card.appendChild(el("p", "season-tip", `💡 لتجهّز المبلغ من الآن: وفّر ${formatMoney(daily)} يومياً`));
      } else {
        card.appendChild(
          el("p", "muted", "لا توجد مصاريف مسجلة من الموسم الماضي. سجّل مصاريف هذا الموسم لتعرف تكلفته في العام القادم.")
        );
      }
    }

    const dismiss = el("button", "small-btn", "تمام 👍");
    dismiss.type = "button";
    dismiss.addEventListener("click", () => {
      // نحتفظ بآخر 50 فقط حتى لا تكبر القائمة مع السنين
      seasonSettings.dismissed = [...seasonSettings.dismissed, key].slice(-50);
      saveSeasonSettings();
      renderSeasons();
    });
    card.appendChild(dismiss);
    box.appendChild(card);
  }
}

function renderSeasonList() {
  const list = $("season-list");
  list.innerHTML = "";
  const rows = seasons
    .filter((s) => s.enabled)
    .map((season) => ({ season, t: seasonTimeline(season) }))
    .sort((a, b) => (a.t ? a.t.daysLeft : Infinity) - (b.t ? b.t.daysLeft : Infinity));

  if (rows.length === 0) {
    list.appendChild(el("li", "muted", "لا توجد مواسم مفعّلة. اضغط \"⚙️ تعديل\" لإضافة موسم."));
    return;
  }

  for (const { season, t } of rows) {
    const li = el("li", "season-row");
    const info = el("div", "season-info");
    info.appendChild(el("strong", "", `${season.icon} ${season.name}`));

    if (!t) {
      info.appendChild(el("span", "muted", "التقويم الهجري غير مدعوم في هذا المتصفح"));
      li.appendChild(info);
      list.appendChild(li);
      continue;
    }

    const details = [seasonDateText(season, t.start)];
    const previousSpend = t.previous ? seasonSpending(season, t.previous) : 0;
    if (previousSpend) details.push(`الموسم الماضي: ${formatMoney(previousSpend)}`);
    info.appendChild(el("span", "muted", details.join(" · ")));

    const when = t.active ? "🔔 الآن" : t.daysLeft === 0 ? "اليوم" : `بعد ${countWord(t.daysLeft, "يوم", "يومين", "أيام")}`;
    li.append(info, el("span", t.active ? "season-when active" : "season-when", when));
    list.appendChild(li);
  }
}

// ===== إدارة المواسم =====

const seasonsDialog = $("seasons-dialog");
const seasonForm = $("season-form");
const seasonMonth = $("season-month");
const seasonDay = $("season-day");

function seasonCalendar() {
  return seasonForm.querySelector('input[name="season-calendar"]:checked').value;
}

function fillSeasonMonths() {
  const names = seasonCalendar() === "hijri" ? HIJRI_MONTHS : GREGORIAN_MONTHS;
  const selected = seasonMonth.value || "1";
  seasonMonth.innerHTML = "";
  names.forEach((name, i) => {
    const option = el("option", "", name);
    option.value = i + 1;
    seasonMonth.appendChild(option);
  });
  seasonMonth.value = selected;
  // الشهر الهجري 29 أو 30 يوماً، فنكتفي بـ 29 حتى يوجد اليوم في كل سنة
  seasonDay.max = seasonCalendar() === "hijri" ? 29 : 31;
}

function renderSeasonManageList() {
  const list = $("season-manage-list");
  list.innerHTML = "";
  for (const season of seasons) {
    const li = el("li", "category-row");

    const toggle = el("input");
    toggle.type = "checkbox";
    toggle.checked = season.enabled;
    toggle.setAttribute("aria-label", `تفعيل ${season.name}`);
    toggle.addEventListener("change", () => {
      season.enabled = toggle.checked;
      save();
    });

    const info = el("div", "season-info");
    info.append(el("strong", "", `${season.icon} ${season.name}`), el("span", "muted", describeSeason(season)));

    const del = el("button", "delete-btn");
    del.appendChild(icon("trash-2"));
    del.type = "button";
    del.setAttribute("aria-label", `حذف ${season.name}`);
    del.addEventListener("click", () => {
      if (!confirm(`حذف موسم "${season.name}"؟`)) return;
      seasons = seasons.filter((s) => s !== season);
      save();
      renderSeasonManageList();
    });

    li.append(toggle, info, del);
    list.appendChild(li);
  }
  $("restore-seasons").hidden = DEFAULT_SEASONS.every((d) => seasons.some((s) => s.id === d.id));
}

$("manage-seasons").addEventListener("click", () => {
  $("season-lead").value = String(seasonSettings.leadDays);
  seasonForm.reset();
  fillSeasonMonths();
  renderSeasonManageList();
  seasonsDialog.showModal();
});

$("season-lead").addEventListener("change", (event) => {
  seasonSettings.leadDays = Number(event.target.value);
  saveSeasonSettings();
  renderSeasons();
});

for (const radio of seasonForm.querySelectorAll('input[name="season-calendar"]')) {
  radio.addEventListener("change", fillSeasonMonths);
}

$("restore-seasons").addEventListener("click", () => {
  for (const d of DEFAULT_SEASONS) {
    if (!seasons.some((s) => s.id === d.id)) seasons.push({ ...d });
  }
  save();
  renderSeasonManageList();
});

seasonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const season = sanitizeSeason({
    id: newId(),
    name: $("season-name").value,
    icon: $("season-icon").value,
    calendar: seasonCalendar(),
    month: Number(seasonMonth.value),
    day: Number(seasonDay.value),
    before: CUSTOM_SEASON_BEFORE,
    length: Number($("season-length").value),
    enabled: true,
  });
  if (!season) {
    alert("الرجاء إكمال بيانات الموسم بشكل صحيح.");
    return;
  }
  seasons.push(season);
  save();
  seasonForm.reset();
  fillSeasonMonths();
  renderSeasonManageList();
});

// ===== التشغيل =====

setupDialog(seasonsDialog);
document.addEventListener("data-changed", renderSeasons);
renderSeasons();
