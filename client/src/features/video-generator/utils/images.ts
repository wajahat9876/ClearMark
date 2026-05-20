import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB } from '../constants';

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Use JPEG, PNG, or WebP images.';
  }
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_IMAGE_MB) {
    return `Each image must be under ${MAX_IMAGE_MB} MB.`;
  }
  return null;
}

export function createImageId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
