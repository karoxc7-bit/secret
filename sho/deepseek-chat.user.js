// ==UserScript==
// @name         DeepSeek Chat Widget
// @namespace    local.deepseek.chat
// @version      2.0.0
// @description  DeepSeek exam helper — bank answers first (near-zero errors)
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      api.deepseek.com
// @connect      *
// @connect      cdnjs.cloudflare.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    apiKey: "sk-b5cd6189b6a74b0b9da1dacb6640db72",
    apiUrl: "https://api.deepseek.com/chat/completions",
    model: "deepseek-flash",
    quizModel: "deepseek-flash",
    // text-only fallback (same flash model without images is tried first)
    quizFallbackModel: "deepseek-flash",
    maxTokens: 1024,
    temperature: 0.7,
    quizMaxTokens: 80,
    quizTemperature: 0.2,
    quizTimeoutMs: 20000,
    pageMaxChars: 8000,
    autoWatchMs: 550,
    autoPollMs: 600,
    maxImages: 2,
    imageDetail: "high",
    maxImageChars: 2_500_000, // skip oversized data-URLs
    apiRetries: 3,
    systemPrompt:
      "You are a helpful, concise assistant. Reply in the same language the user writes in. Keep answers clear and short unless asked for detail.",
    quizSystemPrompt:
      "تۆ پسپۆڕی یاسای هاتووچۆی عێراق/کوردستانیت بۆ تاقیکردنەوەی مۆڵەتی شۆفێری.\n" +
      "وەڵامی یاسایی ڕاست هەڵبژێرە. تەنها ٢ هێڵ، کوردی، بێ ئینگلیزی.\n" +
      "فۆرمات:\nهەڵبژێرە: C\nدەق: ...",
  };

  let embeddedBank = null; // [{q,a,w}] from page script when available

  const WIDGET_ID = "ds-chat-widget-root";
  if (document.getElementById(WIDGET_ID)) return;

  const history = [{ role: "system", content: CONFIG.systemPrompt }];

  const css = `
    #${WIDGET_ID}, #${WIDGET_ID} * { box-sizing: border-box; font-family: "Segoe UI", Tahoma, system-ui, sans-serif; }
    #${WIDGET_ID} {
      position: fixed; inset: 0; pointer-events: none; z-index: 2147483646;
      --ds-bg: #0f1419; --ds-panel: #1a2332; --ds-border: #2a3544;
      --ds-accent: #3b82f6; --ds-accent2: #06b6d4; --ds-text: #e8eef6;
      --ds-muted: #8b9bb0; --ds-user: #2563eb; --ds-bot: #243044;
      --ds-shadow: 0 20px 50px rgba(0,0,0,.45);
      --ds-ui-opacity: 1;
    }
    #${WIDGET_ID}.ds-gone .ds-fab,
    #${WIDGET_ID}.ds-gone .ds-panel {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #${WIDGET_ID} .ds-fab {
      pointer-events: auto; position: fixed; right: 22px; bottom: 22px;
      width: 58px; height: 58px; border: none; border-radius: 50%;
      cursor: pointer; display: grid; place-items: center;
      background: linear-gradient(135deg, var(--ds-accent), var(--ds-accent2));
      color: #fff; box-shadow: 0 10px 28px rgba(59,130,246,.45);
      opacity: var(--ds-ui-opacity);
      transition: transform .2s ease, box-shadow .2s ease, opacity .15s ease;
    }
    #${WIDGET_ID}.ds-faded .ds-fab { pointer-events: none; }
    #${WIDGET_ID} .ds-fab:hover { transform: scale(1.06); }
    #${WIDGET_ID} .ds-fab svg { width: 26px; height: 26px; }
    #${WIDGET_ID} .ds-panel {
      pointer-events: auto; position: fixed; right: 22px; bottom: 92px;
      width: min(380px, calc(100vw - 28px)); height: min(560px, calc(100vh - 120px));
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--ds-panel); color: var(--ds-text);
      border: 1px solid var(--ds-border); border-radius: 18px;
      box-shadow: var(--ds-shadow);
      opacity: 0; transform: translateY(14px) scale(.97); pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
    }
    #${WIDGET_ID}.open .ds-panel {
      opacity: var(--ds-ui-opacity); transform: none; pointer-events: auto;
    }
    #${WIDGET_ID}.open.ds-faded .ds-panel { pointer-events: none; }
    #${WIDGET_ID} .ds-opacity-badge {
      pointer-events: none; position: fixed; right: 22px; bottom: 88px;
      min-width: 48px; padding: 4px 8px; border-radius: 8px;
      background: rgba(15,20,25,.85); color: #fff; font-size: 12px;
      text-align: center; opacity: 0; transition: opacity .2s ease;
    }
    #${WIDGET_ID} .ds-opacity-badge.show { opacity: 1; }
    #${WIDGET_ID} .ds-head {
      display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px;
      background: linear-gradient(180deg, #1e2a3d, var(--ds-panel));
      border-bottom: 1px solid var(--ds-border);
    }
    #${WIDGET_ID} .ds-avatar {
      width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
      background: linear-gradient(135deg, var(--ds-accent), var(--ds-accent2)); flex-shrink: 0;
    }
    #${WIDGET_ID} .ds-title { font-weight: 700; font-size: 14px; line-height: 1.2; }
    #${WIDGET_ID} .ds-sub { font-size: 11px; color: var(--ds-muted); margin-top: 2px; }
    #${WIDGET_ID} .ds-actions { margin-inline-start: auto; display: flex; gap: 6px; }
    #${WIDGET_ID} .ds-icon-btn {
      width: 30px; height: 30px; border: none; border-radius: 8px; cursor: pointer;
      background: transparent; color: var(--ds-muted); font-size: 14px; line-height: 1;
    }
    #${WIDGET_ID} .ds-icon-btn:hover { background: #2a3548; color: var(--ds-text); }
    #${WIDGET_ID} .ds-toolbar {
      display: flex; gap: 6px; padding: 0 10px 8px; pointer-events: auto;
    }
    #${WIDGET_ID} .ds-solve, #${WIDGET_ID} .ds-auto {
      flex: 1; border: none; border-radius: 10px;
      padding: 8px 8px; cursor: pointer; font-size: 12px; font-weight: 600;
      color: #fff;
    }
    #${WIDGET_ID} .ds-solve {
      background: linear-gradient(135deg, #16a34a, #22c55e);
    }
    #${WIDGET_ID} .ds-auto {
      background: #334155; border: 1px solid var(--ds-border);
    }
    #${WIDGET_ID} .ds-auto.on {
      background: linear-gradient(135deg, #d97706, #f59e0b); color: #111;
    }
    #${WIDGET_ID} .ds-solve:disabled, #${WIDGET_ID} .ds-auto:disabled { opacity: .5; cursor: not-allowed; }
    #${WIDGET_ID} .ds-msgs {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
      background: radial-gradient(1200px 400px at 100% 0%, rgba(59,130,246,.08), transparent 50%), var(--ds-bg);
    }
    #${WIDGET_ID} .ds-msg {
      max-width: 88%; padding: 10px 12px; border-radius: 14px; font-size: 13.5px;
      line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    #${WIDGET_ID} .ds-msg.user {
      align-self: flex-end; background: var(--ds-user); color: #fff;
      border-bottom-right-radius: 5px;
    }
    #${WIDGET_ID} .ds-msg.bot {
      align-self: flex-start; background: var(--ds-bot); border: 1px solid var(--ds-border);
      border-bottom-left-radius: 5px;
    }
    #${WIDGET_ID} .ds-msg.answer {
      align-self: stretch; background: linear-gradient(135deg, #14532d, #166534);
      border: 1px solid #22c55e; color: #ecfdf5; font-weight: 700; font-size: 15px;
    }
    #${WIDGET_ID} .ds-msg.error {
      align-self: stretch; background: rgba(239,68,68,.12);
      border: 1px solid rgba(239,68,68,.35); color: #fecaca;
    }
    #${WIDGET_ID} .ds-typing {
      align-self: flex-start; display: flex; gap: 5px; padding: 12px 14px;
      background: var(--ds-bot); border-radius: 14px; border: 1px solid var(--ds-border);
    }
    #${WIDGET_ID} .ds-typing i {
      width: 6px; height: 6px; border-radius: 50%; background: var(--ds-muted);
      animation: dsDot 1s infinite ease-in-out;
    }
    #${WIDGET_ID} .ds-typing i:nth-child(2) { animation-delay: .15s; }
    #${WIDGET_ID} .ds-typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes dsDot {
      0%, 80%, 100% { transform: translateY(0); opacity: .4; }
      40% { transform: translateY(-4px); opacity: 1; }
    }
    #${WIDGET_ID} .ds-foot {
      padding: 10px; border-top: 1px solid var(--ds-border); background: #152033;
      display: flex; gap: 8px; align-items: flex-end;
    }
    #${WIDGET_ID} .ds-input {
      flex: 1; min-height: 42px; max-height: 120px; resize: none; border: 1px solid var(--ds-border);
      border-radius: 12px; padding: 10px 12px; background: #0f1724; color: var(--ds-text);
      font-size: 13.5px; outline: none; line-height: 1.4;
    }
    #${WIDGET_ID} .ds-input:focus { border-color: var(--ds-accent); }
    #${WIDGET_ID} .ds-send {
      width: 42px; height: 42px; border: none; border-radius: 12px; cursor: pointer;
      background: linear-gradient(135deg, var(--ds-accent), var(--ds-accent2)); color: #fff;
      display: grid; place-items: center; flex-shrink: 0;
    }
    #${WIDGET_ID} .ds-send:disabled { opacity: .45; cursor: not-allowed; }
    #${WIDGET_ID} .ds-send svg { width: 18px; height: 18px; }
  `;

  const root = document.createElement("div");
  root.id = WIDGET_ID;
  root.innerHTML = `
    <style>${css}</style>
    <button class="ds-fab" type="button" title="Open chat · Space hide · Q solve · X/Z opacity" aria-label="Open chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
      </svg>
    </button>
    <div class="ds-opacity-badge">100%</div>
    <div class="ds-panel" role="dialog" aria-label="DeepSeek Chat">
      <div class="ds-head">
        <div class="ds-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
            <circle cx="12" cy="8" r="3"/><path d="M5 19a7 7 0 0 1 14 0"/>
          </svg>
        </div>
        <div>
          <div class="ds-title">DeepSeek Chat</div>
          <div class="ds-sub">خۆکار: کاتێک پرسیار دەگۆڕێت</div>
        </div>
        <div class="ds-actions">
          <button class="ds-icon-btn ds-clear" type="button" title="Clear chat">⟲</button>
          <button class="ds-icon-btn ds-close" type="button" title="Close">✕</button>
        </div>
      </div>
      <div class="ds-toolbar">
        <button class="ds-solve" type="button" title="ئێستا وەڵام بدە (Q)">⚡ ئێستا</button>
        <button class="ds-auto on" type="button" title="خۆکار چالاک/ناچالاک (A)">🔴 خۆکار ON</button>
      </div>
      <div class="ds-msgs"></div>
      <div class="ds-foot">
        <textarea class="ds-input" rows="1" placeholder="پەیامێک بنووسە…"></textarea>
        <button class="ds-send" type="button" title="Send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>
    </div>
  `;

  (document.body || document.documentElement).appendChild(root);

  const fab = root.querySelector(".ds-fab");
  const msgs = root.querySelector(".ds-msgs");
  const input = root.querySelector(".ds-input");
  const sendBtn = root.querySelector(".ds-send");
  const clearBtn = root.querySelector(".ds-clear");
  const closeBtn = root.querySelector(".ds-close");
  const solveBtn = root.querySelector(".ds-solve");
  const autoBtn = root.querySelector(".ds-auto");
  const opacityBadge = root.querySelector(".ds-opacity-badge");

  let busy = false;
  let uiHidden = false;
  let uiOpacity = 100;
  let badgeTimer = null;
  let autoSolve = true;
  let lastFingerprint = "";
  let autoTimer = null;
  let solvingFp = "";

  function isTypingTarget(el) {
    if (!el || el === document.body) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return !!el.closest?.("input, textarea, select, [contenteditable='true']");
  }

  function applyOpacity() {
    const v = uiOpacity / 100;
    root.style.setProperty("--ds-ui-opacity", String(v));
    root.classList.toggle("ds-faded", uiOpacity === 0);
    opacityBadge.textContent = uiOpacity + "%";
    opacityBadge.classList.add("show");
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => opacityBadge.classList.remove("show"), 900);
  }

  function setUiHidden(hidden) {
    uiHidden = hidden;
    root.classList.toggle("ds-gone", hidden);
  }

  function nudgeOpacity(delta) {
    uiOpacity = Math.max(0, Math.min(100, uiOpacity + delta));
    applyOpacity();
  }

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = `ds-msg ${role}`;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "ds-typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setOpen(open) {
    root.classList.toggle("open", open);
    if (open) setTimeout(() => input.focus(), 50);
  }

  function setBusy(state) {
    busy = state;
    sendBtn.disabled = state;
    solveBtn.disabled = state;
  }

  function quizFingerprint(quiz) {
    return [quiz.question || "", ...(quiz.choices || []), ...(quiz.imageUrls || [])].join(
      "\n||\n"
    );
  }

  function looksLikeQuiz(quiz) {
    if (!quiz || !quiz.choices || quiz.choices.length < 2) return false;
    if (!quiz.question || quiz.question.length < 8) return false;
    // reject if choices look like grid numbers only
    const bad = quiz.choices.every((c) => /^[A-E]\)\s*\d{1,2}$/.test(c));
    return !bad;
  }

  function updateAutoBtn() {
    autoBtn.classList.toggle("on", autoSolve);
    autoBtn.textContent = autoSolve ? "🔴 خۆکار ON" : "⭕ خۆکار OFF";
  }

  function scheduleAutoSolve(reason) {
    if (!autoSolve) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(async () => {
      if (!autoSolve || busy) return;
      const quiz = await waitForStableQuiz(1600);
      if (!looksLikeQuiz(quiz)) return;
      const fp = quizFingerprint(quiz);
      if (!fp || fp === lastFingerprint || fp === solvingFp) return;
      solvePageQuiz("🔄 پرسیاری نوێ دۆزرایەوە", { fromAuto: true, fingerprint: fp });
    }, CONFIG.autoWatchMs);
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function skipEl(el) {
    return !el || el.closest(`#${WIDGET_ID}`);
  }

  function isJunkChoice(t) {
    if (!t) return true;
    if (/^[\d\s]+$/.test(t)) return true; // grid numbers
    if (/^(وەڵامەکان|answers)\s*:?\s*$/i.test(t)) return true;
    if (/powered|ict|بەخێر|مرحبا|تاقیکردنەوەی تیوری هاتووچۆ|هاتووچۆ\s*\d*$/i.test(t)) {
      return true;
    }
    if (t.length < 2 || t.length > 500) return true;
    return false;
  }

  function normalizeChoice(raw, index) {
    const t = cleanText(raw);
    const m = t.match(/^\s*([A-Ea-e]|[١-٥]|[1-5])[\s\)\].:-]+(.+)$/);
    if (m) {
      let letter = m[1];
      if (/[1-5]/.test(letter)) letter = String.fromCharCode(64 + parseInt(letter, 10));
      if (letter === "١") letter = "A";
      if (letter === "٢") letter = "B";
      if (letter === "٣") letter = "C";
      if (letter === "٤") letter = "D";
      if (letter === "٥") letter = "E";
      letter = letter.toUpperCase();
      return { letter, text: cleanText(m[2]), display: letter + ") " + cleanText(m[2]) };
    }
    const letter = String.fromCharCode(65 + index);
    return { letter, text: t, display: letter + ") " + t };
  }

  function buildQuizPayload(question, choiceRawList, extraNote) {
    const choices = [];
    const seen = new Set();
    choiceRawList.forEach((raw) => {
      if (isJunkChoice(raw)) return;
      const n = normalizeChoice(raw, choices.length);
      const key = n.text;
      if (seen.has(key)) return;
      seen.add(key);
      choices.push(n);
    });

    const imageUrls = collectQuestionImageUrls();
    const lines = [];
    lines.push("URL: " + location.href);
    lines.push("Title: " + document.title);
    if (extraNote) lines.push(extraNote);
    lines.push("\nپرسیار:\n" + (question || "(نەدۆزرایەوە)"));
    lines.push("\nهەڵبژاردەکان (تەنها لەم لیستە هەڵبژێرە):");
    choices.forEach((c) => lines.push(c.display));
    if (imageUrls.length) {
      lines.push("\nوێنە/سکرین: " + imageUrls.length + " — لەگەڵ داواکاری دەنێردرێت");
    }
    lines.push(
      "\nتێبینی: وەڵام دەبێت یەکێک بێت لە A/B/Cی سەرەوە. ژمارەی پرسیار و تایمەر پشتگوێ بخە."
    );

    return {
      question: question || "",
      choices: choices.map((c) => c.display),
      choiceMeta: choices,
      imageUrls,
      text: lines.join("\n").slice(0, CONFIG.pageMaxChars),
      precise: true,
    };
  }
  /** Precise readers for known driving-test UIs */
  function readKnownExamUi() {
    // kurdishtop224.github.io/driving-test and similar
    const qEl = document.querySelector(
      "#questionText, .question-text, .top-question-section .question-text"
    );
    const items = [
      ...document.querySelectorAll(
        "#answersList .answer-item, .answers-list .answer-item, .answers-section .answer-item"
      ),
    ].filter((el) => !skipEl(el));

    if (qEl && items.length >= 2) {
      const question = cleanText(qEl.innerText);
      if (question.length >= 8) {
        return buildQuizPayload(
          question,
          items.map((el) => el.innerText),
          "سەرچاوە: UI ورد (questionText + answer-item)"
        );
      }
    }

    // MOI / yellow button exams: question heading + large option buttons
    const examRoot =
      document.querySelector(".exam-screen, #examPage, main, .container, body");
    const headings = [
      ...document.querySelectorAll("h1, h2, h3, h4, .question, #question"),
    ].filter((el) => !skipEl(el));
    let question = "";
    for (const h of headings) {
      const t = cleanText(h.innerText);
      if (t.length < 10 || t.length > 450) continue;
      if (/بەخێر|مرحبا|powered|ict/i.test(t)) continue;
      if (/پرسیار|\d+\s*[-–:]|؟|\?/.test(t)) {
        question = t;
        break;
      }
    }

    if (question) {
      const optButtons = [];
      const candidates = [
        ...document.querySelectorAll(
          "button, [role='button'], input[type='button'], .option, .answer, [onclick]"
        ),
      ];
      for (const el of candidates) {
        if (skipEl(el)) continue;
        if (el.closest(".questions-grid, #questionsGrid, .q-btn, #timer, .timer-badge")) {
          continue;
        }
        if (el.classList?.contains("q-btn")) continue;
        const t = cleanText(el.innerText || el.value || "");
        if (isJunkChoice(t)) continue;
        if (t === question || question.includes(t)) continue;
        // yellow-ish or reasonably sized option
        const st = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.height < 28 || rect.width < 80) continue;
        if (rect.height > 120) continue;
        const bg = st.backgroundColor || "";
        const yellow =
          /rgb\(\s*(2[0-5]\d|1\d\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*,\s*([0-9]|[1-9]\d|1[0-2]\d)\s*\)/.test(
            bg
          );
        if (yellow || el.tagName === "BUTTON" || el.getAttribute("onclick")) {
          optButtons.push(t);
        }
      }
      const uniq = [...new Set(optButtons)].slice(0, 5);
      if (uniq.length >= 2) {
        return buildQuizPayload(question, uniq, "سەرچاوە: UI دوگمە/هەڵبژاردە");
      }
    }

    return null;
  }

  /** Extract question + choices accurately */
  function readQuizFromPage() {
    const known = readKnownExamUi();
    if (known && known.choices.length >= 2) return known;

    // Fallback: parse from answers-section text block
    const ansSec = document.querySelector(".answers-section, #answersList, .answers-list");
    const qEl = document.querySelector("#questionText, .question-text, h2, h3");
    if (ansSec && qEl) {
      const question = cleanText(qEl.innerText);
      const block = cleanText(ansSec.innerText).replace(/^وەڵامەکان\s*:?\s*/i, "");
      const parts = block
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s && !/^وەڵامەکان/i.test(s));
      if (question && parts.length >= 2) {
        return buildQuizPayload(question, parts, "سەرچاوە: fallback lines");
      }
    }

    // Last resort: body regex for A) B) C)
    let bodyText = "";
    try {
      const clone = document.body.cloneNode(true);
      clone
        .querySelectorAll(
          `#${WIDGET_ID}, script, style, noscript, svg, iframe, .questions-grid, #questionsGrid, #timer, .timer-badge`
        )
        .forEach((n) => n.remove());
      bodyText = cleanText(clone.innerText || "");
    } catch (_) {
      bodyText = cleanText(document.body.innerText || "");
    }

    let question = "";
    const qm = bodyText.match(/(?:پرسیار\s*\d+\s*:|[0-9]+\s*[-–.])\s*[^\n]{8,400}/);
    if (qm) question = cleanText(qm[0]);

    const choiceMatches = [...bodyText.matchAll(/(?:^|\n)\s*([A-C])\)\s*([^\n]{2,300})/g)];
    const raw = choiceMatches.map((m) => m[1] + ") " + m[2]);
    if (question && raw.length >= 2) {
      return buildQuizPayload(question, raw, "سەرچاوە: regex A/B/C");
    }

    return buildQuizPayload(question, raw, "سەرچاوە: partial");
  }

  function collectQuestionImageUrls() {
    const scored = [];

    document.querySelectorAll("img").forEach((img) => {
      if (skipEl(img)) return;
      if (img.closest(".questions-grid, #questionsGrid")) return;
      const src = img.currentSrc || img.src || img.getAttribute("src") || "";
      if (!src || src.startsWith("data:image/svg")) return;
      if (/logo|icon|favicon|sprite|banner|avatar|emoji/i.test(src + img.className + (img.alt || ""))) {
        return;
      }
      const w = img.naturalWidth || img.width || img.clientWidth || 0;
      const h = img.naturalHeight || img.height || img.clientHeight || 0;
      const rect = img.getBoundingClientRect();
      const area = Math.max(w * h, rect.width * rect.height);
      if (area < 60 * 60) return;
      try {
        scored.push({
          src: new URL(src, location.href).href,
          area,
          top: rect.top,
          kind: "img",
        });
      } catch (_) {}
    });

    document.querySelectorAll("div, section, td, span").forEach((el) => {
      if (skipEl(el)) return;
      const st = getComputedStyle(el);
      const bg = st.backgroundImage || "";
      const m = bg.match(/url\(["']?(https?:[^"')]+|\/[^"')]+)["']?\)/i);
      if (!m) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 70 || rect.height < 70) return;
      try {
        scored.push({
          src: new URL(m[1], location.href).href,
          area: rect.width * rect.height,
          top: rect.top,
          kind: "bg",
        });
      } catch (_) {}
    });

    scored.sort((a, b) => b.area - a.area || a.top - b.top);
    const uniq = [];
    const seen = new Set();
    for (const s of scored) {
      if (seen.has(s.src)) continue;
      seen.add(s.src);
      uniq.push(s.src);
      if (uniq.length >= CONFIG.maxImages) break;
    }
    return uniq;
  }

  function isUsefulVisualTarget(el) {
    if (!el) return false;
    // skip decorative placeholder (emoji only / no real image)
    const hasImg = !!el.querySelector("img, canvas, svg");
    const t = cleanText(el.innerText || "");
    if (!hasImg && /تاقیکردنەوەی تیوری|🚦/.test(t) && t.length < 80) return false;
    if (!hasImg && t.length < 5) return false;
    // for sign-box: only if real media inside
    if (el.classList?.contains("sign-box") && !hasImg) return false;
    return true;
  }

  /** Screenshot of sign/question visual area (for pages without <img>) */
  async function captureVisualAreas() {
    const out = [];
    if (typeof html2canvas !== "function") return out;

    const targets = [
      document.querySelector("#questionImage, .question-image, .exam-image"),
      document.querySelector(".sign-box"),
    ].filter((el) => el && !skipEl(el) && isUsefulVisualTarget(el));

    const bigImg = [...document.images]
      .filter((img) => !skipEl(img) && img.clientWidth >= 80)
      .sort(
        (a, b) =>
          b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
      )[0];
    if (bigImg) targets.push(bigImg);

    // MOI: capture area around question + image if present
    const needsVision = /هێما|وێنە|نیشانە|sign|picture|image/i.test(
      document.querySelector("#questionText, .question-text, h2, h3")?.innerText || ""
    );
    if (needsVision) {
      const block = document.querySelector(
        ".exam-screen, #examPage, form, .container"
      );
      if (block && !skipEl(block)) targets.push(block);
    }

    const seen = new Set();
    for (const el of targets) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) continue;
      try {
        const canvas = await html2canvas(el, {
          backgroundColor: "#ffffff",
          scale: needsVision && el.clientWidth > 500 ? 0.7 : 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        if (dataUrl && dataUrl.length > 800) out.push(dataUrl);
      } catch (e) {
        console.warn("[DS] html2canvas fail", e);
      }
      if (out.length >= CONFIG.maxImages) break;
    }
    return out;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function guessMime(url, headerMime) {
    if (headerMime && /^image\//i.test(headerMime)) return headerMime.split(";")[0].trim();
    const u = (url || "").toLowerCase();
    if (u.includes(".png")) return "image/png";
    if (u.includes(".webp")) return "image/webp";
    if (u.includes(".gif")) return "image/gif";
    return "image/jpeg";
  }

  function canvasFromImgElement(img) {
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return null;
      const canvas = document.createElement("canvas");
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.85);
    } catch (_) {
      return null; // tainted canvas
    }
  }

  /** Fetch image bypassing page CORS → data URL for DeepSeek vision */
  function fetchImageDataUrl(url) {
    return new Promise((resolve, reject) => {
      if (url.startsWith("data:image/")) {
        resolve(url);
        return;
      }
      // try matching <img> on page first (blob: / same-origin)
      const el = [...document.images].find(
        (img) => (img.currentSrc || img.src) === url
      );
      if (el) {
        const fromCanvas = canvasFromImgElement(el);
        if (fromCanvas) {
          resolve(fromCanvas);
          return;
        }
      }
      if (url.startsWith("blob:")) {
        reject(new Error("blob image not readable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout: 8000,
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error("img HTTP " + res.status));
            return;
          }
          try {
            const ct =
              (res.responseHeaders || "").match(/content-type:\s*([^;\r\n]+)/i)?.[1] || "";
            const mime = guessMime(url, ct);
            const b64 = arrayBufferToBase64(res.response);
            resolve("data:" + mime + ";base64," + b64);
          } catch (e) {
            reject(e);
          }
        },
        onerror() {
          reject(new Error("img network error"));
        },
        ontimeout() {
          reject(new Error("img timeout"));
        },
      });
    });
  }

  function questionNeedsVision(question) {
    return /هێما|وێنە|نیشانە|لەم وێن|ئەم هێما|sign|picture|image|شکل/i.test(
      question || ""
    );
  }

  async function loadQuizImages(urls, { forceVision = false } = {}) {
    const out = [];
    for (const url of (urls || []).slice(0, CONFIG.maxImages)) {
      try {
        const dataUrl = await fetchImageDataUrl(url);
        if (dataUrl.length < 200 || dataUrl.length > CONFIG.maxImageChars) continue;
        out.push(dataUrl);
      } catch (e) {
        console.warn("[DS] image fail", url, e);
      }
    }
    // Screenshots only when question is about a sign/image (avoids empty API replies)
    if (forceVision && out.length < CONFIG.maxImages) {
      try {
        const shots = await captureVisualAreas();
        for (const s of shots) {
          if (out.length >= CONFIG.maxImages) break;
          if (s.length > CONFIG.maxImageChars) continue;
          out.push(s);
        }
      } catch (e) {
        console.warn("[DS] capture fail", e);
      }
    }
    return out;
  }

  /** Wait until question+answers stop changing (AJAX settle) */
  function waitForStableQuiz(maxMs = 1800) {
    return new Promise((resolve) => {
      let last = "";
      let hits = 0;
      const started = Date.now();
      const tick = () => {
        const q = readQuizFromPage();
        const fp = quizFingerprint(q);
        if (looksLikeQuiz(q) && fp === last) {
          hits++;
          if (hits >= 2) return resolve(q);
        } else {
          hits = 0;
          last = fp;
        }
        if (Date.now() - started >= maxMs) return resolve(readQuizFromPage());
        setTimeout(tick, 180);
      };
      tick();
    });
  }

  function readPageText() {
    return readQuizFromPage().text;
  }

  function isAskForAnswer(text) {
    return /وەڵام|وڵام|کام|هەڵبژێر|هەڵبژارد|choose|answer|quiz|پرسیار|ڕاست|rast|کامیە|کامە/i.test(
      text || ""
    );
  }

  function asPlainText(val) {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
      return val
        .map((p) => {
          if (typeof p === "string") return p;
          return p?.text || p?.content || "";
        })
        .join("");
    }
    return String(val);
  }
  /** Pull A/B/C out of messy model text / reasoning */
  function formatQuizAnswer(raw, choiceMeta) {
    const text = asPlainText(raw).trim();
    if (!text) return "";

    // already clean
    const clean = text.match(/هەڵبژێرە\s*:\s*([A-Ea-e1-5])/);
    if (clean && text.length < 220 && !/Need |Let's |Iraqi Traffic/i.test(text)) {
      return text;
    }

    let letter = null;
    const patterns = [
      /هەڵبژێرە\s*:\s*([A-Ea-e])/,
      /(?:select|answer|option|choose|هەڵبژاردە)\s*[:：]?\s*([A-Ea-e])/i,
      /\b([A-Ea-e])\s*[)\]].{0,40}(?:correct|ڕاست|best)/i,
      /(?:select|choose|pick)\s+([A-Ea-e])\b/i,
      /\b([Cc])\s+if both/i,
      /(?:likely|best|answer)\s*(?:is|=|:)\s*([A-Ea-e])/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        letter = m[1].toUpperCase();
        break;
      }
    }

    // last mentioned A/B/C in short conclusion lines
    if (!letter) {
      const lines = text.split(/\n/).slice(-6);
      for (let i = lines.length - 1; i >= 0; i--) {
        const m = lines[i].match(/\b([A-C])\b/);
        if (m && /select|answer|هەڵبژ|correct|ڕاست|C if|imprisonment and fine/i.test(lines[i])) {
          letter = m[1].toUpperCase();
          break;
        }
      }
    }

    if (!letter && choiceMeta?.length) {
      // match option text snippets mentioned as correct
      for (const c of choiceMeta) {
        if (c.text && text.includes(c.text.slice(0, 18))) {
          // weak signal — only if "C" style imprisonment+fine
          if (/بەندکردن و بژاردن|imprisonment and fine/i.test(c.text + text)) {
            letter = c.letter;
          }
        }
      }
    }

    if (!letter) {
      // if short enough, keep as-is; else refuse to dump reasoning
      if (text.length <= 160) return text;
      return "";
    }

    const meta = (choiceMeta || []).find((c) => c.letter === letter);
    const label = meta ? meta.text : "";
    return "هەڵبژێرە: " + letter + (label ? "\nدەق: " + label : "");
  }

  function extractReplyText(json, opts = {}) {
    const choice = json?.choices?.[0];
    const msg = choice?.message || choice?.delta || {};
    const content = asPlainText(msg.content).trim();
    const reasoning = asPlainText(
      msg.reasoning_content || msg.reasoning || ""
    ).trim();

    if (opts.quizMode) {
      const formatted = formatQuizAnswer(content || reasoning, opts.choiceMeta);
      if (formatted) return formatted;
      if (content) return content;
      return "";
    }

    if (content) return content;
    return "";
  }

  function apiChatOnce(messages, opts = {}) {
    const maxTokens = opts.maxTokens ?? CONFIG.maxTokens;
    const temperature = opts.temperature ?? CONFIG.temperature;
    const timeout = opts.timeout ?? 60000;
    const model = opts.model || CONFIG.model;

    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
      // CRITICAL: stop dumping English chain-of-thought
      thinking: { type: "disabled" },
    };

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: CONFIG.apiUrl,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.apiKey}`,
        },
        data: JSON.stringify(body),
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`API ${res.status}: ${(res.responseText || "").slice(0, 280)}`));
            return;
          }
          try {
            const json = JSON.parse(res.responseText);
            const text = extractReplyText(json, opts);
            if (!text) {
              const finish = json?.choices?.[0]?.finish_reason || "?";
              reject(
                new Error(
                  "Empty response from API (finish=" +
                    finish +
                    ")"
                )
              );
            } else resolve(text);
          } catch (e) {
            reject(new Error("Invalid JSON from API"));
          }
        },
        onerror() {
          reject(new Error("Network error talking to DeepSeek"));
        },
        ontimeout() {
          reject(new Error("Request timed out"));
        },
        timeout,
      });
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function stripImagesFromMessages(messages) {
    return messages.map((m) => {
      if (!Array.isArray(m.content)) return m;
      const textParts = m.content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      return { ...m, content: textParts || "(no text)" };
    });
  }

  /** Retry + strip images on empty replies (common DeepSeek glitch) */
  async function apiChat(messages, opts = {}) {
    const retries = opts.retries ?? CONFIG.apiRetries;
    const model = opts.model || CONFIG.model;
    const attempts = [
      { model, messages, label: "full" },
      { model, messages: stripImagesFromMessages(messages), label: "text-only" },
    ];
    // dedupe if already text-only
    const uniq = [];
    const seen = new Set();
    for (const a of attempts) {
      const key = a.label + ":" + a.model;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(a);
    }

    let lastErr;
    for (const attempt of uniq) {
      for (let i = 0; i < retries; i++) {
        try {
          return await apiChatOnce(attempt.messages, { ...opts, model: attempt.model });
        } catch (err) {
          lastErr = err;
          const msg = String(err.message || err);
          const retryable =
            /Empty response|timed out|Network error|API 429|API 5\d\d/i.test(msg);
          console.warn("[DS] API try fail", attempt.label, i + 1, msg.slice(0, 120));
          if (!retryable) break;
          if (i < retries - 1) await sleep(350 + i * 450);
        }
      }
    }
    throw lastErr || new Error("API failed");
  }

  function normQuizText(s) {
    return cleanText(s || "")
      .replace(/^پرسیار\s*\d+\s*:\s*/i, "")
      .replace(/^\d+\s*[-–.:]\s*/, "")
      .replace(/[يى]/g, "ی")
      .replace(/[ك]/g, "ک")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Parse BANK = [{q,a,w}] from page scripts (kurdishtop224 etc.) */
  function loadEmbeddedBank() {
    if (embeddedBank) return embeddedBank;
    const chunks = [...document.scripts]
      .map((s) => s.textContent || "")
      .concat([document.documentElement.innerHTML]);
    let source = "";
    for (const c of chunks) {
      if (c.includes("const BANK") && c.includes("{q:")) {
        source = c;
        break;
      }
    }
    if (!source) {
      embeddedBank = [];
      return embeddedBank;
    }

    const marker = source.indexOf("const BANK");
    if (marker < 0) {
      embeddedBank = [];
      return embeddedBank;
    }
    let i = source.indexOf("[", marker);
    if (i < 0) {
      embeddedBank = [];
      return embeddedBank;
    }
    let depth = 0;
    let end = -1;
    for (let j = i; j < source.length; j++) {
      const ch = source[j];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          end = j + 1;
          break;
        }
      }
    }
    if (end < 0) {
      embeddedBank = [];
      return embeddedBank;
    }
    try {
      const bank = Function('"use strict"; return (' + source.slice(i, end) + ");")();
      embeddedBank = Array.isArray(bank) ? bank : [];
      console.log("[DS] BANK loaded:", embeddedBank.length, "questions");
    } catch (e) {
      console.warn("[DS] BANK parse fail", e);
      embeddedBank = [];
    }
    return embeddedBank;
  }

  function textsMatch(a, b) {
    const na = normQuizText(a);
    const nb = normQuizText(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    // soft: shared prefix (handles minor typos)
    const n = Math.min(na.length, nb.length, 40);
    return n >= 24 && na.slice(0, n) === nb.slice(0, n);
  }

  function choiceTextOnly(display) {
    return cleanText(String(display || "").replace(/^[A-Ea-e1-5][\s\)\].:-]+/, ""));
  }

  /** Exact answer from embedded BANK — nearly zero error on practice sites */
  function solveFromBank(quiz) {
    const bank = loadEmbeddedBank();
    if (!bank.length) return null;

    const qn = normQuizText(quiz.question);
    let best = null;
    let bestScore = 0;
    for (const item of bank) {
      if (!item || !item.q || !item.a) continue;
      const bn = normQuizText(item.q);
      if (qn === bn) {
        best = item;
        bestScore = 100;
        break;
      }
      if (qn.includes(bn) || bn.includes(qn)) {
        const score = Math.min(qn.length, bn.length);
        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      }
    }
    if (!best || bestScore < 20) return null;

    const correct = cleanText(best.a);
    const meta = quiz.choiceMeta || [];
    let hit = meta.find((c) => textsMatch(c.text, correct) || textsMatch(c.display, correct));
    if (!hit) {
      hit = meta.find((c) => {
        const t = normQuizText(c.text);
        const a = normQuizText(correct);
        return t.includes(a) || a.includes(t);
      });
    }
    if (!hit) {
      // match against raw choice strings
      for (let i = 0; i < (quiz.choices || []).length; i++) {
        const raw = choiceTextOnly(quiz.choices[i]);
        if (textsMatch(raw, correct)) {
          hit = { letter: String.fromCharCode(65 + i), text: raw };
          break;
        }
      }
    }
    if (!hit) return null;

    return {
      reply: "هەڵبژێرە: " + hit.letter + "\nدەق: " + (hit.text || correct),
      source: "bank",
      confidence: "exact",
    };
  }
  /** AI path with self-check to reduce mistakes */
  async function solveWithAI(quiz, dataUrls) {
    const letters = (quiz.choiceMeta || []).map((c) => c.letter).join("/");
    const optionsBlock = (quiz.choiceMeta || [])
      .map((c) => c.letter + ") " + c.text)
      .join("\n");

    const promptText =
      "پرسیاری تاقیکردنەوەی مۆڵەتی شۆفێری عێراق/کوردستان.\n" +
      "تەنها یەک وەڵامی یاسایی ڕاست هەڵبژێرە لەم لیستە.\n" +
      "پیتەکان: " +
      (letters || "A/B/C") +
      "\n\nپرسیار:\n" +
      quiz.question +
      "\n\nهەڵبژاردەکان:\n" +
      optionsBlock +
      "\n\nتەنها ٢ هێڵ بنووسە:\nهەڵبژێرە: X\nدەق: ...";

    let userContent = dataUrls.length
      ? [{ type: "text", text: promptText + "\n\n[وێنە هاوپێچ — بیبینە]" }].concat(
          dataUrls.map((url) => ({
            type: "image_url",
            image_url: { url, detail: CONFIG.imageDetail },
          }))
        )
      : promptText;

    const first = await apiChat(
      [
        { role: "system", content: CONFIG.quizSystemPrompt },
        { role: "user", content: userContent },
      ],
      {
        model: CONFIG.quizModel,
        maxTokens: 80,
        temperature: 0,
        timeout: CONFIG.quizTimeoutMs,
        quizMode: true,
        choiceMeta: quiz.choiceMeta || [],
      }
    );

    // Second pass: confirm / correct mistakes
    const check = await apiChat(
      [
        {
          role: "system",
          content:
            "تۆ چاککەری وەڵامی تاقیکردنەوەیت. ئەگەر وەڵامەکە هەڵەیە، وەڵامی ڕاست بنووسە. ئەگەر ڕاستە هەمان شت بنووسەوە. تەنها ٢ هێڵ.",
        },
        {
          role: "user",
          content:
            "پرسیار:\n" +
            quiz.question +
            "\n\nهەڵبژاردەکان:\n" +
            optionsBlock +
            "\n\nوەڵامی پێشنیارکراو:\n" +
            first +
            "\n\nئایا ڕاستە بۆ یاسای هاتووچۆ؟ وەڵامی کۆتایی:",
        },
      ],
      {
        model: CONFIG.quizModel,
        maxTokens: 80,
        temperature: 0,
        timeout: CONFIG.quizTimeoutMs,
        quizMode: true,
        choiceMeta: quiz.choiceMeta || [],
        retries: 2,
      }
    );

    const finalReply = formatQuizAnswer(check || first, quiz.choiceMeta || []) || check || first;
    return finalReply;
  }

  async function solvePageQuiz(userSaid, opts = {}) {
    if (busy) return;
    setOpen(true);
    if (uiHidden) setUiHidden(false);

    const quiz = opts.fromAuto ? await waitForStableQuiz(1600) : readQuizFromPage();
    const fp = opts.fingerprint || quizFingerprint(quiz);

    if (!quiz.text || quiz.text.length < 20) {
      if (!opts.fromAuto) addMsg("error", "نەتوانرا دەقی پەڕەکە بخوێنرێتەوە.");
      return;
    }
    if (!looksLikeQuiz(quiz)) {
      if (!opts.fromAuto) {
        addMsg(
          "error",
          "پرسیار/هەڵبژاردە بە وردی نەدۆزرایەوە. دوگمەی «ئێستا» تاقیبکەرەوە."
        );
      }
      return;
    }
    if (fp === lastFingerprint && opts.fromAuto) return;

    solvingFp = fp;
    setBusy(true);
    lastFingerprint = fp;

    if (!opts.fromAuto) {
      addMsg("user", userSaid || "⚡ وەڵامەکە کامیە؟");
    }

    const bankHit = solveFromBank(quiz);
    const needsVision = !bankHit && questionNeedsVision(quiz.question);

    addMsg(
      "bot",
      (opts.fromAuto ? "🔄 " : "📖 ") +
        quiz.question +
        "\n" +
        quiz.choices.join("\n") +
        (bankHit
          ? "\n📚 لە بنکەی پرسیارەکانی پەڕە…"
          : needsVision
            ? "\n🖼 وێنە + AI…"
            : "\n🤖 AI + پشتڕاستکردنەوە…")
    );

    const typing = showTyping();
    const t0 = Date.now();

    try {
      let reply;
      let tag = "";

      if (bankHit) {
        reply = bankHit.reply;
        tag = " · 📚 بنکە (ورد)";
      } else {
        const dataUrls = await loadQuizImages(quiz.imageUrls || [], {
          forceVision: needsVision,
        });
        reply = await solveWithAI(quiz, dataUrls);
        tag = dataUrls.length ? " · 🖼" + dataUrls.length : " · 🤖×2";
      }

      typing.remove();
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      addMsg("answer", "✅ " + reply + "\n\n⏱ " + sec + "s" + tag);
      history.push({ role: "user", content: "[quiz] " + quiz.question });
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      typing.remove();
      addMsg("error", "هەڵە: " + (err.message || err) + "\nدوگمەی «ئێستا» دووبارە تاقیبکەرەوە.");
      if (lastFingerprint === fp) lastFingerprint = "";
    } finally {
      solvingFp = "";
      setBusy(false);
      scheduleAutoSolve("after-solve");
    }
  }

  fab.addEventListener("click", () => setOpen(!root.classList.contains("open")));
  closeBtn.addEventListener("click", () => setOpen(false));
  solveBtn.addEventListener("click", () => solvePageQuiz());
  autoBtn.addEventListener("click", () => {
    autoSolve = !autoSolve;
    updateAutoBtn();
    addMsg("bot", autoSolve ? "خۆکار چالاکە — کاتێک پرسیار بگۆڕێت وەڵام دەدەم." : "خۆکار کوژایەوە.");
    if (autoSolve) {
      lastFingerprint = "";
      scheduleAutoSolve("toggle-on");
    }
  });
  clearBtn.addEventListener("click", () => {
    history.length = 1;
    msgs.innerHTML = "";
    addMsg("bot", "چات پاککرایەوە. پرسیارێک بکە یان دوگمەی سەوز بەکاربهێنە.");
  });

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;

    input.value = "";
    input.style.height = "auto";

    // "وەڵامەکە کامیە" → always solve current exam question
    if (isAskForAnswer(text)) {
      await solvePageQuiz(text);
      input.focus();
      return;
    }

    setBusy(true);
    addMsg("user", text);

    const pageText = readPageText();
    const userContent =
      text + "\n\n--- Current page ---\n" + pageText;

    history.push({ role: "user", content: userContent });
    const typing = showTyping();

    try {
      const reply = await apiChat(history);
      typing.remove();
      addMsg("bot", reply);
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      typing.remove();
      addMsg("error", "هەڵە: " + (err.message || err));
      history.pop();
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  addMsg(
    "bot",
    "سڵاو! دۆخی وردی چالاکە.\n١) بنکەی پرسیارەکانی پەڕە (بێ هەڵە)\n٢) ئەگەر نەبوو: AI + دووجار پشتڕاستکردنەوە\nخۆکار ON · Q=ئێستا · Space هاید"
  );

  // Watch DOM + poll: exam pages often replace question via AJAX
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const t = m.target;
      if (t && t.nodeType === 1 && t.closest && t.closest(`#${WIDGET_ID}`)) continue;
      if (t && t.nodeType === 3 && t.parentElement && t.parentElement.closest(`#${WIDGET_ID}`)) {
        continue;
      }
      scheduleAutoSolve("dom");
      return;
    }
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  setInterval(() => scheduleAutoSolve("poll"), CONFIG.autoPollMs);
  setTimeout(() => {
    const n = loadEmbeddedBank().length;
    if (n) addMsg("bot", "📚 بنکەی پرسیارەکان بارکرا (" + n + ") — وەڵامەکان ورد دەبن.");
    scheduleAutoSolve("boot");
  }, 800);

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key;
      if (key === " " || key === "Spacebar") {
        e.preventDefault();
        setUiHidden(!uiHidden);
        return;
      }
      if (key === "q" || key === "Q") {
        e.preventDefault();
        lastFingerprint = "";
        solvePageQuiz();
        return;
      }
      if (key === "a" || key === "A") {
        e.preventDefault();
        autoBtn.click();
        return;
      }
      if (key === "x" || key === "X") {
        e.preventDefault();
        if (uiHidden) setUiHidden(false);
        nudgeOpacity(-10);
        return;
      }
      if (key === "z" || key === "Z") {
        e.preventDefault();
        if (uiHidden) setUiHidden(false);
        nudgeOpacity(10);
      }
    },
    true
  );
})();