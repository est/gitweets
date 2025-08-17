async function handler(request, env) {
  const req_url = new URL(request.url)
  const code = (req_url.searchParams.get('code') || '').trim()
  const rspGohome = Response.redirect('/', 302)
  console.log(env)
  if (code.length != 20 || !env.client_secret || !env.client_id){
    return rspGohome
  }
  const payload = {
    "client_id": env.client_id,
    "client_secret": env.client_secret,
    "code": code,
  }
  console.log(payload)
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'post', headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(payload).toString(),
    signal: AbortSignal.timeout(5000)})
  rsp = await r.json()
  if (rsp.scope == 'public_repo' && rsp.access_token) {
    rspGohome.headers.set('Set-Cookie', `access_token=${rsp.access_token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=20000`)
    return rspGohome
  } else {
    return rspGohome
  }
}

export function onRequest(context) {
  return handler(context.request, context.env)
}
