const DEFAULT_KEY = "badminton:main";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
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
      const key = url.searchParams.get("key") || DEFAULT_KEY;

      // データ取得
      if (request.method === "GET") {
        const record = await env.BADMINTON_STATE.get(key, {
          type: "json",
        });

        return new Response(record ? JSON.stringify(record) : "", {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      // データ保存
      if (request.method === "POST") {
        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              ok: false,
              error: "invalid_json",
            },
            400
          );
        }

        const old = await env.BADMINTON_STATE.get(key, {
          type: "json",
        });

        const oldRevision = old
          ? Number(old.revision) || 0
          : 0;

        const revision = oldRevision + 1;
        const json = String(body.json ?? "");

        const record = {
          revision,
          json,
        };

        await env.BADMINTON_STATE.put(
          key,
          JSON.stringify(record)
        );

        return jsonResponse({
          ok: true,
          revision,
          json,
        });
      }

      return jsonResponse(
        {
          ok: false,
          error: "method_not_allowed",
        },
        405
      );
    }

    // HTML表示
    if (
      url.pathname === "/" ||
      url.pathname === "/index.html"
    ) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);

      headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );

      headers.set("Pragma", "no-cache");

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders(),
    });
  },
};
