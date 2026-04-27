// AI Feature 1: 수집 시 자동 요약 + 태그 추천
// POST { title, url, userTags[] }
// Returns { summary, tags[] }

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { title = '', url = '', userTags = [] } = body;
  const hasTags = userTags.length > 0;

  const prompt = `당신은 PARA 방법론 기반 노트앱의 AI 어시스턴트입니다.

사용자가 다음 콘텐츠를 수집했습니다:
- 제목/내용: ${title}
${url ? `- URL: ${url}` : ''}

${hasTags
  ? `사용자의 태그 목록: ${userTags.join(', ')}\n\n다음 두 가지를 JSON으로 응답하세요:\n1. summary: 핵심 내용을 2-3문장으로 한국어 요약\n2. tags: 위 태그 목록에서 가장 관련성 높은 태그 1-3개 선택 (반드시 목록에 있는 태그만)`
  : `다음 두 가지를 JSON으로 응답하세요:\n1. summary: 핵심 내용을 2-3문장으로 한국어 요약\n2. tags: 이 콘텐츠에 어울리는 한국어 태그 1-3개를 자유롭게 추천 (예: 자기계발, 투자, 건강 등)`
}

응답 형식 (JSON만, 다른 텍스트 없이):
{"summary":"요약 내용","tags":["태그1","태그2"]}`;

  // gemini-2.0-flash-lite → gemini-1.5-flash → gemini-pro 순으로 시도
  const MODELS = [
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];

  let lastError = null;

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Model ${model} failed (${response.status}):`, errText);
        lastError = `${model}: ${response.status} ${errText}`;
        continue; // 다음 모델 시도
      }

      const data = await response.json();

      // 오류 응답 확인
      if (data.error) {
        console.error(`Model ${model} API error:`, data.error);
        lastError = `${model}: ${JSON.stringify(data.error)}`;
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // JSON 파싱 시도
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: parsed.summary || '',
            tags: hasTags
              ? (parsed.tags || []).filter(t => userTags.includes(t))
              : (parsed.tags || []),
            _model: model, // 어떤 모델이 응답했는지 (디버그용)
          }),
        };
      }

      console.error(`Model ${model} returned no JSON:`, text);
      lastError = `${model}: no JSON in response: ${text}`;
    } catch (err) {
      console.error(`Model ${model} threw:`, err.message);
      lastError = `${model}: ${err.message}`;
    }
  }

  // 모든 모델 실패
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: '', tags: [], _error: lastError }),
  };
}
