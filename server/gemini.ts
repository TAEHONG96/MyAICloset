import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AiClosetDiagnosis,
  ExtractedImageMetadata,
  OutfitIllustrationSpec,
  OutfitRecommendation,
  PurchaseAdvice,
  PurchaseCandidate,
  RawAiOutfit,
  StylePreferences,
  WardrobeItem,
} from '../src/types/wardrobe';
import {
  buildOutfitPhotoPromptSummary,
  CONCEPTUAL_PREVIEW_DISCLAIMER,
  formatVisualMetadataSummary,
  inferSilhouetteVariant,
  mapCategoryToSlot,
  normalizeCategory,
  normalizeFit,
  normalizeSeason,
  normalizeStyle,
  normalizeThickness,
  resolveChatAttachments,
  resolveKoreanColorHex,
  validateOutfitRecommendations,
} from '../src/lib/wardrobeLogic';

import { sanitizeErrorMessage } from './security';

const MODEL_NAME = 'gemini-4-hydrogen';
const IMAGE_MODEL_NAME = 'gemini-3.1-flash-lite-image';

const BASE_SYSTEM_RULES = `당신은 한국어 개인 옷장 전문 AI 스타일리스트 '나만의 옷장'입니다.
다음 핵심 원칙을 예외 없이 지키세요:
1. 모든 응답은 반드시 자연스럽고 정중한 한국어로 작성합니다.
2. 사용자가 전달한 보유 의류 목록(ownedItems)에 없는 옷을 절대 보유하고 있는 것처럼 지어내거나 추측하여 추가하지 않습니다.
3. 아이템의 소재 두께, 정확한 기장, 네크라인, 체형, 실제 기온 등 입력 데이터에 없는 정보에 대해서는 반드시 가정과 불확실성을 명확히 밝힙니다.
4. 불필요한 새 옷 구매를 부추기지 말고, 이미 보유한 옷을 조합·레이어드·변주하여 재활용하는 방안을 최우선으로 제안합니다.
5. 의류에 이미지 기반 시각 메타데이터(소재, 패턴, 두께감, 상세 실루엣)가 포함된 경우 이를 코디 조합, 계절 판단, 중복성 평가에 적극 반영합니다.`;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY가 서버 환경 변수에 설정되어 있지 않습니다. 서버 환경변수(.env 또는 호스팅 대시보드 Secrets)를 확인해 주세요.'
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function serializeClosetForPrompt(items: WardrobeItem[]): string {
  if (items.length === 0) return '(등록된 보유 의류 없음)';
  return items
    .map((i) => {
      const metaSummary = formatVisualMetadataSummary(i.visualMeta);
      const photoFlag = i.imageUrl ? '사진 첨부됨' : '사진 미첨부';
      const extraMeta = [
        metaSummary ? `시각 메타데이터: ${metaSummary}` : '',
        i.visualMeta?.summaryNote ? `이미지 요약: ${i.visualMeta.summaryNote}` : '',
        photoFlag,
        i.notes ? `메모: ${i.notes}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      return `- [ID: ${i.id}] ${i.name} | 카테고리: ${i.category} | 색상: ${i.color} | 스타일: ${i.style} | 핏: ${i.fit} | 계절: ${i.season}${extraMeta ? ` | ${extraMeta}` : ''}`;
    })
    .join('\n');
}

export function formatGeminiError(error: unknown): { status: number; message: string } {
  const err = error as { status?: number; statusCode?: number; message?: string };
  const status = err?.statusCode ?? err?.status ?? 500;
  const raw = sanitizeErrorMessage(err?.message ?? '알 수 없는 서버 오류가 발생했습니다.');

  if (status === 403 || status === 400 || raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: status === 500 ? 403 : status,
      message: 'Gemini API 인증에 실패했습니다. 서버 환경변수(GEMINI_API_KEY) 설정을 확인해 주세요.',
    };
  }
  if (status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 API 키 요금제를 확인해 주세요.',
    };
  }
  if (
    status === 503 ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand') ||
    raw.includes('"code":503')
  ) {
    return {
      status: 503,
      message: raw.includes('GEMINI_API_KEY')
        ? raw
        : '현재 AI 모델 요청량이 많아 일시적으로 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  if (status >= 500 || raw.includes('{') || raw.includes('Error:')) {
    console.error(`[gemini-error] status=${status}`);
    return {
      status: status >= 400 && status < 600 ? status : 500,
      message: 'AI 서비스 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  return { status, message: raw };
}

export async function extractGarmentMetadataFromImage(params: {
  base64Data: string;
  mimeType: string;
  hintName?: string;
}): Promise<ExtractedImageMetadata> {
  const ai = getClient();
  const prompt = `첨부된 의류 사진을 분석하여 의류 카테고리, 색상, 소재를 포함한 구조화된 메타데이터를 한국어로 정확하게 추출해 주세요.
${params.hintName?.trim() ? `사용자가 입력한 참고 이름: ${params.hintName.trim()}` : ''}

[추출 원칙]
- category(의류 카테고리)는 반드시 '아우터', '상의', '하의', '원피스', '신발', '가방/액세서리' 중 하나만 선택하세요.
- color(색상)는 사진에서 관찰되는 대표 색상을 자연스러운 한국어 색상명(예: 네이비, 아이보리, 차콜, 베이지, 블랙, 중청)으로 적으세요.
- material(소재)은 직조감·광택·편직 패턴을 바탕으로 가장 가능성 높은 대표 소재(예: 울, 코튼, 데님, 니트, 캐시미어, 린넨, 가죽, 나일론/폴리)를 적으세요.
- style은 반드시 '미니멀', '클래식', '캐주얼', '비즈니스 캐주얼', '시티보이', '스트릿', '페미닌', '프레피', '애슬레저' 중 하나를 선택하세요.
- fit은 반드시 '슬림핏', '레귤러핏', '세미오버핏', '오버핏', '와이드핏', '스트레이트핏', '루즈핏' 중 하나를 선택하세요.
- season은 반드시 '봄', '여름', '가을', '겨울', '간절기', '사계절' 중 하나를 선택하세요.
- thickness는 반드시 '얇음', '보통', '두꺼움' 중 하나를 선택하세요.
- summaryNote에는 기장감, 레이어드 활용법, 계절 착용 팁을 1문장으로 요약해 적으세요.
- 사진만으로 혼방 비율이나 정확한 안감·두께를 100% 단정할 수 없다면 추정 근거와 불확실성을 uncertaintyNote에 솔직히 적으세요.`;

  const runExtract = () =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          inlineData: {
            data: params.base64Data,
            mimeType: params.mimeType,
          },
        },
        { text: prompt },
      ],
      config: {
        systemInstruction: BASE_SYSTEM_RULES,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedName: { type: Type.STRING, description: '사진 속 의류를 설명하는 간결한 한국어 이름' },
            category: { type: Type.STRING, description: "아우터/상의/하의/원피스/신발/가방/액세서리 중 하나" },
            color: { type: Type.STRING, description: '주된 한국어 색상명 (예: 차콜, 네이비, 아이보리)' },
            style: { type: Type.STRING, description: '어울리는 스타일 (예: 미니멀, 클래식, 캐주얼)' },
            fit: { type: Type.STRING, description: '예상 핏 (예: 레귤러핏, 세미오버핏, 와이드핏)' },
            season: { type: Type.STRING, description: '봄/여름/가을/겨울/간절기/사계절 중 하나' },
            material: { type: Type.STRING, description: '관찰되는 대표 소재 또는 편직감 (예: 울, 코튼, 데님, 니트, 가죽)' },
            pattern: { type: Type.STRING, description: '무지, 스트라이프, 체크, 헤링본 등 패턴' },
            thickness: { type: Type.STRING, description: '얇음/보통/두꺼움 중 하나' },
            silhouetteDetail: { type: Type.STRING, description: '칼라, 라펠, 투턱, 단추 등 눈에 띄는 디테일' },
            summaryNote: { type: Type.STRING, description: '코디 조합에 참고할 1문장 시각적 특징 요약' },
            uncertaintyNote: { type: Type.STRING, description: '사진 해상도·조명·혼방 여부 등으로 인한 불확실성 설명' },
          },
          required: [
            'suggestedName',
            'category',
            'color',
            'style',
            'fit',
            'season',
            'material',
            'pattern',
            'thickness',
            'silhouetteDetail',
            'summaryNote',
            'uncertaintyNote',
          ],
        },
      },
    });

  let response;
  try {
    response = await runExtract();
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? '';
    const code = (err as { status?: number })?.status;
    if (code === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      await new Promise((r) => setTimeout(r, 900));
      response = await runExtract();
    } else {
      throw err;
    }
  }

  const raw = JSON.parse((response.text ?? '{}').trim()) as {
    suggestedName?: string;
    category?: string;
    color?: string;
    style?: string;
    fit?: string;
    season?: string;
    material?: string;
    pattern?: string;
    thickness?: string;
    silhouetteDetail?: string;
    summaryNote?: string;
    uncertaintyNote?: string;
  };

  return {
    suggestedName: raw.suggestedName?.trim() || params.hintName?.trim() || '사진 분석 의류',
    category: normalizeCategory(raw.category ?? '') ?? '상의',
    color: raw.color?.trim() || '미지정',
    style: normalizeStyle(raw.style ?? ''),
    fit: normalizeFit(raw.fit ?? ''),
    season: normalizeSeason(raw.season ?? ''),
    visualMeta: {
      material: raw.material?.trim() || undefined,
      pattern: raw.pattern?.trim() || undefined,
      thickness: normalizeThickness(raw.thickness) ?? '보통',
      silhouetteDetail: raw.silhouetteDetail?.trim() || undefined,
      extractedFromImage: true,
      summaryNote: raw.summaryNote?.trim() || undefined,
    },
    uncertaintyNote:
      raw.uncertaintyNote?.trim() ||
      '사진의 조명과 촬영 각도에 따라 실제 색감 및 원단 혼방률은 차이가 있을 수 있습니다.',
  };
}

export async function generateClosetDiagnosis(
  ownedItems: WardrobeItem[]
): Promise<AiClosetDiagnosis> {
  const ai = getClient();
  const prompt = `다음은 사용자의 보유 의류 목록입니다. 이 목록과 각 의류의 시각 메타데이터(소재, 패턴, 두께감, 상세 실루엣)만 근거로 옷장 전체를 진단해 주세요.
보유 목록에 없는 아이템을 언급하지 말고, 기존 옷의 활용도를 높이는 방향을 우선 제시하며, 사진·메타데이터가 비어 있어 알 수 없는 점(가정 및 불확실성)을 꼭 설명하세요.

[보유 의류 목록]
${serializeClosetForPrompt(ownedItems)}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: BASE_SYSTEM_RULES,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING, description: '옷장 전체의 핵심 성격을 요약한 한 문장' },
          strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '현재 옷장의 강점 2~3가지 (실제 보유 아이템 이름과 소재·메타데이터 인용)',
          },
          balanceNotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '카테고리·색상·소재·두께·계절 편중 및 중복 관찰 2~3가지',
          },
          reuseStrategies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '새 옷 구매 없이 기존 옷을 다양하게 활용하는 실용 전략 2~3가지',
          },
          assumptionsAndUncertainties: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '사진·원단·기장·착용 빈도 등 입력 데이터에 없어 가정하거나 불확실한 점 2~3가지',
          },
        },
        required: [
          'headline',
          'strengths',
          'balanceNotes',
          'reuseStrategies',
          'assumptionsAndUncertainties',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as AiClosetDiagnosis;
  return parsed;
}

