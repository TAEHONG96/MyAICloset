import React from 'react';
import {
  OCCASION_OPTIONS,
  SEASON_OPTIONS,
  SeasonTag,
  STYLE_OPTIONS,
  StylePreferences,
} from '../types/wardrobe';

interface StylePreferencesWidgetProps {
  preferences: StylePreferences;
  ownedCount: number;
  isGenerating: boolean;
  onChange: (next: StylePreferences) => void;
  onGenerateOutfits: () => void;
}

export const StylePreferencesWidget: React.FC<StylePreferencesWidgetProps> = ({
  preferences,
  ownedCount,
  isGenerating,
  onChange,
  onGenerateOutfits,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateOutfits();
  };

  return (
    <section
      aria-labelledby="widget-style-prefs-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6"
    >
      <div className="pb-4 border-b border-[#ECEDF0]">
        <p className="text-xs font-medium text-[#525866] mb-1">02. 스타일 선호도</p>
        <h2
          id="widget-style-prefs-heading"
          className="text-xl font-semibold text-[#141619]"
        >
          상황·계절·선호 무드 설정
        </h2>
        <p className="text-xs text-[#525866] mt-1">
          설정한 조건을 바탕으로 내 옷장({ownedCount}벌) 안의 의류만 조합해 3가지 코디를 생성합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="pt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="pref-occasion"
              className="block text-xs font-semibold text-[#141619] mb-1.5"
            >
              착용 상황 (TPO)
            </label>
            <select
              id="pref-occasion"
              value={preferences.occasion}
              onChange={(e) => onChange({ ...preferences, occasion: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {OCCASION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-season"
              className="block text-xs font-semibold text-[#141619] mb-1.5"
            >
              계절
            </label>
            <select
              id="pref-season"
              value={preferences.season}
              onChange={(e) =>
                onChange({ ...preferences, season: e.target.value as SeasonTag })
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
              htmlFor="pref-style"
              className="block text-xs font-semibold text-[#141619] mb-1.5"
            >
              선호 스타일
            </label>
            <select
              id="pref-style"
              value={preferences.preferredStyle}
              onChange={(e) => onChange({ ...preferences, preferredStyle: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="pref-additional"
            className="block text-xs font-semibold text-[#141619] mb-1.5"
          >
            추가 요청사항
          </label>
          <textarea
            id="pref-additional"
            rows={2}
            value={preferences.additionalNotes}
            onChange={(e) => onChange({ ...preferences, additionalNotes: e.target.value })}
            placeholder="예: 오래 걸어야 해서 편한 신발 위주로, 실내 난방이 강해 겉옷을 벗어도 단정한 조합"
            className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-xs text-[#6B7280]">
            보유하지 않은 옷은 추천에 포함되지 않으며, 누락된 부위는 가정 사항으로 안내됩니다.
          </p>
          <button
            type="submit"
            disabled={isGenerating || ownedCount < 2}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? '보유 옷으로 3가지 코디 생성 중...' : '보유 옷으로 3가지 코디 추천 받기'}
          </button>
        </div>
      </form>
    </section>
  );
};
