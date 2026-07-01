/* ==========================================================================
   reader.js —— 阅读器页面逻辑
   功能：Markdown 正文渲染 / 目录 / 上一篇下一篇 / 字体行距宽度调整 /
        夜间·护眼·纸张模式 / 阅读位置与设置自动保存到 LocalStorage
   ========================================================================== */

const READER_SETTINGS_KEY = "bifeng-reader-settings";
const READER_PROGRESS_KEY = "bifeng-reader-progress"; // { [bookId]: { chapter, scroll } }

function loadSettings() {
  const defaults = { fontSize: 18, lineHeight: 2, width: 720, mode: "day" };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(READER_SETTINGS_KEY) || "{}") };
  } catch {
    return defaults;
  }
}
function saveSettings(settings) {
  localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
}
function applySettings(settings) {
  document.documentElement.style.setProperty("--reader-font-size", settings.fontSize + "px");
  document.documentElement.style.setProperty("--reader-line-height", settings.lineHeight);
  document.documentElement.style.setProperty("--reader-width", settings.width + "px");
  document.documentElement.dataset.readerMode = settings.mode === "day" ? "" : settings.mode;
}

function getProgressMap() {
  try { return JSON.parse(localStorage.getItem(READER_PROGRESS_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(bookId, chapterFile, scrollRatio) {
  const map = getProgressMap();
  map[bookId] = { chapter: chapterFile, scroll: scrollRatio, savedAt: Date.now() };
  localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify(map));
}

async function initReaderPage() {
  const bookId = getQueryParam("id");
  const root = document.getElementById("readerRoot");
  if (!bookId) { root.innerHTML = `<div class="empty-state">未指定书籍</div>`; return; }

  const settings = loadSettings();
  applySettings(settings);

  try {
    const books = await fetchJSON("data/books.json");
    const meta = books.find((b) => b.id === bookId);
    if (!meta) throw new Error("book not found");
    const detail = await fetchJSON(`${meta.path}/book.json`);

    const progressMap = getProgressMap();
    const chapterFile =
      getQueryParam("chapter") || progressMap[bookId]?.chapter || detail.chapters[0].file;

    await renderChapter(meta, detail, chapterFile, settings, progressMap[bookId]);
    initToolbar(settings);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty-state">章节加载失败，请返回详情页重试。</div>`;
  }
}

async function renderChapter(meta, detail, chapterFile, settings, savedProgress) {
  const idx = detail.chapters.findIndex((c) => c.file === chapterFile);
  const chapter = detail.chapters[idx] || detail.chapters[0];
  const mdText = await (await fetch(`${meta.path}/${chapter.file}`)).text();
  const contentHtml = parseMarkdown(mdText);

  const prev = detail.chapters[idx - 1];
  const next = detail.chapters[idx + 1];

  document.title = `${chapter.title} - ${detail.title} - 笔锋`;
  document.getElementById("readerRoot").innerHTML = `
    <div class="reader-progress" id="readerProgress"></div>
    <div class="reader-layout">
      <aside class="reader-toc">
        <h4>${detail.title} · 目录</h4>
        ${detail.chapters
          .map(
            (c) =>
              `<a href="reader.html?id=${meta.id}&chapter=${c.file}" class="${c.file === chapter.file ? "is-current" : ""}">${c.title}</a>`
          )
          .join("")}
      </aside>
      <main class="reader-main">
        <h1 class="reader-chapter-title">${chapter.title}</h1>
        <div class="reader-content">${contentHtml}</div>
        <div class="reader-nav">
          ${prev ? `<a href="reader.html?id=${meta.id}&chapter=${prev.file}">← 上一章</a>` : `<span>已是第一章</span>`}
          <a href="book.html?id=${meta.id}">目录</a>
          ${next ? `<a href="reader.html?id=${meta.id}&chapter=${next.file}">下一章 →</a>` : `<span>已是最后一章</span>`}
        </div>
      </main>
    </div>
  `;

  // 恢复滚动位置（仅当是上次阅读的同一章节时）
  if (savedProgress && savedProgress.chapter === chapter.file && savedProgress.scroll) {
    requestAnimationFrame(() => {
      const doc = document.documentElement;
      window.scrollTo(0, savedProgress.scroll * (doc.scrollHeight - window.innerHeight));
    });
  }

  const progressBar = document.getElementById("readerProgress");
  window.addEventListener("scroll", () => {
    const doc = document.documentElement;
    const ratio = window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight);
    progressBar.style.width = Math.min(100, ratio * 100) + "%";
    saveProgress(meta.id, chapter.file, ratio);
  });
}

function initToolbar(settings) {
  const root = document.getElementById("readerToolbarRoot");
  root.innerHTML = `
    <div class="reader-settings" id="readerSettings">
      <div class="reader-settings__row">
        <span>字体大小</span>
        <div class="stepper">
          <button data-action="font-dec">A-</button>
          <span id="fontSizeLabel">${settings.fontSize}</span>
          <button data-action="font-inc">A+</button>
        </div>
      </div>
      <div class="reader-settings__row">
        <span>行距</span>
        <div class="stepper">
          <button data-action="line-dec">-</button>
          <span id="lineHeightLabel">${settings.lineHeight}</span>
          <button data-action="line-inc">+</button>
        </div>
      </div>
      <div class="reader-settings__row">
        <span>页面宽度</span>
        <div class="stepper">
          <button data-action="width-dec">-</button>
          <span id="widthLabel">${settings.width}</span>
          <button data-action="width-inc">+</button>
        </div>
      </div>
      <div class="reader-settings__row">
        <span>模式</span>
        <div class="mode-group" id="modeGroup">
          <button data-mode="day" class="${settings.mode === "day" ? "is-active" : ""}">日间</button>
          <button data-mode="night" class="${settings.mode === "night" ? "is-active" : ""}">夜间</button>
          <button data-mode="eye" class="${settings.mode === "eye" ? "is-active" : ""}">护眼</button>
          <button data-mode="paper" class="${settings.mode === "paper" ? "is-active" : ""}">纸张</button>
        </div>
      </div>
    </div>
    <button class="reader-toolbar__btn" id="readerSettingsBtn" title="阅读设置" aria-label="阅读设置">⚙</button>
  `;

  document.getElementById("readerSettingsBtn").addEventListener("click", () => {
    document.getElementById("readerSettings").classList.toggle("is-open");
  });

  root.querySelector("[data-action='font-inc']").addEventListener("click", () => updateSetting(settings, "fontSize", 1, 14, 26));
  root.querySelector("[data-action='font-dec']").addEventListener("click", () => updateSetting(settings, "fontSize", -1, 14, 26));
  root.querySelector("[data-action='line-inc']").addEventListener("click", () => updateSetting(settings, "lineHeight", 0.1, 1.4, 2.6));
  root.querySelector("[data-action='line-dec']").addEventListener("click", () => updateSetting(settings, "lineHeight", -0.1, 1.4, 2.6));
  root.querySelector("[data-action='width-inc']").addEventListener("click", () => updateSetting(settings, "width", 40, 480, 960));
  root.querySelector("[data-action='width-dec']").addEventListener("click", () => updateSetting(settings, "width", -40, 480, 960));

  document.getElementById("modeGroup").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    settings.mode = btn.dataset.mode;
    saveSettings(settings);
    applySettings(settings);
    [...document.getElementById("modeGroup").children].forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
}

function updateSetting(settings, key, delta, min, max) {
  settings[key] = Math.min(max, Math.max(min, Math.round((settings[key] + delta) * 10) / 10));
  saveSettings(settings);
  applySettings(settings);
  const labelMap = { fontSize: "fontSizeLabel", lineHeight: "lineHeightLabel", width: "widthLabel" };
  const label = document.getElementById(labelMap[key]);
  if (label) label.textContent = settings[key];
}
