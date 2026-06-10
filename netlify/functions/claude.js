exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const prompt = body.messages?.[0]?.content;
    if (!prompt) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "prompt가 없습니다." }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "GEMINI_API_KEY가 없습니다." }) };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (response.status === 429) {
      return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: "요청 한도 초과입니다. 1분 후 다시 시도해주세요." }) };
    }

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify({ error: "Gemini API 오류", detail: data }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Gemini 응답이 비었습니다." }) };
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
