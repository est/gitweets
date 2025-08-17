function getCookie(cookie_str, name) {
    return decodeURIComponent(cookie_str || ''
        .split(";")
        .find(row => row.trim().startsWith(name + "="))
        ?.split("=")[1]?.trim() || '');
}

async function handler(request, env) {
    const req_url = new URL(request.url)
    const repo = req_url.searchParams.get('repo')
    if (!repo) return new Response('', {status: 400})
    const access_token = getCookie(request.headers.get('cookie'), 'access_token')
    const {message} = await request.json()
    if (!msg) return new Response('', {status: 400})
    const API_BASE = `https://api.github.com/repos/${repo}`
    const r1 = await fetch(`${API_BASE}/commits?per_page=1`, {
        method: 'get', signal: AbortSignal.timeout(5000),
    })
    const r1_rsp = await r1.json()
    const last_sha = r1_rsp?.[0]?.sha
    const last_tree = r1_rsp?.[0]?.commit?.tree?.sha
    if (!last_sha || !last_tree) return new Response('', {status: 400})
    const r2 = await fetch(`${API_BASE}/commits/${last_sha}/branches-where-head`, {
        method: 'get', signal: AbortSignal.timeout(5000),
    })
    const branch = (await r2.json())?.[0]?.name
    API_COMMIT_BASE = `${API_BASE}/git/commits`
    const r3 = await fetch(API_COMMIT_BASE, {
        method: 'post', header: {"Authorization": `Bearer ${access_token}`},
        signal: AbortSignal.timeout(5000), body: JSON.stringify({
            message: message, tree: last_tree, parents: [last_sha]
        }), credentials: 'include'
    })
    API_HEAD_BASE = `${API_BASE}/git/ref/heads/${branch}`
    const new_sha = (await r3.json())?.sha
    const r4 = await fetch(API_HEAD_BASE, {
        method: 'patch', header: {"Authorization": `Bearer ${access_token}`},
        signal: AbortSignal.timeout(5000), body: JSON.stringify({
            sha: new_sha
        }), credentials: 'include'
    })
    return Response.json(await r4.json(), {status: 201})
}

export function onRequest(context) {
  return handler(context.request, context.env)
}
