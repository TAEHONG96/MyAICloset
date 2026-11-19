import React, { useEffect, useMemo, useState } from 'react';
import {
  INITIAL_PURCHASE_CANDIDATE,
  INITIAL_SEED_OUTFITS,
  INITIAL_STYLE_PREFERENCES,
  INITIAL_WARDROBE_ITEMS,
} from './data/sampleCloset';
import {
  analyzeCloset,
  buildLocalIllustrationSpec,
  computeDeterministicPurchasePrecheck,
  resolveChatAttachments,
} from './lib/wardrobeLogic';
import {
  requestAssistantReply,
  requestClosetDiagnosis,
  requestOutfitPreview,
  requestOutfitRecommendations,
  requestPurchaseAdvice,
} from './services/wardrobeApi';
import type {
  AiClosetDiagnosis,
  ChatAttachmentSelection,
  ChatMessage,
  OutfitIllustrationSpec,
  OutfitRecommendation,
  PurchaseAdvice,
  PurchaseCandidate,
  StylePreferences,
  WardrobeItem,
  WorkspaceSection,
} from './types/wardrobe';
import { TopHeader } from './components/TopHeader';
import { ClosetManagerWidget } from './components/ClosetManagerWidget';
import { ClosetAnalyzerWidget } from './components/ClosetAnalyzerWidget';
import { StylePreferencesWidget } from './components/StylePreferencesWidget';
import { OutfitRecommenderWidget } from './components/OutfitRecommenderWidget';
import { OutfitPreviewWidget } from './components/OutfitPreviewWidget';
import { PurchaseCandidateWidget } from './components/PurchaseCandidateWidget';
import { PurchaseAdvisorWidget } from './components/PurchaseAdvisorWidget';
import { FashionAssistantWidget } from './components/FashionAssistantWidget';

const STORAGE_KEYS = {
  items: 'my-ai-closet:items:v1',
  prefs: 'my-ai-closet:prefs:v1',
  candidate: 'my-ai-closet:candidate:v1',
};

function formatTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function filterOutfitsByOwned(
  candidateOutfits: OutfitRecommendation[],
  ownedItems: WardrobeItem[]
): OutfitRecommendation[] {
  const ownedMap = new Map(ownedItems.map((item) => [item.id, item]));
  return candidateOutfits
    .map((outfit) => {
      const validItems = outfit.itemIds
        .map((id) => ownedMap.get(id))
        .filter((i): i is WardrobeItem => Boolean(i));
      return {
        ...outfit,
        itemIds: validItems.map((i) => i.id),
        items: validItems,
      };
    })
    .filter((outfit) => outfit.items.length >= 2);
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content:
    '안녕하세요, 나만의 옷장 패션 어시스턴트입니다.\n등록하신 보유 의류 목록만을 바탕으로 코디 응용법, 계절별 활용 팁, 중복 의류 정리, 구매 고민 상담을 도와드립니다. 무엇이든 편하게 질문해 주세요.',
  timestamp: formatTimeNow(),
};

function loadInitialItems(): WardrobeItem[] {
  const stored = loadStored(STORAGE_KEYS.items, INITIAL_WARDROBE_ITEMS);
  if (!Array.isArray(stored)) return INITIAL_WARDROBE_ITEMS;
  const sampleImageById = new Map(
    INITIAL_WARDROBE_ITEMS.filter((item) => Boolean(item.imageUrl)).map((item) => [
      item.id,
      item.imageUrl!,
    ])
  );
  return stored.map((item) => {
    if (item.imageUrl) return item;
    const starterImg = sampleImageById.get(item.id);
    return starterImg ? { ...item, imageUrl: starterImg } : item;
  });
}

