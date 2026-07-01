/* ==========================================================================
   app.js —— 站点主逻辑：首页 / 书库 / 排行榜 / 分类 / 详情页
   所有书籍数据均来自 data/books.json，新增小说无需修改本文件。
   ========================================================================== */

const CATEGORY_LIST = [
  "玄幻", "都市", "武侠", "历史", "科幻",
  "悬疑", "轻小说", "散文", "科普", "杂谈",
];

function bookCardHTML(book) {
  return `
    <a class="book-card fade-up" href="book.html?id=${book.id}">
      <div class="book-card__cover">
        <img src="${book.cover}" alt="${book.title}封面" loading="lazy">
      </div>
      <div class="book-card__body">
        <h3 class="book-card__title">${book.title}</h3>
        <div class="book-card__meta">${book.author} · ${book.category} · ${formatWords(book.words)}</div>
        <p class="book-card__intro">${book.intro}</p>
        <span class="book-card__tag">${book.status}</span>
      </div>
    </a>
  `;
}

function renderGrid(mountId, books) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = books.length
    ? books.map(bookCardHTML).join("")
    : `<div class="empty-state">暂无相关作品</div>`;
}

/* ---------------- 首页 index.html ---------------- */
async function initHomePage() {
  try {
    const books = await fetchJSON("data/books.json");
    const byUpdate = [...books].sort((a, b) => new Date(b.update) - new Date(a.update));
    const byViews = [...books].sort((a, b) => b.views - a.views);
    const recommend = books.filter((b) => b.recommend);

    renderGrid("todayRecommend", recommend.length ? recommend : books.slice(0, 4));
    renderGrid("latestUpdate", byUpdate.slice(0, 8));
    renderGrid("hotBooks", byViews.slice(0, 4));
    renderGrid("newBooks", [...books].reverse().slice(0, 4));

    const heroForm = document.getElementById("heroSearchForm");
    if (heroForm) {
      heroForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = document.getElementById("heroSearchInput").value.trim();
        window.location.href = "search.html" + (q ? `?q=${encodeURIComponent(q)}` : "");
      });
    }
  } catch (err) {
    console.error(err);
  }
}

/* ---------------- 书库 library.html ---------------- */
async function initLibraryPage() {
  const books = await fetchJSON("data/books.json");
  const validSorts = ["update", "hot", "words"];
  const initialSort = getQueryParam("sort");
  const state = {
    category: getQueryParam("category") || "全部",
    sort: validSorts.includes(initialSort) ? initialSort : "update",
    page: 1,
    pageSize: 8,
  };
  document.getElementById("sortSelect").value = state.sort;

  const filterBar = document.getElementById("categoryFilter");
  const categories = ["全部", ...CATEGORY_LIST];
  filterBar.innerHTML = categories
    .map((c) => `<button class="chip ${c === state.category ? "is-active" : ""}" data-cat="${c}">${c}</button>`)
    .join("");

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    state.page = 1;
    [...filterBar.children].forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  function getFiltered() {
    let list = state.category === "全部" ? books : books.filter((b) => b.category === state.category);
    if (state.sort === "update") list = [...list].sort((a, b) => new Date(b.update) - new Date(a.update));
    if (state.sort === "hot") list = [...list].sort((a, b) => b.views - a.views);
    if (state.sort === "words") list = [...list].sort((a, b) => b.words - a.words);
    return list;
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    renderGrid("libraryGrid", filtered.slice(start, start + state.pageSize));
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const mount = document.getElementById("libraryPagination");
    if (totalPages <= 1) { mount.innerHTML = ""; return; }
    let html = "";
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === state.page ? "is-active" : ""}" data-page="${i}">${i}</button>`;
    }
    mount.innerHTML = html;
    mount.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.page = Number(btn.dataset.page);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  render();
}

