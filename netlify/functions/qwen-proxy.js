// netlify/functions/qwen-proxy.js
const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing QWEN_API_KEY in Netlify environment variables." }),
    };
  }

  try {
    const parsed = JSON.parse(event.body || "{}");
    const path = typeof parsed.path === "string" ? parsed.path : "/chat/completions";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const { path: _ignoredPath, ...qwenBody } = parsed;

    const upstream = await fetch(`${QWEN_BASE_URL}${normalizedPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(qwenBody),
    });

    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
    };
  }
};
