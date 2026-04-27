// AI Feature 1: 수집 시 자동 요약 + 태그 추천
// POST { title, url, userTags[] }
// Returns { summary, tags[], fetchedTitle? }

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// YouTube oEmbed로 실제 영상 제목·채널명 가져오기 (API 키 불필요)
async function fetchYouTubeMeta(url) {
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!oembed.ok) return null;
    const d = await oembed.json();
    return { title: d.title || '', author: d.author_name || '' };
  } catch {
    return null;
  }
}

// 일반 웹페이지 OG 태그 파싱으로 제목·설명 가져오기
async function fetchWebMeta(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<title>([^<]+)<\/title>/i)?.[1]
      || '';
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
      || '';
    return { title: ogTitle.trim(), description: ogDesc.trim() };
  } catch {
    return null;
  }
}

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

  // 디버그: 모델 목록 조회
  if (body._listModels) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`).catch(() => null);
    const d = r ? await r.json() : {};
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: (d.models || []).map(m => m.name) }),
    };
  }

  let { title = '', url = '', userTags = [] } = body;
  const hasTags = userTags.length > 0;

  // ── 실제 콘텐츠 메타데이터 가져오기 ──────────────────────────
  let fetchedTitle = '';
  let fetchedDesc  = '';
  let contentContext = '';

  if (url) {
    const isYT = /youtube\.com|youtu\.be/i.test(url);
    const isIG = /instagram\.com/i.test(url);

    if (isYT) {
      const meta = await fetchYouTubeMeta(url);
      if (meta) {
        fetchedTitle = meta.title;
        contentContext = `유튜브 영상 제목: "${meta.title}"\n채널: ${meta.author}`;
      }
    } else if (!isIG) {
      // 일반 웹 (인스타는 로그인 필요라 스킵)
      const meta = await fetchWebMeta(url);
      if (meta?.title) {
        fetchedTitle = meta.title;
        contentContext = `페이지 제목: "${meta.title}"${meta.description ? `\n설명: ${meta.description.slice(0, 200)}` : ''}`;
      }
    }
  }

  // 실제 제목이 있으면 사용, 없으면 사용자가 입력한 제목 사용
  const effectiveTitle = fetchedTitle || title;
  const contentInfo = contentContext || `제목/내용: ${effectiveTitle}`;

  const prompt = `당신은 PARA 방법론 기반 노트앱의 AI 어시스턴트입니다.
사용자가 다음 콘텐츠를 저장했습니다.

${contentInfo}
${url ? `URL: ${url}` : ''}

${hasTags
  ? `사용자 태그 목록: ${userTags.join(', ')}\n\n아래 두 가지를 JSON으로 응답하세요:\n1. summary: 실제 콘텐츠 제목/설명을 바탕으로 2-3문장 한국어 요약\n2. tags: 위 태그 목록에서 가장 관련 높은 것 1-3개 선택 (목록에 있는 태그만)`
  : `아래 두 가지를 JSON으로 응답하세요:\n1. summary: 실제 콘텐츠 제목/설명을 바탕으로 2-3문장 한국어 요약\n2. tags: 콘텐츠에 어울리는 한국어 태그 1-3개 자유 추천`
}

응답 형식 (JSON만, 다른 텍스트 없이):
{"summary":"요약 내용","tags":["태그1","태그2"]}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
      throw new Error(`Gemini ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error(`No JSON in: ${text}`);

    const parsed = JSON.parse(match[0]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: parsed.summary || '',
        tags: hasTags
          ? (parsed.tags || []).filter(t => userTags.includes(t))
          : (parsed.tags || []),
        fetchedTitle: fetchedTitle || undefined,
      }),
    };
  } catch (err) {
    console.error('AI summary error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: '', tags: [], _error: err.message }),
    };
  }
}
