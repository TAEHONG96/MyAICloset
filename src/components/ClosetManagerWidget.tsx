import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, Plus, Search, SlidersHorizontal, Upload } from 'lucide-react';
import { SAMPLE_CSV_TEXT } from '../data/sampleCloset';
import { exportWardrobeCsv, parseWardrobeCsv } from '../lib/wardrobeLogic';
import { CLOTHING_CATEGORIES, type WardrobeItem } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';
import { Modal } from './Modal';

const FILTERS = [
  { id: 'color', label: '색상', value: (item: WardrobeItem) => item.color },
  { id: 'season', label: '계절', value: (item: WardrobeItem) => item.season },
  { id: 'fit', label: '핏', value: (item: WardrobeItem) => item.fit },
  { id: 'material', label: '소재', value: (item: WardrobeItem) => item.visualMeta?.material?.trim() ?? '' },
] as const;

type FilterId = typeof FILTERS[number]['id'];
type ImportMode = 'append' | 'replace';

interface ClosetManagerWidgetProps {
  items: WardrobeItem[];
  analysis: ReactNode;
  onAdd: () => void;
  onOpenItem: (item: WardrobeItem) => void;
  onImportItems: (items: WardrobeItem[], mode: ImportMode) => void;
  onResetSample: () => void;
  onClearAll: () => void;
}

