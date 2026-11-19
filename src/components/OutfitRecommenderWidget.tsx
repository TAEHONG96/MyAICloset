import React from 'react';
import { Eye } from 'lucide-react';
import type { OutfitRecommendation } from '../types/wardrobe';
import { formatVisualMetadataSummary, resolveKoreanColorHex } from '../lib/wardrobeLogic';

interface OutfitRecommenderWidgetProps {
  outfits: OutfitRecommendation[];
  selectedOutfitId: string | null;
  generatedOutfitIds?: string[];
  isLoading: boolean;
  error: string | null;
  ownedCount: number;
  onSelectForPreview: (outfit: OutfitRecommendation) => void;
  onGenerateOutfits: () => void;
}

export const OutfitRecommenderWidget: React.FC<OutfitRecommenderWidgetProps> = ({
  outfits,
  selectedOutfitId,
  generatedOutfitIds = [],
  isLoading,
  error,
  ownedCount,
  onSelectForPreview,
  onGenerateOutfits,
}) => {
  const generatedSet = new Set(generatedOutfitIds);

  return (
    <section
      aria-labelledby="widget-outfit-recommender-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#ECEDF0]">
        <div>
          <p className="text-xs font-medium text-[#525866] mb-1">04. 코디 추천기</p>
          <h2
            id="widget-outfit-recommender-heading"
            className="text-xl font-semibold text-[#141619]"
          >
            보유 의류 기반 3가지 추천 조합
          </h2>
          <p className="text-xs text-[#525866] mt-1">
            모든 추천 조합은 실제 보유 의류 ID와 사진·소재 메타데이터를 기준으로 새 옷을 지어내지 않습니다.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-xs text-[#B91C1C] leading-relaxed">
          <span className="font-semibold">코디 추천 오류:</span> {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6 animate-pulse" aria-live="polite">
          {[1, 2, 3].map((n) => (
            <div key={n} className="pb-5 border-b border-[#ECEDF0] last:border-b-0 space-y-2.5">
              <div className="h-4 bg-[#ECEDF0] rounded w-1/3" />
              <div className="h-3 bg-[#F3F4F6] rounded w-2/3" />
              <div className="h-3 bg-[#F3F4F6] rounded w-full" />
              <div className="h-3 bg-[#F3F4F6] rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm font-medium text-[#141619]">
            아직 생성된 추천 코디가 없습니다.
          </p>
          <p className="text-xs text-[#525866] max-w-md mx-auto leading-relaxed">
            위의 스타일 선호도에서 상황과 계절을 선택한 뒤 추천 버튼을 누르면, 현재 내 옷장에 등록된{' '}
            <span className="font-mono tabular-nums font-semibold text-[#141619]">{ownedCount}</span>
            벌만으로 3가지 맞춤 조합을 제안해 드립니다.
          </p>
          <button
            type="button"
            onClick={onGenerateOutfits}
            disabled={ownedCount < 2}
            className="px-4 py-2 text-xs font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          >
            지금 3가지 코디 추천 받기
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#ECEDF0]">
          {outfits.map((outfit, index) => {
            const isSelected = outfit.id === selectedOutfitId;
            const hasGenerated = generatedSet.has(outfit.id);
            return (
              <article
                key={outfit.id}
                className={`py-5 first:pt-1 last:pb-1 transition-colors ${
                  isSelected ? 'bg-[#F8FAFC] -mx-5 sm:-mx-6 px-5 sm:px-6' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-mono tabular-nums text-[#525866]">
                      LOOK 0{index + 1} · 보유 아이템 {outfit.items.length}점 조합 ·{' '}
                      <span className="font-sans">
                        {outfit.source === 'seed' ? '기본 예시 조합' : 'AI 맞춤 추천'}
                      </span>
                    </p>
                    <h3 className="text-base sm:text-lg font-semibold text-[#141619] mt-0.5">
                      {outfit.title}
                    </h3>
                    {outfit.conceptSummary && (
                      <p className="text-xs text-[#525866] mt-1">{outfit.conceptSummary}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectForPreview(outfit)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#1F3A5F] text-white border-[#1F3A5F]'
                        : 'border-[#D8DCE2] text-[#141619] hover:bg-[#F5F6F7]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    {isSelected
                      ? hasGenerated
                        ? '실사 미리보기 표시 중'
                        : '실사 이미지 생성'
                      : '실사 코디 미리보기'}
                  </button>
                </div>

                {/* Owned items list (unboxed clean metadata rows + optional thumbnail) */}
                <ul className="mt-4 divide-y divide-[#F1F2F5] border-y border-[#F1F2F5]">
                  {outfit.items.map((item) => {
                    const metaSummary = formatVisualMetadataSummary(item.visualMeta);
                    return (
                      <li
                        key={item.id}
                        className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="inline-flex items-center gap-2.5 min-w-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-10 object-cover rounded border border-[#E5E7EB] shrink-0 bg-white"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="w-3 h-3 rounded-xs border border-black/15 shrink-0"
                              style={{ backgroundColor: resolveKoreanColorHex(item.color) }}
                            />
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-[#141619] block">{item.name}</span>
                            {metaSummary && (
                              <span className="text-[11px] text-[#1F3A5F] block">
                                {metaSummary}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[#525866]">
                          {item.category} · {item.color} · {item.fit} · {item.season}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Editorial Explanations */}
                <div className="mt-3.5 space-y-2 text-xs leading-relaxed text-[#374151]">
                  <p>
                    <span className="font-semibold text-[#141619]">스타일링 설명:</span>{' '}
                    {outfit.stylingExplanation}
                  </p>
                  {outfit.tpoFit && (
                    <p>
                      <span className="font-semibold text-[#141619]">TPO · 계절 적합성:</span>{' '}
                      {outfit.tpoFit}
                    </p>
                  )}
                  {outfit.reuseTip && (
                    <p>
                      <span className="font-semibold text-[#15803D]">기존 옷 활용 팁:</span>{' '}
                      {outfit.reuseTip}
                    </p>
                  )}
                  <p className="text-[#6B7280]">
                    <span className="font-semibold text-[#525866]">가정 및 불확실성:</span>{' '}
                    {outfit.assumptions}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
