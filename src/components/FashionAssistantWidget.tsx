import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Paperclip, Send } from 'lucide-react';
import { QUICK_CHAT_PROMPTS } from '../data/sampleCloset';
import {
  CLOTHING_CATEGORIES,
  type ChatAttachmentSelection, type ChatMessage, type OutfitRecommendation,
  type PurchaseCandidate, type StylePreferences, type WardrobeItem,
} from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';
import { ItemStrip } from './ItemStrip';
import { Modal } from './Modal';

interface FashionAssistantWidgetProps {
  messages: ChatMessage[];
  ownedItems: WardrobeItem[];
  preferences: StylePreferences;
  outfits: OutfitRecommendation[];
  purchaseCandidate: PurchaseCandidate;
  isSending: boolean;
  error: string | null;
  onOpenItem: (item: WardrobeItem) => void;
  onSendMessage: (text: string, attachments?: ChatAttachmentSelection) => void;
  onRetry?: () => void;
  onClearChat: () => void;
}

const EMPTY_ATTACHMENTS: ChatAttachmentSelection = {
  itemIds: [], outfitIds: [], includeClosetSummary: false, includePurchaseCandidate: false,
};

export function FashionAssistantWidget({
  messages, ownedItems, preferences, outfits, purchaseCandidate, isSending, error, onOpenItem, onSendMessage, onRetry, onClearChat,
}: FashionAssistantWidgetProps) {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState(EMPTY_ATTACHMENTS);
  const log = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const itemsById = new Map(ownedItems.map((item) => [item.id, item]));
  const outfitsById = new Map(outfits.map((outfit) => [outfit.id, outfit]));
  const resolveItems = (ids?: string[]) => (ids ?? []).flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
  const selection = {
    ...attachments,
    itemIds: attachments.itemIds.filter((id) => itemsById.has(id)),
    outfitIds: attachments.outfitIds.filter((id) => outfitsById.has(id)),
    includePurchaseCandidate: attachments.includePurchaseCandidate && Boolean(purchaseCandidate.name.trim()),
  };
  const attachmentLabels = [
    ...resolveItems(selection.itemIds).map((item) => item.name),
    ...selection.outfitIds.map((id) => outfitsById.get(id)?.title),
    ...(selection.includeClosetSummary ? ['옷장 요약'] : []),
    ...(selection.includePurchaseCandidate ? [purchaseCandidate.name] : []),
  ];

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, isSending]);

  function send(message: string) {
    if (!message.trim() || isSending) return;
    onSendMessage(message.trim(), attachmentLabels.length ? selection : undefined);
    setInput('');
    setAttachments(EMPTY_ATTACHMENTS);
  }

  return (
    <div className="assistant-layout">
      <section className="assistant-chat" aria-labelledby="chat-heading">
        <div className="chat-heading">
          <h2 id="chat-heading" className="text-lg font-semibold">스타일 상담</h2>
          {messages.length > 1 && <button type="button" className="text-action disabled:opacity-50" onClick={onClearChat} disabled={isSending}>대화 초기화</button>}
        </div>
        <div className="chat-log" ref={log} role="log" aria-label="상담 메시지" tabIndex={0}>
          {messages.map((message) => {
            const user = message.role === 'user';
            const representative = message.representativeOutfit;
            const outfitItems = resolveItems(representative?.itemIds);
            const citedItems = resolveItems(message.citedItemIds).filter((item) => !outfitItems.some((outfitItem) => outfitItem.id === item.id));
            const attached = [...resolveItems(message.attachedItemIds).map((item) => item.name), ...(message.attachedContextLabels ?? [])];
            return (
              <article className={`chat-message ${user ? 'user-message' : 'assistant-message'}`} key={message.id}>
                <header className="flex flex-wrap items-baseline gap-x-3 text-xs font-semibold">
                  <span>{user ? '나' : '스타일 어시스턴트'}</span>
                  <time className="font-normal opacity-90">{message.timestamp}</time>
                </header>
                {attached.length > 0 && <p className="mt-1 text-xs leading-relaxed">첨부 · {attached.join(' · ')}</p>}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                {representative && (
                  <div className="mt-4 space-y-3 border-t border-line pt-3">
                    <h3 className="font-semibold">{representative.title}</h3>
                    {representative.imageUrl && <figure className="max-w-[250px]">
                      <GarmentImage src={representative.imageUrl} alt={`${representative.title} 착장`} className="generated-look" />
                      <figcaption className="mt-1 text-xs font-medium text-olive-deep">AI가 생성한 착장 이미지</figcaption>
                    </figure>}
                    {representative.imageError && <p className="form-status" role="alert">{representative.imageError}</p>}
                    {representative.stylingNote && <p className="text-sm leading-relaxed text-muted">{representative.stylingNote}</p>}
                    {outfitItems.length > 0 && <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted">내 옷장 사진</p>
                      <ItemStrip items={outfitItems} onOpenItem={onOpenItem} />
                    </div>}
                  </div>
                )}
                {citedItems.length > 0 && <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted">답변에서 언급한 의류</p>
                  <ItemStrip items={citedItems} onOpenItem={onOpenItem} />
                </div>}
              </article>
            );
          })}
          {isSending && (
            <p className="form-status flex items-center gap-2">
              <LoaderCircle size={17} className="animate-spin shrink-0" aria-hidden="true" /> 내 옷장을 참고해 답변을 준비하는 중이에요.
            </p>
          )}
        </div>
        <div className="chat-compose">
          {messages.length === 1 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="추천 질문">
            {QUICK_CHAT_PROMPTS.map(({ label, prompt }) => (
              <button className="chat-suggestion" key={prompt} type="button" disabled={isSending} onClick={() => send(prompt)}>{label}</button>
            ))}
          </div>}
          {error && <div>
            <p role="alert" className="form-status">{error}</p>
            {onRetry && <button type="button" className="text-action" onClick={onRetry}>답변 다시 요청</button>}
          </div>}
          {attachmentLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3">
              <p className="text-sm text-muted break-words">첨부 · {attachmentLabels.join(' · ')}</p>
              <button type="button" className="text-action" onClick={() => setAttachments(EMPTY_ATTACHMENTS)}>첨부 비우기</button>
            </div>
          )}
          <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="space-y-2">
            <label className="block">
              <span className="sr-only">스타일 질문</span>
              <textarea ref={composer} className="field-input resize-y" rows={2} placeholder="예를 들어 이번 주말에 뭘 입으면 좋을까요?" value={input} onChange={(event) => setInput(event.target.value)} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="action action-outline" onClick={() => setPickerOpen(true)} disabled={isSending}>
                <Paperclip size={16} aria-hidden="true" /> 내 옷장 첨부{attachmentLabels.length > 0 ? ` (${attachmentLabels.length})` : ''}
              </button>
              <button className="action action-primary" type="submit" disabled={isSending || !input.trim()}>
                <Send size={16} aria-hidden="true" /> 보내기
              </button>
            </div>
          </form>
        </div>
      </section>
      <aside className="assistant-context">
        <h2 className="mb-3 font-semibold">상담에 참고하는 내 옷장</h2>
        <dl className="detail-fields">
          <div><dt>보유 의류</dt><dd>{ownedItems.length}개</dd></div>
          <div><dt>입을 상황</dt><dd>{preferences.occasion}</dd></div>
          <div><dt>계절</dt><dd>{preferences.season}</dd></div>
          <div><dt>선호 스타일</dt><dd>{preferences.preferredStyle}</dd></div>
          {purchaseCandidate.name.trim() && <div><dt>구매 후보</dt><dd>{purchaseCandidate.name}</dd></div>}
        </dl>
      </aside>

      {pickerOpen && (
        <AttachmentPicker items={ownedItems} outfits={outfits} candidate={purchaseCandidate} initial={selection} onClose={() => setPickerOpen(false)}
          onApply={(next) => { setAttachments(next); setPickerOpen(false); requestAnimationFrame(() => composer.current?.focus()); }} />
      )}
    </div>
  );
}

