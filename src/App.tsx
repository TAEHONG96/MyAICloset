import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
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
import { WardrobeHome } from './components/WardrobeHome';
import { GarmentDetail } from './components/GarmentDetail';
import { GarmentEditor } from './components/GarmentEditor';
import { Modal } from './components/Modal';

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
    '안녕하세요. 오늘은 어떤 옷을 입고 싶으세요? 입을 옷이나 장소를 알려주면 내 옷장에서 어울리는 조합을 찾아드릴게요.',
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
    if (typeof item.imageUrl === 'string') return item;
    const starterImg = sampleImageById.get(item.id);
    return starterImg ? { ...item, imageUrl: starterImg } : item;
  });
}

export function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('home');
  const mainRef = useRef<HTMLElement>(null);
  const navigateFocus = useRef(false);
  const [detailId, setDetailId] = useState<string>();
  const [editor, setEditor] = useState<'new' | WardrobeItem>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<{ message: string; itemId?: string }>();
  const [storageError, setStorageError] = useState(false);

  function navigate(section: WorkspaceSection) {
    setNotice(undefined);
    if (section === activeSection) {
      mainRef.current?.focus({ preventScroll: true });
    } else {
      navigateFocus.current = true;
      setActiveSection(section);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  useEffect(() => {
    if (navigateFocus.current) {
      navigateFocus.current = false;
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [activeSection]);

  useEffect(() => {
    if (!notice || notice.itemId) return;
    const timer = window.setTimeout(() => setNotice(undefined), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewVersion = useRef(0);

  // Widget 6: Purchase Advisor
  const [purchaseAdvice, setPurchaseAdvice] = useState<PurchaseAdvice | null>(null);
  const [isEvaluatingPurchase, setIsEvaluatingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const purchaseContext = useRef({ purchaseCandidate, items });
  purchaseContext.current = { purchaseCandidate, items };

  // Widget 8: Fashion Assistant Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedChat, setFailedChat] = useState<{ text: string; attachments?: ChatAttachmentSelection }>();

  // Persist user data
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
      setStorageError(false);
    } catch {
      setStorageError(true);
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

  const currentOutfits = useMemo(() => filterOutfitsByOwned(outfits, items), [outfits, items]);
  const selectedOutfit = currentOutfits.find((outfit) => outfit.id === selectedOutfitId) ?? null;
  const detailItem = items.find((item) => item.id === detailId);

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
    return id;
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
    if (mode === 'replace') {
      setOutfits([]);
      setSelectedOutfitId(null);
      setPreviewCache({});
    }
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
    setPurchaseAdvice(null);
    setPurchaseError(null);
  };

  const handleClearAll = () => {
    setItems([]);
    setOutfits([]);
    setSelectedOutfitId(null);
    setPreviewCache({});
    setDiagnosis(null);
    setPurchaseAdvice(null);
    setPurchaseError(null);
  };

  // Widget 3 handler
  const handleRequestDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisError(null);
    try {
      const result = await requestClosetDiagnosis(items);
      if (purchaseContext.current.items === items) setDiagnosis(result);
    } catch (err) {
      if (purchaseContext.current.items === items) {
        setDiagnosisError(err instanceof Error ? err.message : 'AI 진단 중 오류가 발생했습니다.');
      }
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
    setPreviewOpen(true);
    setPreviewError(null);
    const version = ++previewVersion.current;

    const alreadyHasPhoto = Boolean(previewCache[outfit.id]?.generatedImageUrl);
    if (!forceRegenerate && alreadyHasPhoto) {
      setIsGeneratingPreview(false);
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const aiSpec = await requestOutfitPreview(outfit, items);
      if (version === previewVersion.current) {
        if (!aiSpec.generatedImageUrl) throw new Error('착장 이미지가 반환되지 않았습니다. 다시 시도해 주세요.');
        setPreviewCache((prev) => ({ ...prev, [outfit.id]: aiSpec }));
      }
    } catch (err) {
      if (version === previewVersion.current) setPreviewError(err instanceof Error ? err.message : '실사 코디 이미지 생성 실패');
    } finally {
      if (version === previewVersion.current) setIsGeneratingPreview(false);
    }
  };

  // Widget 4 handler
  const handleGenerateOutfits = async () => {
    setIsRecommending(true);
    setRecommendError(null);
    try {
      const generated = await requestOutfitRecommendations(items, preferences);
      const tagged = generated.map((o) => ({ ...o, source: 'ai' as const }));
      setOutfits(tagged);
      setPreviewCache({});
      setSelectedOutfitId(tagged[0]?.id ?? null);
      if (tagged.length === 0) {
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
    if (window.matchMedia('(max-width: 1023px)').matches) {
      document.getElementById('purchase-comparison')?.scrollIntoView({ block: 'start' });
      document.getElementById('purchase-results-heading')?.focus({ preventScroll: true });
    }
    try {
      const result = await requestPurchaseAdvice(items, purchaseCandidate);
      if (purchaseContext.current.purchaseCandidate === purchaseCandidate && purchaseContext.current.items === items) {
        setPurchaseAdvice(result);
      }
    } catch (err) {
      if (purchaseContext.current.purchaseCandidate === purchaseCandidate && purchaseContext.current.items === items) {
        setPurchaseError(err instanceof Error ? err.message : '구매 분석 중 오류가 발생했습니다.');
      }
    } finally {
      setIsEvaluatingPurchase(false);
    }
  };

  // Widget 8 handler
  const handleSendChat = async (text: string, attachments?: ChatAttachmentSelection, retry = false) => {
    if (isSendingChat) return;
    const resolved = resolveChatAttachments({
      ownedItems: items,
      outfits: currentOutfits,
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
    const history = retry ? chatMessages.slice(0, -1) : chatMessages;
    if (!retry) setChatMessages([...history, userMsg]);
    setIsSendingChat(true);
    setChatError(null);
    setFailedChat(undefined);

    try {
      const response = await requestAssistantReply({
        ownedItems: items,
        preferences,
        outfits: currentOutfits,
        purchaseCandidate,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        message: text,
        attachments,
      });

      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        citedItemIds: response.citedItemIds,
        representativeOutfit: response.representativeOutfit,
        timestamp: formatTimeNow(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '답변 생성 중 오류가 발생했습니다.');
      setFailedChat({ text, attachments });
    } finally {
      setIsSendingChat(false);
    }
  };


  const closeDetail = () => {
    setDetailId(undefined);
    setConfirmDelete(false);
  };
  const openItem = (item: WardrobeItem) => setDetailId(item.id);
  const openRegistration = () => setEditor('new');

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link action action-primary">본문으로 건너뛰기</a>
      <TopHeader activeSection={activeSection} onSelectSection={navigate} onAdd={openRegistration} />

      <main id="main-content" ref={mainRef} tabIndex={-1} className="site-main site-width">
        {storageError && <p role="alert" className="form-status mb-4">브라우저 저장 공간을 사용할 수 없어 현재 옷장 변경사항을 저장하지 못했습니다.</p>}

        {activeSection === 'home' && (
          <WardrobeHome items={items} latestOutfit={currentOutfits.find((outfit) => outfit.source === 'ai')}
            onNavigate={navigate} onAdd={openRegistration} onOpenItem={openItem} />
        )}

        {activeSection === 'closet' && (
          <ClosetManagerWidget
            items={items}
            onAdd={openRegistration}
            onOpenItem={openItem}
            onImportItems={handleImportItems}
            onResetSample={handleResetSample}
            onClearAll={handleClearAll}
            analysis={<ClosetAnalyzerWidget summary={closetSummary} diagnosis={diagnosis}
              isLoading={isDiagnosing} error={diagnosisError} onRequestDiagnosis={handleRequestDiagnosis} />}
          />
        )}

        {activeSection === 'outfit' && (
          <div className="space-y-7">
            <PageIntro title="오늘의 코디" label="THE LOOKBOOK" description="입을 상황을 정하면 내 옷장에서 어울리는 조합을 찾아드려요." />
            <StylePreferencesWidget preferences={preferences} ownedCount={items.length} isGenerating={isRecommending}
              onChange={setPreferences} onGenerateOutfits={handleGenerateOutfits} />
            <OutfitRecommenderWidget
              outfits={currentOutfits}
              generatedOutfitIds={Object.keys(previewCache).filter((id) => Boolean(previewCache[id]?.generatedImageUrl))}
              isLoading={isRecommending}
              error={recommendError}
              ownedCount={items.length}
              onOpenItem={openItem}
              onSelectForPreview={(outfit) => void handleSelectOutfitForPreview(outfit)}
              onGenerateOutfits={handleGenerateOutfits}
              onAdd={openRegistration}
            />
          </div>
        )}

        {activeSection === 'purchase' && (
          <>
            <PageIntro title="구매 전 분석" label="SHOPPING ADVISOR" description="마음에 든 옷과 내 옷장을 비교해 활용도와 유사한 옷을 살펴보세요." />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 min-w-0">
                <PurchaseCandidateWidget candidate={purchaseCandidate} isEvaluating={isEvaluatingPurchase}
                  onChange={(next) => {
                    setPurchaseCandidate(next);
                    setPurchaseAdvice(null);
                    setPurchaseError(null);
                  }}
                  onEvaluate={handleEvaluatePurchase} />
              </div>
              <div className="lg:col-span-7 min-w-0">
                <PurchaseAdvisorWidget candidate={purchaseCandidate} ownedItems={items} precheck={purchasePrecheck}
                  advice={purchaseAdvice} isLoading={isEvaluatingPurchase} error={purchaseError} onOpenItem={openItem} />
              </div>
            </div>
          </>
        )}

        {activeSection === 'assistant' && (
          <>
            <PageIntro title="AI 스타일 어시스턴트" label="STYLE CONSULTATION" description="옷이나 코디를 첨부해서 내 옷장을 바탕으로 스타일을 상담해 보세요." />
            <FashionAssistantWidget
              messages={chatMessages}
              ownedItems={items}
              preferences={preferences}
              outfits={currentOutfits}
              purchaseCandidate={purchaseCandidate}
              isSending={isSendingChat}
              error={chatError}
              onOpenItem={openItem}
              onSendMessage={handleSendChat}
              onRetry={failedChat ? () => void handleSendChat(failedChat.text, failedChat.attachments, true) : undefined}
              onClearChat={() => {
                setChatMessages([WELCOME_MESSAGE]);
                setChatError(null);
                setFailedChat(undefined);
              }}
            />
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="site-width footer-inner">
          <strong>My AI Closet</strong>
          <span>나만의 옷장 · AI 개인 스타일링</span>
        </div>
      </footer>

      {previewOpen && selectedOutfit && (
        <Modal title="AI 착장 미리보기" onClose={() => setPreviewOpen(false)} className="preview-modal">
          <OutfitPreviewWidget selectedOutfit={selectedOutfit} illustrationSpec={illustrationSpec}
            isLoading={isGeneratingPreview} error={previewError}
            onRefreshAiDirection={() => void handleSelectOutfitForPreview(selectedOutfit, true)} />
        </Modal>
      )}

      {detailItem && !confirmDelete && (
        <GarmentDetail
          item={detailItem}
          onClose={closeDetail}
          onEdit={() => {
            closeDetail();
            setEditor(detailItem);
          }}
          onDelete={() => setConfirmDelete(true)}
        />
      )}
      {detailItem && confirmDelete && (
        <Modal title="의류를 삭제할까요?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm leading-relaxed">{detailItem.name}의 사진과 정보가 옷장에서 삭제됩니다.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="action action-outline" onClick={() => setConfirmDelete(false)}>취소</button>
            <button type="button" className="action action-primary" onClick={() => {
              handleDeleteItem(detailItem.id);
              closeDetail();
              setNotice({ message: '의류를 삭제했어요.' });
            }}>삭제</button>
          </div>
        </Modal>
      )}
      {editor && (
        <GarmentEditor item={editor === 'new' ? undefined : editor} onClose={() => setEditor(undefined)}
          onSave={(item) => {
            if (editor === 'new') {
              const itemId = handleAddItem(item);
              setNotice({ message: '옷장에 새 의류를 등록했어요.', itemId });
            } else {
              handleUpdateItem(editor.id, item);
              setNotice({ message: '의류 정보를 저장했어요.' });
            }
            setEditor(undefined);
          }}
        />
      )}
      <div className="status-toast" role="status">
        {notice && <>
          <Check size={16} aria-hidden="true" />
          <span>{notice.message}</span>
          {notice.itemId && <button type="button" className="text-action" onClick={() => {
            setDetailId(notice.itemId);
          }}>의류 보기</button>}
          <button type="button" className="icon-button" aria-label="알림 닫기" onClick={() => setNotice(undefined)}><X size={16} aria-hidden="true" /></button>
        </>}
      </div>
    </div>
  );
}

function PageIntro({ title, label, description }: { title: string; label: string; description: string }) {
  return (
    <header className="page-intro">
      <div>
        <p className="editorial-label">{label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

export default App;
