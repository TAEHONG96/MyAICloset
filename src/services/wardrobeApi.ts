import type {
  AiClosetDiagnosis,
  ChatRepresentativeOutfit,
  ExtractedImageMetadata,
  OutfitIllustrationSpec,
  OutfitRecommendation,
  PurchaseAdvice,
  PurchaseCandidate,
  StylePreferences,
  WardrobeItem,
} from '../types/wardrobe';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `요청 처리 중 오류가 발생했습니다. (HTTP ${res.status})`);
  }
  return data;
}

export async function requestImageMetadataExtraction(
  imageDataUrl: string,
  hintName?: string
): Promise<ExtractedImageMetadata> {
  const data = await postJson<{ metadata: ExtractedImageMetadata }>(
    '/api/wardrobe/extract-image-metadata',
    {
      imageDataUrl,
      hintName,
    }
  );
  return data.metadata;
}

export async function requestClosetDiagnosis(
  ownedItems: WardrobeItem[]
): Promise<AiClosetDiagnosis> {
  const data = await postJson<{ diagnosis: AiClosetDiagnosis }>('/api/wardrobe/analyze', {
    ownedItems,
  });
  return data.diagnosis;
}

export async function requestOutfitRecommendations(
  ownedItems: WardrobeItem[],
  preferences: StylePreferences
): Promise<OutfitRecommendation[]> {
  const data = await postJson<{ outfits: OutfitRecommendation[] }>('/api/wardrobe/recommend', {
    ownedItems,
    preferences,
  });
  return data.outfits;
}

export async function requestPurchaseAdvice(
  ownedItems: WardrobeItem[],
  candidate: PurchaseCandidate
): Promise<PurchaseAdvice> {
  const data = await postJson<{ advice: PurchaseAdvice }>('/api/wardrobe/purchase-advice', {
    ownedItems,
    candidate,
  });
  return data.advice;
}

export async function requestOutfitPreview(
  outfit: OutfitRecommendation,
  ownedItems: WardrobeItem[]
): Promise<OutfitIllustrationSpec> {
  const idSet = new Set(outfit.itemIds);
  const relevantItems = ownedItems.filter((item) => idSet.has(item.id));
  const data = await postJson<{ preview: OutfitIllustrationSpec }>('/api/wardrobe/outfit-preview', {
    outfit,
    ownedItems: relevantItems.length > 0 ? relevantItems : outfit.items,
  });
  return data.preview;
}

export async function requestAssistantReply(payload: {
  ownedItems: WardrobeItem[];
  preferences: StylePreferences;
  outfits: OutfitRecommendation[];
  purchaseCandidate: PurchaseCandidate;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  attachments?: {
    itemIds: string[];
    outfitIds: string[];
    includeClosetSummary: boolean;
    includePurchaseCandidate: boolean;
  };
}): Promise<{
  reply: string;
  citedItemIds: string[];
  representativeOutfit?: ChatRepresentativeOutfit;
}> {
  return postJson<{
    reply: string;
    citedItemIds: string[];
    representativeOutfit?: ChatRepresentativeOutfit;
  }>('/api/wardrobe/chat', payload);
}
