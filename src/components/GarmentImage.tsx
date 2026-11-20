import { useState } from 'react';
import { Shirt } from 'lucide-react';

interface GarmentImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function GarmentImage(props: GarmentImageProps) {
  return <GarmentImageContent key={props.src} {...props} />;
}

function GarmentImageContent({ src, alt, className = '' }: GarmentImageProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  return (
    <span className={`garment-image ${className}`} data-loading={Boolean(src && state === 'loading')}>
      {src && state !== 'error' ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      ) : (
        <span className="image-fallback">
          <Shirt size={24} strokeWidth={1.2} aria-hidden="true" />
          <span className="sr-only">사진 없음</span>
        </span>
      )}
    </span>
  );
}
