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
    const { city } = JSON.parse(event.body || "{}");
    if (!city) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "city 파라미터가 없습니다." }) };
    }

    const API_KEY = process.env.OPENWEATHER_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENWEATHER_API_KEY 환경변수가 없습니다." }) };
    }

    // 현재 날씨 조회
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=kr`
    );
    if (!currentRes.ok) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: `"${city}" 날씨를 찾지 못했습니다.` }) };
    }
    const current = await currentRes.json();

    // 5일 예보 (3시간 단위) — 오늘 데이터만 필터링
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=kr&cnt=8`
    );
    const forecast = await forecastRes.json();

    // 날씨 아이콘 매핑
    const weatherEmoji = (id) => {
      if (id >= 200 && id < 300) return "⛈️";
      if (id >= 300 && id < 400) return "🌦️";
      if (id >= 500 && id < 600) return "🌧️";
      if (id >= 600 && id < 700) return "❄️";
      if (id >= 700 && id < 800) return "🌫️";
      if (id === 800) return "☀️";
      if (id === 801) return "🌤️";
      if (id === 802) return "⛅";
      if (id >= 803) return "☁️";
      return "🌡️";
    };

    const result = {
      city: current.name,
      weatherId: current.weather[0].id, // ✅ 실내외 비중 계산용
      temp: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      temp_min: Math.round(current.main.temp_min),
      temp_max: Math.round(current.main.temp_max),
      humidity: current.main.humidity,
      description: current.weather[0].description,
      emoji: weatherEmoji(current.weather[0].id),
      wind: Math.round(current.wind.speed * 3.6), // m/s → km/h
      hourly: (forecast.list || []).slice(0, 5).map(item => ({
        time: new Date(item.dt * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        temp: Math.round(item.main.temp),
        emoji: weatherEmoji(item.weather[0].id),
        description: item.weather[0].description,
      })),
    };

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
