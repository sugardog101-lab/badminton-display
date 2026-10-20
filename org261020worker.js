const DEFAULT_KEY = "badminton:main";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Expires": "0",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/api") {
      if (!env.BADMINTON_STATE) {
        return jsonResponse(
          { ok: false, error: "BADMINTON_STATE binding is missing" },
          500
        );
      }

      const key = url.searchParams.get("key") || DEFAULT_KEY;

      if (request.method === "GET") {
        const record = await env.BADMINTON_STATE.get(key, { type: "json" });
        return jsonResponse(record || { revision: 0, json: "" });
      }

      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ ok: false, error: "invalid_json" }, 400);
        }

        const current = await env.BADMINTON_STATE.get(key, { type: "json" });
        const currentRevision = Number(current?.revision || 0);
        const requestedRevision = Number(body?.revision || 0);

        // optimistic concurrency control:
        // 保存開始時に見ていたrevisionとサーバーのrevisionが違えば拒否する。
        if (current && requestedRevision !== currentRevision) {
          return jsonResponse(
            {
              ok: false,
              conflict: true,
              revision: currentRevision,
              json: current.json || "",
            },
            409
          );
        }

        const next = {
          revision: currentRevision + 1,
          json: String(body?.json ?? ""),
        };

        await env.BADMINTON_STATE.put(key, JSON.stringify(next));

        return jsonResponse({
          ok: true,
          revision: next.revision,
          json: next.json,
        });
      }

      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (!env.ASSETS) {
        return new Response("ASSETS binding is missing", {
          status: 500,
          headers: corsHeaders(),
        });
      }

      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);

      headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );
      headers.set("CDN-Cache-Control", "no-store");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders(),
    });
  },
};
