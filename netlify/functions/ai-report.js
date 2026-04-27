// AI 인텔리전스 리포트 생성
// POST { url, title, userTags[] }
// Returns { report: string (markdown) }

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// YouTube 자막 가져오기 (API 키 불필요)
async function fetchTranscript(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  const videoId = match[1];

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!captionMatch) return null;

    const tracks = JSON.parse(captionMatch[1]);
    if (!tracks.length) return null;

    const track = tracks.find(t => t.languageCode === 'ko')
      || tracks.find(t => t.languageCode === 'en')
      || tracks[0];
    if (!track?.baseUrl) return null;

    const txRes = await fetch(decodeURIComponent(track.baseUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!txRes.ok) return null;
    const xml = await txRes.text();

    const texts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
      .map(m => m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/<[^>]*>/g, '').trim()
      )
      .filter(Boolean);

    return texts.join(' ').slice(0, 10000);
  } catch {
    return null;
  }
}

// YouTube oEmbed로 제목·채널 가져오기
async function fetchYouTubeMeta(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return { title: d.title || '', author: d.author_name || '' };
  } catch { return null; }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { url = '', title = '', userTags = [] } = body;

  const [meta, transcript] = await Promise.all([
    fetchYouTubeMeta(url),
    fetchTranscript(url),
  ]);

  const videoTitle  = meta?.title || title || url;
  const channelName = meta?.author || '';

  const contentSection = transcript
    ? `[자막]\n${transcript.slice(0, 8000)}`
    : `[영상 제목] ${videoTitle} / 채널: ${channelName}\n(자막 없음 — 제목 기반 분석)`;

  const prompt = `당신은 영상 콘텐츠 분석 전문가입니다. 아래 영상 자막을 읽고 **간결하고 실용적인 한국어 리포트**를 작성하세요.

${contentSection}
${userTags.length ? `관심 태그: ${userTags.join(', ')}` : ''}

다음 형식으로 작성하세요 (각 섹션은 짧고 핵심만):

## 💡 핵심 인사이트
한 줄 요약: (영상 전체를 한 문장으로)
주요 포인트:
• (포인트 1 — 20자 이내)
• (포인트 2 — 20자 이내)
• (포인트 3 — 20자 이내)

## ✅ 바로 써먹기
- [ ] (즉시 실행 가능한 행동 1)
- [ ] (즉시 실행 가능한 행동 2)
- [ ] (즉시 실행 가능한 행동 3)
- [ ] (즉시 실행 가능한 행동 4)

## ⚡ 한 줄 핵심
(이 영상에서 가장 중요한 단 하나의 교훈을 굵게)

출처: ${videoTitle}${channelName ? ` | ${channelName}` : ''}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));

    const report = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, videoTitle, hasTranscript: !!transcript }),
    };
  } catch (err) {
    console.error('ai-report error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