/* ---------------- 排行榜 ranking.html ---------------- */
async function initRankingPage() {
  const books = await fetchJSON("data/books.json");
  const tabs = {
    hot: { label: "热门榜", sort: (a, b) => b.views - a.views, stat: (b) => `${(b.views / 1000).toFixed(1)}k 阅读` },
    update: { label: "更新榜", sort: (a, b) => new Date(b.update) - new Date(a.update), stat: (b) => b.update },
    words: { label: "字数榜", sort: (a, b) => b.words - a.words, stat: (b) => formatWords(b.words) },
    rating: { label: "评分榜（预留）", sort: (a, b) => b.rating - a.rating, stat: (b) => `${b.rating} 分` },
  };
  const initialTab = getQueryParam("tab");
  let current = Object.keys(tabs).includes(initialTab) ? initialTab : "hot";

  const tabBar = document.getElementById("rankTabs");
  tabBar.innerHTML = Object.entries(tabs)
    .map(([key, t]) => `<button class="chip ${key === current ? "is-active" : ""}" data-tab="${key}">${t.label}</button>`)
    .join("");

  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    current = btn.dataset.tab;
    [...tabBar.children].forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });

  function render() {
    const t = tabs[current];
    const list = [...books].sort(t.sort);
    document.getElementById("rankList").innerHTML = list
      .map(
        (b, i) => `
        <a class="rank-item" href="book.html?id=${b.id}">
          <div class="rank-item__num">${i + 1}</div>
          <div class="rank-item__cover"><img src="${b.cover}" alt="${b.title}"></div>
          <div class="rank-item__info">
            <div class="rank-item__title">${b.title}</div>
            <div class="rank-item__meta">${b.author} · ${b.category}</div>
          </div>
          <div class="rank-item__stat">${t.stat(b)}</div>
        </a>`
      )
      .join("");
  }
  render();
}

/* ---------------- 分类 categories.html ---------------- */
async function initCategoriesPage() {
  const books = await fetchJSON("data/books.json");
  const mount = document.getElementById("categoryList");
  mount.innerHTML = CATEGORY_LIST.map((cat) => {
    const count = books.filter((b) => b.category === cat).length;
    return `
      <a class="chip category-card" href="library.html?category=${encodeURIComponent(cat)}" style="padding:16px 22px;font-size:15px;">
        ${cat} <span style="color:var(--color-text-muted);font-size:12px;">（${count}）</span>
      </a>`;
  }).join("");
}

/* ---------------- 详情页 book.html ---------------- */
async function initBookPage() {
  const id = getQueryParam("id");
  const mount = document.getElementById("bookDetailRoot");
  if (!id) { mount.innerHTML = `<div class="empty-state">未指定书籍</div>`; return; }

  try {
    const books = await fetchJSON("data/books.json");
    const meta = books.find((b) => b.id === id);
    if (!meta) throw new Error("not found");
    const detail = await fetchJSON(`${meta.path}/book.json`);

    document.title = `${detail.title} - 笔锋 Bifeng Novel`;

    mount.innerHTML = `
      <div class="book-detail">
        <div>
          <div class="book-detail__cover"><img src="${meta.path}/${detail.cover}" alt="${detail.title}"></div>
        </div>
        <div>
          <h1 class="book-detail__title">${detail.title}</h1>
          <p class="book-detail__author">作者：${detail.author} · ${detail.category} · ${detail.status}</p>
          <div class="book-detail__tags">
            ${(detail.tags || []).map((t) => `<span class="book-card__tag">${t}</span>`).join("")}
          </div>
          <div class="book-detail__meta-list">
            <div>${formatWords(detail.words)}<span>字数</span></div>
            <div>${detail.update}<span>更新时间</span></div>
            <div>${(detail.views || 0).toLocaleString()}<span>阅读量</span></div>
            <div>${detail.rating ?? "-"}<span>评分（预留）</span></div>
          </div>
          <p class="book-detail__intro">${detail.intro}</p>
          <div class="book-detail__actions">
            <a class="btn" href="reader.html?id=${id}&chapter=${detail.chapters[0].file}">开始阅读</a>
            <a class="btn btn-outline" href="#toc">查看目录</a>
          </div>
          <div id="toc">
            <div class="toc-list">
              ${detail.chapters
                .map(
                  (c) => `<a href="reader.html?id=${id}&chapter=${c.file}"><span>${c.title}</span><span>›</span></a>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<div class="empty-state">未找到该书籍，可能已被移除。</div>`;
  }
}
