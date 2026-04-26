// 기본 태그 세트 — 사용자가 설정에서 자유롭게 추가/수정/삭제 가능
export const DEFAULT_TAGS = [
  '운동', '건강', '자기계발', '독서', '사업',
  '투자', '여행', '일상', '개발', '디자인',
  '글쓰기', '영어', '요리', '음악', '영감',
];

// 카테고리 메타
export const CATEGORIES = {
  inbox:    { label: '수신함',    icon: '📥', color: '#EA580C' },
  resource: { label: '자료함',    icon: '📚', color: '#D97706' },
  project:  { label: '프로젝트',  icon: '🎯', color: '#7C3AED' },
  archive:  { label: '보관함',    icon: '🗂',  color: '#6B7280' },
};

// Netlify Functions 엔드포인트
export const AI_ENDPOINT = '/.netlify/functions/ai-summary';
export const AI_WEEKLY_ENDPOINT = '/.netlify/functions/ai-weekly';
export const AI_RECOMMEND_ENDPOINT = '/.netlify/functions/ai-recommend';
