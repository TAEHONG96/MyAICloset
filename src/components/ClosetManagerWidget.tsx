import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  FIT_OPTIONS,
  GarmentThickness,
  GarmentVisualMetadata,
  SEASON_OPTIONS,
  SeasonTag,
  STYLE_OPTIONS,
  WardrobeItem,
} from '../types/wardrobe';
import {
  exportWardrobeCsv,
  formatVisualMetadataSummary,
  hasUsefulVisualMeta,
  mergeExtractedMetadataToDraft,
  parseWardrobeCsv,
  resolveKoreanColorHex,
} from '../lib/wardrobeLogic';
import {
  captureVideoFrameToGarmentImage,
  classifyCameraError,
  compressGarmentImage,
} from '../lib/imageUtils';
import { requestImageMetadataExtraction } from '../services/wardrobeApi';
import { SAMPLE_CSV_TEXT } from '../data/sampleCloset';

const THICKNESS_OPTIONS: GarmentThickness[] = ['얇음', '보통', '두꺼움'];

interface CameraViewfinderProps {
  stream: MediaStream;
  onCapture: (videoEl: HTMLVideoElement) => void;
  onClose: () => void;
  label?: string;
}

const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  stream,
  onCapture,
  onClose,
  label = '실시간 카메라 촬영',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsReady(false);
    video.srcObject = stream;
    const handleCanPlay = () => setIsReady(true);
    video.addEventListener('loadedmetadata', handleCanPlay);
    video.addEventListener('canplay', handleCanPlay);
    video.play().catch(() => {
      // Autoplay policies may block until interaction; playsInline + muted handles standard browsers
    });
    return () => {
      video.removeEventListener('loadedmetadata', handleCanPlay);
      video.removeEventListener('canplay', handleCanPlay);
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="p-3 bg-white border border-[#D8DCE2] rounded-lg space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#141619]">
          <Video className="w-3.5 h-3.5 text-[#1F3A5F]" aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#525866] hover:text-[#141619] cursor-pointer"
        >
          카메라 닫기
        </button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label={label}
          className="w-full max-w-xs aspect-[4/3] object-cover rounded-md border border-[#D8DCE2] bg-[#141619]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) onCapture(videoRef.current);
            }}
            disabled={!isReady}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#1F3A5F] text-white hover:bg-[#172C49] disabled:opacity-50 rounded-lg cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            이 사진으로 촬영하기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium border border-[#D8DCE2] text-[#374151] hover:bg-[#F5F6F7] rounded-lg cursor-pointer"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

interface ClosetManagerWidgetProps {
  items: WardrobeItem[];
  onAddItem: (item: Omit<WardrobeItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<WardrobeItem>) => void;
  onImportItems: (items: WardrobeItem[], mode: 'append' | 'replace') => void;
  onDeleteItem: (id: string) => void;
  onResetSample: () => void;
  onClearAll: () => void;
}

