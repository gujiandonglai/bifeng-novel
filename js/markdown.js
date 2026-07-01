/* ==========================================================================
   markdown.js —— 极简 Markdown 转 HTML（无外部依赖，专为小说正文设计）
   支持：# 标题、> 引用、**加粗**、*斜体*、---分割线、空行分段
   ========================================================================== */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let inQuote = false;

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      continue;
    }
    if (/^---+$/.test(line)) {
      flushParagraph();
      html.push("<hr>");
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith(">")) {
      flushParagraph();
      html.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return html.join("\n");
}
