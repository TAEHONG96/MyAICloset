import { LoaderCircle, RefreshCw } from 'lucide-react';
import type { OutfitIllustrationSpec, OutfitRecommendation } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';

interface OutfitPreviewWidgetProps {
  selectedOutfit: OutfitRecommendation;
  illustrationSpec: OutfitIllustrationSpec | null;
  isLoading: boolean;
  error: string | null;
  onRefreshAiDirection: () => void;
}

export function OutfitPreviewWidget({ selectedOutfit, illustrationSpec, isLoading, error, onRefreshAiDirection }: OutfitPreviewWidgetProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{selectedOutfit.title}</h3>
      <div role="status">
        {isLoading && (
          <p className="form-status inline-flex items-center gap-2">
            <LoaderCircle size={18} className="animate-spin shrink-0" aria-hidden="true" />
            AI가 내 옷장 사진과 의류 정보를 참고해 착장 이미지를 만드는 중이에요.
          </p>
        )}
      </div>
      {error && <p role="alert" className="form-status">{error}</p>}
      {illustrationSpec?.generatedImageUrl && (
        <figure className="mx-auto max-w-[360px]">
          <GarmentImage src={illustrationSpec.generatedImageUrl} alt={`${selectedOutfit.title} AI 착장 연출`} className="generated-look" />
          <figcaption className="py-2 text-sm font-semibold text-olive-deep">AI가 생성한 착장 이미지</figcaption>
        </figure>
      )}
      {illustrationSpec && <>
        <p className="text-sm leading-relaxed text-muted">{illustrationSpec.disclaimer}</p>
        <details className="border-t border-line">
          <summary className="disclosure">참고한 의류 사진과 스타일링 정보</summary>
          {illustrationSpec.moodLine && <p className="mb-3 text-sm font-medium text-muted">{illustrationSpec.moodLine}</p>}
          <ul className="item-strip mb-4">
            {illustrationSpec.layers.map((layer) => (
              <li key={layer.itemId}>
                <GarmentImage src={layer.imageUrl} alt="" />
                <p className="garment-name">{layer.itemName}</p>
                <p className="mt-1 text-xs text-muted">{layer.fitNote}</p>
                {layer.calloutNote && <p className="mt-1 text-xs leading-relaxed text-muted">{layer.calloutNote}</p>}
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-sm leading-relaxed text-muted">
            <p>{illustrationSpec.artDirectionNote}</p>
            {illustrationSpec.stylingNotes.map((note, index) => <p key={index}>{note}</p>)}
            {illustrationSpec.assumptionsAndUncertainties.map((note, index) => <p key={index}>{note}</p>)}
          </div>
        </details>
      </>}
      {!isLoading && (
        <button className="action action-outline" type="button" onClick={onRefreshAiDirection}>
          <RefreshCw size={16} aria-hidden="true" /> {illustrationSpec?.generatedImageUrl ? '이미지 다시 생성' : '이미지 생성 다시 시도'}
        </button>
      )}
    </div>
  );
}
