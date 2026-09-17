const DEFAULT_KEY = 'badminton:main';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    };
    if (request.method === 'OPTIONS') return new Response('', {headers: cors});
    if (url.pathname !== '/api') return new Response('Not found', {status:404, headers:cors});
    const key = env.STATE_KEY || DEFAULT_KEY;
    if (request.method === 'GET') {
      const record = await env.BADMINTON_STATE.get(key, {type:'json'});
      return new Response(record ? JSON.stringify(record) : '', {headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
    }
    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ok:false,error:'invalid json'}), {status:400,headers:{...cors,'Content-Type':'application/json'}}); }
      const current = await env.BADMINTON_STATE.get(key, {type:'json'});
      const currentRevision = Number(current?.revision || 0);
      const requestedRevision = Number(body.revision || 0);
      if (current && requestedRevision !== currentRevision) {
        return new Response(JSON.stringify({ok:false,conflict:true,revision:currentRevision,json:current.json || ''}), {headers:{...cors,'Content-Type':'application/json'}});
      }
      const next = {revision: currentRevision + 1, json: String(body.json || '')};
      await env.BADMINTON_STATE.put(key, JSON.stringify(next));
      return new Response(JSON.stringify({ok:true,revision:next.revision,json:next.json}), {headers:{...cors,'Content-Type':'application/json'}});
    }
    return new Response('Method not allowed', {status:405,headers:cors});
  }
};
