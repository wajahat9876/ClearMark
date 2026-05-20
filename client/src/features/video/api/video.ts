import axios from 'axios';
import type { VideoHealthResponse, VideoJobResponse, VideoResolution } from '../types';

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

const client = axios.create({
  baseURL,
  timeout: 600_000,
});

export async function checkVideoHealth(): Promise<VideoHealthResponse> {
  const { data } = await client.get<VideoHealthResponse>('/video/health', {
    timeout: 10_000,
  });
  return data;
}

export async function submitVideoEnhance(
  file: File,
  resolution: VideoResolution
): Promise<VideoJobResponse> {
  const form = new FormData();
  form.append('video', file);
  form.append('resolution', resolution);

  try {
    const { data } = await client.post<VideoJobResponse>(
      '/video/enhance',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600_000,
      }
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const detail =
        typeof err.response.data === 'object' &&
        err.response.data !== null &&
        'detail' in err.response.data
          ? String((err.response.data as { detail: unknown }).detail)
          : 'Video upload failed.';
      throw new Error(detail);
    }
    if (axios.isAxiosError(err)) {
      throw new Error(err.message || 'Video upload failed.');
    }
    throw err;
  }
}

export async function getVideoJobStatus(jobId: string): Promise<VideoJobResponse> {
  const { data } = await client.get<VideoJobResponse>(`/video/jobs/${jobId}`);
  return data;
}

export async function downloadEnhancedVideo(jobId: string): Promise<Blob> {
  const response = await client.get(`/video/jobs/${jobId}/download`, {
    responseType: 'blob',
    timeout: 600_000,
  });
  return response.data;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
