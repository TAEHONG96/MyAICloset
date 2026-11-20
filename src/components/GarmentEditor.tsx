import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, ImagePlus, LoaderCircle, Sparkles } from 'lucide-react';
import { captureVideoFrameToGarmentImage, classifyCameraError, compressGarmentImage } from '../lib/imageUtils';
import { mergeExtractedMetadataToDraft, type GarmentDraftFields } from '../lib/wardrobeLogic';
import { requestImageMetadataExtraction } from '../services/wardrobeApi';
import { CLOTHING_CATEGORIES, FIT_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS, type WardrobeItem } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';
import { Modal } from './Modal';

type FieldName = Exclude<keyof GarmentDraftFields, 'extractedFromImage' | 'summaryNote'>;

const BASIC_FIELDS = [
  { key: 'name', label: '의류 이름', required: true },
  { key: 'color', label: '색상', required: true },
  { key: 'category', label: '카테고리', options: CLOTHING_CATEGORIES },
  { key: 'season', label: '계절', options: SEASON_OPTIONS },
  { key: 'style', label: '스타일', options: STYLE_OPTIONS },
  { key: 'fit', label: '핏', options: FIT_OPTIONS },
] as const;

const DETAIL_FIELDS = [
  { key: 'material', label: '소재' },
  { key: 'pattern', label: '패턴' },
  { key: 'thickness', label: '두께', options: ['얇음', '보통', '두꺼움'] },
  { key: 'silhouetteDetail', label: '실루엣 · 디테일' },
  { key: 'notes', label: '착용 메모' },
] as const;

interface EditorProps {
  item?: WardrobeItem;
  onClose: () => void;
  onSave: (item: Omit<WardrobeItem, 'id'>) => void;
}

