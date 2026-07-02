# 笔锋 Bifeng Novel

> 每一个故事，都值得被认真阅读。

一个基于 GitHub Pages 的纯静态小说网站。不依赖服务器、不依赖数据库，全部数据以 JSON + Markdown 的形式存放在仓库中，新增小说时**无需修改任何网站源码**。

## 目录结构

```
Bifeng-Novel/
├── index.html          首页
├── library.html         书库（分类/排序/分页）
├── ranking.html         排行榜
├── categories.html      分类
├── search.html           搜索（前端实时过滤）
├── about.html            关于作者
├── book.html              作品详情页
├── reader.html            阅读器
├── css/                   样式（变量、布局、响应式、阅读器、动画）
├── js/                    脚本（ui / app / search / markdown / reader）
├── data/books.json       全站书籍索引（首页/书库/排行榜/分类/搜索 均从此读取）
└── books/<novel-id>/     每本小说一个文件夹
    ├── book.json          该书详情与目录
    ├── cover.svg/jpg      封面
    └── 001.md, 002.md ... 各章节 Markdown 正文
```

## 本地预览

纯静态站点，无需安装任何依赖。用任意本地服务器打开根目录即可，例如：

```bash
# Python 自带的静态服务器
python3 -m http.server 8000
# 然后浏览器打开 http://localhost:8000
```

（不要直接双击打开 index.html，浏览器的 file:// 协议会阻止 `fetch()` 读取 JSON，需要通过 http 服务器访问。）

## 部署到 GitHub Pages

1. 将本项目推送到你的 GitHub 仓库。
2. 仓库 Settings → Pages → Source 选择 `main` 分支 / 根目录。
3. 保存后等待几分钟，即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。

## 如何新增一本小说（无需改动首页代码）

1. 在 `books/` 下新建一个文件夹，例如 `books/novel004/`。
2. 放入封面图片 `cover.jpg`（或 `cover.svg`）。
3. 放入该文件夹的 `book.json`，参考已有书籍的字段格式：

```json
{
  "id": "your-book-id",
  "title": "书名",
  "author": "作者",
  "cover": "cover.jpg",
  "category": "玄幻",
  "status": "连载",
  "words": 50000,
  "update": "2026-07-01",
  "views": 0,
  "rating": 0,
  "intro": "简介……",
  "tags": ["标签1", "标签2"],
  "chapters": [
    { "title": "第一章 ……", "file": "001.md" }
  ]
}
```

4. 按 `chapters` 里声明的文件名放入对应的 Markdown 章节正文（如 `001.md`）。
5. 在根目录的 `data/books.json` 里追加一条索引（字段与上面基本一致，额外需要一个 `path` 字段指向文件夹，例如 `"path": "books/novel004"`）。

完成以上步骤后，首页、书库、排行榜、分类、搜索页会自动读取到新书，**不需要修改任何 HTML/CSS/JS**。

## 批量发布：TXT → 网站（自动化工具）

如果你手上是 `.txt` 格式的小说、且数量比较多，不用按上面的步骤一本本手动拆，
直接用 `tools/txt_to_site.py`：把 txt 放进 `novels_txt/`，运行一条命令，
自动识别卷名/章节、拆分 Markdown、生成 `book.json`、更新 `data/books.json`，
细节和字段说明见 [`tools/README.md`](tools/README.md)。

> 后续版本（见下方规划）会加入 GitHub Actions，实现扫描 `books/` 目录自动生成 `data/books.json`，届时第 5 步也可以省略。

## 分类清单

玄幻、都市、武侠、历史、科幻、悬疑、轻小说、散文、科普、杂谈

## 已实现功能（v1.0）

- 网站框架 / 统一 Header・Footer（`js/ui.js` 注入，改一处全站生效）
- 首页：今日推荐 / 最新更新 / 热门作品 / 最新作品 / 友情链接
- 书库：分类浏览、排序（更新时间/热度/字数）、分页
- 排行榜：热门榜、更新榜、字数榜、评分榜（评分功能预留，UI 已就绪）
- 分类页：十大分类入口
- 搜索：书名/作者/简介/标签 实时过滤，无需服务器
- 详情页：封面/元信息/简介/自动生成目录
- 阅读器：Markdown 渲染、上一章/下一章、字体大小/行距/页面宽度可调、
  夜间模式・护眼模式・纸张模式、阅读进度自动保存与恢复（LocalStorage）
- 全站响应式：电脑四列 / 平板两列 / 手机一列
- 键盘可访问性（可见 focus 状态）、`prefers-reduced-motion` 适配

## 后续版本规划

- **v1.1**：全文搜索优化、目录锚点定位、分享功能、动画细节打磨
- **v1.2**：标签系统页、作者主页、相关推荐、自动扫描书籍生成目录
- **v2.0**：PWA 离线阅读、RSS、SEO/Sitemap、GitHub Actions 自动生成
  `books.json` 并自动构建部署、多作者支持、主题切换、插件系统

## 技术说明

- 纯原生 HTML / CSS / JavaScript（ES6），无构建工具、无框架依赖
- 数据层：`data/books.json`（索引）+ 每本书的 `book.json`（详情）+ Markdown 正文
- 禁止项：PHP、MySQL、Node 后端、任何需要服务器运行的框架
- 允许项：LocalStorage、Fetch API，后续可扩展 PWA

## 示例数据说明

仓库中的《名言之力》《剑影长河》《星海拓荒》为演示用样章与占位封面（SVG），
用于展示网站各功能模块。正式上线前请替换为你自己的真实作品与封面图片。
