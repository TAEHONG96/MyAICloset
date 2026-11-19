import React, { useMemo } from 'react';
import type {
  PurchaseAdvice,
  PurchaseCandidate,
  PurchasePrecheck,
  WardrobeItem,
} from '../types/wardrobe';
import { formatVisualMetadataSummary, resolveKoreanColorHex } from '../lib/wardrobeLogic';

interface PurchaseAdvisorWidgetProps {
  candidate: PurchaseCandidate;
  ownedItems: WardrobeItem[];
  precheck: PurchasePrecheck;
  advice: PurchaseAdvice | null;
  isLoading: boolean;
  error: string | null;
}

function verdictStyle(verdict: PurchaseAdvice['verdict']): {
  label: string;
  textClass: string;
} {
  switch (verdict) {
    case '구매 추천':
      return { label: '구매 추천 (기존 옷장 보완 가치 높음)', textClass: 'text-[#15803D]' };
    case '신중 검토':
      return { label: '신중 검토 (보유 옷과 부분 중복 또는 조건부 추천)', textClass: 'text-[#B45309]' };
    case '기존 옷 활용 권장':
      return { label: '기존 옷 활용 권장 (불필요한 중복 구매 가능성 높음)', textClass: 'text-[#B91C1C]' };
  }
}

export const PurchaseAdvisorWidget: React.FC<PurchaseAdvisorWidgetProps> = ({
  candidate,
  ownedItems,
  precheck,
  advice,
  isLoading,
  error,
}) => {
  const itemById = useMemo(
    () => new Map(ownedItems.map((item) => [item.id, item])),
    [ownedItems]
  );

  const resolveItems = (ids: string[]): WardrobeItem[] =>
    ids.map((id) => itemById.get(id)).filter((i): i is WardrobeItem => Boolean(i));

  const riskColor =
    precheck.redundancyRisk === '높음'
      ? 'text-[#B91C1C]'
      : precheck.redundancyRisk === '보통'
      ? 'text-[#B45309]'
      : 'text-[#15803D]';

  const candidateMetaSummary = formatVisualMetadataSummary(candidate.visualMeta);

  return (
    <section
      aria-labelledby="widget-purchase-advisor-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 space-y-6"
    >
      <div className="pb-4 border-b border-[#ECEDF0]">
        <p className="text-xs font-medium text-[#525866] mb-1">06. 구매 어드바이저</p>
        <h2
          id="widget-purchase-advisor-heading"
          className="text-xl font-semibold text-[#141619]"
        >
          호환성 · 중복성 · 구매 가치 평가
        </h2>
        <p className="text-xs text-[#525866] mt-1">
          새 구매보다 기존 보유 의류의 재활용을 우선 기준으로 평가합니다.
        </p>
      </div>

      {/* Candidate Snapshot with Thumbnail & Visual Metadata */}
      {(candidate.name.trim() || candidate.imageUrl || candidateMetaSummary) && (
        <div className="flex items-center gap-3 pb-4 border-b border-[#ECEDF0]">
          {candidate.imageUrl ? (
            <img
              src={candidate.imageUrl}
              alt={candidate.name || '구매 후보 사진'}
              className="w-14 h-16 object-cover rounded border border-[#E5E7EB] shrink-0 bg-white"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-14 h-16 rounded border border-[#E5E7EB] bg-[#FAFBFB] flex items-center justify-center shrink-0"
            >
              <span
                className="w-4 h-4 rounded-xs border border-black/15"
                style={{ backgroundColor: resolveKoreanColorHex(candidate.color || '') }}
              />
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-[#141619] truncate">
              {candidate.name || '구매 후보 미입력'}
            </p>
            <p className="text-xs text-[#525866]">
              {candidate.category} · {candidate.color || '색상 미입력'} · {candidate.fit} · {candidate.season}
            </p>
            {candidateMetaSummary && (
              <p className="text-xs text-[#1F3A5F] font-medium">{candidateMetaSummary}</p>
            )}
          </div>
        </div>
      )}

      {/* Real-time Deterministic Pre-check connected live to My Closet */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-[#141619]">
            실시간 옷장 대조 사전 점검
          </h3>
          <span className="text-[11px] text-[#6B7280] font-mono tabular-nums">
            기준: 보유 {ownedItems.length}벌
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#ECEDF0]">
          <div className="pr-3">
            <div className="text-[11px] text-[#525866]">동일 카테고리</div>
            <div className="text-xl font-mono tabular-nums font-semibold text-[#141619] mt-0.5">
              {precheck.sameCategoryCount}
              <span className="text-xs font-sans font-normal text-[#525866] ml-1">벌 보유</span>
            </div>
          </div>
          <div className="px-3">
            <div className="text-[11px] text-[#525866]">사전 중복 위험</div>
            <div className={`text-base font-semibold mt-1 ${riskColor}`}>
              {precheck.redundancyRisk}
            </div>
            <div className="text-[11px] text-[#6B7280] font-mono tabular-nums">
              유사 {precheck.overlappingItems.length}벌
            </div>
          </div>
          <div className="pl-3">
            <div className="text-[11px] text-[#525866]">즉시 매치 가능</div>
            <div className="text-xl font-mono tabular-nums font-semibold text-[#141619] mt-0.5">
              {precheck.compatibleItems.length}
              <span className="text-xs font-sans font-normal text-[#525866] ml-1">벌+</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#374151] leading-relaxed">{precheck.reuseSuggestion}</p>

        {precheck.overlappingItems.length > 0 && (
          <div className="text-xs space-y-1">
            <span className="font-semibold text-[#141619]">역할·색상이 겹치는 기존 보유 옷:</span>
            <ul className="space-y-1 text-[#525866]">
              {precheck.overlappingItems.map((item) => (
                <li key={item.id} className="inline-flex items-center gap-1.5 mr-3">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-xs border border-black/15"
                    style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                  />
                  {item.name} ({item.color} · {item.season})
                </li>
              ))}
            </ul>
          </div>
        )}

        {precheck.compatibleItems.length > 0 && (
          <div className="text-xs space-y-1">
            <span className="font-semibold text-[#141619]">함께 매치 가능한 기존 보유 옷:</span>
            <p className="text-[#525866] leading-relaxed">
              {precheck.compatibleItems
                .slice(0, 5)
                .map((item) => `${item.name}(${item.color})`)
                .join(' · ')}
            </p>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div role="alert" className="pt-4 border-t border-[#ECEDF0] text-xs text-[#B91C1C]">
          <span className="font-semibold">구매 분석 오류:</span> {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="pt-5 border-t border-[#ECEDF0] space-y-3 animate-pulse" aria-live="polite">
          <div className="h-5 bg-[#ECEDF0] rounded w-1/2" />
          <div className="h-3 bg-[#F3F4F6] rounded w-full" />
          <div className="h-3 bg-[#F3F4F6] rounded w-5/6" />
          <div className="h-3 bg-[#F3F4F6] rounded w-4/5" />
        </div>
      )}

      {/* Full AI Purchase Advisor Report */}
      {advice && !isLoading && (
        <div className="pt-5 border-t border-[#D8DCE2] space-y-5">
          {/* Verdict Header */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-medium text-[#525866]">
                AI 최종 구매 판정 · 대상: {candidate.name}
              </p>
              <span className="text-[11px] text-[#525866]">
                호환성 {advice.compatibilityRating} · 중복성 {advice.redundancyLevel}
              </span>
            </div>
            <h3 className={`text-lg font-semibold ${verdictStyle(advice.verdict).textClass}`}>
              {verdictStyle(advice.verdict).label}
            </h3>
            <p className="text-sm text-[#141619] leading-relaxed">{advice.summary}</p>
          </div>

          {/* 4 Core Evaluation Dimensions */}
          <div className="divide-y divide-[#ECEDF0] text-xs leading-relaxed">
            <div className="py-3.5 space-y-1.5">
              <h4 className="font-semibold text-[#141619]">
                01. 기존 보유 아이템과의 호환성 ({advice.compatibilityRating})
              </h4>
              <p className="text-[#374151]">{advice.compatibilityAnalysis}</p>
              {resolveItems(advice.matchingOwnedItemIds).length > 0 && (
                <p className="text-[#525866]">
                  <span className="font-medium text-[#141619]">잘 어울리는 보유 옷:</span>{' '}
                  {resolveItems(advice.matchingOwnedItemIds)
                    .map((i) => i.name)
                    .join(' · ')}
                </p>
              )}
            </div>

            <div className="py-3.5 space-y-1.5">
              <h4 className="font-semibold text-[#141619]">02. 활용도 및 착장 확장성</h4>
              <p className="text-[#374151]">{advice.versatilityAnalysis}</p>
            </div>

            <div className="py-3.5 space-y-1.5">
              <h4 className="font-semibold text-[#141619]">
                03. 중복성 점검 (중복 위험: {advice.redundancyLevel})
              </h4>
              <p className="text-[#374151]">{advice.redundancyAnalysis}</p>
              {resolveItems(advice.overlappingOwnedItemIds).length > 0 && (
                <p className="text-[#B45309]">
                  <span className="font-semibold">중복 대상 보유 옷:</span>{' '}
                  {resolveItems(advice.overlappingOwnedItemIds)
                    .map((i) => i.name)
                    .join(' · ')}
                </p>
              )}
            </div>

            <div className="py-3.5 space-y-1.5">
              <h4 className="font-semibold text-[#141619]">04. 종합 구매 가치</h4>
              <p className="text-[#374151]">{advice.purchaseValueAnalysis}</p>
            </div>
          </div>

          {/* Reuse-first Existing Wardrobe Alternative */}
          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-4 space-y-2 text-xs leading-relaxed">
            <p className="font-semibold text-[#15803D]">
              새 구매 대신 제안하는 기존 옷 대안: {advice.reuseAlternativeTitle}
            </p>
            {resolveItems(advice.reuseAlternativeItemIds).length > 0 && (
              <p className="text-[#141619] font-medium">
                활용 아이템:{' '}
                {resolveItems(advice.reuseAlternativeItemIds)
                  .map((i) => `${i.name}(${i.color})`)
                  .join(' + ')}
              </p>
            )}
            <p className="text-[#374151]">{advice.reuseAlternativeReason}</p>
          </div>

          {/* Assumptions & Uncertainties */}
          <div className="pt-2 space-y-1.5 text-xs">
            <h4 className="font-semibold text-[#525866]">평가 가정 및 불확실성</h4>
            <ul className="list-disc list-inside text-[#6B7280] space-y-1 leading-relaxed">
              {advice.assumptionsAndUncertainties.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
