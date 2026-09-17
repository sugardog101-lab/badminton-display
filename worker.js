const DEFAULT_KEY = "badminton:main";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: cors
      });
    }

    // =========================
    // API
    // =========================
    if (url.pathname === "/api") {
      if (!env.BADMINTON_STATE) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "BADMINTON_STATE binding is missing"
          }),
          {
            status: 500,
            headers: {
              ...cors,
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      const key = env.STATE_KEY || DEFAULT_KEY;

      // -------------------------
      // GET
      // -------------------------
      if (request.method === "GET") {
        const record = await env.BADMINTON_STATE.get(key, {
          type: "json"
        });

        return new Response(
          record ? JSON.stringify(record) : "",
          {
            status: 200,
            headers: {
              ...cors,
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      // -------------------------
      // POST
      // -------------------------
      if (request.method === "POST") {
        let body;

        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "invalid json"
            }),
            {
              status: 400,
              headers: {
                ...cors,
                "Content-Type": "application/json; charset=utf-8"
              }
            }
          );
        }

        const current = await env.BADMINTON_STATE.get(key, {
          type: "json"
        });

        const currentRevision = Number(
          current?.revision || 0
        );

        const requestedRevision = Number(
          body.revision || 0
        );

        // 他の端末が先に更新していた場合
        if (
          current &&
          requestedRevision !== currentRevision
        ) {
          return new Response(
            JSON.stringify({
              ok: false,
              conflict: true,
              revision: currentRevision,
              json: current.json || ""
            }),
            {
              status: 409,
              headers: {
                ...cors,
                "Content-Type": "application/json; charset=utf-8"
              }
            }
          );
        }

        const next = {
          revision: currentRevision + 1,
          json: String(body.json || "")
        };

        await env.BADMINTON_STATE.put(
          key,
          JSON.stringify(next)
        );

        return new Response(
          JSON.stringify({
            ok: true,
            revision: next.revision,
            json: next.json
          }),
          {
            status: 200,
            headers: {
              ...cors,
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Method not allowed"
        }),
        {
          status: 405,
          headers: {
            ...cors,
            "Content-Type": "application/json; charset=utf-8"
          }
        }
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
            headers: cors
          }
        );
      }

      const response = await env.ASSETS.fetch(request);

      const headers = new Headers(response.headers);

      headers.set("Cache-Control", "no-store");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return new Response("Not found", {
      status: 404,
      headers: cors
    });
  }
};
