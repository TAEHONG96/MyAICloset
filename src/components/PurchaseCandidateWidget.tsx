import React, { useRef, useState } from 'react';
import { Camera, Sparkles, X } from 'lucide-react';
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  FIT_OPTIONS,
  GarmentThickness,
  GarmentVisualMetadata,
  PurchaseCandidate,
  SEASON_OPTIONS,
  SeasonTag,
  STYLE_OPTIONS,
} from '../types/wardrobe';
import { PURCHASE_PRESETS } from '../data/sampleCloset';
import { compressGarmentImage } from '../lib/imageUtils';
import { hasUsefulVisualMeta } from '../lib/wardrobeLogic';
import { requestImageMetadataExtraction } from '../services/wardrobeApi';

const THICKNESS_OPTIONS: GarmentThickness[] = ['얇음', '보통', '두꺼움'];

interface PurchaseCandidateWidgetProps {
  candidate: PurchaseCandidate;
  isEvaluating: boolean;
  onChange: (next: PurchaseCandidate) => void;
  onEvaluate: () => void;
}

export const PurchaseCandidateWidget: React.FC<PurchaseCandidateWidgetProps> = ({
  candidate,
  isEvaluating,
  onChange,
  onEvaluate,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractFeedback, setExtractFeedback] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const updateVisualMeta = (patch: Partial<GarmentVisualMetadata>) => {
    const merged: GarmentVisualMetadata = {
      ...candidate.visualMeta,
      ...patch,
    };
    onChange({
      ...candidate,
      visualMeta: hasUsefulVisualMeta(merged) ? merged : undefined,
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressGarmentImage(file);
      onChange({ ...candidate, imageUrl: compressed.dataUrl });
      setExtractFeedback(null);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.');
    }
  };

  const handleExtractMetadata = async () => {
    if (!candidate.imageUrl) return;
    setIsExtracting(true);
    setExtractFeedback(null);
    try {
      const extracted = await requestImageMetadataExtraction(candidate.imageUrl, candidate.name);
      onChange({
        ...candidate,
        name: candidate.name.trim() ? candidate.name : extracted.suggestedName,
        category: extracted.category,
        color: extracted.color || candidate.color,
        style: STYLE_OPTIONS.includes(extracted.style) ? extracted.style : candidate.style,
        fit: FIT_OPTIONS.includes(extracted.fit) ? extracted.fit : candidate.fit,
        season: extracted.season,
        visualMeta: extracted.visualMeta,
      });
      setExtractFeedback({
        type: 'info',
        message: `사진에서 구매 후보의 소재·패턴·두께 메타데이터를 추출했습니다. (${extracted.uncertaintyNote})`,
      });
    } catch (err) {
      setExtractFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `${err.message} 아래 소재·패턴·두께 항목에 직접 입력하여 비교할 수 있습니다.`
            : '사진 메타데이터 추출에 실패했습니다.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate.name.trim()) {
      setValidationError('구매를 고민 중인 의류 이름을 입력해 주세요.');
      return;
    }
    if (!candidate.color.trim()) {
      setValidationError('구매 후보의 색상을 입력해 주세요.');
      return;
    }
    setValidationError(null);
    onEvaluate();
  };

  return (
    <section
      aria-labelledby="widget-purchase-candidate-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="pb-4 border-b border-[#ECEDF0]">
        <p className="text-xs font-medium text-[#525866] mb-1">05. 구매 후보</p>
        <h2
          id="widget-purchase-candidate-heading"
          className="text-xl font-semibold text-[#141619]"
        >
          구매 고민 아이템 입력
        </h2>
        <p className="text-xs text-[#525866] mt-1">
          장바구니에 담은 옷의 사진과 소재·패턴 메타데이터를 입력하면 현재 내 옷장과의 호환성, 중복 여부, 기존 옷 대체 가능성을 검토합니다.
        </p>
      </div>

      {/* Quick Presets */}
      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium text-[#525866]">
          빠른 테스트 예시 불러오기
        </span>
        <div className="flex flex-wrap gap-2">
          {PURCHASE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onChange(preset.candidate);
                setValidationError(null);
                setExtractFeedback(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-[#374151] border border-[#D8DCE2] hover:border-[#1F3A5F] hover:text-[#1F3A5F] rounded-lg transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Candidate Photo Attachment & AI Metadata Extraction */}
        <div className="p-3 bg-[#FAFBFB] border border-[#E5E7EB] rounded-lg space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {candidate.imageUrl ? (
                <div className="relative shrink-0">
                  <img
                    src={candidate.imageUrl}
                    alt="구매 후보 첨부 사진"
                    className="w-14 h-16 object-cover rounded border border-[#D8DCE2] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...candidate, imageUrl: undefined });
                      setExtractFeedback(null);
                    }}
                    aria-label="구매 후보 사진 삭제"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#141619] text-white flex items-center justify-center hover:bg-[#B91C1C] cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="w-14 h-16 rounded border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center text-[#6B7280] shrink-0">
                  <Camera className="w-4 h-4 mb-0.5" aria-hidden="true" />
                  <span className="text-[10px]">사진 없음</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#141619]">상품 사진 첨부 (선택)</p>
                <p className="text-[11px] text-[#525866] leading-snug mt-0.5">
                  상품 캡처나 사진을 첨부하면 소재·패턴을 추출해 옷장과 비교합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 shrink-0">
              <input
                ref={imageInputRef}
                id="purchase-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-[#D8DCE2] bg-white text-[#141619] hover:bg-[#F5F6F7] rounded-md cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                {candidate.imageUrl ? '사진 변경' : '사진 첨부'}
              </button>
              {candidate.imageUrl && (
                <button
                  type="button"
                  onClick={handleExtractMetadata}
                  disabled={isExtracting}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#1F3A5F] text-white hover:bg-[#172C49] disabled:opacity-50 rounded-md cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  {isExtracting ? '추출 중...' : 'AI 메타데이터 추출'}
                </button>
              )}
            </div>
          </div>

          {extractFeedback && (
            <p
              role={extractFeedback.type === 'error' ? 'alert' : 'status'}
              className={`text-xs leading-relaxed ${
                extractFeedback.type === 'error' ? 'text-[#B91C1C]' : 'text-[#1F3A5F]'
              }`}
            >
              {extractFeedback.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="purchase-name"
            className="block text-xs font-semibold text-[#141619] mb-1"
          >
            구매 후보 아이템명 <span className="text-[#B91C1C]">*</span>
          </label>
          <input
            id="purchase-name"
            type="text"
            value={candidate.name}
            onChange={(e) => {
              onChange({ ...candidate, name: e.target.value });
              if (validationError) setValidationError(null);
            }}
            placeholder="예: 네이비 울 더블 브레스티드 자켓"
            className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="purchase-category"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              카테고리
            </label>
            <select
              id="purchase-category"
              value={candidate.category}
              onChange={(e) =>
                onChange({ ...candidate, category: e.target.value as ClothingCategory })
              }
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {CLOTHING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="purchase-color"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              색상 <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="purchase-color"
              type="text"
              value={candidate.color}
              onChange={(e) => {
                onChange({ ...candidate, color: e.target.value });
                if (validationError) setValidationError(null);
              }}
              placeholder="예: 네이비, 카멜, 버건디"
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="purchase-style"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              스타일
            </label>
            <select
              id="purchase-style"
              value={candidate.style}
              onChange={(e) => onChange({ ...candidate, style: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="purchase-fit"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              핏 / 실루엣
            </label>
            <select
              id="purchase-fit"
              value={candidate.fit}
              onChange={(e) => onChange({ ...candidate, fit: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {FIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="purchase-season"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              계절
            </label>
            <select
              id="purchase-season"
              value={candidate.season}
              onChange={(e) =>
                onChange({ ...candidate, season: e.target.value as SeasonTag })
              }
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {SEASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="purchase-price"
              className="block text-xs font-semibold text-[#141619] mb-1"
            >
              예상 가격 (원, 선택)
            </label>
            <input
              id="purchase-price"
              type="number"
              min="0"
              step="1000"
              value={candidate.priceKrw}
              onChange={(e) => onChange({ ...candidate, priceKrw: e.target.value })}
              placeholder="예: 248000"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            />
          </div>
        </div>

        {/* Visual Metadata Fields */}
        <div className="pt-2 border-t border-[#F0F1F4]">
          <p className="text-xs font-semibold text-[#141619] mb-2">
            구매 후보 시각 메타데이터 (소재 · 패턴 · 두께감)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="purchase-material"
                className="block text-xs font-medium text-[#374151] mb-1"
              >
                소재
              </label>
              <input
                id="purchase-material"
                type="text"
                value={candidate.visualMeta?.material ?? ''}
                onChange={(e) => updateVisualMeta({ material: e.target.value || undefined })}
                placeholder="예: 울, 린넨, 코튼"
                className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="purchase-pattern"
                className="block text-xs font-medium text-[#374151] mb-1"
              >
                패턴
              </label>
              <input
                id="purchase-pattern"
                type="text"
                value={candidate.visualMeta?.pattern ?? ''}
                onChange={(e) => updateVisualMeta({ pattern: e.target.value || undefined })}
                placeholder="예: 무지, 헤링본, 체크"
                className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="purchase-thickness"
                className="block text-xs font-medium text-[#374151] mb-1"
              >
                두께감
              </label>
              <select
                id="purchase-thickness"
                value={candidate.visualMeta?.thickness ?? ''}
                onChange={(e) =>
                  updateVisualMeta({
                    thickness: (e.target.value as GarmentThickness) || undefined,
                  })
                }
                className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              >
                <option value="">미선택</option>
                {THICKNESS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="purchase-silhouette"
                className="block text-xs font-medium text-[#374151] mb-1"
              >
                상세 실루엣 · 디테일
              </label>
              <input
                id="purchase-silhouette"
                type="text"
                value={candidate.visualMeta?.silhouetteDetail ?? ''}
                onChange={(e) =>
                  updateVisualMeta({ silhouetteDetail: e.target.value || undefined })
                }
                placeholder="예: 피크드 라펠, 더블 브레스티드"
                className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="purchase-notes"
            className="block text-xs font-semibold text-[#141619] mb-1"
          >
            고민 이유 및 착용 목적 (선택)
          </label>
          <textarea
            id="purchase-notes"
            rows={2}
            value={candidate.notes}
            onChange={(e) => onChange({ ...candidate, notes: e.target.value })}
            placeholder="예: 출근용 아우터가 하나 더 필요해 보여서 고민 중"
            className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
          />
        </div>

        {validationError && (
          <p role="alert" className="text-xs font-medium text-[#B91C1C]">
            입력 오류: {validationError}
          </p>
        )}

        <button
          type="submit"
          disabled={isEvaluating}
          className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          {isEvaluating ? '보유 옷장 대조 분석 중...' : '구매 가치 AI 분석 실행'}
        </button>
      </form>
    </section>
  );
};
