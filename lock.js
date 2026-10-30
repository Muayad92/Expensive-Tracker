// قفل التطبيق: رمز من 4 أرقام، و Face ID (أو البصمة) إن كان الجوال يدعمه
// القفل يمنع من يمسك الجوال من فتح التطبيق. الرمز لا يُحفظ نفسه، بل بصمته (PBKDF2)
// يعتمد على app.js: $ و el و icon و setupDialog و showToast

const LOCK_KEY = "appLock"; // { salt, hash, credentialId }
const LOCK_ATTEMPTS_KEY = "lockAttempts"; // { count, until }
const PIN_LENGTH = 4;
// يُطلب القفل إذا رجعت للتطبيق بعد دقيقة أو أكثر
const LOCK_AFTER_MS = 60 * 1000;
// بعد 5 محاولات خاطئة: انتظار يتضاعف (30 ثانية، دقيقة، ...) حتى 15 دقيقة
const FREE_ATTEMPTS = 5;
const PBKDF2_ITERATIONS = 100000;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // يبقى كما هو إذا تعذّر الحفظ
  }
}

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromBase64(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return toBase64(bits);
}

async function setPin(pin) {
  const salt = toBase64(randomBytes(16));
  const old = readJson(LOCK_KEY) || {};
  writeJson(LOCK_KEY, { ...old, salt, hash: await hashPin(pin, salt) });
}

async function checkPin(pin) {
  const lock = readJson(LOCK_KEY);
  return Boolean(lock) && (await hashPin(pin, lock.salt)) === lock.hash;
}

// ===== Face ID / البصمة (WebAuthn) =====

async function biometricAvailable() {
  try {
    return Boolean(window.PublicKeyCredential) && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

async function registerBiometric() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "مصاريفي" },
      user: { id: randomBytes(16), name: "مصاريفي", displayName: "قفل مصاريفي" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
    },
  });
  writeJson(LOCK_KEY, { ...readJson(LOCK_KEY), credentialId: toBase64(credential.rawId) });
}