export const ClosetManagerWidget: React.FC<ClosetManagerWidgetProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onImportItems,
  onDeleteItem,
  onResetSample,
  onClearAll,
}) => {
  const [activeCategory, setActiveCategory] = useState<'전체' | ClothingCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [panelMode, setPanelMode] = useState<'closed' | 'add' | 'csv'>('closed');

  // Add item form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('상의');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState(STYLE_OPTIONS[0]);
  const [fit, setFit] = useState(FIT_OPTIONS[1]);
  const [season, setSeason] = useState<SeasonTag>('가을');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [material, setMaterial] = useState('');
  const [pattern, setPattern] = useState('');
  const [thickness, setThickness] = useState<GarmentThickness | ''>('');
  const [silhouetteDetail, setSilhouetteDetail] = useState('');
  const [summaryNote, setSummaryNote] = useState('');
  const [extractedFromImage, setExtractedFromImage] = useState(false);
  const [isExtractingAdd, setIsExtractingAdd] = useState(false);
  const [extractFeedbackAdd, setExtractFeedbackAdd] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [addCameraStream, setAddCameraStream] = useState<MediaStream | null>(null);
  const [cameraErrorAdd, setCameraErrorAdd] = useState<string | null>(null);
  const addImageInputRef = useRef<HTMLInputElement | null>(null);
  const addStreamRef = useRef<MediaStream | null>(null);
  const addCameraSessionRef = useRef(0);
  const addAnalysisSeqRef = useRef(0);
  const autoFilledRef = useRef<{ name?: string; notes?: string }>({});
  const addFieldsRef = useRef({
    name,
    category,
    color,
    style,
    fit,
    season,
    material,
    pattern,
    thickness,
    silhouetteDetail,
    summaryNote,
    notes,
    extractedFromImage,
  });
  addFieldsRef.current = {
    name,
    category,
    color,
    style,
    fit,
    season,
    material,
    pattern,
    thickness,
    silhouetteDetail,
    summaryNote,
    notes,
    extractedFromImage,
  };

  // Per-item inline photo & metadata editor state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<ClothingCategory>('상의');
  const [editColor, setEditColor] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(undefined);
  const [editMaterial, setEditMaterial] = useState('');
  const [editPattern, setEditPattern] = useState('');
  const [editThickness, setEditThickness] = useState<GarmentThickness | ''>('');
  const [editSilhouetteDetail, setEditSilhouetteDetail] = useState('');
  const [editSummaryNote, setEditSummaryNote] = useState('');
  const [editExtractedFromImage, setEditExtractedFromImage] = useState(false);
  const [isExtractingEdit, setIsExtractingEdit] = useState(false);
  const [extractFeedbackEdit, setExtractFeedbackEdit] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  const [editCameraStream, setEditCameraStream] = useState<MediaStream | null>(null);
  const [cameraErrorEdit, setCameraErrorEdit] = useState<string | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const editStreamRef = useRef<MediaStream | null>(null);
  const editCameraSessionRef = useRef(0);
  const editAnalysisSeqRef = useRef(0);

  // CSV state
  const [csvText, setCsvText] = useState('');
  const [csvImportMode, setCsvImportMode] = useState<'append' | 'replace'>('append');
  const [csvFeedback, setCsvFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopAddCamera = () => {
    addCameraSessionRef.current += 1;
    if (addStreamRef.current) {
      addStreamRef.current.getTracks().forEach((track) => track.stop());
      addStreamRef.current = null;
    }
    setAddCameraStream(null);
  };

  const stopEditCamera = () => {
    editCameraSessionRef.current += 1;
    if (editStreamRef.current) {
      editStreamRef.current.getTracks().forEach((track) => track.stop());
      editStreamRef.current = null;
    }
    setEditCameraStream(null);
  };

  useEffect(() => {
    return () => {
      addCameraSessionRef.current += 1;
      editCameraSessionRef.current += 1;
      addStreamRef.current?.getTracks().forEach((track) => track.stop());
      editStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== '전체' && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.style.toLowerCase().includes(q) ||
        item.fit.toLowerCase().includes(q) ||
        item.season.toLowerCase().includes(q) ||
        (item.visualMeta?.material?.toLowerCase().includes(q) ?? false) ||
        (item.visualMeta?.pattern?.toLowerCase().includes(q) ?? false) ||
        (item.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, activeCategory, searchQuery]);

  const buildVisualMeta = (fields: {
    material: string;
    pattern: string;
    thickness: GarmentThickness | '';
    silhouetteDetail: string;
    summaryNote: string;
    extractedFromImage: boolean;
  }): GarmentVisualMetadata | undefined => {
    const meta: GarmentVisualMetadata = {
      ...(fields.material.trim() ? { material: fields.material.trim() } : {}),
      ...(fields.pattern.trim() ? { pattern: fields.pattern.trim() } : {}),
      ...(fields.thickness ? { thickness: fields.thickness } : {}),
      ...(fields.silhouetteDetail.trim() ? { silhouetteDetail: fields.silhouetteDetail.trim() } : {}),
      ...(fields.summaryNote.trim() ? { summaryNote: fields.summaryNote.trim() } : {}),
      ...(fields.extractedFromImage ? { extractedFromImage: true } : {}),
    };
    return hasUsefulVisualMeta(meta) ? meta : undefined;
  };

  const resetAddForm = () => {
    stopAddCamera();
    addAnalysisSeqRef.current += 1;
    autoFilledRef.current = {};
    setName('');
    setColor('');
    setNotes('');
    setImageUrl(undefined);
    setMaterial('');
    setPattern('');
    setThickness('');
    setSilhouetteDetail('');
    setSummaryNote('');
    setExtractedFromImage(false);
    setIsExtractingAdd(false);
    setExtractFeedbackAdd(null);
    setCameraErrorAdd(null);
    setFormError(null);
  };

  const runAutoAddAnalysis = async (
    targetDataUrl: string,
    hintName?: string,
    forceRefresh = false
  ) => {
    const seq = ++addAnalysisSeqRef.current;
    setIsExtractingAdd(true);
    setExtractFeedbackAdd({
      type: 'info',
      message: 'AI가 사진에서 의류 카테고리·색상·소재 및 상세정보를 자동 분석하고 있습니다...',
    });

    try {
      const extracted = await requestImageMetadataExtraction(targetDataUrl, hintName);
      if (seq !== addAnalysisSeqRef.current) return;

      const currentSnapshot = addFieldsRef.current;
      const shouldReplaceName =
        forceRefresh ||
        !currentSnapshot.name.trim() ||
        currentSnapshot.name.trim() === autoFilledRef.current.name;
      const shouldReplaceNotes =
        forceRefresh ||
        !currentSnapshot.notes.trim() ||
        currentSnapshot.notes.trim() === autoFilledRef.current.notes;

      const merged = mergeExtractedMetadataToDraft(currentSnapshot, extracted, {
        replaceAutoFilledName: shouldReplaceName,
        replaceAutoFilledNotes: shouldReplaceNotes,
      });

      if (shouldReplaceName && merged.name.trim()) {
        autoFilledRef.current.name = merged.name.trim();
      }
      if (shouldReplaceNotes && merged.notes.trim()) {
        autoFilledRef.current.notes = merged.notes.trim();
      }

      setName(merged.name);
      setCategory(merged.category);
      setColor(merged.color);
      setStyle(merged.style);
      setFit(merged.fit);
      setSeason(merged.season);
      setMaterial(merged.material);
      setPattern(merged.pattern);
      setThickness(merged.thickness);
      setSilhouetteDetail(merged.silhouetteDetail);
      setSummaryNote(merged.summaryNote);
      setNotes(merged.notes);
      setExtractedFromImage(true);
      setFormError(null);

      const detectedSummary = [
        `카테고리: ${merged.category}`,
        merged.color ? `색상: ${merged.color}` : null,
        merged.material ? `소재: ${merged.material}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      setExtractFeedbackAdd({
        type: 'info',
        message: `AI 자동 분석·기입 완료 (${detectedSummary}). ${extracted.uncertaintyNote}`,
      });
    } catch (err) {
      if (seq !== addAnalysisSeqRef.current) return;
      setExtractFeedbackAdd({
        type: 'error',
        message:
          err instanceof Error
            ? `${err.message} 아래 카테고리·색상·소재·상세정보는 직접 입력해 등록할 수 있습니다.`
            : '사진 자동 분석에 실패했습니다. 아래 항목을 직접 입력해 주세요.',
      });
    } finally {
      if (seq === addAnalysisSeqRef.current) {
        setIsExtractingAdd(false);
      }
    }
  };

  const acquireCameraStream = async (): Promise<MediaStream> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('현재 브라우저 환경에서 실시간 카메라 API(getUserMedia)를 지원하지 않습니다.');
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      throw err;
    }
  };

  const openAddCamera = async () => {
    if (addCameraStream) {
      stopAddCamera();
      return;
    }
    stopEditCamera();
    setCameraErrorAdd(null);
    const sessionId = ++addCameraSessionRef.current;

    try {
      const stream = await acquireCameraStream();
      if (sessionId !== addCameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      addStreamRef.current = stream;
      setAddCameraStream(stream);
    } catch (err) {
      if (sessionId !== addCameraSessionRef.current) return;
      setCameraErrorAdd(
        err instanceof Error && err.message.includes('getUserMedia')
          ? `${err.message} [이미지 파일 첨부]를 이용해 주세요.`
          : classifyCameraError(err)
      );
    }
  };

  const handleCaptureAddPhoto = (videoEl: HTMLVideoElement) => {
    try {
      const compressed = captureVideoFrameToGarmentImage(videoEl);
      stopAddCamera();
      setImageUrl(compressed.dataUrl);
      setCameraErrorAdd(null);
      setFormError(null);
      void runAutoAddAnalysis(compressed.dataUrl, name);
    } catch (err) {
      setCameraErrorAdd(err instanceof Error ? err.message : '촬영 중 오류가 발생했습니다.');
    }
  };

  const handleAddImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressGarmentImage(file);
      stopAddCamera();
      setImageUrl(compressed.dataUrl);
      setCameraErrorAdd(null);
      setFormError(null);
      void runAutoAddAnalysis(compressed.dataUrl, name);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.');
    }
  };

  const startEditingItem = (item: WardrobeItem) => {
    stopEditCamera();
    editAnalysisSeqRef.current += 1;
    setIsExtractingEdit(false);
    setCameraErrorEdit(null);

    if (editingItemId === item.id) {
      setEditingItemId(null);
      return;
    }
    setEditingItemId(item.id);
    setEditCategory(item.category);
    setEditColor(item.color);
    setEditImageUrl(item.imageUrl);
    setEditMaterial(item.visualMeta?.material ?? '');
    setEditPattern(item.visualMeta?.pattern ?? '');
    setEditThickness(item.visualMeta?.thickness ?? '');
    setEditSilhouetteDetail(item.visualMeta?.silhouetteDetail ?? '');
    setEditSummaryNote(item.visualMeta?.summaryNote ?? '');
    setEditExtractedFromImage(Boolean(item.visualMeta?.extractedFromImage));
    setExtractFeedbackEdit(null);
  };

  const runAutoEditAnalysis = async (targetDataUrl: string, targetItem: WardrobeItem) => {
    const seq = ++editAnalysisSeqRef.current;
    setIsExtractingEdit(true);
    setExtractFeedbackEdit({
      type: 'info',
      message: 'AI가 사진에서 의류 카테고리·색상·소재 정보를 자동 분석하고 있습니다...',
    });

    try {
      const extracted = await requestImageMetadataExtraction(targetDataUrl, targetItem.name);
      if (seq !== editAnalysisSeqRef.current) return;

      setEditCategory(extracted.category);
      if (extracted.color && extracted.color.trim() && extracted.color.trim() !== '미지정') {
        setEditColor(extracted.color.trim());
      }
      setEditMaterial(extracted.visualMeta.material ?? '');
      setEditPattern(extracted.visualMeta.pattern ?? '');
      setEditThickness(extracted.visualMeta.thickness ?? '');
      setEditSilhouetteDetail(extracted.visualMeta.silhouetteDetail ?? '');
      setEditSummaryNote(extracted.visualMeta.summaryNote ?? '');
      setEditExtractedFromImage(true);
      setExtractFeedbackEdit({
        type: 'info',
        message: `AI 자동 분석 완료 (카테고리: ${extracted.category}, 색상: ${extracted.color}${
          extracted.visualMeta.material ? `, 소재: ${extracted.visualMeta.material}` : ''
        }). 저장을 누르면 즉시 반영됩니다. (${extracted.uncertaintyNote})`,
      });
    } catch (err) {
      if (seq !== editAnalysisSeqRef.current) return;
      setExtractFeedbackEdit({
        type: 'error',
        message:
          err instanceof Error
            ? `${err.message} 아래 카테고리·색상·소재 입력란을 직접 수정해 저장할 수 있습니다.`
            : '사진 메타데이터 추출에 실패했습니다.',
      });
    } finally {
      if (seq === editAnalysisSeqRef.current) {
        setIsExtractingEdit(false);
      }
    }
  };

  const openEditCamera = async () => {
    if (editCameraStream) {
      stopEditCamera();
      return;
    }
    stopAddCamera();
    setCameraErrorEdit(null);
    const sessionId = ++editCameraSessionRef.current;

    try {
      const stream = await acquireCameraStream();
      if (sessionId !== editCameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      editStreamRef.current = stream;
      setEditCameraStream(stream);
    } catch (err) {
      if (sessionId !== editCameraSessionRef.current) return;
      setCameraErrorEdit(
        err instanceof Error && err.message.includes('getUserMedia')
          ? `${err.message} [이미지 파일 첨부]를 이용해 주세요.`
          : classifyCameraError(err)
      );
    }
  };

  const handleCaptureEditPhoto = (videoEl: HTMLVideoElement, targetItem: WardrobeItem) => {
    try {
      const compressed = captureVideoFrameToGarmentImage(videoEl);
      stopEditCamera();
      setEditImageUrl(compressed.dataUrl);
      setCameraErrorEdit(null);
      void runAutoEditAnalysis(compressed.dataUrl, targetItem);
    } catch (err) {
      setCameraErrorEdit(err instanceof Error ? err.message : '촬영 중 오류가 발생했습니다.');
    }
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const targetItem = items.find((i) => i.id === editingItemId);
    try {
      const compressed = await compressGarmentImage(file);
      stopEditCamera();
      setEditImageUrl(compressed.dataUrl);
      setCameraErrorEdit(null);
      if (targetItem) {
        void runAutoEditAnalysis(compressed.dataUrl, targetItem);
      }
    } catch (err) {
      setExtractFeedbackEdit({
        type: 'error',
        message: err instanceof Error ? err.message : '이미지를 불러오지 못했습니다.',
      });
    }
  };

  const handleSaveItemMeta = (id: string) => {
    stopEditCamera();
    const trimmedColor = editColor.trim();
    onUpdateItem(id, {
      category: editCategory,
      ...(trimmedColor ? { color: trimmedColor } : {}),
      imageUrl: editImageUrl,
      visualMeta: buildVisualMeta({
        material: editMaterial,
        pattern: editPattern,
        thickness: editThickness,
        silhouetteDetail: editSilhouetteDetail,
        summaryNote: editSummaryNote,
        extractedFromImage: editExtractedFromImage,
      }),
    });
    setEditingItemId(null);
    setExtractFeedbackEdit(null);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      setFormError('의류 사진을 먼저 촬영하거나 이미지 파일을 첨부해 주세요. (필수)');
      return;
    }
    if (isExtractingAdd) {
      setFormError('AI가 이미지를 분석하고 있습니다. 잠시 후 다시 등록해 주세요.');
      return;
    }
    if (!name.trim()) {
      setFormError('의류 이름을 입력해 주세요. (예: 아이보리 메리노울 니트)');
      return;
    }
    if (!color.trim()) {
      setFormError('색상을 입력해 주세요. (예: 아이보리, 네이비, 차콜)');
      return;
    }

    onAddItem({
      name: name.trim(),
      category,
      color: color.trim(),
      style,
      fit,
      season,
      notes: notes.trim() || undefined,
      imageUrl,
      visualMeta: buildVisualMeta({
        material,
        pattern,
        thickness,
        silhouetteDetail,
        summaryNote,
        extractedFromImage,
      }),
    });

    resetAddForm();
    setPanelMode('closed');
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(content);
      setCsvFeedback(null);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleImportCsv = () => {
    const result = parseWardrobeCsv(csvText);
    if (result.items.length === 0) {
      setCsvFeedback({
        type: 'error',
        message: '가져올 수 있는 유효한 의류 행이 없습니다.',
        details: result.errors,
      });
      return;
    }

    onImportItems(result.items, csvImportMode);
    setCsvFeedback({
      type: 'success',
      message: `${result.items.length}벌의 의류를 ${
        csvImportMode === 'append' ? '기존 옷장에 추가' : '새 목록으로 교체'
      }했습니다.${result.skippedRows > 0 ? ` (${result.skippedRows}행 제외)` : ''}`,
      details: result.errors.length > 0 ? result.errors : undefined,
    });
    setCsvText('');
  };

  const handleDownloadCsv = () => {
    const csv = exportWardrobeCsv(items);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-ai-closet.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="widget-my-closet-heading"
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#ECEDF0]">
        <div>
          <p className="text-xs font-medium text-[#525866] mb-1">01. 내 옷장</p>
          <h2
            id="widget-my-closet-heading"
            className="text-xl sm:text-2xl font-semibold text-[#141619]"
          >
            보유 의류 목록
          </h2>
          <p className="text-sm text-[#525866] mt-1">
            총 <span className="font-mono tabular-nums font-semibold text-[#141619]">{items.length}</span>벌 등록됨 · 모든 AI 추천과 상담은 이 목록만을 근거로 작동합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (panelMode === 'add') {
                stopAddCamera();
                setPanelMode('closed');
              } else {
                setPanelMode('add');
              }
              setFormError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              panelMode === 'add'
                ? 'bg-[#1F3A5F] text-white'
                : 'bg-[#141619] text-white hover:bg-[#2B303A]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            의류 직접 추가
          </button>

          <button
            type="button"
            onClick={() => {
              stopAddCamera();
              setPanelMode(panelMode === 'csv' ? 'closed' : 'csv');
              setCsvFeedback(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              panelMode === 'csv'
                ? 'border-[#1F3A5F] text-[#1F3A5F] bg-[#1F3A5F]/5'
                : 'border-[#D8DCE2] text-[#141619] hover:bg-[#F5F6F7]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            CSV 가져오기
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#D8DCE2] text-[#374151] hover:bg-[#F5F6F7] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Add Garment Inline Panel */}
      {panelMode === 'add' && (
        <form
          onSubmit={handleSubmitItem}
          noValidate
          className="py-5 border-b border-[#ECEDF0] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#141619]">새 보유 의류 등록</h3>
            <button
              type="button"
              onClick={() => {
                setPanelMode('closed');
                resetAddForm();
              }}
              className="text-xs text-[#525866] hover:text-[#141619] cursor-pointer"
            >
              닫기
            </button>
          </div>

          {/* Photo Upload + Camera Capture + Auto AI Metadata Extraction Strip (Required) */}
          <div
            className={`p-3.5 bg-[#FAFBFB] border rounded-lg space-y-3 ${
              !imageUrl && formError?.includes('사진')
                ? 'border-[#B91C1C]'
                : 'border-[#E5E7EB]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <div className="relative shrink-0">
                    <img
                      src={imageUrl}
                      alt="첨부한 의류 미리보기"
                      className="w-16 h-20 object-cover rounded-md border border-[#D8DCE2] bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addAnalysisSeqRef.current += 1;
                        setIsExtractingAdd(false);
                        setImageUrl(undefined);
                        setExtractedFromImage(false);
                        setExtractFeedbackAdd(null);
                      }}
                      aria-label="첨부 사진 삭제"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#141619] text-white flex items-center justify-center hover:bg-[#B91C1C] cursor-pointer"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-20 rounded-md border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center text-[#6B7280] shrink-0">
                    <Camera className="w-4 h-4 mb-1" aria-hidden="true" />
                    <span className="text-[10px]">사진 필수</span>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#141619]">
                    의류 사진 등록 및 AI 자동 분석 <span className="text-[#B91C1C]">*</span>{' '}
                    <span className="text-[11px] font-normal text-[#B91C1C]">(필수)</span>
                  </p>
                  <p className="text-[11px] text-[#525866] leading-relaxed">
                    카메라로 촬영하거나 이미지 파일을 첨부하면 AI가{' '}
                    <strong className="font-medium text-[#141619]">
                      의류 이름·카테고리·색상·소재·상세정보
                    </strong>
                    를 자동으로 분석해 채워 줍니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  ref={addImageInputRef}
                  id="closet-add-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAddImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={openAddCamera}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg cursor-pointer transition-colors ${
                    addCameraStream
                      ? 'border-[#1F3A5F] bg-[#1F3A5F]/10 text-[#1F3A5F]'
                      : 'border-[#D8DCE2] bg-white text-[#141619] hover:bg-[#F5F6F7]'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  {addCameraStream ? '카메라 닫기' : '카메라 촬영'}
                </button>
                <button
                  type="button"
                  onClick={() => addImageInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#D8DCE2] bg-white text-[#141619] hover:bg-[#F5F6F7] rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  {imageUrl ? '이미지 변경' : '이미지 파일 첨부'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => void runAutoAddAnalysis(imageUrl, name, true)}
                    disabled={isExtractingAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1F3A5F] text-white hover:bg-[#172C49] disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {isExtractingAdd ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {isExtractingAdd ? 'AI 자동 분석 중...' : 'AI 다시 분석'}
                  </button>
                )}
              </div>
            </div>

            {addCameraStream && (
              <CameraViewfinder
                stream={addCameraStream}
                onCapture={handleCaptureAddPhoto}
                onClose={stopAddCamera}
                label="새 의류 카메라 촬영"
              />
            )}

            {cameraErrorAdd && (
              <p role="alert" className="text-xs text-[#B91C1C] leading-relaxed">
                {cameraErrorAdd}
              </p>
            )}

            {extractFeedbackAdd && (
              <div
                role={extractFeedbackAdd.type === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 text-xs leading-relaxed ${
                  extractFeedbackAdd.type === 'error' ? 'text-[#B91C1C]' : 'text-[#1F3A5F]'
                }`}
              >
                {isExtractingAdd && (
                  <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
                )}
                <span>{extractFeedbackAdd.message}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="closet-name" className="block text-xs font-medium text-[#374151] mb-1">
                의류 이름 <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                id="closet-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="예: 베이지 캐시미어 머플러"
                className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="closet-category" className="block text-xs font-medium text-[#374151] mb-1">
                카테고리
              </label>
              <select
                id="closet-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ClothingCategory)}
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
              <label htmlFor="closet-color" className="block text-xs font-medium text-[#374151] mb-1">
                색상 <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                id="closet-color"
                type="text"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="예: 네이비, 아이보리, 올리브"
                className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="closet-style" className="block text-xs font-medium text-[#374151] mb-1">
                스타일
              </label>
              <select
                id="closet-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
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
              <label htmlFor="closet-fit" className="block text-xs font-medium text-[#374151] mb-1">
                핏 / 실루엣
              </label>
              <select
                id="closet-fit"
                value={fit}
                onChange={(e) => setFit(e.target.value)}
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
              <label htmlFor="closet-season" className="block text-xs font-medium text-[#374151] mb-1">
                계절
              </label>
              <select
                id="closet-season"
                value={season}
                onChange={(e) => setSeason(e.target.value as SeasonTag)}
                className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
              >
                {SEASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Metadata Sub-grid */}
          <div className="pt-2 border-t border-[#F0F1F4]">
            <p className="text-xs font-semibold text-[#141619] mb-2.5">
              상세 시각 메타데이터 (코디 조합 및 중복 판단 기준)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="closet-material" className="block text-xs font-medium text-[#374151] mb-1">
                  소재
                </label>
                <input
                  id="closet-material"
                  type="text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="예: 울, 코튼, 데님, 린넨"
                  className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="closet-pattern" className="block text-xs font-medium text-[#374151] mb-1">
                  패턴
                </label>
                <input
                  id="closet-pattern"
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="예: 무지, 스트라이프, 체크"
                  className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="closet-thickness" className="block text-xs font-medium text-[#374151] mb-1">
                  두께감
                </label>
                <select
                  id="closet-thickness"
                  value={thickness}
                  onChange={(e) => setThickness(e.target.value as GarmentThickness | '')}
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
                <label htmlFor="closet-silhouette" className="block text-xs font-medium text-[#374151] mb-1">
                  상세 실루엣 · 디테일
                </label>
                <input
                  id="closet-silhouette"
                  type="text"
                  value={silhouetteDetail}
                  onChange={(e) => setSilhouetteDetail(e.target.value)}
                  placeholder="예: 노치드 라펠, 투턱"
                  className="w-full px-3 py-1.5 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="closet-notes" className="block text-xs font-medium text-[#374151] mb-1">
              기장·활용 메모 (선택)
            </label>
            <input
              id="closet-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 얇은 울 혼방이라 아우터 이너로 활용하기 좋음"
              className="w-full px-3 py-2 text-sm border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-[#B91C1C]">
              입력 오류: {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPanelMode('closed');
                resetAddForm();
              }}
              className="px-4 py-2 text-xs font-medium text-[#525866] hover:text-[#141619] cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isExtractingAdd}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {isExtractingAdd ? 'AI 이미지 분석 중...' : '옷장에 등록'}
            </button>
          </div>
        </form>
      )}

      {/* CSV Import Panel */}
      {panelMode === 'csv' && (
        <div className="py-5 border-b border-[#ECEDF0] space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#141619]">CSV 문서로 의류 일괄 등록</h3>
              <p className="text-xs text-[#525866] mt-0.5">
                컬럼 형식: <span className="font-mono">이름,카테고리,색상,스타일,핏,계절,소재,패턴,두께,상세특징,메모</span> (소재·패턴·두께·상세특징 생략 가능)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvText(SAMPLE_CSV_TEXT);
                  setCsvFeedback(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#1F3A5F] border border-[#1F3A5F]/30 rounded-lg hover:bg-[#1F3A5F]/5 cursor-pointer"
              >
                샘플 CSV 채우기
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium text-[#141619] border border-[#D8DCE2] rounded-lg hover:bg-[#F5F6F7] cursor-pointer"
              >
                CSV 파일 선택
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="hidden"
                aria-label="CSV 파일 업로드"
              />
            </div>
          </div>

          <label htmlFor="closet-csv-textarea" className="sr-only">
            CSV 데이터 입력
          </label>
          <textarea
            id="closet-csv-textarea"
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              if (csvFeedback) setCsvFeedback(null);
            }}
            placeholder={`이름,카테고리,색상,스타일,핏,계절,소재,패턴,두께,상세특징,메모\n아이보리 셔츠,상의,아이보리,미니멀,레귤러핏,사계절,코튼,무지,보통,버튼다운 칼라,출근용`}
            className="w-full p-3 text-xs font-mono border border-[#D8DCE2] rounded-lg bg-[#FAFBFB] text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-[#374151]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="csv-mode"
                  checked={csvImportMode === 'append'}
                  onChange={() => setCsvImportMode('append')}
                />
                기존 옷장에 추가
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="csv-mode"
                  checked={csvImportMode === 'replace'}
                  onChange={() => setCsvImportMode('replace')}
                />
                현재 목록 전체 교체
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPanelMode('closed')}
                className="px-3 py-2 text-xs font-medium text-[#525866] hover:text-[#141619] cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] rounded-lg transition-colors cursor-pointer"
              >
                CSV 반영하기
              </button>
            </div>
          </div>

          {csvFeedback && (
            <div
              role="status"
              className={`text-xs pt-2 ${
                csvFeedback.type === 'success' ? 'text-[#15803D]' : 'text-[#B91C1C]'
              }`}
            >
              <p className="font-medium">{csvFeedback.message}</p>
              {csvFeedback.details && csvFeedback.details.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-[#525866] space-y-0.5">
                  {csvFeedback.details.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search & Category Filter Controls */}
      <div className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#ECEDF0]">
        <div
          role="tablist"
          aria-label="보유 의류 분류 필터"
          className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg overflow-x-auto"
        >
          {(['전체', ...CLOTHING_CATEGORIES] as const).map((cat) => {
            const count =
              cat === '전체'
                ? items.length
                : items.filter((item) => item.category === cat).length;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#141619] shadow-xs'
                    : 'text-[#525866] hover:text-[#141619]'
                }`}
              >
                {cat}{' '}
                <span className="font-mono tabular-nums text-[11px] opacity-75">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-64">
          <Search
            className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="closet-search" className="sr-only">
            보유 의류 검색
          </label>
          <input
            id="closet-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 색상, 소재, 패턴 검색..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D8DCE2] rounded-lg bg-white text-[#141619] focus:border-[#1F3A5F] focus:outline-none"
          />
        </div>
      </div>

      {/* Inventory Table (Desktop) / Clean Stacked List (Mobile) / Empty State */}
      {items.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm font-medium text-[#141619]">등록된 의류가 아직 없습니다.</p>
          <p className="text-xs text-[#525866] max-w-md mx-auto">
            의류를 직접 추가하거나 CSV 문서를 업로드하면 옷장 분석, 보유 옷 기반 코디 추천, 구매 가치 검토가 자동으로 연동됩니다.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPanelMode('add')}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] rounded-lg cursor-pointer"
            >
              첫 번째 옷 등록하기
            </button>
            <button
              type="button"
              onClick={onResetSample}
              className="px-4 py-2 text-xs font-medium text-[#141619] border border-[#D8DCE2] hover:bg-[#F5F6F7] rounded-lg cursor-pointer"
            >
              기본 예시 옷장 불러오기
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-sm text-[#525866]">조건에 일치하는 의류가 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('전체');
              setSearchQuery('');
            }}
            className="text-xs font-medium text-[#1F3A5F] hover:underline cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <>
          {/* Hidden shared file input for editing existing items */}
          <input
            ref={editImageInputRef}
            type="file"
            accept="image/*"
            onChange={handleEditImageSelect}
            className="hidden"
            aria-label="기존 의류 사진 첨부"
          />

          {/* Mobile stacked list (no clipped table cells on 390px screens) */}
          <ul className="sm:hidden divide-y divide-[#F0F1F4]">
            {filteredItems.map((item) => {
              const hex = resolveKoreanColorHex(item.color);
              const metaSummary = formatVisualMetadataSummary(item.visualMeta);
              const isEditing = editingItemId === item.id;

              return (
                <li key={item.id} className="py-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-14 object-cover rounded-md border border-[#E5E7EB] shrink-0"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="w-12 h-14 rounded-md border border-[#E5E7EB] flex items-center justify-center shrink-0 bg-[#FAFBFB]"
                        >
                          <span
                            className="w-4 h-4 rounded-xs border border-black/15"
                            style={{ backgroundColor: hex }}
                          />
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-medium text-[#141619] leading-snug">
                          {item.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#525866]">
                          <span>{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[#374151]">
                            {item.color}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.style}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.fit}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.season}</span>
                        </div>
                        {metaSummary && (
                          <p className="text-[11px] text-[#1F3A5F] leading-relaxed">
                            {metaSummary}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-[#6B7280] leading-relaxed">{item.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditingItem(item)}
                        aria-label={`'${item.name}' 사진 및 메타데이터 편집`}
                        className="p-2 text-[#525866] hover:text-[#1F3A5F] rounded-md cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        aria-label={`'${item.name}' 삭제`}
                        className="p-2 text-[#6B7280] hover:text-[#B91C1C] rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="p-3 bg-[#FAFBFB] border border-[#E5E7EB] rounded-lg space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#141619]">사진 · 메타데이터 편집</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={openEditCamera}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#D8DCE2] bg-white rounded-md text-[#141619] cursor-pointer"
                          >
                            <Camera className="w-3 h-3" aria-hidden="true" />
                            {editCameraStream ? '카메라 닫기' : '카메라 촬영'}
                          </button>
                          <button
                            type="button"
                            onClick={() => editImageInputRef.current?.click()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#D8DCE2] bg-white rounded-md text-[#141619] cursor-pointer"
                          >
                            <Upload className="w-3 h-3" aria-hidden="true" />
                            {editImageUrl ? '파일 변경' : '파일 첨부'}
                          </button>
                          {editImageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                editAnalysisSeqRef.current += 1;
                                setIsExtractingEdit(false);
                                setEditImageUrl(undefined);
                                setEditExtractedFromImage(false);
                                setExtractFeedbackEdit(null);
                              }}
                              className="px-2 py-1 text-[#B91C1C] cursor-pointer"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>

                      {editCameraStream && (
                        <CameraViewfinder
                          stream={editCameraStream}
                          onCapture={(videoEl) => handleCaptureEditPhoto(videoEl, item)}
                          onClose={stopEditCamera}
                          label={`'${item.name}' 카메라 촬영`}
                        />
                      )}

                      {cameraErrorEdit && (
                        <p role="alert" className="text-[#B91C1C] leading-relaxed">
                          {cameraErrorEdit}
                        </p>
                      )}

                      {editImageUrl && (
                        <div className="flex items-center gap-3">
                          <img
                            src={editImageUrl}
                            alt={`${item.name} 첨부 사진`}
                            className="w-14 h-16 object-cover rounded border border-[#D8DCE2]"
                          />
                          <button
                            type="button"
                            onClick={() => void runAutoEditAnalysis(editImageUrl, item)}
                            disabled={isExtractingEdit}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1F3A5F] text-white rounded-md disabled:opacity-50 cursor-pointer"
                          >
                            {isExtractingEdit ? (
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <Sparkles className="w-3 h-3" aria-hidden="true" />
                            )}
                            {isExtractingEdit ? 'AI 분석 중...' : 'AI 다시 분석'}
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as ClothingCategory)}
                          aria-label="카테고리"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        >
                          {CLOTHING_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          placeholder="색상 (예: 네이비)"
                          aria-label="색상"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        />
                        <input
                          type="text"
                          value={editMaterial}
                          onChange={(e) => setEditMaterial(e.target.value)}
                          placeholder="소재 (예: 울)"
                          aria-label="소재"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        />
                        <input
                          type="text"
                          value={editPattern}
                          onChange={(e) => setEditPattern(e.target.value)}
                          placeholder="패턴 (예: 무지)"
                          aria-label="패턴"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        />
                        <select
                          value={editThickness}
                          onChange={(e) => setEditThickness(e.target.value as GarmentThickness | '')}
                          aria-label="두께감"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        >
                          <option value="">두께감 미선택</option>
                          {THICKNESS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editSilhouetteDetail}
                          onChange={(e) => setEditSilhouetteDetail(e.target.value)}
                          placeholder="상세 실루엣"
                          aria-label="상세 실루엣"
                          className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white"
                        />
                      </div>

                      {extractFeedbackEdit && (
                        <p
                          role={extractFeedbackEdit.type === 'error' ? 'alert' : 'status'}
                          className={
                            extractFeedbackEdit.type === 'error' ? 'text-[#B91C1C]' : 'text-[#1F3A5F]'
                          }
                        >
                          {extractFeedbackEdit.message}
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            stopEditCamera();
                            setEditingItemId(null);
                          }}
                          className="px-3 py-1 text-[#525866] cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveItemMeta(item.id)}
                          className="px-3 py-1 bg-[#1F3A5F] text-white rounded-md cursor-pointer"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Desktop / Tablet data table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#ECEDF0] text-[11px] font-semibold text-[#525866]">
                  <th className="py-2.5 pr-3">아이템 · 시각 메타데이터</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">카테고리</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">색상</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">스타일 · 핏</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">계절</th>
                  <th className="py-2.5 pl-3 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F4] text-sm">
                {filteredItems.map((item) => {
                  const hex = resolveKoreanColorHex(item.color);
                  const metaSummary = formatVisualMetadataSummary(item.visualMeta);
                  const isEditing = editingItemId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-[#F8F9FA] transition-colors group">
                        <td className="py-3 pr-3 min-w-[230px]">
                          <div className="flex items-start gap-2.5">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-10 h-12 object-cover rounded border border-[#E5E7EB] shrink-0 bg-white"
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className="w-10 h-12 rounded border border-[#E5E7EB] bg-[#FAFBFB] flex items-center justify-center shrink-0"
                                title="사진 미첨부"
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-xs border border-black/15"
                                  style={{ backgroundColor: hex }}
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-[#141619]">{item.name}</div>
                              {metaSummary && (
                                <div className="text-[11px] text-[#1F3A5F] mt-0.5">
                                  {metaSummary}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#374151] whitespace-nowrap">
                          {item.category}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#374151] whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="w-3 h-3 rounded-xs border border-black/15 shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            {item.color}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#525866] whitespace-nowrap">
                          {item.style} <span aria-hidden="true">·</span> {item.fit}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#525866] whitespace-nowrap">
                          {item.season}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditingItem(item)}
                              aria-label={`'${item.name}' 사진 및 메타데이터 편집`}
                              className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                                isEditing
                                  ? 'border-[#1F3A5F] text-[#1F3A5F] bg-[#1F3A5F]/5'
                                  : 'border-[#E5E7EB] text-[#525866] hover:text-[#141619] hover:border-[#D8DCE2]'
                              }`}
                            >
                              사진·메타
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              aria-label={`'${item.name}' 삭제`}
                              className="p-1.5 text-[#6B7280] hover:text-[#B91C1C] rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditing && (
                        <tr className="bg-[#FAFBFB]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="space-y-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  {editImageUrl ? (
                                    <div className="relative">
                                      <img
                                        src={editImageUrl}
                                        alt={`${item.name} 첨부 사진`}
                                        className="w-14 h-16 object-cover rounded border border-[#D8DCE2] bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          editAnalysisSeqRef.current += 1;
                                          setIsExtractingEdit(false);
                                          setEditImageUrl(undefined);
                                          setEditExtractedFromImage(false);
                                          setExtractFeedbackEdit(null);
                                        }}
                                        aria-label="첨부 사진 제거"
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#141619] text-white flex items-center justify-center hover:bg-[#B91C1C] cursor-pointer"
                                      >
                                        <X className="w-2.5 h-2.5" aria-hidden="true" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-14 h-16 rounded border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center text-[#6B7280]">
                                      <Camera className="w-3.5 h-3.5 mb-0.5" aria-hidden="true" />
                                      <span className="text-[10px]">사진 없음</span>
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-[#141619]">
                                      &lsquo;{item.name}&rsquo; 사진 · 카테고리·색상·소재 편집
                                    </p>
                                    <p className="text-[11px] text-[#525866] mt-0.5">
                                      카메라 촬영이나 이미지 파일을 첨부하면 AI가 카테고리·색상·소재를 자동으로 분석합니다.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={openEditCamera}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 border rounded-md font-medium cursor-pointer ${
                                      editCameraStream
                                        ? 'border-[#1F3A5F] bg-[#1F3A5F]/10 text-[#1F3A5F]'
                                        : 'border-[#D8DCE2] bg-white hover:bg-[#F5F6F7] text-[#141619]'
                                    }`}
                                  >
                                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                                    {editCameraStream ? '카메라 닫기' : '카메라 촬영'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => editImageInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#D8DCE2] bg-white hover:bg-[#F5F6F7] text-[#141619] rounded-md font-medium cursor-pointer"
                                  >
                                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                                    {editImageUrl ? '이미지 변경' : '이미지 파일 첨부'}
                                  </button>
                                  {editImageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => void runAutoEditAnalysis(editImageUrl, item)}
                                      disabled={isExtractingEdit}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1F3A5F] text-white hover:bg-[#172C49] disabled:opacity-50 rounded-md font-medium cursor-pointer"
                                    >
                                      {isExtractingEdit ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                      ) : (
                                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                                      )}
                                      {isExtractingEdit ? 'AI 자동 분석 중...' : 'AI 다시 분석'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {editCameraStream && (
                                <CameraViewfinder
                                  stream={editCameraStream}
                                  onCapture={(videoEl) => handleCaptureEditPhoto(videoEl, item)}
                                  onClose={stopEditCamera}
                                  label={`'${item.name}' 카메라 촬영`}
                                />
                              )}

                              {cameraErrorEdit && (
                                <p role="alert" className="text-[#B91C1C] leading-relaxed">
                                  {cameraErrorEdit}
                                </p>
                              )}

                              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                <div>
                                  <label
                                    htmlFor={`edit-d-category-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    카테고리
                                  </label>
                                  <select
                                    id={`edit-d-category-${item.id}`}
                                    value={editCategory}
                                    onChange={(e) =>
                                      setEditCategory(e.target.value as ClothingCategory)
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
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
                                    htmlFor={`edit-d-color-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    색상
                                  </label>
                                  <input
                                    id={`edit-d-color-${item.id}`}
                                    type="text"
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    placeholder="예: 네이비, 차콜"
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-d-material-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    소재
                                  </label>
                                  <input
                                    id={`edit-d-material-${item.id}`}
                                    type="text"
                                    value={editMaterial}
                                    onChange={(e) => setEditMaterial(e.target.value)}
                                    placeholder="예: 울, 코튼, 데님"
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-d-pattern-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    패턴
                                  </label>
                                  <input
                                    id={`edit-d-pattern-${item.id}`}
                                    type="text"
                                    value={editPattern}
                                    onChange={(e) => setEditPattern(e.target.value)}
                                    placeholder="예: 무지, 스트라이프, 체크"
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-d-thickness-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    두께감
                                  </label>
                                  <select
                                    id={`edit-d-thickness-${item.id}`}
                                    value={editThickness}
                                    onChange={(e) =>
                                      setEditThickness(e.target.value as GarmentThickness | '')
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
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
                                    htmlFor={`edit-d-silhouette-${item.id}`}
                                    className="block text-[11px] font-medium text-[#374151] mb-1"
                                  >
                                    상세 실루엣
                                  </label>
                                  <input
                                    id={`edit-d-silhouette-${item.id}`}
                                    type="text"
                                    value={editSilhouetteDetail}
                                    onChange={(e) => setEditSilhouetteDetail(e.target.value)}
                                    placeholder="예: 노치드 라펠, 투턱"
                                    className="w-full px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#141619]"
                                  />
                                </div>
                              </div>

                              {extractFeedbackEdit && (
                                <p
                                  role={extractFeedbackEdit.type === 'error' ? 'alert' : 'status'}
                                  className={
                                    extractFeedbackEdit.type === 'error'
                                      ? 'text-[#B91C1C]'
                                      : 'text-[#1F3A5F]'
                                  }
                                >
                                  {extractFeedbackEdit.message}
                                </p>
                              )}

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    stopEditCamera();
                                    setEditingItemId(null);
                                  }}
                                  className="px-3 py-1.5 text-[#525866] hover:text-[#141619] cursor-pointer"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveItemMeta(item.id)}
                                  className="px-3.5 py-1.5 bg-[#1F3A5F] text-white hover:bg-[#172C49] rounded-md font-medium cursor-pointer"
                                >
                                  사진 · 메타데이터 저장
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Quiet Footer Utilities */}
      <div className="pt-4 mt-2 border-t border-[#ECEDF0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
        <span>변경 사항은 브라우저에 자동 저장됩니다.</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onResetSample}
            className="inline-flex items-center gap-1 hover:text-[#141619] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            기본 옷장 복원
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="hover:text-[#B91C1C] transition-colors cursor-pointer"
            >
              전체 비우기
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