export function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('closet');

  // Core Shared Wardrobe State (Widgets 1, 2, 5)
  const [items, setItems] = useState<WardrobeItem[]>(() => loadInitialItems());
  const [preferences, setPreferences] = useState<StylePreferences>(() =>
    loadStored(STORAGE_KEYS.prefs, INITIAL_STYLE_PREFERENCES)
  );
  const [purchaseCandidate, setPurchaseCandidate] = useState<PurchaseCandidate>(() =>
    loadStored(STORAGE_KEYS.candidate, INITIAL_PURCHASE_CANDIDATE)
  );

  // Widget 3: AI Closet Diagnosis
  const [diagnosis, setDiagnosis] = useState<AiClosetDiagnosis | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  // Widget 4 & 7: Outfit Recommender & Outfit Preview (seeded strictly from matching owned items)
  const [outfits, setOutfits] = useState<OutfitRecommendation[]>(() =>
    filterOutfitsByOwned(INITIAL_SEED_OUTFITS, loadInitialItems())
  );
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(() => {
    const seeded = filterOutfitsByOwned(INITIAL_SEED_OUTFITS, loadInitialItems());
    return seeded[0]?.id ?? null;
  });
  const [previewCache, setPreviewCache] = useState<Record<string, OutfitIllustrationSpec>>({});
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Widget 6: Purchase Advisor
  const [purchaseAdvice, setPurchaseAdvice] = useState<PurchaseAdvice | null>(null);
  const [isEvaluatingPurchase, setIsEvaluatingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Widget 8: Fashion Assistant Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Persist user data
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [items]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(preferences));
    } catch {
      // Ignore quota errors
    }
  }, [preferences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.candidate, JSON.stringify(purchaseCandidate));
    } catch {
      // Ignore quota errors
    }
  }, [purchaseCandidate]);

  // Derived deterministic summaries (instant reactivity across connected widgets)
  const closetSummary = useMemo(() => analyzeCloset(items), [items]);
  const purchasePrecheck = useMemo(
    () => computeDeterministicPurchasePrecheck(purchaseCandidate, items),
    [purchaseCandidate, items]
  );

  const selectedOutfit = useMemo(
    () => outfits.find((o) => o.id === selectedOutfitId) ?? null,
    [outfits, selectedOutfitId]
  );

  const illustrationSpec = useMemo<OutfitIllustrationSpec | null>(() => {
    if (!selectedOutfit) return null;
    return previewCache[selectedOutfit.id] ?? buildLocalIllustrationSpec(selectedOutfit);
  }, [selectedOutfit, previewCache]);

  // Widget 1 handlers
  const handleAddItem = (newItem: Omit<WardrobeItem, 'id'>) => {
    const id = `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    setItems((prev) => [{ id, ...newItem }, ...prev]);
    setDiagnosis(null);
    setPurchaseAdvice(null);
  };

  const handleUpdateItem = (id: string, patch: Partial<WardrobeItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    const affectedOutfitIds = outfits.filter((o) => o.itemIds.includes(id)).map((o) => o.id);
    if (affectedOutfitIds.length > 0) {
      setPreviewCache((prev) => {
        const next = { ...prev };
        affectedOutfitIds.forEach((oid) => delete next[oid]);
        return next;
      });
    }
    setOutfits((prev) =>
      prev.map((outfit) => {
        if (!outfit.itemIds.includes(id)) return outfit;
        const nextItems = outfit.items.map((item) =>
          item.id === id ? { ...item, ...patch } : item
        );
        return { ...outfit, items: nextItems };
      })
    );
    setDiagnosis(null);
    setPurchaseAdvice(null);
  };

  const handleImportItems = (imported: WardrobeItem[], mode: 'append' | 'replace') => {
    setItems((prev) => (mode === 'replace' ? imported : [...imported, ...prev]));
    setDiagnosis(null);
    setPurchaseAdvice(null);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const affectedOutfitIds = outfits.filter((o) => o.itemIds.includes(id)).map((o) => o.id);
    if (affectedOutfitIds.length > 0) {
      setPreviewCache((prev) => {
        const next = { ...prev };
        affectedOutfitIds.forEach((oid) => delete next[oid]);
        return next;
      });
    }
    setOutfits((prev) =>
      prev
        .map((outfit) => ({
          ...outfit,
          itemIds: outfit.itemIds.filter((itemId) => itemId !== id),
          items: outfit.items.filter((item) => item.id !== id),
        }))
        .filter((outfit) => outfit.items.length > 0)
    );
    setDiagnosis(null);
    setPurchaseAdvice(null);
  };

  const handleResetSample = () => {
    setItems(INITIAL_WARDROBE_ITEMS);
    setOutfits(INITIAL_SEED_OUTFITS);
    setSelectedOutfitId(INITIAL_SEED_OUTFITS[0]?.id ?? null);
    setPreviewCache({});
    setDiagnosis(null);
    setPreviewError(null);
  };

  const handleClearAll = () => {
    setItems([]);
    setOutfits([]);
    setSelectedOutfitId(null);
    setPreviewCache({});
    setDiagnosis(null);
  };

  // Widget 3 handler
  const handleRequestDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisError(null);
    try {
      const result = await requestClosetDiagnosis(items);
      setDiagnosis(result);
    } catch (err) {
      setDiagnosisError(err instanceof Error ? err.message : 'AI 진단 중 오류가 발생했습니다.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Widget 7 helper
  const handleSelectOutfitForPreview = async (
    outfit: OutfitRecommendation,
    forceRegenerate = false
  ) => {
    setSelectedOutfitId(outfit.id);
    setPreviewError(null);

    const alreadyHasPhoto = Boolean(previewCache[outfit.id]?.generatedImageUrl);
    if (!forceRegenerate && alreadyHasPhoto) return;

    setIsGeneratingPreview(true);
    try {
      const aiSpec = await requestOutfitPreview(outfit, items);
      setPreviewCache((prev) => ({ ...prev, [outfit.id]: aiSpec }));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '실사 코디 이미지 생성 실패');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Widget 4 handler
  const handleGenerateOutfits = async () => {
    setActiveSection('outfit');
    setIsRecommending(true);
    setRecommendError(null);
    try {
      const generated = await requestOutfitRecommendations(items, preferences);
      const tagged = generated.map((o) => ({ ...o, source: 'ai' as const }));
      setOutfits(tagged);
      setPreviewCache({});
      if (tagged.length > 0) {
        await handleSelectOutfitForPreview(tagged[0], true);
      } else {
        setSelectedOutfitId(null);
        setRecommendError(
          '보유 의류만으로 유효한 조합을 구성하지 못했습니다. 상의·하의 등을 추가로 등록해 주세요.'
        );
      }
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : '코디 추천 중 오류가 발생했습니다.');
    } finally {
      setIsRecommending(false);
    }
  };

  // Widget 6 handler
  const handleEvaluatePurchase = async () => {
    setIsEvaluatingPurchase(true);
    setPurchaseError(null);
    try {
      const result = await requestPurchaseAdvice(items, purchaseCandidate);
      setPurchaseAdvice(result);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : '구매 분석 중 오류가 발생했습니다.');
    } finally {
      setIsEvaluatingPurchase(false);
    }
  };

  // Widget 8 handler
  const handleSendChat = async (text: string, attachments?: ChatAttachmentSelection) => {
    const resolved = resolveChatAttachments({
      ownedItems: items,
      outfits,
      purchaseCandidate,
      selection: attachments,
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      attachedItemIds:
        resolved.attachedItems.length > 0
          ? resolved.attachedItems.map((i) => i.id)
          : undefined,
      attachedContextLabels:
        resolved.contextLabels.length > 0 ? resolved.contextLabels : undefined,
      timestamp: formatTimeNow(),
    };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setIsSendingChat(true);
    setChatError(null);

    try {
      const response = await requestAssistantReply({
        ownedItems: items,
        preferences,
        outfits,
        purchaseCandidate,
        history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        message: text,
        attachments,
      });

      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        citedItemIds: response.citedItemIds,
        timestamp: formatTimeNow(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '답변 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6F7] text-[#141619]">
      <TopHeader
        activeSection={activeSection}
        onSelectSection={(section) => {
          setActiveSection(section);
          window.scrollTo({ top: 0 });
        }}
        onQuickRecommend={handleGenerateOutfits}
        isRecommending={isRecommending}
      />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Editorial Studio Intro Strip */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#141619] tracking-tight">
              가진 옷을 가장 잘 입는 AI 개인 옷장 어시스턴트
            </h1>
            <p className="text-sm text-[#525866] mt-1.5 leading-relaxed">
              내 옷장에 등록된 의류만으로 코디를 조합하고, 새 옷 구매 전 중복 여부와 활용 가치를 냉정하게 점검합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1.5 text-xs text-[#525866] shrink-0">
            <span>
              보유 의류{' '}
              <strong className="font-mono tabular-nums text-[#141619]">{items.length}</strong>벌
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>
              현재 조건{' '}
              <strong className="text-[#141619]">
                {preferences.season} / {preferences.occasion}
              </strong>
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>
              추천 코디{' '}
              <strong className="font-mono tabular-nums text-[#141619]">{outfits.length}</strong>건
            </span>
          </div>
        </section>

        {/* Connected Workspace Views (8 Connected Widgets across 4 focused studio views) */}
        {activeSection === 'closet' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8">
              <ClosetManagerWidget
                items={items}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onImportItems={handleImportItems}
                onDeleteItem={handleDeleteItem}
                onResetSample={handleResetSample}
                onClearAll={handleClearAll}
              />
            </div>
            <div className="xl:col-span-4">
              <ClosetAnalyzerWidget
                summary={closetSummary}
                diagnosis={diagnosis}
                isLoading={isDiagnosing}
                error={diagnosisError}
                onRequestDiagnosis={handleRequestDiagnosis}
              />
            </div>
          </div>
        )}

        {activeSection === 'outfit' && (
          <div className="space-y-6">
            <StylePreferencesWidget
              preferences={preferences}
              ownedCount={items.length}
              isGenerating={isRecommending}
              onChange={setPreferences}
              onGenerateOutfits={handleGenerateOutfits}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7">
                <OutfitRecommenderWidget
                  outfits={outfits}
                  selectedOutfitId={selectedOutfitId}
                  generatedOutfitIds={Object.keys(previewCache).filter(
                    (id) => Boolean(previewCache[id]?.generatedImageUrl)
                  )}
                  isLoading={isRecommending}
                  error={recommendError}
                  ownedCount={items.length}
                  onSelectForPreview={(outfit) => handleSelectOutfitForPreview(outfit, false)}
                  onGenerateOutfits={handleGenerateOutfits}
                />
              </div>
              <div className="xl:col-span-5">
                <OutfitPreviewWidget
                  selectedOutfit={selectedOutfit}
                  illustrationSpec={illustrationSpec}
                  isLoading={isGeneratingPreview}
                  error={previewError}
                  onRefreshAiDirection={() => {
                    if (selectedOutfit) {
                      handleSelectOutfitForPreview(selectedOutfit, true);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'purchase' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-5">
              <PurchaseCandidateWidget
                candidate={purchaseCandidate}
                isEvaluating={isEvaluatingPurchase}
                onChange={(next) => {
                  setPurchaseCandidate(next);
                  setPurchaseAdvice(null);
                  setPurchaseError(null);
                }}
                onEvaluate={handleEvaluatePurchase}
              />
            </div>
            <div className="xl:col-span-7">
              <PurchaseAdvisorWidget
                candidate={purchaseCandidate}
                ownedItems={items}
                precheck={purchasePrecheck}
                advice={purchaseAdvice}
                isLoading={isEvaluatingPurchase}
                error={purchaseError}
              />
            </div>
          </div>
        )}

        {activeSection === 'assistant' && (
          <FashionAssistantWidget
            messages={chatMessages}
            ownedItems={items}
            preferences={preferences}
            outfits={outfits}
            purchaseCandidate={purchaseCandidate}
            isSending={isSendingChat}
            error={chatError}
            onSendMessage={handleSendChat}
            onClearChat={() => {
              setChatMessages([WELCOME_MESSAGE]);
              setChatError(null);
            }}
          />
        )}
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white mt-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6B7280]">
          <span>나만의 옷장 (My AI Closet) · 보유 의류 재활용 중심 개인 스타일링 워크스페이스</span>
          <span>보유 목록에 없는 의류는 생성하지 않으며, 모든 추천에는 가정과 불확실성이 함께 안내됩니다.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
