import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ImagePlus, LoaderCircle, Sparkles } from 'lucide-react';
import { PURCHASE_PRESETS } from '../data/sampleCloset';
import { compressGarmentImage } from '../lib/imageUtils';
import { hasUsefulVisualMeta } from '../lib/wardrobeLogic';
import { requestImageMetadataExtraction } from '../services/wardrobeApi';
import {
  CLOTHING_CATEGORIES, FIT_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS,
  type GarmentThickness, type GarmentVisualMetadata, type PurchaseCandidate,
} from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';

const CORE_FIELDS = [
  { key: 'name', label: '구매 후보 이름', required: true },
  { key: 'color', label: '색상', required: true },
  { key: 'category', label: '카테고리', options: CLOTHING_CATEGORIES },
  { key: 'season', label: '계절', options: SEASON_OPTIONS },
  { key: 'style', label: '스타일', options: STYLE_OPTIONS },
  { key: 'fit', label: '핏', options: FIT_OPTIONS },
] as const;

interface PurchaseCandidateWidgetProps {
  candidate: PurchaseCandidate;
  isEvaluating: boolean;
  onChange: (next: PurchaseCandidate) => void;
  onEvaluate: () => void;
}

export function PurchaseCandidateWidget({ candidate, isEvaluating, onChange, onEvaluate }: PurchaseCandidateWidgetProps) {
  const [working, setWorking] = useState<'photo' | 'analysis'>();
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const current = useRef(candidate);
  const sequence = useRef(0);
  current.current = candidate;
  useEffect(() => () => { sequence.current += 1; }, []);

  function updateVisualMeta(patch: Partial<GarmentVisualMetadata>) {
    const meta = { ...candidate.visualMeta, ...patch };
    onChange({ ...candidate, visualMeta: hasUsefulVisualMeta(meta) ? meta : undefined });
  }

  async function choosePhoto(file: File) {
    const job = ++sequence.current;
    setWorking('photo');
    setError('');
    setFeedback('');
    try {
      const photo = await compressGarmentImage(file);
      if (job === sequence.current) onChange({ ...current.current, imageUrl: photo.dataUrl });
    } catch (err) {
      if (job === sequence.current) setError(err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.');
    } finally {
      if (job === sequence.current) setWorking(undefined);
    }
  }

  async function analyzePhoto() {
    if (!candidate.imageUrl) return;
    const job = ++sequence.current;
    setWorking('analysis');
    setError('');
    setFeedback('');
    try {
      const result = await requestImageMetadataExtraction(candidate.imageUrl, candidate.name.trim() || undefined);
      if (job !== sequence.current) return;
      const latest = current.current;
      const fields = {
        name: candidate.name.trim() ? candidate.name : result.suggestedName,
        category: result.category,
        color: result.color && result.color !== '미지정' ? result.color : candidate.color,
        style: STYLE_OPTIONS.includes(result.style) ? result.style : candidate.style,
        fit: FIT_OPTIONS.includes(result.fit) ? result.fit : candidate.fit,
        season: result.season,
        visualMeta: result.visualMeta,
      };
      const unchanged = (Object.keys(fields) as Array<keyof typeof fields>).filter((key) => latest[key] === candidate[key]);
      onChange({ ...latest, ...Object.fromEntries(unchanged.map((key) => [key, fields[key]])) });
      setFeedback(`AI가 사진에서 찾은 정보를 반영했어요. ${result.uncertaintyNote}`);
    } catch (err) {
      if (job === sequence.current) setError(`${err instanceof Error ? err.message : '사진 분석에 실패했습니다.'} 후보 정보를 직접 입력할 수 있어요.`);
    } finally {
      if (job === sequence.current) setWorking(undefined);
    }
  }

  function resetPhotoFeedback() {
    sequence.current += 1;
    setWorking(undefined);
    setError('');
    setFeedback('');
  }

  return (
    <section className="purchase-form" aria-labelledby="purchase-candidate-heading">
      <div className="section-heading">
        <h2 id="purchase-candidate-heading">구매 후보</h2>
        <a className="text-action" href="#purchase-comparison">비교 보기 <ArrowDown size={15} aria-hidden="true" /></a>
      </div>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!candidate.name.trim() || !candidate.color.trim()) {
          setError('후보 이름과 색상을 입력해 주세요.');
          return;
        }
        if (working || isEvaluating) return;
        setError('');
        onEvaluate();
      }}>
        <div className="upload-stage">
          {candidate.imageUrl && <GarmentImage src={candidate.imageUrl} alt="첨부한 구매 후보 사진" />}
          <div className="flex-1 min-w-[155px]">
            <p className="field-label">상품 사진 <span className="font-normal text-muted">선택</span></p>
            <input ref={imageInput} type="file" className="hidden" accept="image/*" aria-label="구매 후보 사진 파일" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void choosePhoto(file);
            }} />
            <div className="flex flex-wrap gap-2">
              <button className="action action-outline" type="button" onClick={() => imageInput.current?.click()}>
                <ImagePlus size={16} aria-hidden="true" /> {candidate.imageUrl ? '사진 변경' : '사진 첨부'}
              </button>
              {candidate.imageUrl && <button className="action action-outline" type="button" disabled={Boolean(working)} onClick={() => void analyzePhoto()}>
                <Sparkles size={15} aria-hidden="true" /> 사진 AI 분석
              </button>}
            </div>
            {candidate.imageUrl && <button className="text-action danger-text" type="button" onClick={() => {
              resetPhotoFeedback();
              onChange({ ...candidate, imageUrl: undefined });
            }}>사진 제거</button>}
          </div>
        </div>
        <div role="status" className="form-status">{working ? (
          <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin shrink-0" aria-hidden="true" />
            {working === 'photo' ? '사진을 준비하는 중이에요.' : 'AI가 상품 사진을 분석하는 중이에요.'}
          </span>
        ) : feedback}</div>
        {error && <p role="alert" className="form-status">{error}</p>}
        <div className="editor-fields">
          {CORE_FIELDS.map((field) => (
            <label key={field.key} className={field.key === 'name' ? 'col-span-full min-w-0' : 'min-w-0'}>
              <span className="field-label">{field.label}{'required' in field && <span className="danger-text"> *</span>}</span>
              {'options' in field ? (
                <select className="field-input" value={candidate[field.key]} onChange={(event) => onChange({ ...candidate, [field.key]: event.target.value })}>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input className="field-input" required value={candidate[field.key]} onChange={(event) => onChange({ ...candidate, [field.key]: event.target.value })} />
              )}
            </label>
          ))}
        </div>
        <details className="border-t border-line">
          <summary className="disclosure">소재 · 가격 · 메모 <span className="text-xs text-muted font-normal">선택</span></summary>
          <div className="editor-fields">
            {(['material', 'pattern', 'silhouetteDetail'] as const).map((key) => (
              <label key={key}>
                <span className="field-label">{{ material: '소재', pattern: '패턴', silhouetteDetail: '실루엣 · 디테일' }[key]}</span>
                <input className="field-input" value={candidate.visualMeta?.[key] ?? ''} onChange={(event) => updateVisualMeta({ [key]: event.target.value || undefined })} />
              </label>
            ))}
            <label>
              <span className="field-label">두께</span>
              <select className="field-input" value={candidate.visualMeta?.thickness ?? ''} onChange={(event) => updateVisualMeta({ thickness: (event.target.value || undefined) as GarmentThickness | undefined })}>
                <option value="">미선택</option>
                {['얇음', '보통', '두꺼움'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span className="field-label">예상 가격 (원)</span>
              <input className="field-input" type="number" min="0" value={candidate.priceKrw} onChange={(event) => onChange({ ...candidate, priceKrw: event.target.value })} />
            </label>
            <label className="col-span-full">
              <span className="field-label">구매를 고민하는 이유</span>
              <textarea className="field-input" rows={2} value={candidate.notes} onChange={(event) => onChange({ ...candidate, notes: event.target.value })} />
            </label>
          </div>
        </details>
        <button className="action action-primary w-full" type="submit" disabled={isEvaluating || Boolean(working)}>
          {isEvaluating ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          {isEvaluating ? '옷장과 비교하는 중' : 'AI 구매 분석 받기'}
        </button>
      </form>
      <details className="mt-3 border-t border-line">
        <summary className="disclosure">예시 후보 불러오기</summary>
        <div className="flex flex-wrap gap-2">
          {PURCHASE_PRESETS.map((preset) => (
            <button className="action action-outline" type="button" key={preset.label} onClick={() => {
              resetPhotoFeedback();
              onChange(preset.candidate);
            }}>{preset.label}</button>
          ))}
        </div>
      </details>
    </section>
  );
}
