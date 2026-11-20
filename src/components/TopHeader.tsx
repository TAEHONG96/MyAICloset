import { House, MessageCircle, Plus, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import type { WorkspaceSection } from '../types/wardrobe';

const NAV_ITEMS = [
  { id: 'home', label: '홈', icon: House },
  { id: 'closet', label: '내 옷장', icon: Shirt },
  { id: 'outfit', label: '코디 추천', icon: Sparkles },
  { id: 'purchase', label: '구매 분석', icon: ShoppingBag },
  { id: 'assistant', label: 'AI 어시스턴트', mobileLabel: '어시스턴트', icon: MessageCircle },
] as const;

interface TopHeaderProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onAdd: () => void;
}

export function TopHeader({ activeSection, onSelectSection, onAdd }: TopHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-width site-header-inner">
        <button type="button" className="wordmark" onClick={() => onSelectSection('home')} aria-label="My AI Closet 홈">
          <span className="brand-icon"><Shirt size={17} strokeWidth={1.5} aria-hidden="true" /></span>
          My AI Closet
        </button>
        <nav className="site-nav" aria-label="주 메뉴">
          {NAV_ITEMS.map(({ id, label, icon: Icon, ...item }) => (
            <button key={id} type="button" aria-current={id === activeSection ? 'page' : undefined} onClick={() => onSelectSection(id)}>
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              <span className="nav-desktop-label">{label}</span>
              <span className="nav-mobile-label">{'mobileLabel' in item ? item.mobileLabel : label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="action action-primary header-add" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> 의류 등록
        </button>
      </div>
    </header>
  );
}
