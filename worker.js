const DEFAULT_KEY = "badminton:main";
function headers() { return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store","CDN-Cache-Control":"no-store"}; }
function json(data,status=200) {return new Response(JSON.stringify(data),{status,headers:{...headers(),"Content-Type":"application/json; charset=utf-8"}});}

export class BadmintonRoom {
  constructor(ctx,env) {
    this.ctx=ctx; this.env=env;
    this.ctx.blockConcurrencyWhile(async()=>{
      let record=await this.ctx.storage.get('state');
      if (!record) {
        // 初回アクセス時のみ旧KVのデータを引き継ぐ。旧KVは削除しない。
        const old=env.BADMINTON_STATE ? await env.BADMINTON_STATE.get(DEFAULT_KEY,{type:'json'}) : null;
        record=old && typeof old.json==='string' ? {revision:Number(old.revision)||0,json:old.json} : {revision:0,json:''};
        await this.ctx.storage.put('state',record);
      }
    });
  }
  async fetch(request) {
    const url=new URL(request.url);
    if (url.pathname==='/api/ws') {
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return json({ok:false,error:'upgrade_required'},426);
      const pair=new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null,{status:101,webSocket:pair[0]});
    }
    if(url.pathname!=='/api') return json({ok:false,error:'not_found'},404);
    if(request.method==='GET') return json(await this.ctx.storage.get('state')||{revision:0,json:''});
    if(request.method!=='POST') return json({ok:false,error:'method_not_allowed'},405);
    let body;
    try {body=await request.json();} catch {return json({ok:false,error:'invalid_json'},400);}
    if(typeof body?.json!=='string') return json({ok:false,error:'invalid_state'},400);
    const revision=Number(body.revision);
    const outcome=await this.ctx.storage.transaction(async tx=>{
      const current=await tx.get('state')||{revision:0,json:''};
      if(!Number.isSafeInteger(revision)||revision!==current.revision) return {conflict:current};
      const next={revision:current.revision+1,json:body.json};
      await tx.put('state',next);
      return {next};
    });
    if(outcome.conflict) return json({ok:false,conflict:true,revision:outcome.conflict.revision,json:outcome.conflict.json},409);
    const next=outcome.next;
    for(const socket of this.ctx.getWebSockets()) {
      try {socket.send(JSON.stringify({type:'updated',revision:next.revision}));} catch {}
    }
    return json({ok:true,...next});
  }
  webSocketMessage(socket,message) {
    if(message==='ping') {try{socket.send('pong');}catch{}}
  }
  webSocketClose() {}
  webSocketError() {}
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
    if(url.pathname==='/api'||url.pathname==='/api/ws') {
      if(!env.BADMINTON_ROOM)return json({ok:false,error:'BADMINTON_ROOM binding missing'},500);
      const key=url.searchParams.get('key')||DEFAULT_KEY;
      const stub=env.BADMINTON_ROOM.get(env.BADMINTON_ROOM.idFromName(key));
      return stub.fetch(request);
    }
    if(url.pathname==='/'||url.pathname==='/index.html') {
      if(!env.ASSETS)return new Response('ASSETS binding missing',{status:500,headers:headers()});
      const response=await env.ASSETS.fetch(request);
      const h=new Headers(response.headers);
      for(const [k,v] of Object.entries(headers()))h.set(k,v);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
    }
    return new Response('Not found',{status:404,headers:headers()});
  }
};
