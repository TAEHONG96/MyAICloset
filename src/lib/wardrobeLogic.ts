import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  ClosetSummary,
  DistributionEntry,
  ExtractedImageMetadata,
  FIT_OPTIONS,
  GarmentSlot,
  GarmentThickness,
  GarmentVisualMetadata,
  IllustrationGarmentLayer,
  OutfitIllustrationSpec,
  OutfitRecommendation,
  PurchaseCandidate,
  PurchasePrecheck,
  RawAiOutfit,
  RedundancyGroup,
  SEASON_OPTIONS,
  SeasonTag,
  STYLE_OPTIONS,
  WardrobeItem,
} from '../types/wardrobe';

export interface CsvParseResult {
  items: WardrobeItem[];
  errors: string[];
  skippedRows: number;
}

const CATEGORY_ALIASES: Record<string, ClothingCategory> = {
  아우터: '아우터',
  외투: '아우터',
  자켓: '아우터',
  재킷: '아우터',
  블레이저: '아우터',
  코트: '아우터',
  점퍼: '아우터',
  패딩: '아우터',
  outer: '아우터',
  outerwear: '아우터',
  jacket: '아우터',
  coat: '아우터',
  상의: '상의',
  탑: '상의',
  셔츠: '상의',
  블라우스: '상의',
  니트: '상의',
  스웨터: '상의',
  가디건: '상의',
  맨투맨: '상의',
  후드: '상의',
  티셔츠: '상의',
  top: '상의',
  tops: '상의',
  shirt: '상의',
  knit: '상의',
  하의: '하의',
  바지: '하의',
  팬츠: '하의',
  슬랙스: '하의',
  청바지: '하의',
  스커트: '하의',
  치마: '하의',
  bottom: '하의',
  bottoms: '하의',
  pants: '하의',
  skirt: '하의',
  원피스: '원피스',
  드레스: '원피스',
  점프수트: '원피스',
  dress: '원피스',
  onepiece: '원피스',
  신발: '신발',
  슈즈: '신발',
  로퍼: '신발',
  스니커즈: '신발',
  부츠: '신발',
  구두: '신발',
  shoes: '신발',
  footwear: '신발',
  '가방/액세서리': '가방/액세서리',
  가방: '가방/액세서리',
  액세서리: '가방/액세서리',
  잡화: '가방/액세서리',
  머플러: '가방/액세서리',
  스카프: '가방/액세서리',
  벨트: '가방/액세서리',
  모자: '가방/액세서리',
  bag: '가방/액세서리',
  accessory: '가방/액세서리',
  accessories: '가방/액세서리',
};

const SEASON_ALIASES: Record<string, SeasonTag> = {
  봄: '봄',
  spring: '봄',
  여름: '여름',
  summer: '여름',
  가을: '가을',
  fall: '가을',
  autumn: '가을',
  겨울: '겨울',
  winter: '겨울',
  간절기: '간절기',
  '봄/가을': '간절기',
  봄가을: '간절기',
  transitional: '간절기',
  사계절: '사계절',
  전체: '사계절',
  all: '사계절',
  'all-season': '사계절',
};

const COLOR_HEX_MAP: Array<{ keywords: string[]; hex: string; group: string }> = [
  { keywords: ['블랙', '검정', '검은', '흑', 'black'], hex: '#1F2328', group: '블랙/다크' },
  { keywords: ['차콜', '다크그레이', '진회색', 'charcoal'], hex: '#3D434C', group: '그레이/차콜' },
  { keywords: ['그레이', '회색', '멜란지', 'gray', 'grey'], hex: '#8A9099', group: '그레이/차콜' },
  { keywords: ['화이트', '흰색', '백색', 'white'], hex: '#F6F7F8', group: '화이트/아이보리' },
  { keywords: ['아이보리', '크림', '에크루', '오트밀', 'ivory', 'cream', 'oatmeal'], hex: '#EAE4D7', group: '화이트/아이보리' },
  { keywords: ['베이지', '샌드', '탄', '카키베이지', 'beige', 'sand'], hex: '#CBBBA0', group: '베이지/브라운' },
  { keywords: ['카멜', 'camel'], hex: '#B58452', group: '베이지/브라운' },
  { keywords: ['브라운', '다크브라운', '초코', '모카', '밤색', 'brown'], hex: '#5D4037', group: '베이지/브라운' },
  { keywords: ['네이비', '남색', '곤색', 'navy'], hex: '#1F3352', group: '네이비/블루' },
  { keywords: ['진청', '인디고', '생지', 'indigo'], hex: '#283F63', group: '네이비/블루' },
  { keywords: ['중청', '데님', '블루', '파랑', 'blue', 'denim'], hex: '#4B6E9B', group: '네이비/블루' },
  { keywords: ['연청', '스카이블루', '소라', '하늘', 'sky'], hex: '#94B8DA', group: '네이비/블루' },
  { keywords: ['올리브', '카키', 'olive', 'khaki'], hex: '#5B6648', group: '그린/올리브' },
  { keywords: ['그린', '포레스트', '초록', '민트', 'green'], hex: '#2F5D46', group: '그린/올리브' },
  { keywords: ['버건디', '와인', '레드', '빨강', 'burgundy', 'wine', 'red'], hex: '#7A2835', group: '레드/버건디' },
  { keywords: ['핑크', '로즈', '코랄', 'pink'], hex: '#D49BA4', group: '핑크/퍼플' },
  { keywords: ['퍼플', '라벤더', '보라', 'purple'], hex: '#6B5B8C', group: '핑크/퍼플' },
  { keywords: ['옐로우', '머스타드', '노랑', 'yellow', 'mustard'], hex: '#C99E3A', group: '옐로우/오렌지' },
];