export async function generateOutfitRecommendations(
  ownedItems: WardrobeItem[],
  preferences: StylePreferences
): Promise<OutfitRecommendation[]> {
  const ai = getClient();
  const prompt = `사용자의 보유 의류 목록과 스타일 선호도를 바탕으로, **오직 보유 의류 목록에 있는 아이템만** 사용하여 서로 다른 3가지 코디 조합을 추천해 주세요.

[중요 제약]
- 각 코디의 itemIds 배열에는 반드시 아래 보유 목록의 [ID: ...] 값만 그대로 사용하세요. 목록에 없는 옷을 절대 발명하지 마세요.
- 가능한 한 상의+하의(또는 원피스)+아우터/신발/가방 조합을 보유 목록 안에서 구성하세요. 특정 카테고리(예: 신발, 아우터)가 목록에 없다면 억지로 만들지 말고 assumptions 필드에 미보유 사실을 명시하세요.
- 보유 의류의 시각 메타데이터(소재, 패턴, 두께감, 상세 실루엣)가 등록되어 있다면 소재 질감 궁합(예: 울+코튼/메리노울), 패턴 충돌 방지(예: 스트라이프+무지), 계절 대비 두께감 적절성을 반드시 고려해 조합하고 stylingExplanation에 구체적으로 설명하세요.
- 3가지 조합은 서로 분위기나 핵심 아이템 구성을 달리하여 기존 옷의 재활용 폭을 보여주세요.

[스타일 선호도]
- 상황(TPO): ${preferences.occasion}
- 계절: ${preferences.season}
- 선호 스타일: ${preferences.preferredStyle}
- 추가 요청사항: ${preferences.additionalNotes || '없음'}

[보유 의류 목록]
${serializeClosetForPrompt(ownedItems)}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: BASE_SYSTEM_RULES,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          outfits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: '코디 제목 (예: 차콜 톤온톤 미니멀 출근룩)' },
                itemIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '반드시 보유 목록에 존재하는 ID 배열',
                },
                conceptSummary: { type: Type.STRING, description: '한 줄 핵심 콘셉트 요약' },
                stylingExplanation: {
                  type: Type.STRING,
                  description: '색상·소재·패턴·두께감·핏·실루엣이 어떻게 어울리는지 구체적인 한국어 설명',
                },
                tpoFit: { type: Type.STRING, description: '선택한 상황과 계절에 맞는 이유' },
                reuseTip: {
                  type: Type.STRING,
                  description: '새 옷 없이 이 조합을 변주하거나 활용하는 팁',
                },
                assumptions: {
                  type: Type.STRING,
                  description: '원단 두께·기온·미등록 부위 등 이 추천의 가정과 불확실성',
                },
              },
              required: [
                'title',
                'itemIds',
                'conceptSummary',
                'stylingExplanation',
                'tpoFit',
                'reuseTip',
                'assumptions',
              ],
            },
          },
        },
        required: ['outfits'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{"outfits":[]}').trim()) as {
    outfits?: RawAiOutfit[];
  };

  return validateOutfitRecommendations(parsed.outfits ?? [], ownedItems);
}

export async function generatePurchaseAdvice(
  ownedItems: WardrobeItem[],
  candidate: PurchaseCandidate
): Promise<PurchaseAdvice> {
  const ai = getClient();
  const ownedIdSet = new Set(ownedItems.map((i) => i.id));
  const candidateMetaSummary = formatVisualMetadataSummary(candidate.visualMeta);

  const prompt = `사용자가 새로 구매를 고민 중인 의류(구매 후보)를 현재 보유 옷장과 비교하여 냉정하고 실용적으로 평가해 주세요.
기존 옷을 재활용하는 것을 최우선으로 고려하며, 역할·색상·소재·패턴·실루엣이 겹치거나 활용 폭이 좁다면 과감하게 '기존 옷 활용 권장' 또는 '신중 검토'를 제시하세요.
matchingOwnedItemIds, overlappingOwnedItemIds, reuseAlternativeItemIds에는 반드시 보유 의류 목록의 실제 ID만 넣으세요.

[구매 후보]
- 아이템명: ${candidate.name}
- 카테고리: ${candidate.category}
- 색상: ${candidate.color}
- 스타일: ${candidate.style}
- 핏: ${candidate.fit}
- 계절: ${candidate.season}
- 예상 가격: ${candidate.priceKrw ? `${Number(candidate.priceKrw).toLocaleString('ko-KR')}원` : '미입력'}
- 시각 메타데이터(소재/패턴/두께/디테일): ${candidateMetaSummary || '미입력'}
- 이미지 요약: ${candidate.visualMeta?.summaryNote || (candidate.imageUrl ? '사진 첨부됨' : '사진 미첨부')}
- 구매 고민 메모: ${candidate.notes || '없음'}

[현재 보유 의류 목록]
${serializeClosetForPrompt(ownedItems)}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: BASE_SYSTEM_RULES,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: {
            type: Type.STRING,
            description: "반드시 '구매 추천', '신중 검토', '기존 옷 활용 권장' 중 하나",
          },
          summary: { type: Type.STRING, description: '최종 판정 핵심 요약 2문장' },
          compatibilityRating: {
            type: Type.STRING,
            description: "반드시 '높음', '보통', '낮음' 중 하나",
          },
          compatibilityAnalysis: {
            type: Type.STRING,
            description: '기존 보유 아이템과의 구체적인 조합 호환성 및 소재·패턴·실루엣 조화 분석',
          },
          matchingOwnedItemIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '이 구매 후보와 잘 어울리는 실제 보유 아이템 ID 목록',
          },
          versatilityAnalysis: {
            type: Type.STRING,
            description: '계절·두께감·상황별 활용도 및 착장 확장성 분석',
          },
          redundancyLevel: {
            type: Type.STRING,
            description: "반드시 '낮음', '보통', '높음' 중 하나",
          },
          redundancyAnalysis: {
            type: Type.STRING,
            description: '기존 보유 의류와의 역할·색상·소재·패턴·스타일 중복 여부 상세 분석',
          },
          overlappingOwnedItemIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '구매 후보와 겹치는 실제 보유 아이템 ID 목록',
          },
          purchaseValueAnalysis: {
            type: Type.STRING,
            description: '가격·활용 빈도·기존 옷장 보완도를 종합한 구매 가치 판단',
          },
          reuseAlternativeTitle: {
            type: Type.STRING,
            description: '새 옷을 사지 않고 기존 옷만으로 비슷한 무드를 내는 대안 코디 제목',
          },
          reuseAlternativeItemIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '대안 코디에 사용하는 실제 보유 아이템 ID 목록',
          },
          reuseAlternativeReason: {
            type: Type.STRING,
            description: '기존 옷 대안 코디로 구매 욕구를 대체할 수 있는 이유 설명',
          },
          assumptionsAndUncertainties: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '실제 원단 품질, 핏감, 세탁 관리 등 알 수 없는 불확실성 2~3가지',
          },
        },
        required: [
          'verdict',
          'summary',
          'compatibilityRating',
          'compatibilityAnalysis',
          'matchingOwnedItemIds',
          'versatilityAnalysis',
          'redundancyLevel',
          'redundancyAnalysis',
          'overlappingOwnedItemIds',
          'purchaseValueAnalysis',
          'reuseAlternativeTitle',
          'reuseAlternativeItemIds',
          'reuseAlternativeReason',
          'assumptionsAndUncertainties',
        ],
      },
    },
  });

  const raw = JSON.parse((response.text ?? '{}').trim()) as PurchaseAdvice;

  const allowedVerdicts = new Set(['구매 추천', '신중 검토', '기존 옷 활용 권장']);
  const allowedLevels = new Set(['높음', '보통', '낮음']);

  return {
    ...raw,
    verdict: allowedVerdicts.has(raw.verdict) ? raw.verdict : '신중 검토',
    compatibilityRating: allowedLevels.has(raw.compatibilityRating)
      ? raw.compatibilityRating
      : '보통',
    redundancyLevel: allowedLevels.has(raw.redundancyLevel) ? raw.redundancyLevel : '보통',
    matchingOwnedItemIds: (raw.matchingOwnedItemIds ?? []).filter((id) => ownedIdSet.has(id)),
    overlappingOwnedItemIds: (raw.overlappingOwnedItemIds ?? []).filter((id) => ownedIdSet.has(id)),
    reuseAlternativeItemIds: (raw.reuseAlternativeItemIds ?? []).filter((id) => ownedIdSet.has(id)),
    assumptionsAndUncertainties:
      raw.assumptionsAndUncertainties?.length > 0
        ? raw.assumptionsAndUncertainties
        : ['실제 원단 질감과 착용감, 세탁 관리 난이도는 텍스트 정보만으로 확인하기 어렵습니다.'],
  };
}

