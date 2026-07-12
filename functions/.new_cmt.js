// 评论功能
// GET  /:new_cmt?repo=owner/name&shas=abc,def,... → 批量读取评论
// POST /:new_cmt?id=xxx                          → 添加评论（NDJSON 写入 git notes）

const NOTES_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: "refs/notes/commits") {
      target {
        ... on Commit {
          oid
          tree { entries { name object { ... on Blob { text } } } }
        }
      }
    }
  }
}`;

const CACHE_KEY = 'https://gitweets-cmt-cache/notes';

function getRepo(url, env) {
  return url.searchParams.get('repo') || env.REPO || 'est/gitweets';
}

function parseNote(ndjson) {
  const comments = [];
  if (!ndjson) return { comments };
  for (const line of ndjson.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === 'comment') comments.push(e);
      else if (e.type === 'delete_comment') {
        const idx = comments.findIndex(c => c.id === e.target);
        if (idx >= 0) comments.splice(idx, 1);
      }
    } catch {}
  }
  return { comments };
}

function parseAllNotes(data) {
  const ref = data?.data?.repository?.ref;
  if (!ref) return {};
  const commit = ref.target;
  if (!commit?.tree?.entries) return {};
  const result = {};
  for (const entry of commit.tree.entries) {
    if (entry.object?.text) result[entry.name] = parseNote(entry.object.text);
  }
  return { _commitSha: commit.oid, ...result };
}

async function fetchNotesFromGitHub(repoPath, token) {
  const [owner, repo] = repoPath.split('/');
  const resp = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'gitweets/1.0',
    },
    body: JSON.stringify({ query: NOTES_QUERY, variables: { owner, repo } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`GraphQL ${resp.status}`);
  return resp.json();
}

function verifyGitHubToken(token) {
  return fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'gitweets/1.0' },
    signal: AbortSignal.timeout(5000),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
}

function getCookie(cookieStr, name) {
  return decodeURIComponent(cookieStr || '')
    .split(';')
    .find(row => row.trim().startsWith(name + '='))
    ?.split('=')[1]?.trim() || '';
}

async function handler(request, env) {
  try {
    const url = new URL(request.url);
    const repo = getRepo(url, env);

    // --- GET: 批量读取 ---
    if (request.method === 'GET') {
      const shasParam = url.searchParams.get('shas') || '';
      const shas = shasParam.split(',').filter(s => /^[0-9a-f]{7,40}$/i.test(s));
      if (shas.length === 0) return Response.json({});

      // Cache API
      let allNotes;
      const cache = caches.default;
      try {
        const cached = await cache.match(CACHE_KEY);
        if (cached) allNotes = await cached.json();
      } catch {}

      if (!allNotes) {
        allNotes = parseAllNotes(await fetchNotesFromGitHub(repo, env.REPO_TOKEN));
        const resp = new Response(JSON.stringify(allNotes), {
          headers: { 'Content-Type': 'application/json' },
        });
        // Cache for 5 minutes
        const ttlResp = new Response(resp.body, {
          headers: { ...Object.fromEntries(resp.headers), 'Cache-Control': 's-maxage=300' },
        });
        try { await cache.put(CACHE_KEY, ttlResp); } catch {}
      }

      const result = {};
      for (const sha of shas) {
        const fullSha = Object.keys(allNotes).find(k => k.startsWith(sha));
        if (fullSha && allNotes[fullSha]) result[sha] = allNotes[fullSha];
      }
      return Response.json(result);
    }

    // --- POST: 添加评论 ---
    if (request.method === 'POST') {
      const sha = (url.searchParams.get('id') || '').trim();
      if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
        return Response.json({ error: 'Invalid id' }, { status: 400 });
      }

      const access_token = getCookie(request.headers.get('cookie'), 'access_token');
      if (!access_token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const user = await verifyGitHubToken(access_token);
      if (!user) return Response.json({ error: 'Invalid token' }, { status: 401 });

      let text;
      try { text = ((await request.json()).text || '').trim(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
      if (!text || text.length > 500) return Response.json({ error: '评论内容为空或超过 500 字符' }, { status: 400 });

      const cf = request.cf || {};
      const comment = {
        type: 'comment', user: user.login, text,
        id: `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        ts: Math.floor(Date.now() / 1000),
        ua: (request.headers.get('user-agent') || '').slice(0, 100),
        ip: request.headers.get('CF-Connecting-IP') || '',
        cf: { asn: cf.asn, country: cf.country, region: cf.region, city: cf.city, timezone: cf.timezone },
      };

      // 读取当前 notes
      let ghData, allNotes;
      try { ghData = await fetchNotesFromGitHub(repo, env.REPO_TOKEN); allNotes = parseAllNotes(ghData); }
      catch (e) { return Response.json({ error: 'Failed to read notes', detail: e.message }, { status: 502 }); }

      const notesCommitSha = allNotes._commitSha;
      if (!notesCommitSha) return Response.json({ error: 'No notes commit found' }, { status: 500 });

      const fullSha = Object.keys(allNotes).find(k => k.startsWith(sha));
      const existingNdjson = fullSha
        ? (ghData?.data?.repository?.ref?.target?.tree?.entries?.find(e => e.name === fullSha)?.object?.text || '')
        : '';
      const newNdjson = existingNdjson + JSON.stringify(comment) + '\n';

      const [owner, repoName] = repo.split('/');
      const API = `https://api.github.com/repos/${owner}/${repoName}`;
      const auth = { 'Authorization': `Bearer ${env.REPO_TOKEN}`, 'User-Agent': 'gitweets/1.0' };

      // 1. 创建 blob
      const blobR = await fetch(`${API}/git/blobs`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNdjson, encoding: 'utf-8' }),
        signal: AbortSignal.timeout(10000),
      });
      if (!blobR.ok) return Response.json({ error: 'Failed to create blob', detail: await blobR.text() }, { status: 502 });
      const blobSha = (await blobR.json()).sha;

      // 2. 获取 notes tree
      const commitR = await fetch(`${API}/git/commits/${notesCommitSha}`, {
        headers: auth, signal: AbortSignal.timeout(5000),
      });
      if (!commitR.ok) return Response.json({ error: 'Failed to read notes commit' }, { status: 502 });
      const currentTreeSha = (await commitR.json()).tree.sha;

      // 3. 创建新 tree
      const targetSha = fullSha || sha;
      const treeR = await fetch(`${API}/git/trees`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_tree: currentTreeSha, tree: [{ path: targetSha, mode: '100644', type: 'blob', sha: blobSha }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (!treeR.ok) return Response.json({ error: 'Failed to create tree', detail: await treeR.text() }, { status: 502 });
      const newTreeSha = (await treeR.json()).sha;

      // 4. 创建 commit
      const newCommitR = await fetch(`${API}/git/commits`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `comment by ${user.login}`, tree: newTreeSha, parents: [notesCommitSha] }),
        signal: AbortSignal.timeout(10000),
      });
      if (!newCommitR.ok) return Response.json({ error: 'Failed to create commit', detail: await newCommitR.text() }, { status: 502 });
      const newCommitSha = (await newCommitR.json()).sha;

      // 5. 更新 ref（冲突直接失败）
      const refR = await fetch(`${API}/git/refs/notes/commits`, {
        method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: newCommitSha }),
        signal: AbortSignal.timeout(10000),
      });
      if (!refR.ok) return Response.json({ error: 'Failed to update ref (conflict?)', detail: await refR.text() }, { status: 409 });

      // 6. 清缓存
      try { await caches.default.delete(CACHE_KEY); } catch {}

      return Response.json({ success: true, comment });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (e) {
    console.error('new_cmt error:', e);
    return Response.json({ error: 'Internal error', detail: e.message }, { status: 500 });
  }
}

export function onRequest(context) {
  return handler(context.request, context.env);
}
