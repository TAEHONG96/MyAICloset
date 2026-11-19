import React from 'react';
import { Camera, RefreshCw, Sparkles } from 'lucide-react';
import type { OutfitIllustrationSpec, OutfitRecommendation } from '../types/wardrobe';

interface OutfitPreviewWidgetProps {
  selectedOutfit: OutfitRecommendation | null;
  illustrationSpec: OutfitIllustrationSpec | null;
  isLoading: boolean;
  error: string | null;
  onRefreshAiDirection: () => void;
}

export const OutfitPreviewWidget: React.FC<OutfitPreviewWidgetProps> = ({
  selectedOutfit,
  illustrationSpec,
  isLoading,
  error,
  onRefreshAiDirection,
}) => {
  const hasGeneratedImage = Boolean(illustrationSpec?.generatedImageUrl);
  const referencePhotoLayers = (illustrationSpec?.layers ?? []).filter((layer) =>
    Boolean(layer.imageUrl)
  );

  return (
    <section
      aria-labelledby="widget-outfit-preview-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#ECEDF0]">
        <div>
          <p className="text-xs font-medium text-[#525866] mb-1">07. 코디 미리보기</p>
          <h2
            id="widget-outfit-preview-heading"
            className="text-xl font-semibold text-[#141619]"
          >
            실사 코디 착장 미리보기
          </h2>
        </div>

        {selectedOutfit && (
          <button
            type="button"
            onClick={onRefreshAiDirection}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1F3A5F] border border-[#1F3A5F]/35 hover:bg-[#1F3A5F]/5 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isLoading
              ? '실사 코디 이미지 생성 중...'
              : hasGeneratedImage
                ? '실사 이미지 다시 생성'
                : '실사 코디 이미지 생성'}
          </button>
        )}
      </div>

      {!selectedOutfit || !illustrationSpec ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm font-medium text-[#141619]">
            미리볼 추천 코디를 선택해 주세요.
          </p>
          <p className="text-xs text-[#525866] max-w-sm mx-auto leading-relaxed">
            코디 추천기에서 추천 조합을 생성하고 &lsquo;실사 코디 미리보기&rsquo;를 누르면, 보유 의류 사진과 메타데이터를 조합한 실제 착장 이미지(얼굴 제외)가 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3.5 py-2.5 leading-relaxed">
              실사 코디 이미지 생성 오류: {error}
            </p>
          )}

          {/* Realistic Outfit Lookbook Photo Stage (3:4 vertical portrait, headless neck-down framing) */}
          <figure className="bg-[#FAFBFB] border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="relative aspect-[3/4] w-full bg-[#F4F5F7] flex items-center justify-center overflow-hidden">
              {isLoading ? (
                <div
                  aria-live="polite"
                  className="px-6 text-center space-y-3"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-[#1F3A5F]/20 border-t-[#1F3A5F] animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#141619]">
                      실사 코디 착장 이미지를 생성하고 있습니다
                    </p>
                    <p className="text-xs text-[#525866] max-w-xs mx-auto leading-relaxed">
                      선택한 보유 의류 {illustrationSpec.layers.length}점의 실제 사진과 핏·소재 정보를 조합해 얼굴 제외 전신 스타일링을 연출하는 중입니다.
                    </p>
                  </div>
                </div>
              ) : illustrationSpec.generatedImageUrl ? (
                <img
                  src={illustrationSpec.generatedImageUrl}
                  alt={`${illustrationSpec.title} 얼굴 제외 실사 코디 이미지`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="p-5 sm:p-6 w-full h-full flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F3A5F]">
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      얼굴 제외 전신 실사 착장 미리보기
                    </span>
                    <h3 className="text-base font-semibold text-[#141619] leading-snug">
                      {illustrationSpec.title}
                    </h3>
                    <p className="text-xs text-[#525866] leading-relaxed">
                      보유 의류 사진과 핏·소재 정보를 조합해 실제로 착용한 전신 코디 이미지를 생성합니다.
                    </p>
                  </div>

                  {referencePhotoLayers.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 my-3">
                      {referencePhotoLayers.slice(0, 4).map((layer) => (
                        <div
                          key={layer.itemId}
                          className="bg-white border border-[#E5E7EB] rounded-lg p-1.5 flex items-center gap-2"
                        >
                          <img
                            src={layer.imageUrl}
                            alt={layer.itemName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-12 object-cover rounded shrink-0 bg-[#FAFBFB]"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-[#141619] truncate">
                              {layer.itemName}
                            </p>
                            <p className="text-[10px] text-[#525866] truncate">
                              {layer.colorLabel} · {layer.category}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={onRefreshAiDirection}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1F3A5F] hover:bg-[#172C49] rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      실사 코디 이미지 생성하기
                    </button>
                    <p className="text-[11px] text-center text-[#6B7280]">
                      목·턱선 아래부터 신발까지 착장 중심으로 생성됩니다
                    </p>
                  </div>
                </div>
              )}
            </div>

            <figcaption className="px-3.5 py-2.5 bg-white border-t border-[#ECEDF0] flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-[#141619] truncate">
                {illustrationSpec.moodLine}
              </span>
              <span className="text-[#525866] shrink-0">
                얼굴 제외 착장 · {illustrationSpec.layers.length}점
              </span>
            </figcaption>
          </figure>

          {/* Attached Reference Photos Strip (if any outfit items have photos) */}
          {referencePhotoLayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#141619]">
                착장에 반영된 보유 의류 사진 ({referencePhotoLayers.length}점)
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {referencePhotoLayers.map((layer) => (
                  <div
                    key={layer.itemId}
                    className="border border-[#E5E7EB] rounded-lg p-1.5 bg-[#FAFBFB] space-y-1"
                  >
                    <img
                      src={layer.imageUrl}
                      alt={layer.itemName}
                      referrerPolicy="no-referrer"
                      className="w-full h-20 object-cover rounded bg-white"
                    />
                    <p className="text-[11px] font-medium text-[#141619] truncate">
                      {layer.itemName}
                    </p>
                    {(layer.materialHint || layer.patternHint) && (
                      <p className="text-[10px] text-[#525866] truncate">
                        {[layer.materialHint, layer.patternHint].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mandatory Non-Exact Visual Reproduction Disclaimer */}
          <p className="text-[11px] text-[#525866] bg-[#F5F6F7] border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 leading-relaxed">
            <span className="font-semibold text-[#141619]">안내:</span>{' '}
            {illustrationSpec.disclaimer}
          </p>

          {/* Art Direction & Styling Notes */}
          <div className="pt-2 space-y-3 text-xs leading-relaxed">
            <div>
              <h3 className="font-semibold text-[#141619] mb-1">
                실사 착장 연출 방향{' '}
                <span className="font-normal text-[#6B7280]">
                  · {hasGeneratedImage ? 'AI 실사 이미지 생성 완료' : '생성 대기 (착장 구성 요약)'}
                </span>
              </h3>
              <p className="text-[#374151]">{illustrationSpec.artDirectionNote}</p>
            </div>

            {illustrationSpec.stylingNotes.length > 0 && (
              <div>
                <h3 className="font-semibold text-[#141619] mb-1">실제 착장 · 스타일링 포인트</h3>
                <ul className="list-disc list-inside text-[#374151] space-y-1">
                  {illustrationSpec.stylingNotes.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {illustrationSpec.assumptionsAndUncertainties.length > 0 && (
              <div className="pt-2 border-t border-[#ECEDF0]">
                <h3 className="font-semibold text-[#525866] mb-1">실사 생성 가정 및 불확실성</h3>
                <ul className="list-disc list-inside text-[#6B7280] space-y-1">
                  {illustrationSpec.assumptionsAndUncertainties.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
