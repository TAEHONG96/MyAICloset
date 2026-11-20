import { LoaderCircle } from 'lucide-react';
import { formatVisualMetadataSummary } from '../lib/wardrobeLogic';
import type { PurchaseAdvice, PurchaseCandidate, PurchasePrecheck, WardrobeItem } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';
import { ItemStrip } from './ItemStrip';

interface PurchaseAdvisorWidgetProps {
  candidate: PurchaseCandidate;
  ownedItems: WardrobeItem[];
  precheck: PurchasePrecheck;
  advice: PurchaseAdvice | null;
  isLoading: boolean;
  error: string | null;
  onOpenItem: (item: WardrobeItem) => void;
}

export function PurchaseAdvisorWidget({ candidate, ownedItems, precheck, advice, isLoading, error, onOpenItem }: PurchaseAdvisorWidgetProps) {
  const byId = new Map(ownedItems.map((item) => [item.id, item]));
  const ready = Boolean(candidate.name.trim() && candidate.color.trim());
  const resolveItems = (ids: string[]) => ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const candidateDetails = formatVisualMetadataSummary(candidate.visualMeta);

  return (
    <section id="purchase-comparison" className="purchase-results scroll-mt-24" aria-labelledby="purchase-results-heading">
      <h2 id="purchase-results-heading" tabIndex={-1} className="text-xl font-semibold tracking-tight">내 옷장과 비교</h2>
      {!ready ? (
        <div className="empty-state"><p>구매 후보의 이름과 색상을 입력하면 옷장과 비교할 수 있어요.</p></div>
      ) : (
        <>
          <div className="purchase-snapshot">
            <GarmentImage src={candidate.imageUrl} alt="" />
            <div className="min-w-0 space-y-1">
              <p className="editorial-label">구매 후보</p>
              <h3 className="text-lg font-semibold">{candidate.name}</h3>
              <p className="text-sm text-muted">{candidate.category} · {candidate.color} · {candidate.fit} · {candidate.season}</p>
              {candidate.priceKrw && <p className="font-medium">{Number(candidate.priceKrw).toLocaleString('ko-KR')}원</p>}
              {candidateDetails && <p className="text-xs leading-relaxed text-muted">{candidateDetails}</p>}
            </div>
          </div>
          {error && <p role="alert" className="form-status">{error} 후보 정보에서 구매 분석을 다시 요청할 수 있어요.</p>}
          <div role="status">
            {isLoading && <p className="form-status flex items-center gap-2">
              <LoaderCircle size={18} className="animate-spin shrink-0" aria-hidden="true" /> AI가 어울리는 조합과 중복 여부를 비교하는 중이에요.
            </p>}
            {advice && !isLoading && <span className="sr-only">AI 구매 분석이 완료됐어요.</span>}
          </div>
          {advice && !isLoading && <div className="purchase-verdict">
            <p className="editorial-label">AI 구매 의견</p>
            <h3 className="my-1 text-xl font-semibold">{advice.verdict}</h3>
            <p className="text-sm leading-relaxed">{advice.summary}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">등록된 의류와 후보 정보를 기준으로 한 참고 의견이에요.</p>
          </div>}
          <div className="space-y-5">
            <h3 className="text-base font-semibold">보유 의류 빠른 비교</h3>
            <p className="text-sm leading-relaxed text-muted">내 옷장 {ownedItems.length}개 중 같은 카테고리 {precheck.sameCategoryCount}개 · 중복 가능성 <strong>{precheck.redundancyRisk}</strong></p>
            <Comparison title="함께 매치할 옷" items={precheck.compatibleItems} onOpenItem={onOpenItem} />
            <Comparison title="유사한 보유 의류" items={precheck.overlappingItems} onOpenItem={onOpenItem} />
            <p className="text-sm leading-relaxed text-muted">{precheck.reuseSuggestion}</p>
          </div>
          {advice && !isLoading && (
            <div className="space-y-4 border-t border-line pt-5 text-sm leading-relaxed">
              <h3 className="text-base font-semibold">AI 분석 근거</h3>
              <dl className="space-y-4">
                <div><dt className="font-semibold">조합 가능성 · {advice.compatibilityRating}</dt><dd className="text-muted">{advice.compatibilityAnalysis}</dd></div>
                <div><dt className="font-semibold">스타일 활용도</dt><dd className="text-muted">{advice.versatilityAnalysis}</dd></div>
                <div><dt className="font-semibold">중복 가능성 · {advice.redundancyLevel}</dt><dd className="text-muted">{advice.redundancyAnalysis}</dd></div>
                <div><dt className="font-semibold">구매 가치</dt><dd className="text-muted">{advice.purchaseValueAnalysis}</dd></div>
              </dl>
              <Comparison title="AI가 함께 추천한 의류" items={resolveItems(advice.matchingOwnedItemIds)} onOpenItem={onOpenItem} />
              <Comparison title="AI가 유사하다고 본 의류" items={resolveItems(advice.overlappingOwnedItemIds)} onOpenItem={onOpenItem} />
              <div className="space-y-2 bg-parchment p-4">
                <h4 className="font-semibold">가지고 있는 옷으로 · {advice.reuseAlternativeTitle}</h4>
                <p className="text-muted">{advice.reuseAlternativeReason}</p>
                <ItemStrip items={resolveItems(advice.reuseAlternativeItemIds)} onOpenItem={onOpenItem} />
              </div>
              {advice.assumptionsAndUncertainties.length > 0 && <details>
                <summary className="disclosure">분석의 가정과 한계</summary>
                <ul className="list-disc pl-5 text-muted">{advice.assumptionsAndUncertainties.map((note, index) => <li key={index}>{note}</li>)}</ul>
              </details>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Comparison({ title, items, onOpenItem }: { title: string; items: WardrobeItem[]; onOpenItem: (item: WardrobeItem) => void }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ItemStrip items={items} onOpenItem={onOpenItem} />
    </div>
  );
}
