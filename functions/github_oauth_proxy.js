export function onRequest(context) {
  return handler(context.request, context.env)
}

async function handler(request, env) {
  const req_url = new URL(request.url)
  // https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
  const ct = request.headers.get("content-type")
  let payload;
  if (ct.includes("application/json")) {
    payload = new URLSearchParams(await request.json())
  } else if (request.method ==='POST') {
    payload = new URLSearchParams(await request.formData())
  }
  if(!payload || payload.size === 0) {
    console.debug('Body: '+JSON.stringify(request.body))
    payload = new URLSearchParams(req_url.searchParams)
  }
  let rsp = Response.json({}, {'status': 400})
  if(payload.get('code')){
    payload.set('client_secret', env.github_client_secret)
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'post', headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'},
      body: payload.toString()})
    rsp = Response.json(await r.json())
  }
  rsp.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || req_url.origin)
  return rsp
}