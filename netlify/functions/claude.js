exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Key",
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
    const body = JSON.parse(event.body || "{}");
    const prompt = body.messages?.[0]?.content;
    const useSearch = body.useSearch || false; // 검색 모드 여부

    if (!prompt) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "prompt가 없습니다." }) };
    }

    const apiKey = event.headers["x-gemini-key"] || event.headers["X-Gemini-Key"];
    if (!apiKey) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "API 키가 없습니다." }) };
    }

    // ✅ 구글 검색 연동 여부에 따라 요청 구조 분기
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: useSearch ? 0.5 : 0.3,
        maxOutputTokens: 2000,
      },
    };

    // ✅ 검색 모드일 때 Google Search 도구 추가
    if (useSearch) {
      requestBody.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (response.status === 401) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "API 키가 유효하지 않습니다." }) };
    }
    if (response.status === 429) {
      return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: "요청 한도 초과입니다. 1분 후 다시 시도해주세요." }) };
    }

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify({ error: "Gemini API 오류", detail: JSON.stringify(data) }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Gemini 응답이 비었습니다." }) };
    }

    // ✅ 검색 출처 정보도 함께 반환
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks?.map(chunk => ({
      title: chunk.web?.title || '',
      url: chunk.web?.uri || '',
    })) || [];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ text, sources }),
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
