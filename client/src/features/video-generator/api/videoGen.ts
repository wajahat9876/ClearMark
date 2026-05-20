import axios from 'axios';
import type {
  VideoGenHealthResponse,
  VideoGenJobResponse,
  VideoGenSettings,
} from '../types';

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

const client = axios.create({ baseURL, timeout: 600_000 });

export async function checkVideoGenHealth(): Promise<VideoGenHealthResponse> {
  const { data } = await client.get<VideoGenHealthResponse>('/video-gen/health', {
    timeout: 10_000,
  });
  return data;
}

export async function fetchVideoGenPresets(): Promise<VideoGenHealthResponse> {
  const { data } = await client.get<VideoGenHealthResponse>('/video-gen/presets');
  return data;
}

export async function submitVideoGeneration(
  images: File[],
  settings: VideoGenSettings
): Promise<VideoGenJobResponse> {
  const form = new FormData();
  images.forEach((file) => form.append('images', file, file.name));
  form.append('settings', JSON.stringify(settings));

  try {
    const { data } = await client.post<VideoGenJobResponse>(
      '/video-gen/generate',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const detail =
        typeof err.response.data === 'object' &&
        err.response.data !== null &&
        'detail' in err.response.data
          ? String((err.response.data as { detail: unknown }).detail)
          : 'Video generation failed.';
      throw new Error(detail);
    }
    throw err;
  }
}

export async function getVideoGenJobStatus(
  jobId: string
): Promise<VideoGenJobResponse> {
  const { data } = await client.get<VideoGenJobResponse>(
    `/video-gen/jobs/${jobId}`
  );
  return data;
}

export async function downloadVideoGenOutput(jobId: string): Promise<Blob> {
  const { data } = await client.get(`/video-gen/jobs/${jobId}/download`, {
    responseType: 'blob',
  });
  return data;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
