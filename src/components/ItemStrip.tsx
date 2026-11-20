import type { WardrobeItem } from '../types/wardrobe';
import { GarmentImage } from './GarmentImage';

interface ItemStripProps {
  items: WardrobeItem[];
  onOpenItem: (item: WardrobeItem) => void;
}

export function ItemStrip({ items, onOpenItem }: ItemStripProps) {
  return (
    <ul className="item-strip">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="garment-card" onClick={() => onOpenItem(item)}>
            <GarmentImage src={item.imageUrl} alt="" />
            <span className="garment-name">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
