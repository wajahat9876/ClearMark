import { useEffect, useState } from 'react';

export function useKonvaImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return undefined;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);

  return image;
}