async function resolveWardrobeImagePart(
  imageUrl?: string
): Promise<{ data: string; mimeType: string } | null> {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  const dataUrlMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] };
  }

  if (imageUrl.startsWith('/src/assets/images/')) {
    const fileName = path.basename(imageUrl);
    if (!fileName || fileName.includes('..')) return null;

    const candidates = [
      path.resolve(process.cwd(), 'src/assets/images', fileName),
      path.resolve(process.cwd(), 'dist/src/assets/images', fileName),
    ];

    for (const filePath of candidates) {
      try {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const mimeType =
          ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return { mimeType, data: buffer.toString('base64') };
      } catch {
        // Try next candidate path
      }
    }
  }

  return null;
}

async function generateRealisticOutfitPhoto(
  ai: GoogleGenAI,
  outfit: OutfitRecommendation,
  validItems: WardrobeItem[]
): Promise<string> {
  const { itemDescriptions, missingSlots } = buildOutfitPhotoPromptSummary({
    ...outfit,
    items: validItems,
  });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  for (const item of validItems.slice(0, 6)) {
    const imagePart = await resolveWardrobeImagePart(item.imageUrl);
    if (imagePart) {
      parts.push({
        text: `[참고 보유 의류] ${item.name} (${item.category}, ${item.color}, ${item.fit}${
          item.visualMeta?.material ? `, 소재: ${item.visualMeta.material}` : ''
        }${item.visualMeta?.silhouetteDetail ? `, 디테일: ${item.visualMeta.silhouetteDetail}` : ''})`,
      });
      parts.push({ inlineData: imagePart });
    }
  }

  const imagePrompt = `Generate a single photorealistic, high-end editorial fashion lookbook photograph showing a real person wearing the exact outfit combination listed below.

[CRITICAL COMPOSITION & FRAMING RULES]
- Cropped strictly at the mid-neck / collarbone below the chin down to the shoes (completely headless framing: DO NOT show the chin, mouth, nose, eyes, face, or head at all).
- Full outfit silhouette must be clearly visible in a single vertical 3:4 frame from neck/shoulders down to footwear.
- Photorealistic real photography (not an illustration, not a sketch, not a 3D render, not a flat-lay, not a multi-panel collage).
- Clean minimalist light neutral studio background (#F4F5F7 warm off-white/light gray backdrop) with soft natural studio daylight, authentic fabric drape, natural creases, and realistic proportions.
- Faithfully combine ONLY the owned garments below, matching each garment's color, cut, collar/lapel, texture, pattern, and reference photo closely:
${itemDescriptions.map((desc, idx) => `${idx + 1}. ${desc}`).join('\n')}

${
  missingSlots.length > 0
    ? `- Note: The list has no specific ${missingSlots.join(', ')} item; keep any uncovered area understated and minimal without adding conspicuous unrequested accessories or outerwear.`
    : '- Do NOT invent or add extra outerwear, scarves, hats, sunglasses, or accessories not listed above.'
}
- Zero text, zero labels, zero watermarks, zero borders inside the generated photo.`;

  parts.push({ text: imagePrompt });

  const runImageGen = () =>
    ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '3:4',
        },
      },
    });

  let response;
  try {
    response = await runImageGen();
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? '';
    const code = (err as { status?: number })?.status;
    if (code === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      await new Promise((r) => setTimeout(r, 900));
      response = await runImageGen();
    } else {
      throw err;
    }
  }

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('AI가 실사 코디 이미지를 반환하지 않았습니다. 잠시 후 다시 시도해 주세요.');
}

