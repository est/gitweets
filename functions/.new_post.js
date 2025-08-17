function getCookie(cookie_str, name) {
    return decodeURIComponent(cookie_str || ''
        .split(";")
        .find(row => row.trim().startsWith(name + "="))
        ?.split("=")[1]?.trim() || '');
}

async function fetch_json(url, opts){
    if (!opts) opts = {}
    opts.signal ||= AbortSignal.timeout(5000)
    opts.headers ||= {}
    opts.headers['User-Agent'] = 'gitweets/1.0 (cloudflare worker)'
    const req = await fetch(url, opts)
    const rsp = await req.text()
    try{
        return JSON.parse(rsp)
    } catch(err) {
        console.error(err, rsp)
    }
}

async function handler(request, env) {
    const req_url = new URL(request.url)
    const repo = req_url.searchParams.get('repo')
    if (!repo) return Response.json({error: 'no repo'}, {status: 400})
    const access_token = getCookie(request.headers.get('cookie'), 'access_token')
    const {message} = await request.json()
    if (!message) return Response.json({error: 'no message'}, {status: 400})
    const API_BASE = `https://api.github.com/repos/${repo}`
    const r1 = await fetch_json(`${API_BASE}/commits?per_page=1`)
    const last_sha = r1?.[0]?.sha
    const last_tree = r1?.[0]?.commit?.tree?.sha
    if (!last_sha || !last_tree) return Response.json({error: 'no last commit', rsp: r1}, {status: 400})
    const r2 = await fetch_json(`${API_BASE}/commits/${last_sha}/branches-where-head`)
    const branch = r2?.[0]?.name
    if (!branch){return Response.json({error: 'no branch', rsp: r2}, {status: 400})}
    const r3 = await fetch_json(`${API_BASE}/git/commits`, {
        method: 'post', header: {"Authorization": `Bearer ${access_token}`},
        body: JSON.stringify({
            message: message, tree: last_tree, parents: [last_sha]
        }), credentials: 'include'
    })
    const new_sha = r3?.sha
    if (!new_sha) return Response.json({error: 'failed to commit', rsp: r3}, {status: 400})
    const r4 = await fetch_json(`${API_BASE}/git/ref/heads/${branch}`, {
        method: 'patch', header: {"Authorization": `Bearer ${access_token}`},
        body: JSON.stringify({
            sha: new_sha
        }), credentials: 'include'
    })
    return Response.json(r4, {status: 201})
}

export function onRequest(context) {
  return handler(context.request, context.env)
}
