import axios from 'axios';
import type {
  ExportFormat,
  PresetItem,
  StudioHealthResponse,
  StudioJobResponse,
  StudioSettings,
} from '../types';

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

const client = axios.create({ baseURL, timeout: 300_000 });

export async function checkStudioHealth(): Promise<StudioHealthResponse> {
  const { data } = await client.get<StudioHealthResponse>('/studio/health', {
    timeout: 10_000,
  });
  return data;
}

export async function fetchPresets(): Promise<{
  voicePresets: PresetItem[];
  emotionEffects: PresetItem[];
  songStyles?: PresetItem[];
}> {
  const { data } = await client.get('/studio/presets');
  return data;
}

export async function submitStudioProcess(
  settings: StudioSettings,
  audio?: Blob | null,
  filename?: string,
  background?: File | null
): Promise<StudioJobResponse> {
  const form = new FormData();
  if (audio) form.append('audio', audio, filename || 'recording.webm');
  form.append('settings', JSON.stringify(settings));
  if (background) form.append('background', background);

  try {
    const { data } = await client.post<StudioJobResponse>(
      '/studio/process',
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
          : 'Processing failed.';
      throw new Error(detail);
    }
    throw err;
  }
}

export async function getStudioJobStatus(
  jobId: string
): Promise<StudioJobResponse> {
  const { data } = await client.get<StudioJobResponse>(
    `/studio/jobs/${jobId}`
  );
  return data;
}

export async function downloadStudioOutput(jobId: string): Promise<Blob> {
  const { data } = await client.get(`/studio/jobs/${jobId}/download`, {
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

export function formatForExtension(fmt: ExportFormat): string {
  if (fmt === 'aac') return 'm4a';
  return fmt;
}
