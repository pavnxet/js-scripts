const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1";
const MODEL = "openai/gpt-oss-120b";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function isAuthorized(request, env) {
  // Keep the proxy private by default. Set API_ACCESS_KEY in Cloudflare.
  if (!env.API_ACCESS_KEY) return false;

  const authorization = request.headers.get("Authorization") || "";
  const xApiKey = request.headers.get("X-API-Key") || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : xApiKey.trim();

  return supplied.length > 0 && supplied === env.API_ACCESS_KEY;
}

function upstreamHeaders(env) {
  return {
    Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function proxy(request, env, path) {
  if (!env.NVIDIA_API_KEY) {
    return json({
      error: {
        message: "NVIDIA_API_KEY is not configured on the Worker.",
        type: "configuration_error",
      },
    }, 500);
  }

  const target = `${NVIDIA_API_URL}${path}`;
  const headers = upstreamHeaders(env);
  const init = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(target, init);
  const responseHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders())) {
    responseHeaders.set(key, value);
  }

  // Do not expose NVIDIA's upstream API key or internal proxy details.
  responseHeaders.delete("set-cookie");
  responseHeaders.delete("www-authenticate");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        status: "ok",
        model: MODEL,
        provider: "NVIDIA NIM",
        api: "/v1/chat/completions",
      });
    }

    if (url.pathname === "/v1/models" && request.method === "GET") {
      if (!isAuthorized(request, env)) {
        return json({
          error: { message: "Unauthorized", type: "authentication_error" },
        }, 401, { "WWW-Authenticate": "Bearer" });
      }

      return json({
        object: "list",
        data: [{
          id: MODEL,
          object: "model",
          owned_by: "openai",
        }],
      });
    }

    if (!url.pathname.startsWith("/v1/")) {
      return json({
        error: {
          message: "Not found. Use /health or an OpenAI-compatible /v1 endpoint.",
          type: "not_found",
        },
      }, 404);
    }

    if (!isAuthorized(request, env)) {
      return json({
        error: { message: "Unauthorized", type: "authentication_error" },
      }, 401, { "WWW-Authenticate": "Bearer" });
    }

    return proxy(request, env, url.pathname + url.search);
  },
};
