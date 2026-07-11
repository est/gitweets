function getCookie(cookie_str, name) {
    return decodeURIComponent(cookie_str || '')
        .split(";")
        .find(row => row.trim().startsWith(name + "="))
        ?.split("=")[1]?.trim() || '';
}

async function fetch_json(url, opts){
    if (!opts || Object.keys(opts).length === 0) opts = {}
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

// 批量处理图片（前端已压缩，后端直接返回）
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

// 创建 GitHub Blob
async function createBlob(repo, content, token) {
    const API_BASE = `https://api.github.com/repos/${repo}`;
    
    // 将 ArrayBuffer 转换为 Base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));
    
    const response = await fetch_json(`${API_BASE}/git/blobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            content: base64,
            encoding: 'base64'
        })
    });
    
    return response.sha;
}

// 批量创建 Blobs
async function createBlobs(repo, images, token) {
    const results = [];
    
    // 并行创建所有 Blobs
    const promises = images.map(async (img) => {
        const sha = await createBlob(repo, img.content, token);
        return {
            sha,
            filename: img.filename
        };
    });
    
    return Promise.all(promises);
}

// 生成图片存储路径
function getImagePath(filename) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `static/${year}/${month}${day}-${filename.split('-')[1]}`;
}

// 创建包含图片的新 Tree
async function createTree(repo, baseTree, blobs, token) {
    const API_BASE = `https://api.github.com/repos/${repo}`;
    
    const tree = blobs.map(blob => ({
        path: getImagePath(blob.filename),
        mode: '100644',
        type: 'blob',
        sha: blob.sha
    }));
    
    const response = await fetch_json(`${API_BASE}/git/trees`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            base_tree: baseTree,
            tree: tree
        })
    });
    
    return response.sha;
}

// 验证图片文件
function validateImage(image) {
    // 验证文件类型
    if (!image.type.startsWith('image/')) {
        return { valid: false, error: `${image.name} 不是图片文件` };
    }
    
    // 验证文件大小 (5MB，前端会压缩到 ~100KB)
    if (image.size > 5 * 1024 * 1024) {
        return { valid: false, error: `${image.name} 超过 5MB 限制` };
    }
    
    return { valid: true };
}

// 验证所有图片
function validateImages(images) {
    for (const image of images) {
        const validation = validateImage(image);
        if (!validation.valid) {
            return validation;
        }
    }
    return { valid: true };
}

async function handler(request, env) {
    try {
        const req_url = new URL(request.url)
        const content_type = request.headers.get('content-type') || ''

        let message, repo, images = []

        // 向后兼容：支持 JSON 和 FormData
        if (content_type.includes('application/json')) {
            // 旧版 JSON 请求
            const body = await request.json()
            message = body.message
            repo = req_url.searchParams.get('repo') || body.repo
        } else if (content_type.includes('multipart/form-data')) {
            // 新版 FormData 请求
            const formData = await request.formData()
            message = formData.get('message')
            repo = formData.get('repo')
            images = formData.getAll('images')
        } else {
            return Response.json({error: 'Unsupported content type'}, {status: 400})
        }

        if (!repo) return Response.json({error: 'no repo'}, {status: 400})
        if (!message && images.length === 0) {
            return Response.json({error: 'no message'}, {status: 400})
        }
        
        // 验证图片
        if (images.length > 0) {
            const validation = validateImages(images);
            if (!validation.valid) {
                return Response.json({ error: validation.error }, { status: 400 });
            }
            
            if (images.length > 9) {
                return Response.json({ error: '最多选择 9 张图片' }, { status: 400 });
            }
        }
        
        // 处理图片
        let processedImages = [];
        if (images.length > 0) {
            processedImages = await processImages(images);
            console.log(`Processed ${processedImages.length} of ${images.length} images`);
            processedImages.forEach(img => {
                console.log(`  ${img.filename}: ${img.content.byteLength} bytes`);
            });
        }
        
        const access_token = getCookie(request.headers.get('cookie'), 'access_token')
        
        // 创建图片 Blobs
        let blobResults = [];
        if (processedImages.length > 0) {
            blobResults = await createBlobs(repo, processedImages, access_token);
            console.log(`Created ${blobResults.length} blobs`);
        }
        
        const API_BASE = `https://api.github.com/repos/${repo}`
        const r1 = await fetch_json(`${API_BASE}/commits?per_page=1`)
        const last_sha = r1?.[0]?.sha
        const last_tree = r1?.[0]?.commit?.tree?.sha
        if (!last_sha || !last_tree) return Response.json({error: 'no last commit', rsp: r1}, {status: 400})
        const r2 = await fetch_json(`${API_BASE}/commits/${last_sha}/branches-where-head`)
        const branch = r2?.[0]?.name
        if (!branch) return Response.json({error: 'no branch', rsp: r2}, {status: 400})
        
        // 创建新 Tree（如果有图片）
        let new_tree_sha = last_tree;
        if (blobResults.length > 0) {
            new_tree_sha = await createTree(repo, last_tree, blobResults, access_token);
            console.log(`Created new tree: ${new_tree_sha}`);
        }
        
        // 创建 Commit
        const commitMessage = processedImages.length > 0 && !message.endsWith(':')
            ? message + ':'
            : message;
        
        const r3_api = `${API_BASE}/git/commits`
        const r3_req = {
            message: commitMessage, tree: new_tree_sha, parents: [last_sha]
        }
        const r3_opts = {
            method: 'post', headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`},
            body: JSON.stringify(r3_req), credentials: 'include'
        }
        const r3 = await fetch_json(r3_api, r3_opts)
        const new_sha = r3?.sha
        if (!new_sha) {
            console.log(r3_opts)
            return Response.json({
                error: 'failed to commit', req: r3_req, rsp: r3, url: r3_api
            }, {status: 400})
        }
        
        // https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#create-a-reference
        const r4_api = `${API_BASE}/git/refs/heads/${branch}`
        const r4_opts = {
            method: 'patch', headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`},
            body: JSON.stringify({sha: new_sha}), credentials: 'include'
        }
        const r4 = await fetch_json(r4_api, r4_opts)
        console.log(r4_api, r4_opts)
        return Response.json(r4, {status: 201})
        
    } catch (e) {
        console.error('Handler error:', e);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

export function onRequest(context) {
  return handler(context.request, context.env)
}
