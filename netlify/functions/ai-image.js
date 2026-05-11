// AI Image: 이미지 내용 분석 + 텍스트 추출
// POST { imageBase64, mimeType, userTags[] }
// Returns { title, summary, tags[] }

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

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

  const { imageBase64, mimeType = 'image/jpeg', userTags = [] } = body;
  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'imageBase64 required' }) };
  }

  const hasTags = userTags.length > 0;
  const tagInstruction = hasTags
    ? `태그는 반드시 이 목록에서만 선택: [${userTags.join(', ')}]`
    : `콘텐츠에 어울리는 한국어 태그 1-3개 추천`;

  const prompt = `이 이미지를 분석해서 핵심 내용을 추출해주세요.

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "이미지 내용을 한 줄로 요약한 제목 (20자 이내)",
  "summary": "이미지에서 추출한 핵심 내용. 텍스트가 있으면 중요한 부분을 그대로 포함. 2-4문장.",
  "tags": ["태그1", "태그2"]
}

${tagInstruction}

이미지에 텍스트가 있으면 중요한 내용을 summary에 포함시켜주세요.
스크린샷, 영수증, 메모, 명함, 책 내용 등 어떤 이미지든 핵심을 추출해주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error(`No JSON in response: ${text}`);

    const parsed = JSON.parse(match[0]);
    const filteredTags = hasTags
      ? (parsed.tags || []).filter(t => userTags.includes(t))
      : (parsed.tags || []);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: parsed.title || '이미지 내용',
        summary: parsed.summary || '',
        tags: filteredTags,
      }),
    };
  } catch (err) {
    console.error('AI image error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '이미지', summary: '', tags: [], _error: err.message }),
    };
  }
}
