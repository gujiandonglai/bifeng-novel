/* ==========================================================================
   ui.js —— 全站共享界面逻辑：Header / Footer 注入、主题切换、移动端导航
   所有页面共用同一份 Header / Footer，新增页面无需重复书写结构。
   ========================================================================== */

const CATEGORY_QUICK_LIST = [
  "玄幻", "都市", "武侠", "历史", "科幻",
  "悬疑", "轻小说", "散文", "科普", "杂谈",
];

const SITE_NAV = [
  { key: "home", label: "首页", href: "index.html" },
  {
    key: "library", label: "书库", href: "library.html",
    children: [
      { label: "最新更新", href: "library.html?sort=update" },
      { label: "人气热度", href: "library.html?sort=hot" },
      { label: "字数排行", href: "library.html?sort=words" },
    ],
  },
  {
    key: "ranking", label: "排行榜", href: "ranking.html",
    children: [
      { label: "热门榜", href: "ranking.html?tab=hot" },
      { label: "更新榜", href: "ranking.html?tab=update" },
      { label: "字数榜", href: "ranking.html?tab=words" },
      { label: "评分榜", href: "ranking.html?tab=rating" },
    ],
  },
  {
    key: "categories", label: "分类", href: "categories.html",
    children: CATEGORY_QUICK_LIST.map((c) => ({ label: c, href: `library.html?category=${encodeURIComponent(c)}` })),
  },
  { key: "search", label: "搜索", href: "search.html" },
  { key: "about", label: "关于", href: "about.html" },
];

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const activePage = document.body.dataset.page || "";

  const navHtml = SITE_NAV.map((item) => {
    const activeClass = item.key === activePage ? "is-active" : "";
    if (item.children && item.children.length) {
      const submenuHtml = item.children
        .map((c) => `<a href="${c.href}">${c.label}</a>`)
        .join("");
      return `
        <div class="nav-item has-submenu">
          <a href="${item.href}" class="${activeClass}">${item.label}<span class="nav-caret">▾</span></a>
          <div class="submenu">${submenuHtml}</div>
        </div>`;
    }
    return `<div class="nav-item"><a href="${item.href}" class="${activeClass}">${item.label}</a></div>`;
  }).join("");

  mount.innerHTML = `
    <div class="container">
      <a href="index.html" class="site-header__logo">
        <strong>笔锋</strong><span>BIFENG NOVEL</span>
      </a>
      <nav class="site-header__nav" id="siteNav">${navHtml}</nav>
      <div class="site-header__actions">
        <button class="nav-toggle" id="navToggle" aria-label="打开菜单">☰</button>
        <button class="theme-toggle" id="themeToggle" title="切换夜间模式" aria-label="切换夜间模式">🌙</button>
      </div>
    </div>
  `;

  document.getElementById("navToggle").addEventListener("click", () => {
    document.getElementById("siteNav").classList.toggle("is-open");
  });

  const themeBtn = document.getElementById("themeToggle");
  themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";
  themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("bifeng-theme", isDark ? "light" : "dark");
    themeBtn.textContent = isDark ? "🌙" : "☀️";
  });
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  mount.innerHTML = `
    <div class="container links-bar">
      <span>友情链接：</span>
      <a href="#">（预留位）</a>
      <a href="#">（预留位）</a>
      <a href="#">（预留位）</a>
    </div>
    <footer class="site-footer">
      <div class="container">
        <p>笔锋 Bifeng Novel · 每一个故事，都值得被认真阅读。</p>
        <p>© ${new Date().getFullYear()} 王东来 · <a href="about.html">关于本站</a> · <a href="https://github.com/" target="_blank" rel="noopener">GitHub（预留）</a></p>
      </div>
    </footer>
  `;
}

/* 页面加载前尽早应用已保存的主题，避免刷新闪烁 */
(function applyStoredTheme() {
  const saved = localStorage.getItem("bifeng-theme");
  if (saved === "dark") document.documentElement.dataset.theme = "dark";
})();

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});

/* ---------- 通用小工具，供 app.js / search.js / reader.js 复用 ---------- */
function formatWords(num) {
  if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, "") + "万字";
  return num + "字";
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`加载失败: ${path}`);
  return res.json();
}
