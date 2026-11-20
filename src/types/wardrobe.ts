export type ClothingCategory =
  | '아우터'
  | '상의'
  | '하의'
  | '원피스'
  | '신발'
  | '가방/액세서리';

export type SeasonTag = '봄' | '여름' | '가을' | '겨울' | '간절기' | '사계절';

export type GarmentThickness = '얇음' | '보통' | '두꺼움';

export interface GarmentVisualMetadata {
  material?: string;
  pattern?: string;
  silhouetteDetail?: string;
  thickness?: GarmentThickness;
  extractedFromImage?: boolean;
  summaryNote?: string;
}

export interface ExtractedImageMetadata {
  suggestedName: string;
  category: ClothingCategory;
  color: string;
  style: string;
  fit: string;
  season: SeasonTag;
  visualMeta: GarmentVisualMetadata;
  uncertaintyNote: string;
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  style: string;
  fit: string;
  season: SeasonTag;
  notes?: string;
  imageUrl?: string;
  visualMeta?: GarmentVisualMetadata;
}

export interface StylePreferences {
  occasion: string;
  season: SeasonTag;
  preferredStyle: string;
  additionalNotes: string;
}

export interface CategoryStat {
  category: ClothingCategory;
  count: number;
  ratio: number;
}

export interface DistributionEntry {
  label: string;
  count: number;
  ratio: number;
  hex?: string;
}

export interface RedundancyGroup {
  key: string;
  category: ClothingCategory;
  colorGroup: string;
  items: WardrobeItem[];
  reason: string;
}

export interface ClosetSummary {
  totalCount: number;
  imageAttachedCount: number;
  metadataEnrichedCount: number;
  byCategory: CategoryStat[];
  byColor: DistributionEntry[];
  bySeason: DistributionEntry[];
  byStyle: DistributionEntry[];
  byFit: DistributionEntry[];
  byMaterial: DistributionEntry[];
  redundancies: RedundancyGroup[];
  missingCoreCategories: ClothingCategory[];
  assumptions: string[];
}

export interface AiClosetDiagnosis {
  headline: string;
  strengths: string[];
  balanceNotes: string[];
  reuseStrategies: string[];
  assumptionsAndUncertainties: string[];
}

export interface RawAiOutfit {
  title: string;
  itemIds: string[];
  conceptSummary: string;
  stylingExplanation: string;
  tpoFit: string;
  reuseTip: string;
  assumptions: string;
}

export interface OutfitRecommendation {
  id: string;
  title: string;
  itemIds: string[];
  items: WardrobeItem[];
  conceptSummary: string;
  stylingExplanation: string;
  tpoFit: string;
  reuseTip: string;
  assumptions: string;
  rejectedIdsCount: number;
  source?: 'ai' | 'seed';
}

export interface PurchaseCandidate {
  name: string;
  category: ClothingCategory;
  color: string;
  style: string;
  fit: string;
  season: SeasonTag;
  priceKrw: string;
  notes: string;
  imageUrl?: string;
  visualMeta?: GarmentVisualMetadata;
}

export interface PurchasePrecheck {
  overlappingItems: WardrobeItem[];
  compatibleItems: WardrobeItem[];
  sameCategoryCount: number;
  redundancyRisk: '낮음' | '보통' | '높음';
  reuseSuggestion: string;
}

export type PurchaseVerdict = '구매 추천' | '신중 검토' | '기존 옷 활용 권장';

export interface PurchaseAdvice {
  verdict: PurchaseVerdict;
  summary: string;
  compatibilityRating: '높음' | '보통' | '낮음';
  compatibilityAnalysis: string;
  matchingOwnedItemIds: string[];
  versatilityAnalysis: string;
  redundancyLevel: '낮음' | '보통' | '높음';
  redundancyAnalysis: string;
  overlappingOwnedItemIds: string[];
  purchaseValueAnalysis: string;
  reuseAlternativeTitle: string;
  reuseAlternativeItemIds: string[];
  reuseAlternativeReason: string;
  assumptionsAndUncertainties: string[];
}

export type GarmentSlot = 'outer' | 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory';

export interface IllustrationGarmentLayer {
  itemId: string;
  itemName: string;
  category: ClothingCategory;
  slot: GarmentSlot;
  colorHex: string;
  colorLabel: string;
  silhouetteVariant: string;
  patternHint?: string;
  materialHint?: string;
  imageUrl?: string;
  fitNote: string;
  calloutNote: string;
}

export interface OutfitIllustrationSpec {
  outfitId: string;
  title: string;
  artDirectionNote: string;
  moodLine: string;
  backdropTone: string;
  generatedImageUrl?: string;
  layers: IllustrationGarmentLayer[];
  stylingNotes: string[];
  assumptionsAndUncertainties: string[];
  disclaimer: string;
  source: 'ai' | 'local';
}

export interface ChatRepresentativeOutfit {
  title: string;
  itemIds: string[];
  stylingNote?: string;
  imageUrl?: string;
  imageError?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citedItemIds?: string[];
  representativeOutfit?: ChatRepresentativeOutfit;
  attachedItemIds?: string[];
  attachedContextLabels?: string[];
  timestamp: string;
}

export interface ChatAttachmentSelection {
  itemIds: string[];
  outfitIds: string[];
  includeClosetSummary: boolean;
  includePurchaseCandidate: boolean;
}

export type WorkspaceSection = 'home' | 'closet' | 'outfit' | 'purchase' | 'assistant';

export const CLOTHING_CATEGORIES: ClothingCategory[] = [
  '아우터',
  '상의',
  '하의',
  '원피스',
  '신발',
  '가방/액세서리',
];

export const SEASON_OPTIONS: SeasonTag[] = [
  '봄',
  '여름',
  '가을',
  '겨울',
  '간절기',
  '사계절',
];

export const FIT_OPTIONS: string[] = [
  '슬림핏',
  '레귤러핏',
  '세미오버핏',
  '오버핏',
  '와이드핏',
  '스트레이트핏',
  '루즈핏',
];

export const STYLE_OPTIONS: string[] = [
  '미니멀',
  '클래식',
  '캐주얼',
  '비즈니스 캐주얼',
  '시티보이',
  '스트릿',
  '페미닌',
  '프레피',
  '애슬레저',
];

export const OCCASION_OPTIONS: string[] = [
  '출근/비즈니스',
  '데일리/캐주얼',
  '데이트/저녁 모임',
  '하객/포멀',
  '주말 나들이/여행',
  '가벼운 산책/실내 활동',
];
