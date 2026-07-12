// 共享的 git notes 评论模块
// 被 .cmts.js 和 .admin 共同使用

export const NOTES_QUERY = `
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

export const CACHE_KEY = 'https://gitweets-cmt-cache/notes';

export function parseNote(ndjson) {
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

export function parseAllNotes(data) {
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

export async function fetchNotesFromGitHub(repoPath, token) {
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
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GraphQL ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

export function getExistingNdjson(ghData, fullSha) {
  return ghData?.data?.repository?.ref?.target?.tree?.entries
    ?.find(e => e.name === fullSha)?.object?.text || '';
}

export async function writeNoteToGitHub(repoPath, token, { targetSha, ndjson, notesCommitSha, commitMsg }) {
  const [owner, repo] = repoPath.split('/');
  const API = `https://api.github.com/repos/${owner}/${repo}`;
  const auth = { 'Authorization': `Bearer ${token}`, 'User-Agent': 'gitweets/1.0' };

  // 1. 创建 blob
  const blobR = await fetch(`${API}/git/blobs`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: ndjson, encoding: 'utf-8' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!blobR.ok) throw new Error(`create blob: ${blobR.status} ${await blobR.text().catch(() => '')}`);
  const blobSha = (await blobR.json()).sha;

  // 2. 获取当前 notes tree
  const commitR = await fetch(`${API}/git/commits/${notesCommitSha}`, {
    headers: auth, signal: AbortSignal.timeout(5000),
  });
  if (!commitR.ok) throw new Error(`read commit: ${commitR.status}`);
  const currentTreeSha = (await commitR.json()).tree.sha;

  // 3. 创建新 tree
  const treeR = await fetch(`${API}/git/trees`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: currentTreeSha, tree: [{ path: targetSha, mode: '100644', type: 'blob', sha: blobSha }] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!treeR.ok) throw new Error(`create tree: ${treeR.status} ${await treeR.text().catch(() => '')}`);
  const newTreeSha = (await treeR.json()).sha;

  // 4. 创建 commit
  const newCommitR = await fetch(`${API}/git/commits`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: commitMsg, tree: newTreeSha, parents: [notesCommitSha] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!newCommitR.ok) throw new Error(`create commit: ${newCommitR.status} ${await newCommitR.text().catch(() => '')}`);
  const newCommitSha = (await newCommitR.json()).sha;

  // 5. 更新 ref
  const refR = await fetch(`${API}/git/refs/notes/commits`, {
    method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommitSha }),
    signal: AbortSignal.timeout(10000),
  });
  if (!refR.ok) throw new Error(`update ref: ${refR.status} ${await refR.text().catch(() => '')}`);
}
