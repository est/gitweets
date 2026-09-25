// 爬虫 / 非浏览器导航的极简 HTML 直出（链接卡片 + SEO 用）
// 浏览器地址栏导航（Sec-Fetch-Mode: navigate + 浏览器 UA）一律 next() 放行静态 CSR，
// headless 若带 navigate 也视为浏览器，让它自己跑 JS 渲染。
// 只处理页面路由：/ /:user /:user/:sha（与前端 PATH_RE 一致），其余一律 next()。

const REPO_DEFAULT = 'est/gitweets';
const PATH_RE = /^\/(\w+)(?:\/([0-9a-fA-F]{7,40}))?$/;
const IMG_RE = /\/(?:static|uploads)%2F(.+\.(webp|jpg|jpeg|png|gif|jxl|avif))$/i;

const esc = (s) => (s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const firstLine = (s) => (s || '').split('\n')[0].trim();

// 浏览器导航才放行；缺头 / cors / no-cors / 非浏览器 UA 全部走极简 HTML
function isBrowserNavigate(request) {
  if (request.headers.get('sec-fetch-mode') !== 'navigate') return false;
  const ua = request.headers.get('user-agent') || '';
  return /mozilla|chrome|safari|firefox|edge|opera/i.test(ua);
}

async function ghFetch(url, token) {
  const headers = {
    'User-Agent': 'gitweets/2.0 (https://f.est.im/)',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

// commit 的 files 里找第一张图，转成 raw 直链（逻辑同前端 appendImages）
function firstImage(repo, sha, files) {
  for (const f of files || []) {
    const m = IMG_RE.exec(f.raw_url || f.filename || '');
    if (!m) continue;
    try {
      return `https://raw.githubusercontent.com/${repo}/${sha}/uploads/${decodeURIComponent(m[1])}`;
    } catch { return `https://raw.githubusercontent.com/${repo}/${sha}/uploads/${m[1]}`; }
  }
  return '';
}

function pageHtml({ title, desc, canonical, image, ogType, body }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="gitweets">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
<link rel="canonical" href="${esc(canonical)}">
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${body}
<p><a href="${esc(canonical)}">在 f.est.im 上查看</a></p>
</main>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const isRoot = url.pathname === '/';
  const m = PATH_RE.exec(url.pathname);
  if (!m && !isRoot) return next();
  if (isBrowserNavigate(request)) return next();

  try {
    const repo = m ? (env.REPO || REPO_DEFAULT) : (url.searchParams.get('repo') || env.REPO || REPO_DEFAULT);
    const token = env.GITHUB_TOKEN || '';
    const API = `https://api.github.com/repos/${repo}`;
    const canonical = `https://f.est.im${url.pathname}`;

    let title, desc, image = '', ogType = 'website', body;

    if (m?.[2]) {
      // 单条卡片 /:user/:sha，标题/h1 统一为 gitweet+时间，SEO 描述保留正文
      const c = await ghFetch(`${API}/commits/${m[2]}`, token);
      const msg = c.commit?.message || '';
      const dt = c.commit?.committer?.date || c.commit?.author?.date || '';
      // "2026-09-25T08:00:00Z" -> "2026-09-25 08:00"，无日期时回落到短 sha
      const timeStr = dt ? dt.slice(0, 16).replace('T', ' ') : m[2].slice(0, 7);
      title = `gitweet ${timeStr}`;
      desc = msg.slice(0, 300);
      const owner = (await ghFetch(API, token).catch(() => null))?.owner;
      image = firstImage(repo, c.sha, c.files) || owner?.avatar_url || '';
      ogType = 'article';
      body = `<p>${esc(desc).replaceAll('\n', '<br>')}</p>\n${image ? `<p><img src="${esc(image)}" alt="" loading="lazy"></p>` : ''}`;
    } else {
      // 列表 / 或 /:user
      const params = new URLSearchParams({ per_page: 20 });
      if (m?.[1]) params.set('author', m[1]);
      const [repoInfo, commits] = await Promise.all([
        ghFetch(API, token).catch(() => null),
        ghFetch(`${API}/commits?${params}`, token).catch(() => []),
      ]);
      const owner = repoInfo?.owner;
      title = m?.[1] ? `${m[1]} 的时间轴` : `${owner?.login || repo} 的时间轴`;
      // 列表页 desc 固定为项目 SEO 文案，堆 X / Twitter 等关键字
      const userPart = m?.[1] ? `${m[1]} 在 ` : '';
      desc = `${userPart}gitweets by est - 基于 git 的去中心化 Twitter / X 替代品，用 git commit 发推文、写微博，fork 即注册，cherry-pick 即转发。Decentralized microblogging with git commits as tweets, a self-hosted open-source Twitter/X alternative.`;
      image = owner?.avatar_url || '';
      const items = (Array.isArray(commits) ? commits : []).filter((c) => c?.sha);
      body = `<ul>\n${items.map((c) => {
        const sha = c.sha.slice(0, 7);
        const user = c.author?.login || c.commit?.author?.name || '';
        return `<li><a href="/${esc(user)}/${sha}">${esc(firstLine(c.commit?.message) || sha)}</a> (${sha})</li>`;
      }).join('\n')}\n</ul>`;
    }

    const html = pageHtml({ title, desc, canonical, image, ogType, body });
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      // 只有爬虫/curl 会命中这里，人类导航直接走静态；缓存可大胆给
      'Cache-Control': 'public, max-age=60, s-maxage=600',
      'Vary': 'Sec-Fetch-Mode',
    };
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(html, { headers });
  } catch (e) {
    console.error('bot html error:', e?.message);
    return next(); // 失败回落 CSR，不影响正常访问
  }
}