export async function generateOutfitPreviewBlueprint(
  outfit: OutfitRecommendation,
  ownedItems: WardrobeItem[]
): Promise<OutfitIllustrationSpec> {
  const ai = getClient();
  const ownedMap = new Map(ownedItems.map((i) => [i.id, i]));
  const validItems = outfit.itemIds
    .map((id) => ownedMap.get(id))
    .filter((i): i is WardrobeItem => Boolean(i));

  const prompt = `선택된 추천 코디를 위한 '실사 코디 착장 미리보기' 연출 해설을 작성해 주세요.
이 코디는 보유 아이템의 사진과 메타데이터를 조합하여 얼굴을 제외한 전신 실사 룩북 이미지로 생성됩니다.
목록에 없는 의류나 소품을 임의로 추가하지 마세요.

[코디 제목] ${outfit.title}
[코디 설명] ${outfit.stylingExplanation}
[포함된 보유 아이템]
${serializeClosetForPrompt(validItems)}`;

  const [textResponse, generatedImageUrl] = await Promise.all([
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: BASE_SYSTEM_RULES,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artDirectionNote: {
              type: Type.STRING,
              description: '실사 착장 이미지의 전체 색감·소재 대비·실루엣·레이어링 연출 포인트 설명 (2문장)',
            },
            moodLine: {
              type: Type.STRING,
              description: '착장 사진 하단에 들어갈 짧은 무드 한 줄',
            },
            layerCallouts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  calloutNote: {
                    type: Type.STRING,
                    description: '아이템별 짧은 소재/실루엣/착용 연출 메모 (25자 이내)',
                  },
                },
                required: ['itemId', 'calloutNote'],
              },
            },
            stylingNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '실제 착장 시 소재감과 비율·핏을 살리는 스타일링 포인트 2~3가지',
            },
            assumptionsAndUncertainties: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '실제 의류와 생성 이미지 간 차이, 기록되지 않아 가정한 체형·기장·질감 2~3가지',
            },
          },
          required: [
            'artDirectionNote',
            'moodLine',
            'layerCallouts',
            'stylingNotes',
            'assumptionsAndUncertainties',
          ],
        },
      },
    }),
    generateRealisticOutfitPhoto(ai, outfit, validItems),
  ]);

  const parsed = JSON.parse((textResponse.text ?? '{}').trim()) as {
    artDirectionNote?: string;
    moodLine?: string;
    layerCallouts?: Array<{ itemId: string; calloutNote: string }>;
    stylingNotes?: string[];
    assumptionsAndUncertainties?: string[];
  };

  const calloutMap = new Map(
    (parsed.layerCallouts ?? []).map((c) => [c.itemId, c.calloutNote])
  );

  const layers = validItems.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    slot: mapCategoryToSlot(item.category),
    colorHex: resolveKoreanColorHex(item.color),
    colorLabel: item.color,
    silhouetteVariant: inferSilhouetteVariant(item),
    patternHint: item.visualMeta?.pattern,
    materialHint: item.visualMeta?.material,
    imageUrl: item.imageUrl,
    fitNote: `${item.fit} · ${item.style}`,
    calloutNote:
      calloutMap.get(item.id) ||
      formatVisualMetadataSummary(item.visualMeta) ||
      `${item.color} ${item.fit}`,
  }));

  return {
    outfitId: outfit.id,
    title: outfit.title,
    artDirectionNote:
      parsed.artDirectionNote ||
      '보유 아이템의 색상 밸런스와 소재·실루엣 대비를 반영하여 얼굴 제외 전신 착장 이미지로 생성했습니다.',
    moodLine: parsed.moodLine || `${validItems.map((i) => i.color).slice(0, 3).join(' · ')} 실사 착장`,
    backdropTone: '#F4F5F7',
    generatedImageUrl,
    layers,
    stylingNotes:
      parsed.stylingNotes?.length
        ? parsed.stylingNotes
        : ['상의와 하의의 실루엣 대비를 활용해 깔끔한 비율을 연출해 보세요.'],
    assumptionsAndUncertainties:
      parsed.assumptionsAndUncertainties?.length
        ? parsed.assumptionsAndUncertainties
        : ['착용자 체형과 실제 옷 기장·광택은 사진 및 텍스트 정보 기준으로 추정해 생성했습니다.'],
    disclaimer: CONCEPTUAL_PREVIEW_DISCLAIMER,
    source: 'ai',
  };
}

