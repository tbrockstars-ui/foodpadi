import type { ScanImageMediaType } from '@foodpadi/shared';

const ALLOWED_MEDIA_TYPES: ScanImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface CapturedImage {
  base64: string;
  mediaType: ScanImageMediaType;
}

/**
 * Reads a `<input type="file">` selection into the base64 (no data: URI
 * prefix) + media type shape every vision endpoint expects (ScanPhotoRequest,
 * ScanFoodContentRequest, CheckCookingStepRequest). Shared by web's Scan
 * capability and the guided-cooking "Is this ready?" check — mobile gets the
 * same base64 directly from expo-image-picker instead.
 */
export function readImageFile(file: File): Promise<CapturedImage> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type as ScanImageMediaType)) {
      reject(new Error('Please choose a JPEG, PNG or WebP photo.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo. Please try again."));
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,<data>" — everything after the first comma.
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error("Couldn't read that photo. Please try again."));
        return;
      }
      resolve({ base64: result.slice(commaIndex + 1), mediaType: file.type as ScanImageMediaType });
    };
    reader.readAsDataURL(file);
  });
}
