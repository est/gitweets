// 评论管理页面
// GET /:admin → 渲染所有评论，带删除按钮

import { fetchNotesFromGitHub, parseAllNotes, writeNoteToGitHub, CACHE_KEY, getExistingNdjson } from './_notes.mjs';

function getCookie(cookie_str, name) {
  return decodeURIComponent(cookie_str || '')
    .split(";")
    .find(row => row.trim().startsWith(name + "="))
    ?.split("=")[1]?.trim() || '';
}

function getRepo(url, env) {
  return url.searchParams.get('repo') || env.REPO || 'est/gitweets';
}

function renderHTML(commentsBySha, repo) {
  const rows = [];
  for (const [sha, data] of Object.entries(commentsBySha)) {
    if (!data.comments?.length) continue;
    for (const c of data.comments) {
      const time = c.ts ? new Date(c.ts * 1000).toLocaleString('zh-CN') : '';
      rows.push(`
        <tr>
          <td><code title="${sha}">${sha.slice(0, 7)}</code></td>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.text)}</td>
          <td>${time}</td>
          <td><button class="del" onclick="deleteComment('${sha}','${c.id}',this)">✕</button></td>
        </tr>`);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>评论管理</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { font-size: 18px; margin-bottom: 16px; color: #333; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { background: #fafafa; color: #666; font-weight: 500; }
    tr:hover { background: #fafafa; }
    code { font-size: 12px; color: #174b73; }
    .del { background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 4px; }
    .del:hover { background: #fde8e8; }
    .empty { padding: 40px; text-align: center; color: #999; }
  </style>
</head>
<body>
  <h1>评论管理 (${rows.length} 条)</h1>
  ${rows.length ? `
  <table>
    <thead><tr><th>Post</th><th>名字</th><th>内容</th><th>时间</th><th></th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>` : '<div class="empty">暂无评论</div>'}
  <script>
    async function deleteComment(sha, id, btn) {
      if (!confirm('删除这条评论?')) return;
      btn.disabled = true;
      try {
        const r = await fetch('/.admin?id=' + sha, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _delete: id }),
          credentials: 'include',
        });
        const d = await r.json();
        if (d.success) {
          btn.closest('tr').style.opacity = '0.3';
          setTimeout(() => btn.closest('tr').remove(), 300);
        } else {
          alert('删除失败: ' + (d.error || '未知错误'));
          btn.disabled = false;
        }
      } catch (e) {
        alert('请求失败: ' + e.message);
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function handler(request, env) {
  const url = new URL(request.url);
  const repo = getRepo(url, env);
  const token = getCookie(request.headers.get('cookie'), 'access_token');

  // 需要登录
  if (!token) {
    return new Response('需要登录', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // DELETE: 删除评论 (通过 _delete 字段)
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const sha = url.searchParams.get('id') || '';
    const deleteId = body._delete;
    if (!sha || !deleteId) return Response.json({ error: 'Missing params' }, { status: 400 });

    // 读取当前 notes
    let ghData, allNotes;
    try { ghData = await fetchNotesFromGitHub(repo, env.GITHUB_TOKEN); allNotes = parseAllNotes(ghData); }
    catch (e) { return Response.json({ error: 'Failed to read notes' }, { status: 502 }); }

    const notesCommitSha = allNotes._commitSha;
    if (!notesCommitSha) return Response.json({ error: 'No notes commit found' }, { status: 500 });

    const fullSha = Object.keys(allNotes).find(k => k.startsWith(sha));
    const existingNdjson = getExistingNdjson(ghData, fullSha);

    // 追加 delete_comment 事件
    const newNdjson = existingNdjson + JSON.stringify({ type: 'delete_comment', target: deleteId }) + '\n';

    try {
      await writeNoteToGitHub(repo, token, {
        targetSha: fullSha || sha, ndjson: newNdjson, notesCommitSha,
        commitMsg: `delete comment ${deleteId}`,
      });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 502 });
    }

    try { await caches.default.delete(CACHE_KEY); } catch {}
    return Response.json({ success: true });
  }

  // GET: 渲染管理页面
  let allNotes;
  try {
    const ghData = await fetchNotesFromGitHub(repo, env.GITHUB_TOKEN);
    allNotes = parseAllNotes(ghData);
  } catch (e) {
    return new Response('加载失败: ' + e.message, { status: 502 });
  }

  const html = renderHTML(allNotes, repo);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export function onRequest(context) {
  return handler(context.request, context.env);
}
