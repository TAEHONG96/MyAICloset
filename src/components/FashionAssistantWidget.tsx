import React, { useMemo, useRef, useState } from 'react';
import { Check, Paperclip, Plus, Search, Send, X } from 'lucide-react';
import {
  CLOTHING_CATEGORIES,
  type ChatAttachmentSelection,
  type ChatMessage,
  type ClothingCategory,
  type OutfitRecommendation,
  type PurchaseCandidate,
  type StylePreferences,
  type WardrobeItem,
} from '../types/wardrobe';
import { QUICK_CHAT_PROMPTS } from '../data/sampleCloset';
import { formatVisualMetadataSummary, resolveKoreanColorHex } from '../lib/wardrobeLogic';

interface FashionAssistantWidgetProps {
  messages: ChatMessage[];
  ownedItems: WardrobeItem[];
  preferences: StylePreferences;
  outfits: OutfitRecommendation[];
  purchaseCandidate: PurchaseCandidate;
  isSending: boolean;
  error: string | null;
  onSendMessage: (text: string, attachments?: ChatAttachmentSelection) => void;
  onClearChat: () => void;
}

const EMPTY_ATTACHMENTS: ChatAttachmentSelection = {
  itemIds: [],
  outfitIds: [],
  includeClosetSummary: false,
  includePurchaseCandidate: false,
};