// يُرجع true إذا تحقق الجوال من وجهك (أو بصمتك)
async function verifyBiometric() {
  const lock = readJson(LOCK_KEY);
  if (!lock?.credentialId) return false;
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: fromBase64(lock.credentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  // الخانة 32 في authenticatorData فيها علامة "تحقق من المستخدم" (UV)
  return Boolean(credential) && (new Uint8Array(credential.response.authenticatorData)[32] & 0x04) !== 0;
}

// ===== شاشة الرمز =====
// نفس الشاشة للفتح، ولاختيار رمز جديد، وللتأكد من الرمز قبل إيقاف القفل

const lockScreen = $("lock-screen");
let padMode = "unlock"; // "unlock" | "set" | "confirm" | "verify"
let entered = "";
let firstPin = "";
let onPadDone = null;
let waitTimer = null;

function attemptsInfo() {
  return readJson(LOCK_ATTEMPTS_KEY) || { count: 0, until: 0 };
}

function setLockMessage(text, bad = false) {
  const msg = $("lock-message");
  msg.textContent = text;
  msg.classList.toggle("bad", bad);
}

function renderDots() {
  [...$("lock-dots").children].forEach((dot, i) => dot.classList.toggle("filled", i < entered.length));
}

// انتظار بعد محاولات خاطئة كثيرة
function waitingSeconds() {
  return Math.max(0, Math.ceil((attemptsInfo().until - Date.now()) / 1000));
}

function showWait() {
  clearInterval(waitTimer);
  const tick = () => {
    const s = waitingSeconds();
    if (s === 0) {
      clearInterval(waitTimer);
      setLockMessage("");
      return;
    }
    setLockMessage(`حاولت كثيراً. انتظر ${s} ثانية`, true);
  };
  tick();
  waitTimer = setInterval(tick, 1000);
}

function openPad(mode, done) {
  padMode = mode;
  onPadDone = done;
  entered = "";
  renderDots();
  const titles = { unlock: "أدخل الرمز", set: "اختر رمزاً من 4 أرقام", confirm: "أعد كتابة الرمز", verify: "أدخل رمزك الحالي" };
  $("lock-title").textContent = titles[mode];
  setLockMessage("");
  $("lock-cancel").hidden = mode === "unlock";
  $("lock-forgot").hidden = mode !== "unlock";
  // الزر يبقى مكانه مخفياً حتى لا يتحرك الصفر
  $("lock-bio").classList.toggle("off", !(mode === "unlock" && readJson(LOCK_KEY)?.credentialId));
  if (!lockScreen.open) lockScreen.showModal();
  if (mode === "unlock" && waitingSeconds()) showWait();
}

function closePad() {
  clearInterval(waitTimer);
  lockScreen.close();
}

async function padFull() {
  const pin = entered;
  if (padMode === "set") {
    firstPin = pin;
    openPad("confirm", onPadDone);
    return;
  }
  if (padMode === "confirm") {
    if (pin !== firstPin) {
      openPad("set", onPadDone);
      setLockMessage("الرمزان مختلفان، جرّب مرة ثانية", true);
      return;
    }
    await setPin(pin);
    closePad();
    onPadDone?.();
    return;
  }
  // فتح القفل أو التأكد من الرمز
  if (await checkPin(pin)) {
    writeJson(LOCK_ATTEMPTS_KEY, null);
    closePad();
    onPadDone?.();
    return;
  }
  const info = attemptsInfo();
  info.count += 1;
  if (info.count >= FREE_ATTEMPTS) info.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (info.count - FREE_ATTEMPTS)) * 1000;
  writeJson(LOCK_ATTEMPTS_KEY, info);
  entered = "";
  renderDots();
  $("lock-dots").classList.remove("shake");
  void $("lock-dots").offsetWidth; // لإعادة تشغيل الاهتزاز
  $("lock-dots").classList.add("shake");
  if (waitingSeconds()) showWait();
  else setLockMessage("رمز خطأ", true);
}

function pressDigit(digit) {
  if (entered.length >= PIN_LENGTH || (padMode === "unlock" && waitingSeconds())) return;
  entered += digit;
  renderDots();
  if (entered.length === PIN_LENGTH) padFull();
}

function pressBackspace() {
  entered = entered.slice(0, -1);
  renderDots();
}

for (const btn of lockScreen.querySelectorAll("[data-digit]")) {
  btn.addEventListener("click", () => pressDigit(btn.dataset.digit));
}
$("lock-back").addEventListener("click", pressBackspace);
lockScreen.addEventListener("keydown", (event) => {
  if (/^[0-9]$/.test(event.key)) pressDigit(event.key);
  else if (event.key === "Backspace") pressBackspace();
});
// زر الرجوع أو Esc لا يغلق شاشة القفل
lockScreen.addEventListener("cancel", (event) => {
  if (padMode === "unlock") event.preventDefault();
});
$("lock-cancel").addEventListener("click", closePad);

// ===== القفل والفتح =====

let lockedNow = false;
let hiddenAt = null;

function unlocked() {
  lockedNow = false;
  document.documentElement.classList.remove("locked");
}

async function tryBiometric() {
  try {
    if (await verifyBiometric()) {
      writeJson(LOCK_ATTEMPTS_KEY, null);
      closePad();
      unlocked();
    }
  } catch {
    // أُلغي أو لم يتعرف: يبقى الرمز
    setLockMessage("استعمل الرمز");
  }
}

function lockApp() {
  if (!readJson(LOCK_KEY) || lockedNow) return;
  lockedNow = true;
  // النوافذ المفتوحة تبقى كما هي (مع ما كتبته فيها) وتُخفى حتى يُفتح القفل
  document.documentElement.classList.add("locked");
  openPad("unlock", unlocked);
  // نجرب Face ID مباشرة؛ إذا رفضه المتصفح بدون ضغطة، يبقى الزر
  if (readJson(LOCK_KEY)?.credentialId) tryBiometric();
}