export function GarmentEditor({ item, onClose, onSave }: EditorProps) {
  const [draft, setDraft] = useState<GarmentDraftFields>(() => ({
    name: item?.name ?? '',
    color: item?.color ?? '',
    category: item?.category ?? '상의',
    season: item?.season ?? '가을',
    style: item?.style ?? STYLE_OPTIONS[0],
    fit: item?.fit ?? FIT_OPTIONS[1],
    material: item?.visualMeta?.material ?? '',
    pattern: item?.visualMeta?.pattern ?? '',
    thickness: item?.visualMeta?.thickness ?? '',
    silhouetteDetail: item?.visualMeta?.silhouetteDetail ?? '',
    summaryNote: item?.visualMeta?.summaryNote ?? '',
    notes: item?.notes ?? '',
    extractedFromImage: item?.visualMeta?.extractedFromImage ?? false,
  }));
  const [image, setImage] = useState(item?.imageUrl);
  const [working, setWorking] = useState<'photo' | 'analysis'>();
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [aiFields, setAiFields] = useState<FieldName[]>([]);
  const manualFields = useRef(new Set<FieldName>(item ? ['name', 'season', 'style', 'fit', 'notes'] : []));
  const imageInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const operation = useRef(0);
  const cameraOperation = useRef(0);
  const activeStream = useRef<MediaStream>(null);
  const [stream, setStream] = useState<MediaStream>();
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => () => {
    operation.current += 1;
    cameraOperation.current += 1;
    activeStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream]);

  function stopCamera() {
    cameraOperation.current += 1;
    activeStream.current?.getTracks().forEach((track) => track.stop());
    activeStream.current = null;
    setStream(undefined);
    setCameraPending(false);
    setCameraReady(false);
  }

  async function openCamera() {
    if (stream || cameraPending) {
      stopCamera();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저에서 카메라를 사용할 수 없습니다. 이미지 파일을 첨부해 주세요.');
      return;
    }
    const job = ++cameraOperation.current;
    setError('');
    setCameraPending(true);
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (job !== cameraOperation.current) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream.current = camera;
      setStream(camera);
    } catch (err) {
      if (job === cameraOperation.current) setError(classifyCameraError(err));
    } finally {
      if (job === cameraOperation.current) setCameraPending(false);
    }
  }

  async function analyzePhoto(src: string, job: number) {
    setWorking('analysis');
    setError('');
    setFeedback('');
    try {
      let dataUrl = src;
      if (!src.startsWith('data:')) {
        const response = await fetch(src);
        if (!response.ok) throw new Error('의류 사진을 불러오지 못했습니다.');
        const blob = await response.blob();
        const file = new File([blob], 'garment-photo', { type: blob.type });
        dataUrl = (await compressGarmentImage(file)).dataUrl;
      }
      if (job !== operation.current) return;
      const result = await requestImageMetadataExtraction(dataUrl, draft.name.trim() || undefined);
      if (job !== operation.current) return;
      const edited = new Set(manualFields.current);
      setDraft((current) => ({
        ...mergeExtractedMetadataToDraft(current, result, {
          replaceAutoFilledName: !edited.has('name'),
          replaceAutoFilledNotes: !edited.has('notes'),
        }),
        ...Object.fromEntries(Array.from(edited, (field) => [field, current[field]])),
      }));
      const detected: [FieldName, unknown][] = [
        ['name', result.suggestedName.trim()], ['category', result.category],
        ['color', result.color !== '미지정' && result.color?.trim()], ['style', result.style],
        ['fit', result.fit], ['season', result.season], ['material', result.visualMeta.material?.trim()],
        ['pattern', result.visualMeta.pattern?.trim()], ['thickness', result.visualMeta.thickness],
        ['silhouetteDetail', result.visualMeta.silhouetteDetail?.trim()], ['notes', result.visualMeta.summaryNote?.trim()],
      ];
      setAiFields(detected.filter(([, value]) => Boolean(value)).map(([key]) => key));
      setFeedback(`AI가 채운 값을 확인하고 수정할 수 있어요. ${result.uncertaintyNote}`);
    } catch (err) {
      if (job !== operation.current) return;
      setError(`${err instanceof Error ? err.message : '사진 분석에 실패했습니다.'} 다시 분석하거나 직접 입력해 주세요.`);
    } finally {
      if (job === operation.current) setWorking(undefined);
    }
  }

  function usePhoto(src: string, job: number) {
    stopCamera();
    setImage(src);
    setAiFields([]);
    setDraft((current) => ({ ...current, extractedFromImage: false, summaryNote: '' }));
    void analyzePhoto(src, job);
  }

  async function choosePhoto(file: File) {
    const job = ++operation.current;
    setError('');
    setFeedback('');
    setWorking('photo');
    try {
      const photo = await compressGarmentImage(file);
      if (job === operation.current) usePhoto(photo.dataUrl, job);
    } catch (err) {
      if (job !== operation.current) return;
      setWorking(undefined);
      setError(err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.');
    }
  }

  function removePhoto() {
    operation.current += 1;
    // Preserve explicit removal when an older sample item's photo would otherwise be restored.
    setImage(item ? '' : undefined);
    setWorking(undefined);
    setAiFields([]);
    setFeedback('');
    setError('');
    setDraft((current) => ({ ...current, extractedFromImage: false, summaryNote: '' }));
    uploadButton.current?.focus();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    if (!item && !image) {
      setError('등록할 의류 사진을 첨부해 주세요.');
      uploadButton.current?.focus();
      return;
    }
    if (!draft.name.trim() || !draft.color.trim()) {
      setError('의류 이름과 색상을 입력해 주세요.');
      return;
    }
    const { name, color, category, season, style, fit, notes, material, pattern, thickness, silhouetteDetail, summaryNote, extractedFromImage } = draft;
    const meta = {
      material: material.trim() || undefined,
      pattern: pattern.trim() || undefined,
      thickness: thickness || undefined,
      silhouetteDetail: silhouetteDetail.trim() || undefined,
      summaryNote: summaryNote.trim() || undefined,
      extractedFromImage: extractedFromImage || undefined,
    };
    onSave({
      name: name.trim(), color: color.trim(), category, season, style, fit,
      notes: notes.trim() || undefined,
      imageUrl: image,
      visualMeta: Object.values(meta).some(Boolean) ? meta : undefined,
    });
  }

  function renderField({ key, label, options, required }: { key: FieldName; label: string; options?: readonly string[]; required?: boolean }) {
    const update = (value: string) => {
      manualFields.current.add(key);
      setDraft((current) => ({ ...current, [key]: value }));
    };
    const availableOptions = options && (options.includes(draft[key]) ? options : [draft[key], ...options]);
    const id = `garment-field-${key}`;
    return (
      <div key={key} className={key === 'notes' ? 'col-span-full' : 'min-w-0'}>
        <label className="field-label" htmlFor={id}>
          {label}{required && <span className="danger-text"> *</span>}
          {aiFields.includes(key) && !manualFields.current.has(key) && <span className="field-source">AI 입력</span>}
        </label>
        {availableOptions ? (
          <select id={id} className="field-input" value={draft[key]} onChange={(event) => update(event.target.value)}>
            {key === 'thickness' && draft[key] && <option value="">미선택</option>}
            {availableOptions.map((option) => <option key={option} value={option}>{option || '미선택'}</option>)}
          </select>
        ) : (
          <input id={id} className="field-input" value={draft[key]} required={required} onChange={(event) => update(event.target.value)} />
        )}
      </div>
    );
  }

  return (
    <Modal title={item ? '의류 정보 수정' : '의류 등록'} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <div className="upload-stage">
          {image && <GarmentImage src={image} alt="첨부한 의류 사진" />}
          <div className="flex-1 min-w-[160px]">
            <p className="field-label">의류 사진 {!item && <span className="danger-text">*</span>}</p>
            <p className="mb-3 text-sm leading-relaxed text-muted">사진을 올리면 AI가 색상, 소재와 스타일 정보를 채워 줍니다.</p>
            <input ref={imageInput} type="file" accept="image/*" className="hidden" aria-label="의류 사진 파일" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void choosePhoto(file);
            }} />
            <div className="flex flex-wrap gap-2">
              <button ref={uploadButton} type="button" className="action action-primary" onClick={() => imageInput.current?.click()}>
                <ImagePlus size={16} aria-hidden="true" /> {image ? '사진 변경' : '이미지 파일 첨부'}
              </button>
              <button type="button" className="action action-outline" onClick={() => void openCamera()}>
                <Camera size={16} aria-hidden="true" /> {stream ? '카메라 닫기' : cameraPending ? '카메라 연결 취소' : '카메라 촬영'}
              </button>
            </div>
            {image && <div className="flex flex-wrap gap-x-4">
              <button type="button" className="text-action disabled:opacity-50" disabled={Boolean(working)} onClick={() => void analyzePhoto(image, ++operation.current)}>
                <Sparkles size={15} aria-hidden="true" /> AI 다시 분석
              </button>
              <button type="button" className="text-action danger-text" onClick={removePhoto}>사진 제거</button>
            </div>}
          </div>
        </div>
        {stream && (
          <div className="space-y-2">
            <video ref={video} autoPlay playsInline muted onCanPlay={() => setCameraReady(true)} aria-label="촬영 미리보기" className="w-full max-w-sm aspect-[4/3] bg-ink object-contain" />
            <button type="button" className="action action-primary" disabled={!cameraReady} onClick={() => {
              if (!video.current) return;
              try {
                usePhoto(captureVideoFrameToGarmentImage(video.current).dataUrl, ++operation.current);
              } catch (err) {
                setError(err instanceof Error ? err.message : '촬영 중 오류가 발생했습니다.');
              }
            }}>사진 촬영</button>
          </div>
        )}
        <div className="form-status" role="status">
          {working ? (
            <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin shrink-0" aria-hidden="true" />
              {working === 'photo' ? '사진을 준비하는 중입니다.' : 'AI가 사진을 분석하는 중입니다.'}
            </span>
          ) : feedback}
        </div>
        {error && <p className="form-status" role="alert">{error}</p>}
        <fieldset className="editor-fields">
          <legend className="mb-3 font-semibold">기본 정보 <span className="ml-2 text-xs font-normal text-muted">* 필수</span></legend>
          {BASIC_FIELDS.map(renderField)}
        </fieldset>
        <details className="border-t border-line">
          <summary className="disclosure">소재 · 패턴 · 메모 <span className="text-xs font-normal text-muted">선택</span></summary>
          <div className="editor-fields">{DETAIL_FIELDS.map(renderField)}</div>
        </details>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="action action-outline" onClick={onClose}>취소</button>
          <button type="submit" className="action action-primary" disabled={Boolean(working)}>{item ? '변경사항 저장' : '옷장에 등록'}</button>
        </div>
      </form>
    </Modal>
  );
}
