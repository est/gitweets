async function handler(request, env) {
  const req_url = new URL(request.url)
  const code = (req_url.searchParams.get('code') || '').trim()
  const rspGohome = Response.redirect(req_url.origin, 302)
  if (code.length != 20 || !env.client_secret || !env.client_id){
    return rspGohome
  }
  const payload = {
    "client_id": env.client_id,
    "client_secret": env.client_secret,
    "code": code,
  }
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'post', headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(payload).toString(),
    signal: AbortSignal.timeout(5000)})
  const res = await r.json()
  console.debug(code, res)
  if (res.access_token) {
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `access_token=${res.access_token}; Path=/; Secure; SameSite=Strict; Max-Age=20000`
      }
    })
  } else {
    return rspGohome
  }
}

export function onRequest(context) {
  return handler(context.request, context.env)
}
