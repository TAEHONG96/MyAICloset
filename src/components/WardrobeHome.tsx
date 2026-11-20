import { ArrowRight, ArrowUpRight, ShoppingBag, Sparkles } from 'lucide-react';
import type { OutfitRecommendation, WardrobeItem, WorkspaceSection } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';

interface WardrobeHomeProps {
  items: WardrobeItem[];
  latestOutfit?: OutfitRecommendation;
  onNavigate: (section: WorkspaceSection) => void;
  onAdd: () => void;
  onOpenItem: (item: WardrobeItem) => void;
}

export function WardrobeHome({ items, latestOutfit, onNavigate, onAdd, onOpenItem }: WardrobeHomeProps) {
  return (
    <div className="home-flow">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="editorial-label"><span aria-hidden="true" /> PERSONAL WARDROBE</p>
          <h1 id="home-title">The Wardrobe<span>.</span></h1>
          <p className="hero-korean">익숙한 옷, 새로운 조합.</p>
          <p className="hero-description">내 옷을 한곳에 모으고, 가지고 있는 옷으로<br className="hidden sm:block" /> 오늘의 스타일을 찾아보세요.</p>
          <div className="hero-actions">
            <button className="action action-primary" type="button" onClick={() => onNavigate('outfit')}>
              <Sparkles size={16} aria-hidden="true" /> 코디 추천 받기 <ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <button className="action action-outline" type="button" onClick={() => onNavigate('closet')}>
              내 옷장 보기 <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <figure className="hero-image">
          <img src="/src/assets/images/wardrobe-editorial.jpg" alt="베이지 트렌치코트와 브라운 숄더백을 매치한 스타일" width={1448} height={1086} fetchPriority="high" />
          <figcaption>스타일 영감 이미지</figcaption>
        </figure>
      </section>

      <section aria-labelledby="home-closet-heading">
        <div className="section-heading">
          <div>
            <p className="editorial-label">THE COLLECTION</p>
            <h2 id="home-closet-heading">내 옷장에서</h2>
          </div>
          <button className="text-action" type="button" onClick={() => onNavigate('closet')}>
            전체 {items.length}개 보기 <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {items.length > 0 ? (
          <ul className="catalog-grid home-catalog">
            {items.slice(0, 4).map((item) => (
              <li key={item.id}>
                <button className="garment-card" type="button" onClick={() => onOpenItem(item)}>
                  <GarmentImage src={item.imageUrl} alt="" />
                  <span className="garment-category">{item.category}</span>
                  <span className="garment-name">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p>옷장에 첫 의류를 등록해 보세요.</p>
            <button className="action action-primary" type="button" onClick={onAdd}>첫 의류 등록</button>
          </div>
        )}
      </section>

      <div className="home-secondary">
        {latestOutfit && (
          <button type="button" className="home-feature" onClick={() => onNavigate('outfit')}>
            <div>
              <p className="editorial-label">최근 AI 코디</p>
              <h2>{latestOutfit.title}</h2>
            </div>
            <ArrowUpRight size={22} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="home-feature" onClick={() => onNavigate('purchase')}>
          <ShoppingBag size={24} strokeWidth={1.4} aria-hidden="true" />
          <div>
            <h2>살까, 말까?</h2>
            <p>마음에 든 옷이 내 옷장과 어울리는지 확인해 보세요.</p>
          </div>
          <ArrowUpRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
