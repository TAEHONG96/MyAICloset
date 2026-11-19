import React from 'react';
import type { WorkspaceSection } from '../types/wardrobe';

interface TopHeaderProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onQuickRecommend: () => void;
  isRecommending: boolean;
}

const NAV_ITEMS: Array<{ id: WorkspaceSection; label: string }> = [
  { id: 'closet', label: '내 옷장 · 분석' },
  { id: 'outfit', label: '코디 · 미리보기' },
  { id: 'purchase', label: '구매 상담' },
  { id: 'assistant', label: '패션 어시스턴트' },
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeSection,
  onSelectSection,
  onQuickRecommend,
  isRecommending,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB]">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectSection('closet')}
          className="font-editorial text-lg sm:text-xl font-semibold tracking-tight text-[#141619] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          나만의 옷장
        </button>

        <nav
          aria-label="주요 작업 공간"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectSection(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'text-[#141619] font-semibold'
                    : 'text-[#525866] hover:text-[#141619]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1F3A5F]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onQuickRecommend}
            disabled={isRecommending}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1F3A5F] hover:bg-[#172C49] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isRecommending ? '코디 구성 중...' : '코디 추천 받기'}
          </button>
        </div>
      </div>

      {/* Mobile horizontal tab bar kept slim to stay well under 15% mobile sticky cap */}
      <nav
        aria-label="모바일 작업 공간 탐색"
        className="md:hidden border-t border-[#ECEDF0] px-4 overflow-x-auto flex items-center gap-5 bg-white"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelectSection(item.id)}
              className={`relative py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active ? 'text-[#141619] font-semibold' : 'text-[#525866]'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1F3A5F]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
