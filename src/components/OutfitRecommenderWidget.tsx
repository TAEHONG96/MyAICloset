import { Camera } from 'lucide-react';
import type { OutfitRecommendation, WardrobeItem } from '../types/wardrobe';
import { ItemStrip } from './ItemStrip';

interface OutfitRecommenderWidgetProps {
  outfits: OutfitRecommendation[];
  generatedOutfitIds: string[];
  isLoading: boolean;
  error: string | null;
  ownedCount: number;
  onOpenItem: (item: WardrobeItem) => void;
  onSelectForPreview: (outfit: OutfitRecommendation) => void;
  onGenerateOutfits: () => void;
  onAdd: () => void;
}

export function OutfitRecommenderWidget({
  outfits, generatedOutfitIds, isLoading, error, ownedCount, onOpenItem, onSelectForPreview, onGenerateOutfits, onAdd,
}: OutfitRecommenderWidgetProps) {
  return (
    <section aria-labelledby="outfits-heading">
      <div className="section-heading">
        <h2 id="outfits-heading">추천 코디</h2>
        <p role="status" className="text-sm text-muted">
          {isLoading ? '내 옷장에서 조합을 찾는 중이에요.' : outfits.length > 0 ? `${outfits.length}가지 조합` : ''}
        </p>
      </div>
      {error && <div className="mb-4">
        <p className="form-status" role="alert">{error}</p>
        {!isLoading && ownedCount >= 2 && <button className="text-action" type="button" onClick={onGenerateOutfits}>코디 추천 다시 시도</button>}
      </div>}
      {isLoading ? (
        <div className="outfit-grid" aria-hidden="true">
          {[1, 2, 3].map((index) => (
            <div className="outfit-card animate-pulse" key={index}>
              <div className="h-6 w-1/2 bg-linen" />
              <div className="item-strip">{[1, 2, 3].map((tile) => <div key={tile} className="aspect-[4/5] bg-linen" />)}</div>
              <div className="h-4 w-4/5 bg-parchment" />
            </div>
          ))}
        </div>
      ) : outfits.length > 0 ? (
        <div className="outfit-grid">
          {outfits.map((outfit) => (
            <article className="outfit-card" key={outfit.id}>
              <div className="min-w-0">
                <p className="editorial-label">{outfit.source === 'seed' ? '예시 코디' : 'AI 추천'}</p>
                <h3 className="mt-1">{outfit.title}</h3>
                {outfit.conceptSummary && <p className="mt-1 text-sm leading-relaxed text-muted">{outfit.conceptSummary}</p>}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted">내 옷장 사진</h4>
                <ItemStrip items={outfit.items} onOpenItem={onOpenItem} />
              </div>
              <dl className="space-y-2 text-sm leading-relaxed">
                {outfit.tpoFit && <div><dt className="font-semibold">상황과 계절</dt><dd className="text-muted">{outfit.tpoFit}</dd></div>}
                {outfit.stylingExplanation && <div><dt className="font-semibold">추천 이유</dt><dd className="text-muted">{outfit.stylingExplanation}</dd></div>}
              </dl>
              {(outfit.reuseTip || outfit.assumptions) && <details className="border-t border-line">
                <summary className="disclosure">연출 팁과 참고 사항</summary>
                {outfit.reuseTip && <p className="text-sm leading-relaxed text-muted">{outfit.reuseTip}</p>}
                {outfit.assumptions && <p className="mt-2 text-sm leading-relaxed text-muted">{outfit.assumptions}</p>}
              </details>}
              <button className="action action-outline" type="button" onClick={() => onSelectForPreview(outfit)}>
                <Camera size={16} aria-hidden="true" /> {generatedOutfitIds.includes(outfit.id) ? 'AI 착장 보기' : 'AI 착장 이미지 생성'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>{ownedCount < 2 ? '의류를 2개 이상 등록하면 조합을 추천받을 수 있어요.' : '위에서 입을 상황과 계절을 골라 코디를 추천받아 보세요.'}</p>
          {ownedCount < 2 && <button className="action action-primary" type="button" onClick={onAdd}>의류 등록</button>}
        </div>
      )}
    </section>
  );
}