export function ClosetManagerWidget({
  items, analysis, onAdd, onOpenItem, onImportItems, onResetSample, onClearAll,
}: ClosetManagerWidgetProps) {
  const [category, setCategory] = useState('전체');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Partial<Record<FilterId, string>>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [dialog, setDialog] = useState<'csv' | 'restore' | 'clear'>();
  const analysisPanel = useRef<HTMLDetailsElement>(null);
  const filtersId = useId();
  const filterCount = Object.values(filters).filter(Boolean).length;

  const options = useMemo(() => FILTERS.map(({ id, label, value }) => ({
    id, label, values: Array.from(new Set(items.map(value).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')),
  })), [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko');
    return items.filter((item) =>
      (category === '전체' || item.category === category) &&
      FILTERS.every(({ id, value }) => !filters[id] || filters[id] === value(item)) &&
      (!needle || [
        item.name, item.category, item.color, item.style, item.fit, item.season, item.notes,
        item.visualMeta?.material, item.visualMeta?.pattern, item.visualMeta?.silhouetteDetail,
      ].some((value) => value?.toLocaleLowerCase('ko').includes(needle)))
    );
  }, [items, category, query, filters]);

  function resetFilters() {
    setCategory('전체');
    setQuery('');
    setFilters({});
  }

  function downloadCsv() {
    const blob = new Blob(['\uFEFF', exportWardrobeCsv(items)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-ai-closet.csv';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section aria-labelledby="closet-heading">
        <div className="page-intro">
          <div>
            <p className="editorial-label">THE COLLECTION</p>
            <h1 id="closet-heading">내 옷장</h1>
            <p>가지고 있는 {items.length}개의 의류를 둘러보세요.</p>
          </div>
          <button className="text-action" type="button" onClick={() => {
            if (!analysisPanel.current) return;
            analysisPanel.current.open = true;
            analysisPanel.current.scrollIntoView({ block: 'start' });
            analysisPanel.current.querySelector('summary')?.focus({ preventScroll: true });
          }}>옷장 분석 보기</button>
        </div>
        {items.length > 0 && (
          <>
            <div className="catalog-toolbar">
              <div className="category-filter" role="group" aria-label="카테고리">
                {['전체', ...CLOTHING_CATEGORIES].map((value) => (
                  <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>
                    {value}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 min-w-[235px] items-center justify-end gap-2">
                <label className="catalog-search">
                  <span className="sr-only">의류 검색</span>
                  <Search size={16} aria-hidden="true" />
                  <input className="field-input" type="search" value={query} placeholder="이름, 색상, 소재 검색" onChange={(event) => setQuery(event.target.value)} />
                </label>
                <button className={`action ${filterCount ? 'action-primary' : 'action-outline'} shrink-0`} type="button" aria-expanded={showFilters} aria-controls={filtersId} onClick={() => setShowFilters(!showFilters)}>
                  <SlidersHorizontal size={15} aria-hidden="true" /> 필터{filterCount > 0 ? ` (${filterCount})` : ''}
                </button>
              </div>
            </div>
            <div id={filtersId} hidden={!showFilters} className="mt-3">
              <div className="filter-fields">
                {options.map(({ id, label, values }) => (
                  <div key={id} className="min-w-0">
                    <label className="field-label" htmlFor={`${filtersId}-${id}`}>{label}</label>
                    <select id={`${filtersId}-${id}`} className="field-input" value={filters[id] ?? ''} onChange={(event) => setFilters({ ...filters, [id]: event.target.value })}>
                      <option value="">전체</option>
                      {filters[id] && !values.includes(filters[id]) && <option value={filters[id]}>{filters[id]}</option>}
                      {values.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="catalog-count">
              <span role="status">{visibleItems.length}개 의류</span>
              {(category !== '전체' || query || filterCount > 0) && <button className="text-action" type="button" onClick={resetFilters}>검색 · 필터 초기화</button>}
            </div>
          </>
        )}
        {visibleItems.length > 0 ? (
          <ul className="catalog-grid">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <button className="garment-card" type="button" onClick={() => onOpenItem(item)}>
                  <GarmentImage src={item.imageUrl} alt="" />
                  <span className="garment-category">{item.category} · {item.color}</span>
                  <span className="garment-name">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : items.length ? (
          <div className="empty-state"><p>조건에 맞는 의류가 없어요.</p></div>
        ) : (
          <div className="empty-state">
            <p>아직 등록한 의류가 없어요.</p>
            <button type="button" className="action action-primary" onClick={onAdd}><Plus size={16} aria-hidden="true" /> 첫 의류 등록</button>
          </div>
        )}
      </section>

      <details ref={analysisPanel} className="closet-utilities scroll-mt-24">
        <summary className="disclosure">옷장 분석</summary>
        {analysis}
      </details>
      <details className="border-t border-line">
        <summary className="disclosure">옷장 관리</summary>
        <div className="flex flex-wrap gap-2">
          <button className="action action-outline" type="button" onClick={() => setDialog('csv')}><Upload size={16} aria-hidden="true" /> CSV 가져오기</button>
          <button className="action action-outline" type="button" disabled={!items.length} onClick={downloadCsv}><Download size={16} aria-hidden="true" /> CSV 내보내기</button>
          <button className="action action-outline" type="button" onClick={() => setDialog('restore')}>기본 옷장 복원</button>
          <button className="action action-outline danger-text" type="button" disabled={!items.length} onClick={() => setDialog('clear')}>전체 비우기</button>
        </div>
      </details>
      {dialog === 'csv' && <CsvImport onClose={() => setDialog(undefined)} onImport={(imported, mode) => {
        onImportItems(imported, mode);
        resetFilters();
      }} />}
      {(dialog === 'restore' || dialog === 'clear') && (
        <Modal title={dialog === 'restore' ? '기본 옷장 복원' : '옷장 전체 비우기'} onClose={() => setDialog(undefined)}>
          <p className="text-sm leading-relaxed">{dialog === 'restore' ? '현재 의류 목록을 예시 옷장으로 교체할까요?' : '등록한 의류와 사진을 모두 삭제할까요?'}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="action action-outline" type="button" onClick={() => setDialog(undefined)}>취소</button>
            <button className="action action-primary" type="button" onClick={() => {
              if (dialog === 'restore') onResetSample();
              else onClearAll();
              resetFilters();
              setDialog(undefined);
            }}>{dialog === 'restore' ? '예시 옷장으로 교체' : '모두 삭제'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CsvImport({ onClose, onImport }: { onClose: () => void; onImport: (items: WardrobeItem[], mode: ImportMode) => void }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ImportMode>('append');
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; errors?: string[]; success: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <Modal title="CSV 가져오기" onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (mode === 'replace' && !confirmed) return;
        const result = parseWardrobeCsv(text);
        if (!result.items.length) {
          setFeedback({ message: '가져올 수 있는 의류 행이 없습니다.', errors: result.errors, success: false });
          return;
        }
        onImport(result.items, mode);
        setText('');
        setConfirmed(false);
        setFeedback({ message: `${result.items.length}개 의류를 가져왔습니다.${result.skippedRows ? ` ${result.skippedRows}개 행은 제외됐어요.` : ''}`, errors: result.errors, success: true });
      }}>
        <p className="text-sm text-muted leading-relaxed">CSV 파일을 선택하거나 표 데이터를 붙여넣으세요. 샘플로 열 순서를 확인할 수 있어요.</p>
        <div className="flex flex-wrap gap-2">
          <button className="action action-outline" type="button" onClick={() => fileInput.current?.click()}>CSV 파일 선택</button>
          <button className="action action-outline" type="button" onClick={() => { setText(SAMPLE_CSV_TEXT); setFeedback(undefined); }}>샘플 CSV 채우기</button>
          <input ref={fileInput} type="file" className="hidden" aria-label="CSV 파일" accept=".csv,text/csv" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              setText(await file.text());
              setFeedback(undefined);
            } catch {
              setFeedback({ message: 'CSV 파일을 읽지 못했습니다.', success: false });
            }
          }} />
        </div>
        <label className="block"><span className="field-label">CSV 데이터</span>
          <textarea className="field-input" rows={5} value={text} onChange={(event) => { setText(event.target.value); setFeedback(undefined); }} />
        </label>
        <label className="block"><span className="field-label">가져오기 방식</span>
          <select className="field-input" value={mode} onChange={(event) => { setMode(event.target.value as ImportMode); setConfirmed(false); }}>
            <option value="append">기존 옷장에 추가</option>
            <option value="replace">현재 목록 전체 교체</option>
          </select>
        </label>
        {mode === 'replace' && <label className="flex items-center gap-2 min-h-11 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 현재 의류와 사진이 삭제되는 것을 확인했습니다.
        </label>}
        {feedback && <div className="form-status" role={feedback.success ? 'status' : 'alert'}>
          <p>{feedback.message}</p>
          {Boolean(feedback.errors?.length) && <ul className="list-disc pl-5">{feedback.errors?.map((error, index) => <li key={index}>{error}</li>)}</ul>}
        </div>}
        <button type="submit" className="action action-primary" disabled={!text.trim() || (mode === 'replace' && !confirmed)}>CSV 가져오기</button>
      </form>
    </Modal>
  );
}
