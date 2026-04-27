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

    return texts.join(' ').slice(0, 12000); // Gemini 토큰 제한 고려
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

  // 1) 메타 + 자막 병렬 수집
  const [meta, transcript] = await Promise.all([
    fetchYouTubeMeta(url),
    fetchTranscript(url),
  ]);

  const videoTitle  = meta?.title || title || url;
  const channelName = meta?.author || '';

  const contentSection = transcript
    ? `## 실제 자막 (일부)\n${transcript.slice(0, 8000)}`
    : `## 영상 제목\n${videoTitle}\n채널: ${channelName}\n\n(자막을 가져오지 못했습니다. 제목 기반으로 분석합니다.)`;

  const prompt = `너는 'Para노트'의 리소스 분석 전문가야.
사용자가 유튜브 영상을 직접 보지 않고도 핵심 내용을 파악하고 프로젝트에 즉시 활용할 수 있도록,
구조화된 **인텔리전스 리포트**를 한국어로 작성해.

${contentSection}
${userTags.length ? `\n사용자 관심 태그: ${userTags.join(', ')}` : ''}

아래 구조로 마크다운 리포트를 작성해. 타임라인 요약은 제외하고 지식의 구조와 실행에 집중해:

---

## 📊 핵심 요약 대시보드

| 분류 | 핵심 포인트 | 실무 적용법 | 기대 효과 |
|------|------------|------------|----------|
| (3~5개 행) | ... | ... | ... |

---

## 🧠 핵심 원리 & 로직

(영상의 핵심 방법론을 "A를 통해 B를 달성하는 법" 형태의 인과관계로 구조적 설명. 3~4 문단)

---

## ✅ 실전 체크리스트

- [ ] (바로 실행할 수 있는 행동 목록 5~7개)

## ⚠️ 주의사항

- (한계점 또는 주의해야 할 점 2~3개)

---

## 🎯 Para노트 프로젝트 활용 제언
${userTags.length ? `현재 사용자 관심사(${userTags.join(', ')})를 고려해서:` : ''}

1. (프로젝트 활용 아이디어 1)
2. (프로젝트 활용 아이디어 2)
3. (프로젝트 활용 아이디어 3)

---
*분석 영상: ${videoTitle}${channelName ? ` | ${channelName}` : ''}*`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2000 },
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
