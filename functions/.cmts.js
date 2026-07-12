// 评论功能
// GET  /:cmts?repo=owner/name&shas=abc,def,... → 批量读取评论
// POST /:cmts?id=xxx                          → 添加评论（NDJSON 写入 git notes）

import { fetchNotesFromGitHub, parseAllNotes, parseNote, getExistingNdjson, writeNoteToGitHub, CACHE_KEY } from './_notes.mjs';

function getRepo(url, env) {
  return url.searchParams.get('repo') || env.REPO || 'est/gitweets';
}

export async function handler(request, env) {
  try {
    const url = new URL(request.url);
    const repo = getRepo(url, env);

    // --- GET: 批量读取 ---
    if (request.method === 'GET') {
      const shasParam = url.searchParams.get('shas') || '';
      const shas = shasParam.split(',').filter(s => /^[0-9a-f]{7,40}$/i.test(s));
      if (shas.length === 0) return Response.json({});

      let allNotes;
      const cache = caches.default;
      try {
        const cached = await cache.match(CACHE_KEY);
        if (cached) allNotes = await cached.json();
      } catch {}

      if (!allNotes) {
        allNotes = parseAllNotes(await fetchNotesFromGitHub(repo, env.GITHUB_TOKEN));
        try {
          await cache.put(CACHE_KEY, new Response(JSON.stringify(allNotes), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300' },
          }));
        } catch {}
      }

      const result = {};
      for (const sha of shas) {
        const fullSha = Object.keys(allNotes).find(k => k.startsWith(sha));
        if (fullSha && allNotes[fullSha]) result[sha] = allNotes[fullSha];
      }
      return Response.json(result);
    }

    // --- POST: 添加评论（匿名） ---
    if (request.method === 'POST') {
      // 反 bot 检测：静默失败
      const h = request.headers;
      const dest = h.get('sec-fetch-dest');
      const mode = h.get('sec-fetch-mode');
      const origin = h.get('origin') || '';
      const host = h.get('host') || '';
      const enc = h.get('accept-encoding') || '';
      if (dest !== 'empty' || mode !== 'cors' || !origin.includes(host) || !/gzip|deflate|br|zstd/.test(enc)) {
        return Response.json({ success: true, comment: {} });
      }

      const sha = (url.searchParams.get('id') || '').trim();
      if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
        return Response.json({ error: 'Invalid id' }, { status: 400 });
      }

      let body;
      try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

      const name = (body.name || '').trim().slice(0, 50);
      const text = (body.text || '').trim();
      let link = (body.link || '').trim().slice(0, 200);
      const email = (body.email || '').trim().slice(0, 100);

      if (!name) return Response.json({ error: '名字不能为空' }, { status: 400 });
      if (!text || text.length > 500) return Response.json({ error: '评论内容为空或超过 500 字符' }, { status: 400 });
      if (link && !/^https?:\/\//i.test(link)) link = '';

      // 读取当前 notes
      let ghData, allNotes;
      try { ghData = await fetchNotesFromGitHub(repo, env.GITHUB_TOKEN); allNotes = parseAllNotes(ghData); }
      catch (e) { return Response.json({ error: 'Failed to read notes' }, { status: 502 }); }

      const notesCommitSha = allNotes._commitSha;
      if (!notesCommitSha) return Response.json({ error: 'No notes commit found' }, { status: 500 });

      const fullSha = Object.keys(allNotes).find(k => k.startsWith(sha));
      const existingNdjson = getExistingNdjson(ghData, fullSha);

      const comment = { type: 'comment', name, text, id: `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`, ts: Math.floor(Date.now() / 1000) };
      if (link) comment.link = link;
      const newNdjson = existingNdjson + JSON.stringify(comment) + '\n';

      const cf = request.cf || {};
      const meta = { email: email || undefined, ua: (request.headers.get('user-agent') || '').slice(0, 100), ip: request.headers.get('CF-Connecting-IP') || '', cf: { asn: cf.asn, country: cf.country, region: cf.region, city: cf.city, timezone: cf.timezone } };

      try {
        await writeNoteToGitHub(repo, env.GITHUB_TOKEN, {
          targetSha: fullSha || sha, ndjson: newNdjson, notesCommitSha,
          commitMsg: `comment by ${name}\n\n${JSON.stringify(meta)}`,
        });
      } catch (e) {
        const status = e.message.includes('update ref') ? 409 : 502;
        return Response.json({ error: e.message }, { status });
      }

      try { await caches.default.delete(CACHE_KEY); } catch {}
      return Response.json({ success: true, comment });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (e) {
    console.error('cmts error:', e.message, e.stack?.split('\n').slice(0, 3).join(' '));
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export function onRequest(context) {
  return handler(context.request, context.env);
}
