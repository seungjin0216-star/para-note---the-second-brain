// AI Feature 3: 프로젝트에 맞는 자료 추천
// POST { project: { title, desc, tags }, resources: [{ id, title, note, tags }] }
// Returns { recommendedIds[] }

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { project, resources = [] } = body;
  if (!project || resources.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ recommendedIds: [] }) };
  }

  const resourceList = resources.map((r, i) =>
    `[${i}] id="${r.id}" | 제목: ${r.title} | 태그: ${r.tags?.join(', ') || '없음'}${r.note ? ` | 메모: ${r.note}` : ''}`
  ).join('\n');

  const prompt = `당신은 PARA 방법론 기반 노트앱의 AI 어시스턴트입니다.

프로젝트 정보:
- 이름: ${project.title}
- 설명: ${project.desc || '없음'}
- 태그: ${project.tags?.join(', ') || '없음'}

자료함의 자료 목록 (아직 연결되지 않은 자료들):
${resourceList}

이 프로젝트에 가장 도움이 될 자료를 최대 3개 선택해주세요.
관련성이 없는 자료는 선택하지 마세요.

응답 형식 (JSON만, id 값을 그대로 사용):
{"recommendedIds":["id1","id2"]}

관련 자료가 없으면: {"recommendedIds":[]}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // 유효한 ID만 필터링
      const validIds = resources.map(r => r.id);
      const filtered = (parsed.recommendedIds || []).filter(id => validIds.includes(id));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendedIds: filtered }),
      };
    }
    throw new Error('No JSON');
  } catch (err) {
    console.error('Gemini error:', err);
    return {
      statusCode: 200,
      body: JSON.stringify({ recommendedIds: [] }),
    };
  }
}
