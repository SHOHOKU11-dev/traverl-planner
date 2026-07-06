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
    const { origin, destination } = JSON.parse(event.body || "{}");
    if (!origin || !destination) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "origin, destination 필요" }) };
    }

    const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    if (!REST_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "KAKAO_REST_API_KEY 없음" }) };
    }

    // 자동차 길찾기
    const carRes = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}&summary=true`,
      { headers: { "Authorization": `KakaoAK ${REST_API_KEY}` } }
    );
    const carData = await carRes.json();
    const carRoute = carData.routes?.[0]?.summary;

    // 도보 길찾기
    const walkRes = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions/walking?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}`,
      { headers: { "Authorization": `KakaoAK ${REST_API_KEY}` } }
    );
    const walkData = await walkRes.json();
    const walkRoute = walkData.routes?.[0]?.summary;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        car: carRoute ? {
          duration: Math.round(carRoute.duration / 60), // 분
          distance: Math.round(carRoute.distance / 1000 * 10) / 10, // km
        } : null,
        walk: walkRoute ? {
          duration: Math.round(walkRoute.duration / 60),
          distance: Math.round(walkRoute.distance / 1000 * 10) / 10,
        } : null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
