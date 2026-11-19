import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCloset,
  buildLocalIllustrationSpec,
  buildOutfitPhotoPromptSummary,
  computeDeterministicPurchasePrecheck,
  exportWardrobeCsv,
  formatVisualMetadataSummary,
  mergeExtractedMetadataToDraft,
  normalizeCategory,
  normalizeThickness,
  parseWardrobeCsv,
  resolveChatAttachments,
  resolveKoreanColorHex,
  validateOutfitRecommendations,
} from './wardrobeLogic';
import {
  INITIAL_PURCHASE_CANDIDATE,
  INITIAL_SEED_OUTFITS,
  INITIAL_WARDROBE_ITEMS,
  SAMPLE_CSV_TEXT,
} from '../data/sampleCloset';
import { ExtractedImageMetadata, PurchaseCandidate, RawAiOutfit, WardrobeItem } from '../types/wardrobe';

test('parseWardrobeCsv parses valid Korean CSV with visual metadata and normalizes categories/seasons', () => {
  const result = parseWardrobeCsv(SAMPLE_CSV_TEXT, 'test');
  assert.equal(result.errors.length, 0);
  assert.equal(result.skippedRows, 0);
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].name, '카멜 캐시미어 터틀넥 니트');
  assert.equal(result.items[0].category, '상의');
  assert.equal(result.items[0].season, '겨울');
  assert.equal(result.items[0].visualMeta?.material, '캐시미어');
  assert.equal(result.items[0].visualMeta?.thickness, '두꺼움');
  assert.equal(result.items[2].category, '신발');
});

test('parseWardrobeCsv reports errors for invalid category or missing color without crashing', () => {
  const brokenCsv = `이름,카테고리,색상,스타일,핏,계절
잘못된옷,우주복,블랙,미니멀,레귤러핏,가을
색상없는옷,상의,,미니멀,레귤러핏,가을
정상셔츠,상의,화이트,클래식,레귤러핏,봄`;

  const result = parseWardrobeCsv(brokenCsv, 'err');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, '정상셔츠');
  assert.equal(result.skippedRows, 2);
  assert.equal(result.errors.length, 2);
});

test('exportWardrobeCsv round-trips through parseWardrobeCsv preserving item count, names, and visual metadata', () => {
  const csv = exportWardrobeCsv(INITIAL_WARDROBE_ITEMS);
  const parsed = parseWardrobeCsv(csv, 'rt');
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.items.length, INITIAL_WARDROBE_ITEMS.length);
  assert.equal(parsed.items[0].name, INITIAL_WARDROBE_ITEMS[0].name);
  assert.equal(parsed.items[0].visualMeta?.material, '울');
  assert.equal(parsed.items[13].category, '가방/액세서리');
});

test('analyzeCloset summarizes categories, colors, materials, image counts, redundancies, and assumptions accurately', () => {
  const starterSummary = analyzeCloset(INITIAL_WARDROBE_ITEMS);
  assert.equal(starterSummary.imageAttachedCount, INITIAL_WARDROBE_ITEMS.length);

  const partialPhoto: WardrobeItem[] = INITIAL_WARDROBE_ITEMS.map((item, idx) =>
    idx === 0 ? { ...item, imageUrl: 'data:image/jpeg;base64,test' } : { ...item, imageUrl: undefined }
  );
  const summary = analyzeCloset(partialPhoto);
  assert.equal(summary.totalCount, 14);
  assert.equal(summary.imageAttachedCount, 1);
  assert.equal(summary.metadataEnrichedCount, 14);
  assert.ok(summary.byMaterial.length > 0);
  const outerStat = summary.byCategory.find((c) => c.category === '아우터');
  const topStat = summary.byCategory.find((c) => c.category === '상의');
  assert.equal(outerStat?.count, 3);
  assert.equal(topStat?.count, 5);
  assert.equal(summary.missingCoreCategories.length, 0);
  assert.ok(summary.redundancies.length >= 1, 'Expected at least one color-group redundancy in starter closet');
  assert.ok(summary.assumptions.length >= 1, 'Expected explicit uncertainty/assumption note for summer items');
});

