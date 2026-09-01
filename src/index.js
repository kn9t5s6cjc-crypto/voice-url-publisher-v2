import JSZip from 'jszip';

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 300;
const MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
  pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', wav: 'audio/wav',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf'
};

function cleanTeamName(value = '') {
  return value.trim().toLowerCase().normalize('NFKC')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff_-]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40);
}
function safePath(name) {
  const n = name.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!n || n.startsWith('/') || n.split('/').some(p => p === '..')) return null;
  return n;
}
function ignored(path) {
  return path.split('/').some(p => p === '__MACOSX' || p === '.DS_Store' || p.startsWith('._'));
}
function ext(path) { const x = path.split('.').pop().toLowerCase(); return MIME[x] || 'application/octet-stream'; }
function htmlPage() {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VOICE EVENT | Webサイトを公開する</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;background:#f6f6f4;color:#111}.wrap{max-width:760px;margin:0 auto;padding:52px 20px 80px}.brand{font-size:13px;font-weight:900;letter-spacing:.18em;color:#e60012}.card{margin-top:18px;background:#fff;border:1px solid #ddd;border-radius:18px;padding:34px;box-shadow:0 12px 40px #0000000a}h1{font-size:34px;margin:0 0 10px}.lead{color:#555;line-height:1.8;margin-bottom:28px}label{display:block;font-size:13px;font-weight:800;margin:18px 0 8px}input{width:100%;padding:14px;border:1px solid #ccc;border-radius:10px;font-size:16px}button{width:100%;margin-top:24px;padding:16px;border:0;border-radius:10px;background:#e60012;color:#fff;font-weight:900;font-size:16px;cursor:pointer}button:disabled{opacity:.5}.note{font-size:12px;color:#777;margin-top:14px;line-height:1.7}.steps{margin-top:20px;font-weight:700;font-size:13px}.result{display:none;margin-top:22px;padding:18px;background:#f5f5f5;border-radius:12px;word-break:break-all}.result a{color:#e60012;font-weight:800}.error{color:#c00}.spinner{display:none;margin-top:12px;text-align:center;color:#666;font-size:13px}@media(max-width:600px){.wrap{padding-top:28px}.card{padding:24px}h1{font-size:27px}}
</style></head><body><main class="wrap"><div class="brand">VOICE EVENT</div><section class="card"><h1>Webサイトを公開する</h1><p class="lead">作ったサイトのZIPを選ぶだけ。WindowsでもMacでも、公開URLをすぐ発行します。</p><form id="f"><label>チーム名</label><input id="team" name="team" placeholder="例：team-a" required maxlength="40"><label>サイトのZIPファイル</label><input id="zip" name="zip" type="file" accept=".zip,application/zip" required><button id="btn">公開する</button><div id="spin" class="spinner">アップロードしています…</div></form><div class="note">index.html が必要です。Macの __MACOSX / .DS_Store は自動で無視します。ZIPの中にフォルダが1つ入っていてもOKです。最大20MB。</div><div class="steps">1. ZIPを選ぶ　→　2. 公開する　→　3. URLを受け取る</div><div id="result" class="result"></div></section></main><script>
const f=document.getElementById('f'),btn=document.getElementById('btn'),spin=document.getElementById('spin'),result=document.getElementById('result');
f.addEventListener('submit',async e=>{e.preventDefault();result.style.display='none';btn.disabled=true;spin.style.display='block';try{const fd=new FormData(f);const r=await fetch('/api/publish',{method:'POST',body:fd});const d=await r.json();result.style.display='block';if(!r.ok)throw new Error(d.error||'公開に失敗しました');result.innerHTML='<b>公開できました！</b><br><a href="'+d.url+'" target="_blank" rel="noopener">'+d.url+'</a><br><button type="button" style="margin-top:12px" onclick="navigator.clipboard.writeText(\''+d.url+'\')">URLをコピー</button>'}catch(err){result.style.display='block';result.innerHTML='<span class="error">'+err.message+'</span>'}finally{btn.disabled=false;spin.style.display='none'}});
</script></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return new Response(htmlPage(), {headers:{'content-type':'text/html; charset=utf-8'}});

    if (request.method === 'POST' && url.pathname === '/api/publish') {
      try {
        const form = await request.formData();
        const file = form.get('zip');
        const team = cleanTeamName(String(form.get('team') || ''));
        if (!team) return Response.json({error:'チーム名を入力してください。'}, {status:400});
        if (!file || typeof file.arrayBuffer !== 'function') return Response.json({error:'ZIPファイルを選んでください。'}, {status:400});
        if (file.size > MAX_ZIP_BYTES) return Response.json({error:'ZIPは20MB以下にしてください。'}, {status:413});

        let zip;
        try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
        catch { return Response.json({error:'ZIPを読み込めませんでした。ZIP形式を確認してください。'}, {status:400}); }

        const entries = Object.values(zip.files).filter(e => !e.dir).map(e => ({e, path:safePath(e.name)})).filter(x => x.path && !ignored(x.path));
        if (!entries.length) return Response.json({error:'ZIPの中に公開できるファイルがありません。'}, {status:400});
        if (entries.length > MAX_FILES) return Response.json({error:`ファイル数は${MAX_FILES}個以下にしてください。`}, {status:400});

        const indexes = entries.filter(x => x.path.toLowerCase().endsWith('/index.html') || x.path.toLowerCase() === 'index.html');
        if (!indexes.length) return Response.json({error:'index.html が見つかりません。サイトのフォルダに index.html を入れてください。'}, {status:400});
        indexes.sort((a,b) => a.path.split('/').length - b.path.split('/').length);
        const indexPath = indexes[0].path;
        const root = indexPath.slice(0, indexPath.length - 'index.html'.length);
        const siteEntries = entries.filter(x => x.path.startsWith(root));
        let total = 0;
        const prepared = [];
        for (const x of siteEntries) {
          const relative = x.path.slice(root.length);
          if (!relative || ignored(relative)) continue;
          const data = await x.e.async('uint8array');
          total += data.byteLength;
          if (total > MAX_UNCOMPRESSED_BYTES) return Response.json({error:'展開後のファイル容量が大きすぎます。'}, {status:413});
          prepared.push({relative,data});
        }
        if (!prepared.some(x => x.relative.toLowerCase() === 'index.html')) return Response.json({error:'index.html を公開ルートに設定できませんでした。'}, {status:400});

        const siteId = `${team}-${crypto.randomUUID().slice(0,8)}`;
        for (const x of prepared) await env.SITES.put(`sites/${siteId}/${x.relative}`, x.data, {httpMetadata:{contentType:ext(x.relative)}});
        await env.SITES.put(`sites/${siteId}/.manifest`, JSON.stringify({createdAt:new Date().toISOString(),files:prepared.map(x=>x.relative)}), {httpMetadata:{contentType:'application/json'}});
        return Response.json({url:`${url.origin}/s/${siteId}/`});
      } catch (e) {
        console.error(e);
        return Response.json({error:'公開処理でエラーが発生しました。もう一度試してください。'}, {status:500});
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/s/')) {
      const rest = url.pathname.slice(3);
      const slash = rest.indexOf('/');
      if (slash < 1) return new Response('Not Found',{status:404});
      const siteId = rest.slice(0,slash);
      let path = rest.slice(slash+1) || 'index.html';
      path = safePath(path);
      if (!path) return new Response('Not Found',{status:404});
      let obj = await env.SITES.get(`sites/${siteId}/${path}`);
      if (!obj && !path.includes('.')) obj = await env.SITES.get(`sites/${siteId}/${path}/index.html`);
      if (!obj) return new Response('Not Found',{status:404});
      const headers = new Headers(); obj.writeHttpMetadata(headers); headers.set('etag',obj.httpEtag); headers.set('x-content-type-options','nosniff');
      return new Response(obj.body,{headers});
    }
    return new Response('Not Found',{status:404});
  }
};
