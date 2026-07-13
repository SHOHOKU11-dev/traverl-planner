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
    // ✅ 선택한 이동수단 배열도 함께 받음
    const { origin, destination, transports = ["도보", "대중교통"] } = JSON.parse(event.body || "{}");

    if (!origin || !destination) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "origin, destination 필요" }) };
    }

    const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    if (!REST_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "KAKAO_REST_API_KEY 없음" }) };
    }

    const result = {};

    // ✅ 자차 선택 시에만 자동차 길찾기 호출
    if (transports.includes("자차")) {
      try {
        const carRes = await fetch(
          `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}&summary=true`,
          { headers: { "Authorization": `KakaoAK ${REST_API_KEY}` } }
        );
        const carData = await carRes.json();
        const carRoute = carData.routes?.[0]?.summary;
        if (carRoute) {
          result.car = {
            duration: Math.round(carRoute.duration / 60),
            distance: Math.round(carRoute.distance / 1000 * 10) / 10,
          };
        }
      } catch(e) { /* 자차 실패 시 무시 */ }
    }

    // ✅ 도보 선택 시에만 도보 길찾기 호출
    if (transports.includes("도보")) {
      try {
        const walkRes = await fetch(
          `https://apis-navi.kakaomobility.com/v1/directions/walking?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}`,
          { headers: { "Authorization": `KakaoAK ${REST_API_KEY}` } }
        );
        const walkData = await walkRes.json();
        const walkRoute = walkData.routes?.[0]?.summary;
        if (walkRoute) {
          result.walk = {
            duration: Math.round(walkRoute.duration / 60),
            distance: Math.round(walkRoute.distance / 1000 * 10) / 10,
          };
        }
      } catch(e) { /* 도보 실패 시 무시 */ }
    }

    // ✅ 대중교통 선택 시 — 카카오모빌리티는 대중교통 미지원
    // 도보 시간으로 대중교통 예상 시간 근사치 제공
    if (transports.includes("대중교통") && !result.walk) {
      try {
        const walkRes = await fetch(
          `https://apis-navi.kakaomobility.com/v1/directions/walking?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}`,
          { headers: { "Authorization": `KakaoAK ${REST_API_KEY}` } }
        );
        const walkData = await walkRes.json();
        const walkRoute = walkData.routes?.[0]?.summary;
        if (walkRoute) {
          const distKm = walkRoute.distance / 1000;
          // 대중교통 예상: 도보 10분 이하면 도보, 그 이상은 대중교통 환승 포함 추정
          const transitMin = walkRoute.duration / 60 > 10
            ? Math.round(distKm * 3 + 5) // 평균 속도 20km/h + 환승 5분
            : Math.round(walkRoute.duration / 60);
          result.transit = {
            duration: transitMin,
            distance: Math.round(distKm * 10) / 10,
          };
        }
      } catch(e) { /* 대중교통 실패 시 무시 */ }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