test('validateOutfitRecommendations strictly strips any hallucinated item IDs not in ownedItems', () => {
  const rawOutfits: RawAiOutfit[] = [
    {
      title: '미니멀 출근 코디',
      itemIds: ['item-01', 'item-05', 'item-09', 'hallucinated-999', 'item-12'],
      conceptSummary: '차콜과 블랙 중심의 정돈된 출근 룩',
      stylingExplanation: '차콜 블레이저와 아이보리 니트 조합입니다.',
      tpoFit: '출근에 적합',
      reuseTip: '이너만 바꾸어 재활용',
      assumptions: '기장 정보는 표준으로 가정',
    },
    {
      title: '유령 아이템만 있는 잘못된 코디',
      itemIds: ['fake-1', 'fake-2'],
      conceptSummary: '존재하지 않는 옷',
      stylingExplanation: '제외되어야 함',
      tpoFit: '',
      reuseTip: '',
      assumptions: '',
    },
  ];

  const validated = validateOutfitRecommendations(rawOutfits, INITIAL_WARDROBE_ITEMS);
  assert.equal(validated.length, 1);
  assert.equal(validated[0].items.length, 4);
  assert.equal(validated[0].rejectedIdsCount, 1);
  assert.ok(validated[0].items.every((item) => INITIAL_WARDROBE_ITEMS.some((o) => o.id === item.id)));
  assert.ok(validated[0].assumptions.includes('자동 제외'));
});

test('computeDeterministicPurchasePrecheck flags high redundancy and notes matching material metadata', () => {
  const redundantCandidate: PurchaseCandidate = {
    name: '다크그레이 투버튼 블레이저',
    category: '아우터',
    color: '차콜',
    style: '미니멀',
    fit: '세미오버핏',
    season: '가을',
    priceKrw: '198000',
    notes: '',
    visualMeta: {
      material: '울',
      pattern: '무지',
      thickness: '보통',
    },
  };

  const precheck = computeDeterministicPurchasePrecheck(redundantCandidate, INITIAL_WARDROBE_ITEMS);
  assert.equal(precheck.redundancyRisk, '높음');
  assert.ok(precheck.overlappingItems.some((i) => i.id === 'item-01'));
  assert.ok(precheck.compatibleItems.length > 0);
  assert.ok(precheck.reuseSuggestion.includes('차콜 울 싱글 블레이저'));
  assert.ok(precheck.reuseSuggestion.includes('울'));
});

test('normalizeThickness, formatVisualMetadataSummary, and buildLocalIllustrationSpec propagate visual metadata and imageUrl', () => {
  assert.equal(normalizeThickness('두꺼움'), '두꺼움');
  assert.equal(normalizeThickness('light'), '얇음');
  assert.equal(normalizeThickness('보통'), '보통');
  assert.equal(
    formatVisualMetadataSummary({
      material: '울',
      pattern: '체크',
      thickness: '두꺼움',
      silhouetteDetail: '노치드 라펠',
    }),
    '울 · 체크 · 두꺼움 두께 · 노치드 라펠'
  );

  assert.equal(resolveKoreanColorHex('네이비'), '#1F3352');
  assert.equal(resolveKoreanColorHex('아이보리'), '#EAE4D7');
  assert.equal(resolveKoreanColorHex('올리브'), '#5B6648');

  const customItems: WardrobeItem[] = INITIAL_WARDROBE_ITEMS.map((item) =>
    item.id === 'item-01'
      ? {
          ...item,
          imageUrl: 'data:image/jpeg;base64,sample',
          visualMeta: {
            material: '울',
            pattern: '헤링본',
            thickness: '두꺼움',
            silhouetteDetail: '노치드 라펠',
          },
        }
      : item
  );

  const validated = validateOutfitRecommendations(
    [
      {
        title: '테스트 코디',
        itemIds: ['item-01', 'item-04', 'item-09'],
        conceptSummary: '요약',
        stylingExplanation: '설명',
        tpoFit: '출근',
        reuseTip: '팁',
        assumptions: '가정',
      },
    ],
    customItems
  );

  const spec = buildLocalIllustrationSpec(validated[0]);
  assert.equal(spec.layers.length, 3);
  assert.equal(spec.layers[0].patternHint, '헤링본');
  assert.equal(spec.layers[0].materialHint, '울');
  assert.equal(spec.layers[0].imageUrl, 'data:image/jpeg;base64,sample');
  assert.ok(spec.disclaimer.includes('정확한 원단 질감이나 디테일을 시각적으로 그대로 재현한 이미지가 아닙니다'));

  const promptSummary = buildOutfitPhotoPromptSummary(validated[0]);
  assert.equal(promptSummary.itemDescriptions.length, 3);
  assert.ok(promptSummary.itemDescriptions[0].includes('차콜 울 싱글 블레이저'));
  assert.ok(promptSummary.missingSlots.includes('신발'));
});

