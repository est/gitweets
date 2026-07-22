// 工具函数
function getCookie(cookie_str, name) {
  return decodeURIComponent(cookie_str || '')
    .split(";")
    .find(row => row.trim().startsWith(name + "="))
    ?.split("=")[1]?.trim() || '';
}

async function fetch_json(url, opts) {
  if (!opts || Object.keys(opts).length === 0) opts = {};
  opts.signal ||= AbortSignal.timeout(15000);
  opts.headers ||= {};
  opts.headers['User-Agent'] = 'gitweets/2.0 (https://f.est.im/)';
  opts.headers['Accept'] = 'application/vnd.github+json'
  opts.headers['X-GitHub-Api-Version'] = '2026-03-10'
  opts.headers['Content-Type'] = 'application/json'


  // // 记录请求/响应详情（调试用，生产环境可注释）
  // const reqHeaders = {};
  // for (const [k, v] of Object.entries(opts.headers)) {
  //   reqHeaders[k] = k.toLowerCase() === 'authorization'
  //     ? `Bearer ${v.replace(/^Bearer\s+/, '').slice(0, 6)}...`
  //     : v;
  // }
  // console.log(`>>> ${opts.method || 'GET'} ${url}`);
  // console.log('    req headers:', JSON.stringify(reqHeaders));
  // if (opts.body) console.log('    req body:', typeof opts.body === 'string' ? opts.body.slice(0, 500) : '(non-string)');

  const req = await fetch(url, opts);
  const rsp = await req.text();

  // // 记录响应头（调试用，生产环境可注释）
  // const rspHeaders = {};
  // req.headers.forEach((v, k) => { rspHeaders[k] = v; });
  // console.log(`<<< ${req.status} ${url}`);
  // console.log('    rsp headers:', JSON.stringify(rspHeaders));
  // console.log('    rsp body:', rsp.slice(0, 500));

  let json;
  try {
    json = JSON.parse(rsp);
  } catch(err) {
    console.error('JSON parse error:', err, rsp.slice(0, 200));
    throw new Error(`Invalid response from GitHub: ${rsp.slice(0, 200)}`);
  }
  if (!req.ok) {
    const msg = json?.message || JSON.stringify(json);
    throw new Error(`GitHub API ${req.status}: ${msg}`);
  }
  return json;
}

// 图片处理函数
async function processImages(images) {
  const results = [];
  for (const image of images) {
    const buffer = await image.arrayBuffer();
    results.push({
      content: buffer,
      filename: image.name,
      type: image.type
    });
  }
  return results;
}