export function resolveKoreanColorHex(colorName: string): string {
  const normalized = colorName.trim().toLowerCase();
  for (const entry of COLOR_HEX_MAP) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return entry.hex;
    }
  }
  return '#747C87';
}

export function resolveColorGroup(colorName: string): string {
  const normalized = colorName.trim().toLowerCase();
  for (const entry of COLOR_HEX_MAP) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return entry.group;
    }
  }
  return colorName.trim() || '기타';
}

export function normalizeCategory(raw: string): ClothingCategory | null {
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? null;
}

export function normalizeSeason(raw: string): SeasonTag {
  const key = raw.trim().toLowerCase();
  return SEASON_ALIASES[key] ?? '사계절';
}

export function normalizeThickness(raw: string | undefined): GarmentThickness | undefined {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return undefined;
  if (key.includes('얇') || key === 'thin' || key === 'light') return '얇음';
  if (key.includes('두') || key === 'thick' || key === 'heavy') return '두꺼움';
  if (key.includes('보통') || key.includes('중간') || key === 'medium' || key === 'regular') {
    return '보통';
  }
  return undefined;
}

export function hasUsefulVisualMeta(meta?: GarmentVisualMetadata): boolean {
  if (!meta) return false;
  return Boolean(
    meta.material?.trim() ||
      meta.pattern?.trim() ||
      meta.silhouetteDetail?.trim() ||
      meta.thickness ||
      meta.summaryNote?.trim()
  );
}