export async function generateFashionAssistantReply(params: {
  ownedItems: WardrobeItem[];
  preferences: StylePreferences;
  outfits: OutfitRecommendation[];
  purchaseCandidate: PurchaseCandidate;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  attachments?: {
    itemIds?: string[];
    outfitIds?: string[];
    includeClosetSummary?: boolean;
    includePurchaseCandidate?: boolean;
  };
}): Promise<{ reply: string; citedItemIds: string[] }> {
  const ai = getClient();
  const ownedIdSet = new Set(params.ownedItems.map((i) => i.id));
  const candidateMetaSummary = formatVisualMetadataSummary(params.purchaseCandidate.visualMeta);

  const resolvedAttachments = resolveChatAttachments({
    ownedItems: params.ownedItems,
    outfits: params.outfits,
    purchaseCandidate: params.purchaseCandidate,
    selection: params.attachments,
  });

  const attachedItemsSection =
    resolvedAttachments.attachedItems.length > 0
      ? `[사용자가 이번 질문에 직접 첨부한 보유 의류 (${resolvedAttachments.attachedItems.length}벌)]\n${serializeClosetForPrompt(resolvedAttachments.attachedItems)}`
      : '';

  const contextBlock = `[현재 연결된 사용자 옷장 데이터]
보유 의류 (${params.ownedItems.length}벌):
${serializeClosetForPrompt(params.ownedItems)}

현재 스타일 선호도:
- 상황: ${params.preferences.occasion}
- 계절: ${params.preferences.season}
- 선호 스타일: ${params.preferences.preferredStyle}
- 추가 요청: ${params.preferences.additionalNotes || '없음'}

현재 추천된 코디 목록:
${
  params.outfits.length > 0
    ? params.outfits
        .map(
          (o, idx) =>
            `${idx + 1}. ${o.title}: ${o.items.map((i) => `${i.name}(${i.id})`).join(', ')}`
        )
        .join('\n')
    : '(아직 생성된 추천 코디 없음)'
}

현재 검토 중인 구매 후보:
${
  params.purchaseCandidate.name
    ? `${params.purchaseCandidate.name} (${params.purchaseCandidate.category}, ${params.purchaseCandidate.color}, ${params.purchaseCandidate.style}, ${params.purchaseCandidate.fit}, ${params.purchaseCandidate.season}${candidateMetaSummary ? `, 메타데이터: ${candidateMetaSummary}` : ''})`
    : '(입력된 구매 후보 없음)'
}`;

  const historyLines = params.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
    .join('\n');

  const fullPrompt = `${contextBlock}

${attachedItemsSection ? `${attachedItemsSection}\n\n` : ''}${
    resolvedAttachments.summaryText ? `${resolvedAttachments.summaryText}\n\n` : ''
  }[최근 대화 기록]
${historyLines || '(첫 질문)'}

[사용자의 새 질문]
${params.message}

위 보유 의류 데이터에만 근거하여 친절하고 구체적인 한국어로 답변해 주세요.
${
  resolvedAttachments.attachedItems.length > 0 || resolvedAttachments.summaryText
    ? '- 사용자가 이번 질문에 직접 첨부한 의류·사진·데이터를 최우선 중심으로 분석하고, 다른 보유 의류와의 매칭도 함께 제안하세요.\n'
    : ''
}- 보유 목록에 없는 아이템은 절대 보유한 것처럼 말하지 마세요.
- 필요한 경우 가정과 불확실성을 자연스럽게 밝히세요.
- 새 구매보다 기존 옷 활용을 우선으로 제안하세요.
- 답변에서 실제로 언급한 보유 아이템의 ID들을 citedItemIds 배열로 함께 반환하세요.`;

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  for (const item of resolvedAttachments.attachedItems.slice(0, 4)) {
    const imgPart = await resolveWardrobeImagePart(item.imageUrl);
    if (imgPart) {
      parts.push({
        text: `[첨부 의류 사진 참고] ${item.name} (ID: ${item.id})`,
      });
      parts.push({ inlineData: imgPart });
    }
  }
  parts.push({ text: fullPrompt });

  const runChat = () =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: parts.length > 1 ? { parts } : fullPrompt,
      config: {
        systemInstruction: BASE_SYSTEM_RULES,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: '사용자의 질문에 대한 정중하고 구체적인 한국어 답변 (단락 구분 포함)',
            },
            citedItemIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '답변에서 언급한 실제 보유 의류 ID 목록',
            },
          },
          required: ['reply', 'citedItemIds'],
        },
      },
    });

  let response;
  try {
    response = await runChat();
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? '';
    const code = (err as { status?: number })?.status;
    if (code === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      await new Promise((r) => setTimeout(r, 900));
      response = await runChat();
    } else {
      throw err;
    }
  }

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    reply?: string;
    citedItemIds?: string[];
  };

  return {
    reply: parsed.reply?.trim() || '보유하신 옷장 데이터를 바탕으로 다시 질문해 주시면 구체적으로 안내해 드리겠습니다.',
    citedItemIds: Array.from(
      new Set((parsed.citedItemIds ?? []).filter((id) => ownedIdSet.has(id)))
    ),
  };
}
