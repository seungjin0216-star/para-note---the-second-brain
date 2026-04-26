// AI Feature 2: 주간 뇌 리뷰 + 패턴 분석 + 프로젝트 제안
// POST { uid }
// Returns { review, suggestion }

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';

// Firebase Admin 초기화 (Netlify 환경변수에서 서비스 계정 읽기)
function initAdmin() {
  if (getApps().length) return;
  // FIREBASE_SERVICE_ACCOUNT 환경변수: base64 인코딩된 서비스 계정 JSON
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || '', 'base64').toString()
  );
  initializeApp({ credential: credential.cert(serviceAccount) });
}

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

  const { uid } = body;
  if (!uid) return { statusCode: 400, body: JSON.stringify({ error: 'uid required' }) };

  // 최근 7일 이내 아이템 가져오기
  let recentItems = [];
  try {
    initAdmin();
    const db = getFirestore();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const snap = await db
      .collection(`users/${uid}/items`)
      .where('createdAt', '>=', weekAgo.toISOString().slice(0, 10))
      .get();
    recentItems = snap.docs.map(d => d.data());
  } catch (err) {
    console.error('Firestore error:', err);
    // Firestore 접근 실패해도 빈 배열로 진행
  }

  const inbox = recentItems.filter(i => i.type === 'inbox');
  const resources = recentItems.filter(i => i.type === 'resource');
  const projects = recentItems.filter(i => i.type === 'project');

  const itemSummary = [
    ...resources.map(r => `[자료] ${r.title} (태그: ${r.tags?.join(', ') || '없음'})`),
    ...inbox.map(i => `[미처리] ${i.title}`),
    ...projects.map(p => `[프로젝트] ${p.title}`),
  ].join('\n');

  const prompt = `당신은 PARA 방법론 기반 노트앱의 AI 코치입니다.

사용자가 이번 주(최근 7일)에 수집하고 처리한 내용:
${itemSummary || '(이번 주 수집된 내용이 없습니다)'}

다음 두 가지를 JSON으로 응답하세요:
1. review: 이번 주 관심사 패턴, 자주 등장한 주제, 인사이트를 2-4문장으로 한국어 분석. 없으면 "이번 주는 수집된 내용이 없어요. 유튜브나 인스타에서 흥미로운 콘텐츠를 공유해보세요!" 반환
2. suggestion: 수집 패턴을 보고 시작하면 좋을 프로젝트 1개 제안 (없으면 null)

응답 형식 (JSON만):
{"review":"분석 내용","suggestion":"프로젝트 제안 or null"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
        }),
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: parsed.review || '',
          suggestion: parsed.suggestion || null,
        }),
      };
    }
    throw new Error('No JSON');
  } catch (err) {
    console.error('Gemini error:', err);
    return {
      statusCode: 200,
      body: JSON.stringify({
        review: '분석 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
        suggestion: null,
      }),
    };
  }
}
