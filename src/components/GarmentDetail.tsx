import { Pencil, Trash2 } from 'lucide-react';
import type { WardrobeItem } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';
import { Modal } from './Modal';

interface GarmentDetailProps {
  item: WardrobeItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function GarmentDetail({ item, onClose, onEdit, onDelete }: GarmentDetailProps) {
  const fields = [
    ['카테고리', item.category],
    ['색상', item.color],
    ['스타일', item.style],
    ['핏', item.fit],
    ['계절', item.season],
    ['소재', item.visualMeta?.material],
    ['패턴', item.visualMeta?.pattern],
    ['두께', item.visualMeta?.thickness],
    ['디테일', item.visualMeta?.silhouetteDetail],
  ];

  return (
    <Modal title={item.name} onClose={onClose} className="garment-detail-modal">
      <div className="garment-detail">
        <GarmentImage src={item.imageUrl} alt={item.name} />
        <div className="min-w-0 space-y-5">
          <dl className="detail-fields">
            {fields.filter(([, value]) => value).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          {item.visualMeta?.summaryNote && item.visualMeta.summaryNote !== item.notes && (
            <p className="text-sm text-muted leading-relaxed">{item.visualMeta.summaryNote}</p>
          )}
          {item.notes && <p className="text-sm leading-relaxed"><strong>메모</strong><br />{item.notes}</p>}
          {item.visualMeta?.extractedFromImage && <p className="text-xs text-olive">사진 분석을 바탕으로 등록된 의류</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="action action-primary" onClick={onEdit}><Pencil size={15} aria-hidden="true" /> 수정</button>
            <button type="button" className="action action-outline danger-text" onClick={onDelete}><Trash2 size={15} aria-hidden="true" /> 삭제</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
