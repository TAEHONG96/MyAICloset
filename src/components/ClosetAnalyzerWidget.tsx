import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { AiClosetDiagnosis, ClosetSummary } from '../types/wardrobe';

interface ClosetAnalyzerWidgetProps {
  summary: ClosetSummary;
  diagnosis: AiClosetDiagnosis | null;
  isLoading: boolean;
  error: string | null;
  onRequestDiagnosis: () => void;
}

export const ClosetAnalyzerWidget: React.FC<ClosetAnalyzerWidgetProps> = ({
  summary,
  diagnosis,
  isLoading,
  error,
  onRequestDiagnosis,
}) => {
  return (
    <section
      aria-labelledby="widget-closet-analyzer-heading"
      className="closet-analysis space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-line">
        <div>
          <h2
            id="widget-closet-analyzer-heading"
            className="text-xl font-semibold text-ink"
          >
            보유 의류 구성 요약
          </h2>
        </div>

        <button
          type="button"
          onClick={onRequestDiagnosis}
          disabled={isLoading || summary.totalCount === 0}
          className="action action-outline shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isLoading ? 'AI 진단 분석 중...' : 'AI 심층 진단 받기'}
        </button>
      </div>

      {/* Top KPI Strip (unboxed, clean dividers) */}
      <div className="grid grid-cols-3 divide-x divide-line text-left">
        <div className="pr-3">
          <div className="text-[11px] text-muted">총 보유량</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-ink mt-0.5">
            {summary.totalCount}
            <span className="text-xs font-sans font-normal text-muted ml-1">벌</span>
          </div>
          <div className="text-[11px] text-muted font-mono tabular-nums">
            사진 {summary.imageAttachedCount} · 상세 정보 {summary.metadataEnrichedCount}
          </div>
        </div>
        <div className="px-3">
          <div className="text-[11px] text-muted">주요 색상</div>
          <div className="text-base font-semibold text-ink mt-1.5 truncate">
            {summary.byColor[0]?.label ?? '—'}
          </div>
          <div className="text-[11px] text-muted font-mono tabular-nums">
            {summary.byColor[0] ? `${summary.byColor[0].count}벌 (${summary.byColor[0].ratio}%)` : '데이터 없음'}
          </div>
        </div>
        <div className="pl-3">
          <div className="text-[11px] text-muted">중복 주의 구간</div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-ink mt-0.5">
            {summary.redundancies.length}
            <span className="text-xs font-sans font-normal text-muted ml-1">건</span>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="pt-4 border-t border-line space-y-2.5">
        <h3 className="text-xs font-semibold text-ink">카테고리별 분포</h3>
        <div className="space-y-2">
          {summary.byCategory.map((cat) => (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink">{cat.category}</span>
                <span className="font-mono tabular-nums text-muted">
                  {cat.count}벌 ({cat.ratio}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#EFF1F4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-olive rounded-full transition-all duration-300"
                  style={{ width: `${cat.ratio}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Season & Color Breakdown */}
      <div className="pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-ink">계절별 보유 현황</h3>
          <dl className="divide-y divide-parchment text-xs">
            {summary.bySeason.map((s) => (
              <div key={s.label} className="py-1.5 flex items-center justify-between">
                <dt className="text-muted">{s.label}</dt>
                <dd className="font-mono tabular-nums font-medium text-ink">
                  {s.count}벌
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-ink">상위 색상 팔레트</h3>
          {summary.byColor.length === 0 ? (
            <p className="text-xs text-muted">등록된 의류가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-parchment text-xs">
              {summary.byColor.slice(0, 6).map((c) => (
                <li key={c.label} className="py-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span
                      aria-hidden="true"
                      className="w-3 h-3 rounded-xs border border-black/15"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.label}
                  </span>
                  <span className="font-mono tabular-nums text-muted">
                    {c.count}벌
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Style, Fit & Material Summary (unboxed inline metadata) */}
      {summary.totalCount > 0 && (
        <div className="pt-4 border-t border-line space-y-2 text-xs">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">주요 스타일:</span>
            <span className="text-muted">
              {summary.byStyle
                .slice(0, 4)
                .map((s) => `${s.label}(${s.count})`)
                .join(' · ')}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">주요 핏:</span>
            <span className="text-muted">
              {summary.byFit
                .slice(0, 4)
                .map((f) => `${f.label}(${f.count})`)
                .join(' · ')}
            </span>
          </div>
          {summary.byMaterial.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">주요 소재:</span>
              <span className="text-muted">
                {summary.byMaterial
                  .slice(0, 5)
                  .map((m) => `${m.label}(${m.count})`)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Overlap / Redundancy Flags */}
      {summary.redundancies.length > 0 && (
        <div className="pt-4 border-t border-line space-y-2">
          <h3 className="text-xs font-semibold text-[#B45309]">
            중복 가능성 점검 (기존 옷 우선 활용)
          </h3>
          <ul className="space-y-2 text-xs text-ink">
            {summary.redundancies.map((group) => (
              <li key={group.key} className="leading-relaxed">
                <span className="font-medium text-ink">
                  {group.category} / {group.colorGroup}:
                </span>{' '}
                {group.items.map((i) => i.name).join(', ')} — {group.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deterministic Assumptions & Uncertainties */}
      {summary.assumptions.length > 0 && (
        <div className="pt-4 border-t border-line space-y-1.5">
          <h3 className="text-xs font-semibold text-muted">분석 기준 및 불확실성</h3>
          <ul className="space-y-1 text-xs text-muted list-disc list-inside leading-relaxed">
            {summary.assumptions.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Deep Diagnosis Section */}
      {error && (
        <div
          role="alert"
          className="pt-4 border-t border-line text-xs text-[#B91C1C] leading-relaxed"
        >
          <span className="font-semibold">AI 진단 오류:</span> {error}
        </div>
      )}

      {isLoading && (
        <div className="pt-4 border-t border-line space-y-2 animate-pulse" aria-live="polite">
          <div className="h-4 bg-line rounded w-3/4" />
          <div className="h-3 bg-parchment rounded w-full" />
          <div className="h-3 bg-parchment rounded w-5/6" />
        </div>
      )}

      {diagnosis && !isLoading && (
        <div className="pt-5 border-t border-line space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-olive">AI 옷장 심층 진단</p>
            <p className="text-sm font-semibold text-ink mt-1 leading-snug">
              {diagnosis.headline}
            </p>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div>
              <h4 className="font-semibold text-ink mb-1">현재 옷장의 강점</h4>
              <ul className="list-disc list-inside text-ink space-y-1">
                {diagnosis.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-ink mb-1">균형 및 편중 진단</h4>
              <ul className="list-disc list-inside text-ink space-y-1">
                {diagnosis.balanceNotes.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-olive-deep mb-1">새 옷 없이 활용도 높이는 전략</h4>
              <ul className="list-disc list-inside text-ink space-y-1">
                {diagnosis.reuseStrategies.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-muted mb-1">가정 및 불확실성</h4>
              <ul className="list-disc list-inside text-muted space-y-1">
                {diagnosis.assumptionsAndUncertainties.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