export function formatVisualMetadataSummary(meta?: GarmentVisualMetadata): string {
  if (!meta) return '';
  const parts = [
    meta.material?.trim(),
    meta.pattern?.trim(),
    meta.thickness ? `${meta.thickness} 두께` : undefined,
    meta.silhouetteDetail?.trim(),
  ].filter((v): v is string => Boolean(v));
  return parts.join(' · ');
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseWardrobeCsv(csvText: string, idPrefix = 'csv'): CsvParseResult {
  const rawLines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return {
      items: [],
      errors: ['CSV 내용이 비어 있습니다. 헤더와 의류 데이터를 입력해 주세요.'],
      skippedRows: 0,
    };
  }

  const firstRow = parseCsvLine(rawLines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader = firstRow.some((cell) =>
    ['이름', '품목', '아이템', 'name', 'item', '카테고리', 'category'].includes(cell)
  );

  const headerMap = {
    name: 0,
    category: 1,
    color: 2,
    style: 3,
    fit: 4,
    season: 5,
    notes: 6,
    material: -1,
    pattern: -1,
    thickness: -1,
    silhouetteDetail: -1,
  };

  if (looksLikeHeader) {
    firstRow.forEach((h, idx) => {
      if (['이름', '품목', '아이템', '아이템명', 'name', 'item'].includes(h)) headerMap.name = idx;
      if (['카테고리', '분류', '종류', 'category'].includes(h)) headerMap.category = idx;
      if (['색상', '컬러', 'color'].includes(h)) headerMap.color = idx;
      if (['스타일', '무드', 'style'].includes(h)) headerMap.style = idx;
      if (['핏', '실루엣', 'fit'].includes(h)) headerMap.fit = idx;
      if (['계절', '시즌', 'season'].includes(h)) headerMap.season = idx;
      if (['소재', '원단', '재질', 'material', 'fabric'].includes(h)) headerMap.material = idx;
      if (['패턴', '무늬', 'pattern'].includes(h)) headerMap.pattern = idx;
      if (['두께', '두께감', 'thickness'].includes(h)) headerMap.thickness = idx;
      if (['상세특징', '디테일', '실루엣디테일', 'detail', 'silhouettedetail'].includes(h)) {
        headerMap.silhouetteDetail = idx;
      }
      if (['메모', '비고', '특징', 'notes', 'note'].includes(h)) headerMap.notes = idx;
    });
  }

  const startIndex = looksLikeHeader ? 1 : 0;
  const items: WardrobeItem[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  for (let i = startIndex; i < rawLines.length; i += 1) {
    const cols = parseCsvLine(rawLines[i]);
    const name = cols[headerMap.name] ?? '';
    const rawCat = cols[headerMap.category] ?? '';
    const color = cols[headerMap.color] ?? '';
    const style = cols[headerMap.style] || '미니멀';
    const fit = cols[headerMap.fit] || '레귤러핏';
    const rawSeason = cols[headerMap.season] || '사계절';
    const notes = cols[headerMap.notes] || '';
    const material = headerMap.material >= 0 ? cols[headerMap.material] || '' : '';
    const pattern = headerMap.pattern >= 0 ? cols[headerMap.pattern] || '' : '';
    const thickness =
      headerMap.thickness >= 0 ? normalizeThickness(cols[headerMap.thickness]) : undefined;
    const silhouetteDetail =
      headerMap.silhouetteDetail >= 0 ? cols[headerMap.silhouetteDetail] || '' : '';

    if (!name) {
      errors.push(`${i + 1}행: 아이템 이름이 비어 있어 건너뛰었습니다.`);
      skippedRows += 1;
      continue;
    }

    const category = normalizeCategory(rawCat);
    if (!category) {
      errors.push(
        `${i + 1}행(${name}): 카테고리 '${rawCat || '미입력'}'을 인식할 수 없어 건너뛰었습니다. (아우터/상의/하의/원피스/신발/가방/액세서리)`
      );
      skippedRows += 1;
      continue;
    }

    if (!color) {
      errors.push(`${i + 1}행(${name}): 색상이 비어 있어 건너뛰었습니다.`);
      skippedRows += 1;
      continue;
    }

    const visualMeta: GarmentVisualMetadata | undefined =
      material || pattern || thickness || silhouetteDetail
        ? {
            ...(material ? { material } : {}),
            ...(pattern ? { pattern } : {}),
            ...(thickness ? { thickness } : {}),
            ...(silhouetteDetail ? { silhouetteDetail } : {}),
          }
        : undefined;

    items.push({
      id: `${idPrefix}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      category,
      color,
      style,
      fit,
      season: normalizeSeason(rawSeason),
      notes: notes || undefined,
      ...(visualMeta ? { visualMeta } : {}),
    });
  }

  return { items, errors, skippedRows };
}

function escapeCsvCell(value: string | undefined): string {
  const v = value ?? '';
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function exportWardrobeCsv(items: WardrobeItem[]): string {
  const header = '이름,카테고리,색상,스타일,핏,계절,소재,패턴,두께,상세특징,메모';
  const rows = items.map((item) =>
    [
      escapeCsvCell(item.name),
      escapeCsvCell(item.category),
      escapeCsvCell(item.color),
      escapeCsvCell(item.style),
      escapeCsvCell(item.fit),
      escapeCsvCell(item.season),
      escapeCsvCell(item.visualMeta?.material),
      escapeCsvCell(item.visualMeta?.pattern),
      escapeCsvCell(item.visualMeta?.thickness),
      escapeCsvCell(item.visualMeta?.silhouetteDetail),
      escapeCsvCell(item.notes),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function analyzeCloset(items: WardrobeItem[]): ClosetSummary {
  const totalCount = items.length;
  const imageAttachedCount = items.filter((item) => Boolean(item.imageUrl)).length;
  const metadataEnrichedCount = items.filter((item) => hasUsefulVisualMeta(item.visualMeta)).length;

  const byCategory = CLOTHING_CATEGORIES.map((category) => {
    const count = items.filter((item) => item.category === category).length;
    return {
      category,
      count,
      ratio: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });

  const colorCounts = new Map<string, number>();
  const styleCounts = new Map<string, number>();
  const fitCounts = new Map<string, number>();
  const materialCounts = new Map<string, number>();
  const seasonCounts = new Map<SeasonTag, number>();
  SEASON_OPTIONS.forEach((s) => seasonCounts.set(s, 0));

  for (const item of items) {
    const colorKey = item.color.trim() || '미지정';
    colorCounts.set(colorKey, (colorCounts.get(colorKey) ?? 0) + 1);

    const styleKey = item.style.trim() || '미지정';
    styleCounts.set(styleKey, (styleCounts.get(styleKey) ?? 0) + 1);

    const fitKey = item.fit.trim() || '미지정';
    fitCounts.set(fitKey, (fitCounts.get(fitKey) ?? 0) + 1);

    const materialKey = item.visualMeta?.material?.trim();
    if (materialKey) {
      materialCounts.set(materialKey, (materialCounts.get(materialKey) ?? 0) + 1);
    }

    seasonCounts.set(item.season, (seasonCounts.get(item.season) ?? 0) + 1);
  }

  const toDistribution = (
    map: Map<string, number>,
    includeHex = false
  ): DistributionEntry[] =>
    Array.from(map.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        ratio: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        ...(includeHex ? { hex: resolveKoreanColorHex(label) } : {}),
      }));

  const byColor = toDistribution(colorCounts, true);
  const byStyle = toDistribution(styleCounts);
  const byFit = toDistribution(fitCounts);
  const byMaterial = toDistribution(materialCounts);
  const bySeason: DistributionEntry[] = SEASON_OPTIONS.map((season) => {
    const count = seasonCounts.get(season) ?? 0;
    return {
      label: season,
      count,
      ratio: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });

  // Detect potential redundancies: same category + same color group (excluding 상의 if <3 or flag when >=2)
  const groupMap = new Map<string, WardrobeItem[]>();
  for (const item of items) {
    const colorGroup = resolveColorGroup(item.color);
    const key = `${item.category}::${colorGroup}`;
    const bucket = groupMap.get(key) ?? [];
    bucket.push(item);
    groupMap.set(key, bucket);
  }

  const redundancies: RedundancyGroup[] = [];
  for (const [key, bucket] of groupMap.entries()) {
    if (bucket.length >= 2) {
      const [category, colorGroup] = key.split('::') as [ClothingCategory, string];
      redundancies.push({
        key,
        category,
        colorGroup,
        items: bucket,
        reason: `동일 카테고리(${category}) 내 유사 색상 계열(${colorGroup}) 아이템이 ${bucket.length}개 있어 용도가 겹칠 수 있습니다.`,
      });
    }
  }

  const coreCategories: ClothingCategory[] = ['상의', '하의', '신발'];
  const missingCoreCategories = coreCategories.filter(
    (cat) => !items.some((item) => item.category === cat)
  );

  const assumptions: string[] = [];
  if (totalCount === 0) {
    assumptions.push('현재 등록된 의류가 없어 통계를 계산할 수 없습니다.');
  } else {
    if (missingCoreCategories.length > 0) {
      assumptions.push(
        `옷장에 ${missingCoreCategories.join(', ')} 항목이 등록되어 있지 않아 완전한 착장 분석 시 해당 부위는 미등록 상태로 간주합니다.`
      );
    }
    const itemsMissingDetail = items.filter(
      (i) => !i.notes?.trim() && !hasUsefulVisualMeta(i.visualMeta)
    ).length;
    if (itemsMissingDetail > 0) {
      assumptions.push(
        `사진 메타데이터나 세부 메모(소재·두께·패턴)가 없는 아이템이 ${itemsMissingDetail}벌 있어 계절·핏 표기 기준으로 보수적으로 분류했습니다.`
      );
    }
    if (!items.some((i) => i.season === '여름')) {
      assumptions.push(
        '여름 전용 아이템이 명시적으로 등록되어 있지 않으며, 사계절 표기 의류의 한여름 착용 가능성은 소재 정보가 없어 불확실합니다.'
      );
    }
  }

  return {
    totalCount,
    imageAttachedCount,
    metadataEnrichedCount,
    byCategory,
    byColor,
    bySeason,
    byStyle,
    byFit,
    byMaterial,
    redundancies,
    missingCoreCategories,
    assumptions,
  };
}

/**
 * Enforces the critical invariant: Outfit recommendations MUST ONLY reference items
 * that actually exist in ownedItems. Any invented/unknown item IDs are stripped.
 */
export function validateOutfitRecommendations(
  rawOutfits: RawAiOutfit[],
  ownedItems: WardrobeItem[]
): OutfitRecommendation[] {
  const itemMap = new Map<string, WardrobeItem>();
  for (const item of ownedItems) {
    itemMap.set(item.id, item);
  }

  return rawOutfits
    .slice(0, 3)
    .map((raw, index) => {
      const seen = new Set<string>();
      const validItems: WardrobeItem[] = [];
      let rejectedIdsCount = 0;

      for (const id of raw.itemIds ?? []) {
        const found = itemMap.get(id);
        if (found && !seen.has(found.id)) {
          seen.add(found.id);
          validItems.push(found);
        } else if (!found) {
          rejectedIdsCount += 1;
        }
      }

      return {
        id: `outfit-${index + 1}`,
        title: raw.title?.trim() || `추천 코디 ${index + 1}`,
        itemIds: validItems.map((i) => i.id),
        items: validItems,
        conceptSummary: raw.conceptSummary?.trim() || '',
        stylingExplanation: raw.stylingExplanation?.trim() || '',
        tpoFit: raw.tpoFit?.trim() || '',
        reuseTip: raw.reuseTip?.trim() || '',
        assumptions:
          rejectedIdsCount > 0
            ? `${raw.assumptions?.trim() || ''} (안전 검증: 보유 목록에 없는 항목 ${rejectedIdsCount}건을 자동 제외했습니다.)`.trim()
            : raw.assumptions?.trim() || '등록된 색상·핏·계절 정보만을 근거로 조합했습니다.',
        rejectedIdsCount,
      };
    })
    .filter((outfit) => outfit.items.length > 0);
}

const NEUTRAL_COLOR_GROUPS = new Set([
  '블랙/다크',
  '그레이/차콜',
  '화이트/아이보리',
  '베이지/브라운',
  '네이비/블루',
]);

function seasonsCompatible(a: SeasonTag, b: SeasonTag): boolean {
  if (a === '사계절' || b === '사계절') return true;
  if (a === b) return true;
  if (a === '간절기' && (b === '봄' || b === '가을')) return true;
  if (b === '간절기' && (a === '봄' || a === '가을')) return true;
  return false;
}

export function computeDeterministicPurchasePrecheck(
  candidate: PurchaseCandidate,
  ownedItems: WardrobeItem[]
): PurchasePrecheck {
  const candidateGroup = resolveColorGroup(candidate.color);
  const sameCategoryItems = ownedItems.filter((item) => item.category === candidate.category);

  const overlappingItems = sameCategoryItems.filter((item) => {
    const sameColorGroup = resolveColorGroup(item.color) === candidateGroup;
    const sameSeason = seasonsCompatible(item.season, candidate.season);
    const sameStyle = item.style === candidate.style;
    return sameColorGroup || (sameSeason && sameStyle);
  });

  const compatibleItems = ownedItems.filter((item) => {
    if (item.category === candidate.category) return false;
    const seasonMatch = seasonsCompatible(item.season, candidate.season);
    if (!seasonMatch) return false;

    const itemGroup = resolveColorGroup(item.color);
    const colorMatch =
      NEUTRAL_COLOR_GROUPS.has(candidateGroup) ||
      NEUTRAL_COLOR_GROUPS.has(itemGroup) ||
      item.style === candidate.style;
    return colorMatch;
  });

  let redundancyRisk: '낮음' | '보통' | '높음' = '낮음';
  const exactColorOverlap = overlappingItems.some(
    (item) => resolveColorGroup(item.color) === candidateGroup
  );
  if (exactColorOverlap || overlappingItems.length >= 2) {
    redundancyRisk = '높음';
  } else if (overlappingItems.length === 1 || sameCategoryItems.length >= 4) {
    redundancyRisk = '보통';
  }

  const sameMaterialMatch = overlappingItems.find(
    (item) =>
      candidate.visualMeta?.material &&
      item.visualMeta?.material &&
      item.visualMeta.material.trim() === candidate.visualMeta.material.trim()
  );

  let reuseSuggestion =
    '현재 옷장에 동일 역할의 아이템이 적어 보완 여지가 있으나, 실제 착용 빈도를 먼저 점검해 보세요.';
  if (overlappingItems.length > 0) {
    const names = overlappingItems
      .slice(0, 2)
      .map((i) => `'${i.name}'`)
      .join(', ');
    const materialNote = sameMaterialMatch?.visualMeta?.material
      ? ` 특히 ${sameMaterialMatch.visualMeta.material} 소재·실루엣 성격이 유사합니다.`
      : '';
    reuseSuggestion = `이미 보유한 ${names}와 역할·무드가 겹칩니다.${materialNote} 새 구매 전 기존 아이템의 레이어드나 핏 연출을 먼저 시도해 보는 것을 권장합니다.`;
  }

  return {
    overlappingItems,
    compatibleItems: compatibleItems.slice(0, 6),
    sameCategoryCount: sameCategoryItems.length,
    redundancyRisk,
    reuseSuggestion,
  };
}

export function mapCategoryToSlot(category: ClothingCategory): GarmentSlot {
  switch (category) {
    case '아우터':
      return 'outer';
    case '상의':
      return 'top';
    case '하의':
      return 'bottom';
    case '원피스':
      return 'dress';
    case '신발':
      return 'shoes';
    case '가방/액세서리':
      return 'accessory';
  }
}

export function inferSilhouetteVariant(item: WardrobeItem): string {
  const n = item.name;
  if (item.category === '아우터') {
    if (n.includes('트렌치')) return 'trench-coat';
    if (n.includes('코트') || n.includes('맥시')) return 'long-coat';
    if (n.includes('패딩') || n.includes('점퍼')) return 'puffer';
    return 'blazer';
  }
  if (item.category === '상의') {
    if (n.includes('가디건')) return 'cardigan';
    if (n.includes('셔츠') || n.includes('블라우스')) return 'shirt';
    if (n.includes('니트') || n.includes('스웨터') || n.includes('터틀넥')) return 'knit';
    return 'tshirt';
  }
  if (item.category === '하의') {
    if (n.includes('스커트') || n.includes('치마')) return 'skirt';
    if (item.fit.includes('와이드') || n.includes('와이드')) return 'wide-trousers';
    if (n.includes('데님') || n.includes('청')) return 'straight-denim';
    return 'tailored-slacks';
  }
  if (item.category === '원피스') {
    return 'midi-dress';
  }
  if (item.category === '신발') {
    if (n.includes('부츠')) return 'boots';
    if (n.includes('스니커즈') || n.includes('운동화')) return 'sneakers';
    return 'loafers';
  }
  if (n.includes('벨트')) return 'belt';
  if (n.includes('머플러') || n.includes('스카프')) return 'scarf';
  return 'shoulder-bag';
}

export const CONCEPTUAL_PREVIEW_DISCLAIMER =
  '본 실사 코디 이미지는 등록된 의류 사진과 메타데이터를 바탕으로 AI가 연출한 착장 미리보기이며, 실제 의류의 정확한 원단 질감이나 디테일을 시각적으로 그대로 재현한 이미지가 아닙니다. 체형·기장·조명에 따라 실제 착용 모습과 차이가 있을 수 있습니다.';

export function buildOutfitPhotoPromptSummary(outfit: OutfitRecommendation): {
  itemDescriptions: string[];
  missingSlots: string[];
} {
  const itemDescriptions = outfit.items.map((item) => {
    const metaSummary = formatVisualMetadataSummary(item.visualMeta);
    return `${item.name} (카테고리: ${item.category}, 색상: ${item.color}, 핏: ${item.fit}, 스타일: ${item.style}${metaSummary ? `, 세부 특징: ${metaSummary}` : ''})`;
  });

  const slots = new Set(outfit.items.map((item) => mapCategoryToSlot(item.category)));
  const missingSlots: string[] = [];
  if (!slots.has('outer') && !slots.has('top') && !slots.has('dress')) missingSlots.push('상의');
  if (!slots.has('bottom') && !slots.has('dress')) missingSlots.push('하의');
  if (!slots.has('shoes')) missingSlots.push('신발');

  return { itemDescriptions, missingSlots };
}

export function buildLocalIllustrationSpec(outfit: OutfitRecommendation): OutfitIllustrationSpec {
  const layers: IllustrationGarmentLayer[] = outfit.items.map((item) => {
    const metaSummary = formatVisualMetadataSummary(item.visualMeta);
    return {
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
      calloutNote: metaSummary || item.notes || `${item.color} ${item.fit} 실루엣`,
    };
  });

  const missingSlots: string[] = [];
  if (!layers.some((l) => l.slot === 'shoes')) missingSlots.push('신발');
  if (!layers.some((l) => l.slot === 'accessory')) missingSlots.push('가방/액세서리');

  const assumptions = [
    outfit.assumptions || '등록된 색상명과 핏 표기를 기준으로 일반적인 착장 비율을 가정했습니다.',
    '착용자의 신장·체형 및 소매·밑단 수선 여부는 기록되지 않아 표준 핏 기준으로 연출합니다.',
  ];
  if (missingSlots.length > 0) {
    assumptions.push(
      `선택된 코디에 ${missingSlots.join(', ')} 항목이 포함되어 있지 않아 해당 부분은 절제된 기본 매치로 보완되거나 화면에서 최소화됩니다.`
    );
  }

  return {
    outfitId: outfit.id,
    title: outfit.title,
    artDirectionNote:
      outfit.conceptSummary || '보유 의류의 색상 배합과 소재·핏 균형을 반영한 실사 코디 착장 구성입니다.',
    moodLine: `${outfit.items.map((i) => i.color).slice(0, 3).join(' · ')} 톤 착장`,
    backdropTone: '#F4F5F7',
    layers,
    stylingNotes: [
      outfit.stylingExplanation || '상·하의 실루엣 대비와 색상 밸런스를 중심으로 조합했습니다.',
      outfit.reuseTip || '소매 롤업이나 상의 인·아웃 연출만으로 기존 옷의 분위기를 변주할 수 있습니다.',
    ],
    assumptionsAndUncertainties: assumptions,
    disclaimer: CONCEPTUAL_PREVIEW_DISCLAIMER,
    source: 'local',
  };
}

export function normalizeStyle(raw: string, fallback = STYLE_OPTIONS[0]): string {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return fallback;
  const matched = STYLE_OPTIONS.find((opt) => opt.replace(/\s+/g, '') === cleaned);
  if (matched) return matched;
  if (cleaned.includes('비즈니스')) return '비즈니스 캐주얼';
  if (cleaned.includes('미니멀')) return '미니멀';
  if (cleaned.includes('클래식') || cleaned.includes('포멀')) return '클래식';
  if (cleaned.includes('캐주얼')) return '캐주얼';
  if (cleaned.includes('시티보이')) return '시티보이';
  if (cleaned.includes('스트릿')) return '스트릿';
  if (cleaned.includes('페미닌')) return '페미닌';
  if (cleaned.includes('프레피')) return '프레피';
  if (cleaned.includes('애슬레저') || cleaned.includes('스포티')) return '애슬레저';
  return fallback;
}

export function normalizeFit(raw: string, fallback = FIT_OPTIONS[1]): string {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return fallback;
  const matched = FIT_OPTIONS.find((opt) => opt.replace(/\s+/g, '') === cleaned);
  if (matched) return matched;
  if (cleaned.includes('세미오버')) return '세미오버핏';
  if (cleaned.includes('오버')) return '오버핏';
  if (cleaned.includes('슬림')) return '슬림핏';
  if (cleaned.includes('와이드')) return '와이드핏';
  if (cleaned.includes('스트레이트') || cleaned.includes('일자')) return '스트레이트핏';
  if (cleaned.includes('루즈') || cleaned.includes('여유')) return '루즈핏';
  if (cleaned.includes('레귤러') || cleaned.includes('스탠다드')) return '레귤러핏';
  return fallback;
}

export interface GarmentDraftFields {
  name: string;
  category: ClothingCategory;
  color: string;
  style: string;
  fit: string;
  season: SeasonTag;
  material: string;
  pattern: string;
  thickness: GarmentThickness | '';
  silhouetteDetail: string;
  summaryNote: string;
  notes: string;
  extractedFromImage: boolean;
}

export function mergeExtractedMetadataToDraft(
  current: GarmentDraftFields,
  extracted: ExtractedImageMetadata,
  options?: {
    replaceAutoFilledName?: boolean;
    replaceAutoFilledNotes?: boolean;
  }
): GarmentDraftFields {
  const nextColor =
    extracted.color && extracted.color.trim() && extracted.color.trim() !== '미지정'
      ? extracted.color.trim()
      : current.color;

  const suggestedName = extracted.suggestedName.trim();
  const suggestedSummary = extracted.visualMeta.summaryNote?.trim() ?? '';

  return {
    name:
      !current.name.trim() || options?.replaceAutoFilledName
        ? suggestedName || current.name
        : current.name,
    category: extracted.category,
    color: nextColor,
    style: normalizeStyle(extracted.style, current.style),
    fit: normalizeFit(extracted.fit, current.fit),
    season: extracted.season,
    material: extracted.visualMeta.material?.trim() || current.material,
    pattern: extracted.visualMeta.pattern?.trim() || current.pattern,
    thickness: extracted.visualMeta.thickness ?? current.thickness,
    silhouetteDetail: extracted.visualMeta.silhouetteDetail?.trim() || current.silhouetteDetail,
    summaryNote: suggestedSummary || current.summaryNote,
    notes:
      !current.notes.trim() || options?.replaceAutoFilledNotes
        ? suggestedSummary || current.notes
        : current.notes,
    extractedFromImage: true,
  };
}

export interface ResolvedChatAttachments {
  attachedItems: WardrobeItem[];
  attachedOutfits: OutfitRecommendation[];
  contextLabels: string[];
  summaryText: string;
}

export function resolveChatAttachments(params: {
  ownedItems: WardrobeItem[];
  outfits: OutfitRecommendation[];
  purchaseCandidate: PurchaseCandidate;
  selection?: {
    itemIds?: string[];
    outfitIds?: string[];
    includeClosetSummary?: boolean;
    includePurchaseCandidate?: boolean;
  };
}): ResolvedChatAttachments {
  const ownedMap = new Map(params.ownedItems.map((i) => [i.id, i]));
  const seenItemIds = new Set<string>();
  const attachedItems: WardrobeItem[] = [];

  for (const id of params.selection?.itemIds ?? []) {
    const found = ownedMap.get(id);
    if (found && !seenItemIds.has(found.id)) {
      seenItemIds.add(found.id);
      attachedItems.push(found);
    }
  }

  const outfitMap = new Map(params.outfits.map((o) => [o.id, o]));
  const seenOutfitIds = new Set<string>();
  const attachedOutfits: OutfitRecommendation[] = [];

  for (const id of params.selection?.outfitIds ?? []) {
    const found = outfitMap.get(id);
    if (found && !seenOutfitIds.has(found.id)) {
      seenOutfitIds.add(found.id);
      attachedOutfits.push(found);
    }
  }

  const contextLabels: string[] = [];
  const summarySections: string[] = [];

  if (params.selection?.includeClosetSummary) {
    const closet = analyzeCloset(params.ownedItems);
    contextLabels.push(`옷장 전체 요약 (${closet.totalCount}벌)`);
    const categoryText = closet.byCategory
      .filter((c) => c.count > 0)
      .map((c) => `${c.category} ${c.count}벌(${c.ratio}%)`)
      .join(', ');
    const topColors = closet.byColor
      .slice(0, 5)
      .map((c) => `${c.label} ${c.count}벌`)
      .join(', ');
    summarySections.push(
      `[첨부된 옷장 전체 요약]\n- 총 보유량: ${closet.totalCount}벌 (사진 ${closet.imageAttachedCount}건, 시각 메타데이터 ${closet.metadataEnrichedCount}건)\n- 카테고리 분포: ${categoryText || '없음'}\n- 주요 색상: ${topColors || '없음'}\n- 중복 주의 구간: ${closet.redundancies.length}건`
    );
  }

  if (params.selection?.includePurchaseCandidate && params.purchaseCandidate.name.trim()) {
    const c = params.purchaseCandidate;
    contextLabels.push(`구매 후보: ${c.name}`);
    const meta = formatVisualMetadataSummary(c.visualMeta);
    summarySections.push(
      `[첨부된 구매 후보]\n- ${c.name} | 카테고리: ${c.category} | 색상: ${c.color} | 스타일: ${c.style} | 핏: ${c.fit} | 계절: ${c.season}${c.priceKrw ? ` | 가격: ${Number(c.priceKrw).toLocaleString('ko-KR')}원` : ''}${meta ? ` | 메타데이터: ${meta}` : ''}${c.notes ? ` | 메모: ${c.notes}` : ''}`
    );
  }

  for (const outfit of attachedOutfits) {
    contextLabels.push(`코디: ${outfit.title}`);
    summarySections.push(
      `[첨부된 추천 코디: ${outfit.title}]\n- 구성 아이템: ${outfit.items.map((i) => `${i.name}(${i.id})`).join(', ')}\n- 콘셉트: ${outfit.conceptSummary}`
    );
  }

  return {
    attachedItems,
    attachedOutfits,
    contextLabels,
    summaryText: summarySections.join('\n\n'),
  };
}

/**
 * Validates representative outfit item IDs returned by the Fashion Assistant against ownedItems.
 * Enforces >= 2 distinct owned items and caps at 6 items so preview generation stays grounded.
 */
export function resolveRepresentativeOutfitItems(
  rawItemIds: string[] | undefined,
  ownedItems: WardrobeItem[]
): WardrobeItem[] {
  if (!Array.isArray(rawItemIds) || rawItemIds.length === 0) return [];
  const ownedMap = new Map(ownedItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const resolved: WardrobeItem[] = [];

  for (const id of rawItemIds) {
    const found = ownedMap.get(id);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      resolved.push(found);
      if (resolved.length >= 6) break;
    }
  }

  return resolved.length >= 2 ? resolved : [];
}