async function createBlob(repo, content, token) {
  const API_BASE = `https://api.github.com/repos/${repo}`;
  const bytes = new Uint8Array(content);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64 = btoa(binary);

  try {
    const response = await fetch_json(`${API_BASE}/git/blobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: base64,
        encoding: 'base64'
      })
    });
    return response?.sha || null;
  } catch (e) {
    console.error('createBlob error:', e.message);
    return null;
  }
}

async function createBlobs(repo, images, token) {
  const promises = images.map(async (img) => {
    const sha = await createBlob(repo, img.content, token);
    return { sha, filename: img.filename };
  });
  const results = await Promise.all(promises);
  const failed = results.filter(r => !r.sha);
  if (failed.length > 0) {
    console.error('createBlobs failed for:', failed.map(f => f.filename));
  }
  return results;
}

// 生成图片存储路径：static/YYYY/MMDD-HHmmss.ext
// index: 同一批图片的序号（从0开始），每张+1s避免秒内冲突
function getImagePath(filename, index = 0) {
  const now = new Date();
  now.setSeconds(now.getSeconds() + index);
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  return `static/${y}/${mo}${d}-${h}${mi}${s}${ext}`;
}

async function createTree(repo, baseTree, blobs, token) {
  const API_BASE = `https://api.github.com/repos/${repo}`;
  const tree = blobs.map((blob, i) => ({
    path: getImagePath(blob.filename, i),
    mode: '100644',
    type: 'blob',
    sha: blob.sha
  }));

  try {
    const response = await fetch_json(`${API_BASE}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        base_tree: baseTree,
        tree: tree
      })
    });
    return response;
  } catch (e) {
    console.error('createTree error:', e.message);
    return null;
  }
}

// ArrayBuffer → base64（Contents API 用）
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// 通过 Contents API 上传单个文件（支持 OAuth token）
// sha 可选：更新已有文件时需传入，新建时不传
async function uploadFile(repo, path, content, message, token, sha) {
  /* https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents */
  const API_BASE = `https://api.github.com/repos/${repo}`;
  const base64 = typeof content === 'string' ? btoa(content) : arrayBufferToBase64(content);
  const encodedPath = path.split('/').map(s => encodeURIComponent(s)).join('/');

  const body = { message, content: base64};
  if (sha) body.sha = sha;  // 更新已有文件时需要

  return fetch_json(`${API_BASE}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

// 验证函数
function validateImage(image) {
  if (!image.type.startsWith('image/')) {
    return { valid: false, error: `${image.name} 不是图片文件` };
  }
  if (image.size > 5 * 1024 * 1024) {
    return { valid: false, error: `${image.name} 超过 5MB 限制` };
  }
  return { valid: true };
}

function validateImages(images) {
  for (const image of images) {
    const validation = validateImage(image);
    if (!validation.valid) return validation;
  }
  return { valid: true };
}

// 主处理函数
async function handler(request, env) {
  try {
    const req_url = new URL(request.url);
    const content_type = request.headers.get('content-type') || '';
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
    const country = request.headers.get('cf-ipcountry') || 'unknown';
    const colo = request.headers.get('cf-ray')?.split('.')?.[1] || 'unknown';

    // // 记录 cookie 名称（不记录值，安全）
    // const cookieStr = request.headers.get('cookie') || '';
    // const cookieNames = cookieStr.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
    // const hasAccessToken = cookieNames.includes('access_token');
    // const hasLoggedIn = cookieNames.includes('logged_in');
    // console.log(`[NEW POST] client=${clientIP} country=${country} colo=${colo}`);
    // console.log(`  cookies: ${cookieNames.join(', ') || '(none)'} | access_token=${hasAccessToken} logged_in=${hasLoggedIn}`);

    let message, repo, images = [];

    if (content_type.includes('application/json')) {
      const body = await request.json();
      message = body.message;
      repo = req_url.searchParams.get('repo') || body.repo;
    } else if (content_type.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = formData.get('message');
      repo = formData.get('repo');
      images = formData.getAll('images');
    } else {
      return Response.json({error: 'Unsupported content type'}, {status: 400});
    }

    if (!repo) return Response.json({error: 'no repo'}, {status: 400});
    if (!message && images.length === 0) {
      return Response.json({error: 'no message'}, {status: 400});
    }

    if (images.length > 0) {
      const validation = validateImages(images);
      if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
      if (images.length > 9) {
        return Response.json({ error: '最多选择 9 张图片' }, { status: 400 });
      }
    }

    let processedImages = [];
    if (images.length > 0) {
      processedImages = await processImages(images);
      // console.log(`Processed ${processedImages.length} of ${images.length} images`);
    }

    const access_token = getCookie(request.headers.get('cookie'), 'access_token');
    if (!access_token) {
      return Response.json({ error: '未登录或 token 已过期，请重新登录' }, { status: 401 });
    }
    // console.log(`  token: ${access_token.slice(0, 6)}...${access_token.slice(-4)}`);
    const API_BASE = `https://api.github.com/repos/${repo}`;
    const opts = {headers: {
      "Authorization": `Bearer ${access_token}`
    }}


    const commitMessage = processedImages.length > 0 && !message.endsWith(':')
      ? message + ':'
      : message;


    // ============================================================
    // Contents API 路径：纯文本或单图，走 PUT /contents（支持 OAuth）
    // 多图仍走下面的 Git Data API 路径做对比测试
    // ============================================================
    if (processedImages.length === 0) {
      // 纯文本：更新 static/.gitkeep 触发 commit
      // 空文件的 blob SHA 是固定的，用于更新已有文件
      const EMPTY_BLOB_SHA = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';
      const r = await uploadFile(repo, 'static/.gitkeep', '', commitMessage, access_token, EMPTY_BLOB_SHA);
      return Response.json(r, {status: 201});
    } else if (processedImages.length === 1) {
      // 单图：直接用 Contents API 上传图片文件
      const img = processedImages[0];
      const path = getImagePath(img.filename);
      // console.log(`  [Contents] 单图 commit: ${path} msg: ${commitMessage}`);
      const r = await uploadFile(repo, path, img.content, commitMessage, access_token);
      return Response.json(r, {status: 201});
    }
    

    // ============================================================
    // Git Data API 路径：多图走原有 blob → tree → commit 流程
    // ============================================================
    // console.log('[Git Data API] 多图，使用 Git Data API 路径');

    let blobResults = [];
    if (processedImages.length > 0) {
      blobResults = await createBlobs(repo, processedImages, access_token);
      const validBlobs = blobResults.filter(b => b.sha);
      if (validBlobs.length !== blobResults.length) {
        return Response.json({ error: 'failed to create some blobs' }, {status: 400});
      }
      // console.log(`Created ${validBlobs.length} blobs`);
      blobResults = validBlobs;
    }

    const r1 = await fetch_json(`${API_BASE}/commits?per_page=1`, opts);
    const last_sha = r1?.[0]?.sha;
    const last_tree = r1?.[0]?.commit?.tree?.sha;
    if (!last_sha || !last_tree) return Response.json({error: '无法获取最新提交', detail: r1?.message || JSON.stringify(r1)}, {status: 400});

    const r2 = await fetch_json(`${API_BASE}/commits/${last_sha}/branches-where-head`, opts);
    const branch = r2?.[0]?.name;
    if (!branch) return Response.json({error: '无法获取分支信息', detail: r2?.message || JSON.stringify(r2)}, {status: 400});

    let new_tree_sha = last_tree;
    if (blobResults.length > 0) {
      const tree_rsp = await createTree(repo, last_tree, blobResults, access_token);
      new_tree_sha = tree_rsp?.sha;
      if (!new_tree_sha) {
        return Response.json({ error: 'failed to create tree', rsp: tree_rsp }, {status: 400});
      }
      // console.log(`Created new tree: ${new_tree_sha}`);
    }

    const r3_api = `${API_BASE}/git/commits`;
    const r3_req = {
      message: commitMessage,
      tree: new_tree_sha,
      parents: [last_sha]
    };
    // console.log(`[COMMIT] repo=${repo} branch=${branch} tree=${new_tree_sha} parent=${last_sha}`);
    const r3_opts = {
      method: 'POST',
      body: JSON.stringify(r3_req),
      ...opts
    };
    const r3 = await fetch_json(r3_api, r3_opts);
    const new_sha = r3?.sha;
    if (!new_sha) {
      // console.log(r3_opts);
      return Response.json({ error: 'failed to commit' }, {status: 400});
    }

    const r4_api = `${API_BASE}/git/refs/heads/${branch}`;
    const r4_opts = {
      method: 'patch',
      body: JSON.stringify({sha: new_sha}),
      ...opts
    };
    const r4 = await fetch_json(r4_api, r4_opts);
    // console.log(r4_api, r4_opts);
    return Response.json(r4, {status: 201});

  } catch (e) {
    console.error('Handler error:', e);
    return Response.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}

export function onRequest(context) {
  return handler(context.request, context.env);
}