test('mergeExtractedMetadataToDraft auto-populates category, color, material, notes, and expanded Korean category aliases', () => {
  assert.equal(normalizeCategory('블레이저'), '아우터');
  assert.equal(normalizeCategory('가디건'), '상의');
  assert.equal(normalizeCategory('슬랙스'), '하의');
  assert.equal(normalizeCategory('로퍼'), '신발');
  assert.equal(normalizeCategory('머플러'), '가방/액세서리');

  const extracted: ExtractedImageMetadata = {
    suggestedName: '네이비 트위드 재킷',
    category: '아우터',
    color: '네이비',
    style: '비즈니스캐주얼',
    fit: '세미 오버핏',
    season: '가을',
    visualMeta: {
      material: '울 트위드',
      pattern: '무지',
      thickness: '두꺼움',
      silhouetteDetail: '금장 단추 노치드 라펠',
      extractedFromImage: true,
      summaryNote: '가을 아우터로 활용도가 높은 네이비 트위드 재킷',
    },
    uncertaintyNote: '조명에 따라 네이비 명도가 달라 보일 수 있습니다.',
  };

  const merged = mergeExtractedMetadataToDraft(
    {
      name: '',
      category: '상의',
      color: '',
      style: '미니멀',
      fit: '레귤러핏',
      season: '봄',
      material: '',
      pattern: '',
      thickness: '',
      silhouetteDetail: '',
      summaryNote: '',
      notes: '',
      extractedFromImage: false,
    },
    extracted
  );

  assert.equal(merged.name, '네이비 트위드 재킷');
  assert.equal(merged.category, '아우터');
  assert.equal(merged.color, '네이비');
  assert.equal(merged.material, '울 트위드');
  assert.equal(merged.style, '비즈니스 캐주얼');
  assert.equal(merged.fit, '세미오버핏');
  assert.equal(merged.season, '가을');
  assert.equal(merged.thickness, '두꺼움');
  assert.equal(merged.notes, '가을 아우터로 활용도가 높은 네이비 트위드 재킷');
  assert.equal(merged.extractedFromImage, true);
});

test('resolveChatAttachments validates attached closet item IDs, dedupes, and formats attached context blocks', () => {
  const result = resolveChatAttachments({
    ownedItems: INITIAL_WARDROBE_ITEMS,
    outfits: INITIAL_SEED_OUTFITS,
    purchaseCandidate: INITIAL_PURCHASE_CANDIDATE,
    selection: {
      itemIds: ['item-01', 'item-10', 'item-01', 'nonexistent-item'],
      outfitIds: ['seed-outfit-1'],
      includeClosetSummary: true,
      includePurchaseCandidate: true,
    },
  });

  assert.equal(result.attachedItems.length, 2);
  assert.equal(result.attachedItems[0].id, 'item-01');
  assert.equal(result.attachedItems[1].id, 'item-10');
  assert.equal(result.attachedOutfits.length, 1);
  assert.equal(result.contextLabels.length, 3);
  assert.ok(result.summaryText.includes('총 보유량: 14벌'));
  assert.ok(result.summaryText.includes(INITIAL_PURCHASE_CANDIDATE.name));
  assert.ok(result.summaryText.includes(INITIAL_SEED_OUTFITS[0].title));
});