$("lock-bio").addEventListener("click", tryBiometric);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt >= LOCK_AFTER_MS) lockApp();
});

// نسيت الرمز: مسح كل شي، ثم الاسترجاع من نسخة احتياطية
$("lock-forgot").addEventListener("click", () => {
  const last = localStorage.getItem(BACKUP_DATE_KEY);
  const backupText = last
    ? `آخر نسخة احتياطية حفظتها كانت في ${new Date(last).toLocaleDateString("ar-IQ-u-nu-latn")}.`
    : "لم تحفظ أي نسخة احتياطية من قبل.";
  if (!confirm(`لفتح التطبيق بدون الرمز يجب مسح كل بياناته.\n${backupText}\nبعدها تقدر ترجع بياناتك من: المزيد ← استرجاع من نسخة احتياطية.`)) return;
  if (!confirm("متأكد؟ سيُمسح كل شي في التطبيق ولا يمكن التراجع.")) return;
  try {
    localStorage.clear();
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // لا شيء آخر نفعله
  }
  location.reload();
});

// ===== الإعدادات (المزيد ← قفل التطبيق) =====

const lockSettings = $("lock-settings");

async function renderLockSettings() {
  const lock = readJson(LOCK_KEY);
  const box = $("lock-settings-body");
  box.innerHTML = "";
  $("lock-status").textContent = lock ? (lock.credentialId ? "مفعّل بالرمز و Face ID" : "مفعّل بالرمز") : "متوقف";
  if (!lock) {
    box.appendChild(el("p", "hint start", "عند تفعيله يطلب التطبيق رمزك (أو Face ID) كلما فتحته، أو رجعت له بعد دقيقة."));
    const on = iconText("button", "lock", "تفعيل القفل بالرمز", "primary-btn");
    on.type = "button";
    on.addEventListener("click", () => {
      lockSettings.close();
      openPad("set", () => {
        showToast("تم تفعيل القفل");
        openLockSettings();
      });
    });
    box.appendChild(on);
    return;
  }

  // Face ID
  const bioRow = el("div", "lock-row");
  bioRow.appendChild(iconText("span", "scan-face", "Face ID أو البصمة", "lock-row-label"));
  if (await biometricAvailable()) {
    const toggle = el("button", lock.credentialId ? "chip-btn" : "small-btn", lock.credentialId ? "إيقاف" : "تفعيل");
    toggle.type = "button";
    toggle.addEventListener("click", async () => {
      if (lock.credentialId) {
        writeJson(LOCK_KEY, { ...readJson(LOCK_KEY), credentialId: undefined });
        renderLockSettings();
        return;
      }
      try {
        await registerBiometric();
        showToast("تم تفعيل Face ID");
      } catch {
        alert("ما تفعّل Face ID. تأكد إنه مفعّل بإعدادات الجوال وجرّب مرة ثانية.");
      }
      renderLockSettings();
    });
    bioRow.appendChild(toggle);
  } else {
    bioRow.appendChild(el("span", "muted", "غير متاح هنا"));
  }
  box.appendChild(bioRow);

  const change = iconText("button", "pencil", "تغيير الرمز", "action-btn with-icon");
  change.type = "button";
  change.addEventListener("click", () => {
    lockSettings.close();
    openPad("verify", () => openPad("set", () => {
      showToast("تم تغيير الرمز");
      openLockSettings();
    }));
  });
  const off = el("button", "danger-btn", "إيقاف القفل");
  off.type = "button";
  off.addEventListener("click", () => {
    lockSettings.close();
    openPad("verify", () => {
      writeJson(LOCK_KEY, null);
      showToast("تم إيقاف القفل");
      openLockSettings();
    });
  });
  box.append(change, off);
}

function openLockSettings() {
  renderLockSettings();
  lockSettings.showModal();
}

$("open-lock").addEventListener("click", openLockSettings);
setupDialog(lockSettings);
renderLockSettings();

// عند فتح التطبيق
lockApp();