function AttachmentPicker({
  items, outfits, candidate, initial, onClose, onApply,
}: {
  items: WardrobeItem[]; outfits: OutfitRecommendation[]; candidate: PurchaseCandidate; initial: ChatAttachmentSelection;
  onClose: () => void; onApply: (selection: ChatAttachmentSelection) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(initial);
  const needle = query.trim().toLocaleLowerCase('ko');
  const filtered = items.filter((item) => (!category || category === item.category) &&
    [item.name, item.color, item.category, item.visualMeta?.material].some((part) => part?.toLocaleLowerCase('ko').includes(needle)));
  const toggle = (field: 'itemIds' | 'outfitIds', id: string) => setSelected((current) => ({
    ...current, [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id],
  }));

  return (
    <Modal title="내 옷장 첨부" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4">
          <label className="check-row"><input type="checkbox" checked={selected.includeClosetSummary} onChange={(event) => setSelected({ ...selected, includeClosetSummary: event.target.checked })} /> 옷장 요약</label>
          {candidate.name.trim() && <label className="check-row">
            <input type="checkbox" checked={selected.includePurchaseCandidate} onChange={(event) => setSelected({ ...selected, includePurchaseCandidate: event.target.checked })} /> 구매 후보 · {candidate.name}
          </label>}
        </div>
        {outfits.length > 0 && <fieldset>
          <legend className="font-semibold">코디</legend>
          {outfits.map((outfit) => (
            <label key={outfit.id} className="check-row"><input type="checkbox" checked={selected.outfitIds.includes(outfit.id)} onChange={() => toggle('outfitIds', outfit.id)} /> {outfit.title}</label>
          ))}
        </fieldset>}
        <fieldset className="space-y-2">
          <legend className="font-semibold">의류</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label><span className="field-label">카테고리</span>
              <select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">전체</option>
                {CLOTHING_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label><span className="field-label">의류 검색</span>
              <input type="search" className="field-input" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          {filtered.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((item) => (
              <label key={item.id} className="check-row border border-line px-2 py-1">
                <input type="checkbox" checked={selected.itemIds.includes(item.id)} onChange={() => toggle('itemIds', item.id)} />
                <GarmentImage src={item.imageUrl} alt="" className="w-10 shrink-0" />
                <span>{item.name}</span>
              </label>
            ))}
          </div> : <p className="text-sm text-muted">검색 조건에 맞는 의류가 없어요.</p>}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="action action-outline" onClick={onClose}>취소</button>
          <button type="button" className="action action-primary" onClick={() => onApply(selected)}>선택 반영</button>
        </div>
      </div>
    </Modal>
  );
}
