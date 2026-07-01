/* ==========================================================================
   search.js —— 站内实时搜索：书名 / 作者 / 简介 / 标签，纯前端过滤
   ========================================================================== */

async function initSearchPage() {
  const books = await fetchJSON("data/books.json");
  const input = document.getElementById("searchInput");
  const resultMount = document.getElementById("searchResults");
  const countMount = document.getElementById("searchCount");

  function matches(book, keyword) {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return true;
    const haystack = [book.title, book.author, book.intro, book.category, ...(book.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(kw);
  }

  function render(keyword) {
    const result = books.filter((b) => matches(b, keyword));
    countMount.textContent = keyword.trim()
      ? `找到 ${result.length} 个与"${keyword.trim()}"相关的结果`
      : `共 ${books.length} 部作品，输入关键词即可实时筛选`;
    renderGrid("searchResults", result);
  }

  input.addEventListener("input", () => render(input.value));

  const presetQ = getQueryParam("q");
  if (presetQ) input.value = presetQ;
  render(input.value);
  input.focus();
}
