```javascript
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

    // =========================
    // CORS
    // =========================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // =========================
    // API
    // =========================
    if (url.pathname === "/api") {
      if (!env.BADMINTON_STATE) {
        return jsonResponse(
          {
            ok: false,
            error: "BADMINTON_STATE binding is missing",
          },
          500
        );
      }

      const key = url.searchParams.get("key") || DEFAULT_KEY;

      // =========================
      // GET
      // =========================
      if (request.method === "GET") {
        const record = await env.BADMINTON_STATE.get(key, {
          type: "json",
        });

        return jsonResponse(
          record
            ? record
            : {
                revision: 0,
                json: "",
              }
        );
      }

      // =========================
      // POST
      // =========================
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

        const current = await env.BADMINTON_STATE.get(key, {
          type: "json",
        });

        const currentRevision = Number(
          current?.revision || 0
        );

        const requestedRevision = Number(
          body?.revision || 0
        );

        // =========================
        // 競合チェック
        // =========================
        if (
          current &&
          requestedRevision !== currentRevision
        ) {
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

        await env.BADMINTON_STATE.put(
          key,
          JSON.stringify(next)
        );

        return jsonResponse({
          ok: true,
          revision: next.revision,
          json: next.json,
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

    // =========================
    // トップページ
    // =========================
    if (
      url.pathname === "/" ||
      url.pathname === "/index.html"
    ) {
      if (!env.ASSETS) {
        return new Response(
          "ASSETS binding is missing",
          {
            status: 500,
            headers: corsHeaders(),
          }
        );
      }

      const response = await env.ASSETS.fetch(request);

      const headers = new Headers(response.headers);

      headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );

      headers.set("Pragma", "no-cache");

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
```