export const FashionAssistantWidget: React.FC<FashionAssistantWidgetProps> = ({
  messages,
  ownedItems,
  preferences,
  outfits,
  purchaseCandidate,
  isSending,
  error,
  onSendMessage,
  onClearChat,
}) => {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<'전체' | ClothingCategory>('전체');
  const [pickerSearch, setPickerSearch] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachmentSelection>(EMPTY_ATTACHMENTS);
  const listRef = useRef<HTMLDivElement | null>(null);

  const ownedMap = useMemo(
    () => new Map(ownedItems.map((i) => [i.id, i])),
    [ownedItems]
  );

  const outfitMap = useMemo(
    () => new Map(outfits.map((o) => [o.id, o])),
    [outfits]
  );

  // Filter out any deleted items or outdated outfits from current draft selection
  const activeItemIds = useMemo(
    () => attachments.itemIds.filter((id) => ownedMap.has(id)),
    [attachments.itemIds, ownedMap]
  );
  const activeOutfitIds = useMemo(
    () => attachments.outfitIds.filter((id) => outfitMap.has(id)),
    [attachments.outfitIds, outfitMap]
  );

  const attachedItems = useMemo(
    () =>
      activeItemIds
        .map((id) => ownedMap.get(id))
        .filter((i): i is WardrobeItem => Boolean(i)),
    [activeItemIds, ownedMap]
  );

  const totalAttachmentCount =
    activeItemIds.length +
    activeOutfitIds.length +
    (attachments.includeClosetSummary ? 1 : 0) +
    (attachments.includePurchaseCandidate && purchaseCandidate.name.trim() ? 1 : 0);

  const filteredPickerItems = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return ownedItems.filter((item) => {
      if (pickerCategory !== '전체' && item.category !== pickerCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.visualMeta?.material ?? '').toLowerCase().includes(q)
      );
    });
  }, [ownedItems, pickerCategory, pickerSearch]);

  const toggleItemAttachment = (id: string) => {
    setAttachments((prev) => {
      const exists = prev.itemIds.includes(id);
      return {
        ...prev,
        itemIds: exists ? prev.itemIds.filter((x) => x !== id) : [...prev.itemIds, id],
      };
    });
  };

  const toggleOutfitAttachment = (id: string) => {
    setAttachments((prev) => {
      const exists = prev.outfitIds.includes(id);
      return {
        ...prev,
        outfitIds: exists ? prev.outfitIds.filter((x) => x !== id) : [...prev.outfitIds, id],
      };
    });
  };

  const buildCurrentSelection = (): ChatAttachmentSelection | undefined => {
    const clean: ChatAttachmentSelection = {
      itemIds: activeItemIds,
      outfitIds: activeOutfitIds,
      includeClosetSummary: attachments.includeClosetSummary,
      includePurchaseCandidate:
        attachments.includePurchaseCandidate && Boolean(purchaseCandidate.name.trim()),
    };
    const count =
      clean.itemIds.length +
      clean.outfitIds.length +
      (clean.includeClosetSummary ? 1 : 0) +
      (clean.includePurchaseCandidate ? 1 : 0);
    return count > 0 ? clean : undefined;
  };

  const dispatchMessage = (text: string) => {
    const payload = buildCurrentSelection();
    onSendMessage(text, payload);
    setAttachments(EMPTY_ATTACHMENTS);
    setIsPickerOpen(false);
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setInputError('질문 내용을 입력해 주세요.');
      return;
    }
    setInputError(null);
    const messageText = input.trim();
    setInput('');
    dispatchMessage(messageText);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Chat Panel */}
      <section
        aria-labelledby="widget-fashion-assistant-heading"
        className="lg:col-span-8 bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 flex flex-col"
      >
        <div className="flex items-end justify-between gap-3 pb-4 border-b border-[#ECEDF0]">
          <div>
            <p className="text-xs font-medium text-[#525866] mb-1">08. 패션 어시스턴트</p>
            <h2
              id="widget-fashion-assistant-heading"
              className="text-xl font-semibold text-[#141619]"
            >
              내 옷장 기반 스타일 상담 챗봇
            </h2>
            <p className="text-xs text-[#525866] mt-1">
              현재 등록된 {ownedItems.length}벌의 보유 의류를 기본 참조하며, 특정 옷이나 코디 데이터를 직접 첨부해 질문할 수 있습니다.
            </p>
          </div>

          {messages.length > 1 && (
            <button
              type="button"
              onClick={onClearChat}
              className="text-xs text-[#525866] hover:text-[#141619] whitespace-nowrap shrink-0 cursor-pointer"
            >
              대화 초기화
            </button>
          )}
        </div>

        {/* Message List */}
        <div
          ref={listRef}
          aria-live="polite"
          className="py-5 space-y-5 min-h-[340px] max-h-[520px] overflow-y-auto"
        >
          {messages.map((msg) => {
            const citedItems = (msg.citedItemIds ?? [])
              .map((id) => ownedMap.get(id))
              .filter((i): i is WardrobeItem => Boolean(i));
            const msgAttachedItems = (msg.attachedItemIds ?? [])
              .map((id) => ownedMap.get(id))
              .filter((i): i is WardrobeItem => Boolean(i));
            const msgContextLabels = msg.attachedContextLabels ?? [];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="text-[11px] text-[#6B7280] mb-1">
                  {msg.role === 'user' ? '나' : '나만의 옷장 어시스턴트'} ·{' '}
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                </div>

                {/* User-attached Closet Data Preview inside message history */}
                {msg.role === 'user' &&
                  (msgAttachedItems.length > 0 || msgContextLabels.length > 0) && (
                    <div className="mb-1.5 max-w-[90%] flex flex-wrap justify-end gap-1.5">
                      {msgAttachedItems.map((item) => (
                        <div
                          key={item.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#F5F6F7] border border-[#D8DCE2] rounded-lg text-[11px] text-[#141619]"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-5 h-6 object-cover rounded shrink-0 bg-white"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="w-2.5 h-2.5 rounded-xs border border-black/15 shrink-0"
                              style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                            />
                          )}
                          <span className="font-medium truncate max-w-[150px]">{item.name}</span>
                          <span className="text-[#6B7280]">{item.color}</span>
                        </div>
                      ))}
                      {msgContextLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center px-2 py-1 bg-[#F5F6F7] border border-[#D8DCE2] rounded-lg text-[11px] font-medium text-[#1F3A5F]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                <div
                  className={`max-w-[90%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#1F3A5F] text-white'
                      : 'bg-[#F5F6F7] text-[#141619] border border-[#E5E7EB]'
                  }`}
                >
                  {msg.content}
                </div>
                {citedItems.length > 0 && (
                  <div className="mt-1.5 text-[11px] text-[#525866] max-w-[90%]">
                    <span className="font-semibold text-[#141619]">참조한 보유 의류:</span>{' '}
                    {citedItems.map((item) => `${item.name}(${item.color})`).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex flex-col items-start">
              <div className="text-[11px] text-[#6B7280] mb-1">나만의 옷장 어시스턴트</div>
              <div className="bg-[#F5F6F7] border border-[#E5E7EB] rounded-lg px-4 py-3 text-xs text-[#525866] animate-pulse">
                첨부된 옷장 데이터와 보유 의류 목록을 확인하며 답변을 정리하고 있습니다...
              </div>
            </div>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="pt-3 pb-4 border-t border-[#ECEDF0] space-y-2">
          <span className="block text-[11px] font-medium text-[#525866]">추천 질문</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_CHAT_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isSending}
                onClick={() => {
                  setInputError(null);
                  dispatchMessage(q);
                }}
                className="text-left px-3 py-1.5 text-xs text-[#374151] border border-[#D8DCE2] hover:border-[#1F3A5F] hover:text-[#1F3A5F] disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Closet Data Attachment Picker */}
        {isPickerOpen && (
          <div
            id="closet-attachment-picker"
            className="mb-3 p-4 bg-[#FAFBFB] border border-[#D8DCE2] rounded-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#ECEDF0]">
              <div>
                <h3 className="text-xs font-semibold text-[#141619]">
                  내 옷장 데이터 첨부 ({totalAttachmentCount}건 선택됨)
                </h3>
                <p className="text-[11px] text-[#525866] mt-0.5">
                  특정 의류(사진·메타데이터 포함)나 옷장 요약·코디·구매 후보를 질문에 직접 첨부하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                aria-label="옷장 첨부 패널 닫기"
                className="p-1 text-[#525866] hover:text-[#141619] rounded cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Context Data Blocks */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#141619]">옷장 요약 · 코디 · 구매 후보</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => ({
                      ...prev,
                      includeClosetSummary: !prev.includeClosetSummary,
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                    attachments.includeClosetSummary
                      ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                      : 'bg-white text-[#374151] border-[#D8DCE2] hover:border-[#1F3A5F]'
                  }`}
                >
                  {attachments.includeClosetSummary && <Check className="w-3 h-3" aria-hidden="true" />}
                  옷장 전체 요약 ({ownedItems.length}벌)
                </button>

                {purchaseCandidate.name.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => ({
                        ...prev,
                        includePurchaseCandidate: !prev.includePurchaseCandidate,
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                      attachments.includePurchaseCandidate
                        ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                        : 'bg-white text-[#374151] border-[#D8DCE2] hover:border-[#1F3A5F]'
                    }`}
                  >
                    {attachments.includePurchaseCandidate && (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    )}
                    구매 후보: {purchaseCandidate.name}
                  </button>
                )}

                {outfits.map((outfit) => {
                  const selected = activeOutfitIds.includes(outfit.id);
                  return (
                    <button
                      key={outfit.id}
                      type="button"
                      onClick={() => toggleOutfitAttachment(outfit.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                          : 'bg-white text-[#374151] border-[#D8DCE2] hover:border-[#1F3A5F]'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" aria-hidden="true" />}
                      코디: {outfit.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual Owned Garment Picker */}
            <div className="space-y-2.5 pt-2 border-t border-[#ECEDF0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-[#141619]">
                  보유 의류 선택 ({activeItemIds.length}벌 선택됨)
                </p>
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <label htmlFor="chat-attachment-search" className="sr-only">
                    첨부할 보유 의류 검색
                  </label>
                  <input
                    id="chat-attachment-search"
                    type="search"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="의류 이름·색상·소재 검색"
                    className="pl-8 pr-2.5 py-1 text-xs border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none w-full sm:w-52"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['전체', ...CLOTHING_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPickerCategory(cat)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                      pickerCategory === cat
                        ? 'bg-[#141619] text-white border-[#141619]'
                        : 'bg-white text-[#525866] border-[#E5E7EB] hover:text-[#141619]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {filteredPickerItems.length === 0 ? (
                <p className="text-xs text-[#6B7280] py-4 text-center">
                  조건에 맞는 보유 의류가 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredPickerItems.map((item) => {
                    const selected = activeItemIds.includes(item.id);
                    const meta = formatVisualMetadataSummary(item.visualMeta);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItemAttachment(item.id)}
                        aria-pressed={selected}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#F0F4F8] border-[#1F3A5F]'
                            : 'bg-white border-[#E5E7EB] hover:border-[#9CA3AF]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-11 object-cover rounded border border-[#E5E7EB] shrink-0 bg-white"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="w-4 h-4 rounded-xs border border-black/15 shrink-0"
                              style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#141619] truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-[#525866] truncate">
                              {item.category} · {item.color} · {item.fit}
                            </p>
                            {meta && (
                              <p className="text-[10px] text-[#1F3A5F] truncate">{meta}</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded border shrink-0 ${
                            selected
                              ? 'bg-[#1F3A5F] border-[#1F3A5F] text-white'
                              : 'border-[#D1D5DB] text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Attachments Draft Strip */}
        {totalAttachmentCount > 0 && (
          <div
            aria-label="전송할 첨부 옷장 데이터"
            className="mb-2.5 p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[#1F3A5F]">
                이번 질문에 첨부된 옷장 데이터 ({totalAttachmentCount}건)
              </span>
              <button
                type="button"
                onClick={() => setAttachments(EMPTY_ATTACHMENTS)}
                className="text-[#525866] hover:text-[#141619] cursor-pointer"
              >
                첨부 비우기
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attachedItems.map((item) => (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-[#D8DCE2] rounded-lg text-xs text-[#141619]"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-4 h-5 object-cover rounded shrink-0"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-xs border border-black/15 shrink-0"
                      style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                    />
                  )}
                  <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleItemAttachment(item.id)}
                    aria-label={`'${item.name}' 첨부 해제`}
                    className="text-[#6B7280] hover:text-[#141619] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}

              {attachments.includeClosetSummary && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-[#D8DCE2] rounded-lg text-xs text-[#1F3A5F] font-medium">
                  <span>옷장 전체 요약 ({ownedItems.length}벌)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => ({ ...prev, includeClosetSummary: false }))
                    }
                    aria-label="옷장 전체 요약 첨부 해제"
                    className="text-[#6B7280] hover:text-[#141619] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              {attachments.includePurchaseCandidate && purchaseCandidate.name.trim() && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-[#D8DCE2] rounded-lg text-xs text-[#1F3A5F] font-medium">
                  <span>구매 후보: {purchaseCandidate.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => ({ ...prev, includePurchaseCandidate: false }))
                    }
                    aria-label="구매 후보 첨부 해제"
                    className="text-[#6B7280] hover:text-[#141619] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              {activeOutfitIds.map((outfitId) => {
                const outfit = outfitMap.get(outfitId);
                if (!outfit) return null;
                return (
                  <div
                    key={outfit.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-[#D8DCE2] rounded-lg text-xs text-[#1F3A5F] font-medium"
                  >
                    <span>코디: {outfit.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleOutfitAttachment(outfit.id)}
                      aria-label={`'${outfit.title}' 코디 첨부 해제`}
                      className="text-[#6B7280] hover:text-[#141619] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-[#B91C1C] pb-2">
            상담 오류: {error}
          </p>
        )}
        {inputError && (
          <p role="alert" className="text-xs text-[#B91C1C] pb-2">
            {inputError}
          </p>
        )}

        {/* Composer */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setIsPickerOpen((prev) => !prev)}
              aria-expanded={isPickerOpen}
              aria-controls="closet-attachment-picker"
              disabled={isSending}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isPickerOpen || totalAttachmentCount > 0
                  ? 'border-[#1F3A5F] text-[#1F3A5F] bg-[#F0F4F8]'
                  : 'border-[#D8DCE2] text-[#374151] bg-white hover:border-[#1F3A5F]'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
              내 옷장 첨부{totalAttachmentCount > 0 ? ` (${totalAttachmentCount})` : ''}
            </button>

            <label htmlFor="assistant-chat-input" className="sr-only">
              패션 어시스턴트에게 질문 입력
            </label>
            <input
              id="assistant-chat-input"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              disabled={isSending}
              placeholder="예: 첨부한 옷 두 벌로 출근룩 조합이 어울릴까요?"
              className="flex-1 min-w-0 px-3.5 py-2.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSending}
            aria-label="질문 보내기"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            전송
          </button>
        </form>
      </section>

      {/* Connected Wardrobe Context Sidebar */}
      <aside
        aria-label="연동된 옷장 데이터 요약"
        className="lg:col-span-4 bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-5"
      >
        <div className="pb-3 border-b border-[#ECEDF0] flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#141619]">어시스턴트 연동 컨텍스트</h3>
            <p className="text-xs text-[#525866] mt-0.5">
              항목을 눌러 질문에 바로 첨부할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setAttachments((prev) => ({
                ...prev,
                includeClosetSummary: !prev.includeClosetSummary,
              }))
            }
            className={`px-2 py-1 text-[11px] font-medium rounded border shrink-0 cursor-pointer ${
              attachments.includeClosetSummary
                ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                : 'border-[#D8DCE2] text-[#1F3A5F] hover:bg-[#F5F6F7]'
            }`}
          >
            {attachments.includeClosetSummary ? '요약 첨부됨' : '+ 요약 첨부'}
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <h4 className="font-semibold text-[#141619]">현재 스타일 선호도</h4>
          <p className="text-[#525866] leading-relaxed">
            {preferences.occasion} · {preferences.season} · {preferences.preferredStyle}
          </p>
        </div>

        <div className="pt-3 border-t border-[#ECEDF0] space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[#141619]">검토 중인 구매 후보</h4>
            {purchaseCandidate.name.trim() && (
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => ({
                    ...prev,
                    includePurchaseCandidate: !prev.includePurchaseCandidate,
                  }))
                }
                className={`px-2 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                  attachments.includePurchaseCandidate
                    ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                    : 'border-[#D8DCE2] text-[#525866] hover:text-[#141619]'
                }`}
              >
                {attachments.includePurchaseCandidate ? '첨부됨' : '+ 첨부'}
              </button>
            )}
          </div>
          <p className="text-[#525866]">
            {purchaseCandidate.name
              ? `${purchaseCandidate.name} (${purchaseCandidate.category} · ${purchaseCandidate.color})`
              : '입력된 구매 후보 없음'}
          </p>
        </div>

        <div className="pt-3 border-t border-[#ECEDF0] space-y-2 text-xs">
          <h4 className="font-semibold text-[#141619]">
            생성된 추천 코디 ({outfits.length}건)
          </h4>
          {outfits.length === 0 ? (
            <p className="text-[#6B7280]">아직 생성된 코디가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5 text-[#525866]">
              {outfits.map((o, idx) => {
                const selected = activeOutfitIds.includes(o.id);
                return (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      0{idx + 1}. {o.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleOutfitAttachment(o.id)}
                      aria-label={`'${o.title}' 코디 ${selected ? '첨부 해제' : '질문에 첨부'}`}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded border shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                          : 'border-[#D8DCE2] text-[#525866] hover:text-[#141619]'
                      }`}
                    >
                      {selected ? '첨부됨' : '+ 첨부'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pt-3 border-t border-[#ECEDF0] space-y-2 text-xs">
          <h4 className="font-semibold text-[#141619]">
            보유 의류 목록 ({ownedItems.length}벌)
          </h4>
          {ownedItems.length === 0 ? (
            <p className="text-[#6B7280]">등록된 의류가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {ownedItems.map((item) => {
                const selected = activeItemIds.includes(item.id);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-[#374151]">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-5 h-6 object-cover rounded border border-[#E5E7EB] shrink-0 bg-white"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-xs border border-black/15 shrink-0"
                          style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                        />
                      )}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleItemAttachment(item.id)}
                      aria-label={`'${item.name}' ${selected ? '첨부 해제' : '질문에 첨부'}`}
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-medium rounded border shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                          : 'border-[#D8DCE2] text-[#525866] hover:text-[#141619]'
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check className="w-3 h-3" aria-hidden="true" />
                          첨부됨
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" aria-hidden="true" />
                          첨부
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};
