export interface CompressedGarmentImage {
  dataUrl: string;
  base64Data: string;
  mimeType: string;
}

function renderCanvasSourceToCompressedGarmentImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension = 640,
  quality = 0.8
): CompressedGarmentImage {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);
  const scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
  const width = Math.max(1, Math.round(safeWidth * scale));
  const height = Math.max(1, Math.round(safeHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('브라우저 이미지 처리 캔버스를 초기화하지 못했습니다.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const commaIdx = dataUrl.indexOf(',');
  return {
    dataUrl,
    base64Data: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '',
    mimeType: 'image/jpeg',
  };
}

/**
 * Compresses and resizes a user-selected garment photo in the browser so it
 * fits cleanly in localStorage and transfers quickly to the server-side Gemini Vision API.
 */
export function compressGarmentImage(
  file: File,
  maxDimension = 640,
  quality = 0.8
): Promise<CompressedGarmentImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(JPG, PNG, WEBP 등)만 첨부할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽는 중 오류가 발생했습니다.'));
    reader.onload = () => {
      const originalDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!originalDataUrl) {
        reject(new Error('이미지 데이터를 불러오지 못했습니다.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('지원하지 않거나 손상된 이미지 형식입니다.'));
      img.onload = () => {
        try {
          resolve(
            renderCanvasSourceToCompressedGarmentImage(
              img,
              img.width || 1,
              img.height || 1,
              maxDimension,
              quality
            )
          );
        } catch {
          const commaIdx = originalDataUrl.indexOf(',');
          resolve({
            dataUrl: originalDataUrl,
            base64Data: commaIdx >= 0 ? originalDataUrl.slice(commaIdx + 1) : originalDataUrl,
            mimeType: file.type || 'image/jpeg',
          });
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Captures the current frame from a live HTMLVideoElement camera stream and compresses it to JPEG.
 */
export function captureVideoFrameToGarmentImage(
  video: HTMLVideoElement,
  maxDimension = 640,
  quality = 0.8
): CompressedGarmentImage {
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('카메라 영상을 아직 불러오지 못했습니다. 화면이 보인 뒤 다시 촬영해 주세요.');
  }
  return renderCanvasSourceToCompressedGarmentImage(
    video,
    video.videoWidth,
    video.videoHeight,
    maxDimension,
    quality
  );
}

export function classifyCameraError(err: unknown): string {
  const errorObj = err as { name?: string; message?: string } | undefined;
  const name = errorObj?.name ?? '';
  const msg = (errorObj?.message ?? '').toLowerCase();

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('permission')) {
    return '카메라 접근 권한이 거부되었습니다. 브라우저 주소창의 카메라 권한을 허용하거나 아래 [이미지 파일 첨부]를 이용해 주세요.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('not found')) {
    return '연결된 카메라 장치를 찾을 수 없습니다. [이미지 파일 첨부]를 이용해 의류 사진을 등록해 주세요.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '카메라가 다른 앱에서 사용 중이거나 장치를 읽을 수 없습니다. [이미지 파일 첨부]를 이용해 주세요.';
  }
  if (name === 'SecurityError') {
    return '보안 환경(HTTPS/권한 정책)으로 인해 실시간 카메라에 접근할 수 없습니다. [이미지 파일 첨부]를 이용해 주세요.';
  }
  return '카메라를 실행하지 못했습니다. [이미지 파일 첨부] 버튼으로 사진을 직접 첨부할 수 있습니다.';
}

export function splitDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}
