import axios from 'axios';
import type { TTSGenerateRequest } from '../types';

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

const client = axios.create({
  baseURL,
  timeout: 120_000,
  responseType: 'blob',
});

export async function generateSpeech(
  request: TTSGenerateRequest
): Promise<Blob> {
  try {
    const response = await client.post('/tts/generate', request, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      const detailText = await err.response.data.text();
      try {
        const parsed = JSON.parse(detailText) as { detail?: string };
        throw new Error(parsed.detail ?? detailText);
      } catch {
        throw new Error(detailText || 'Voice generation failed.');
      }
    }
    if (axios.isAxiosError(err)) {
      throw new Error(err.message || 'Voice generation failed.');
    }
    throw err;
  }
}

export async function checkTTSHealth(): Promise<{
  configured: boolean;
  provider: string;
  free?: boolean;
}> {
  const { data } = await axios.get(`${baseURL}/tts/health`, { timeout: 10_000 });
  return data;
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
