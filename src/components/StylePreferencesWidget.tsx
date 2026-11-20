import { LoaderCircle, Sparkles } from 'lucide-react';
import { OCCASION_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS, type SeasonTag, type StylePreferences } from '../types/wardrobe';

interface StylePreferencesWidgetProps {
  preferences: StylePreferences;
  ownedCount: number;
  isGenerating: boolean;
  onChange: (next: StylePreferences) => void;
  onGenerateOutfits: () => void;
}

const PREFERENCE_FIELDS = [
  { key: 'occasion', label: '입을 상황', options: OCCASION_OPTIONS },
  { key: 'season', label: '계절', options: SEASON_OPTIONS },
  { key: 'preferredStyle', label: '선호 스타일', options: STYLE_OPTIONS },
] as const;

export function StylePreferencesWidget({ preferences, ownedCount, isGenerating, onChange, onGenerateOutfits }: StylePreferencesWidgetProps) {
  return (
    <form className="bg-parchment p-4 sm:p-6 space-y-4" onSubmit={(event) => { event.preventDefault(); onGenerateOutfits(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PREFERENCE_FIELDS.map(({ key, label, options }) => (
          <label key={key} className="min-w-0">
            <span className="field-label">{label}</span>
            <select className="field-input" value={preferences[key]} onChange={(event) => {
              const value = event.target.value;
              onChange(key === 'season' ? { ...preferences, season: value as SeasonTag } : { ...preferences, [key]: value });
            }}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
      <details>
        <summary className="disclosure">추가 요청 <span className="text-xs text-muted font-normal">선택</span></summary>
        <label className="block">
          <span className="sr-only">추가 요청사항</span>
          <textarea className="field-input" rows={2} placeholder="예를 들어 오래 걸어야 해서 편한 신발을 신고 싶어요." value={preferences.additionalNotes} onChange={(event) => onChange({ ...preferences, additionalNotes: event.target.value })} />
        </label>
      </details>
      <button className="action action-primary" type="submit" disabled={isGenerating || ownedCount < 2}>
        {isGenerating ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
        {isGenerating ? '코디를 만드는 중' : '코디 3가지 추천받기'}
      </button>
    </form>
  );
}
