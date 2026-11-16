let activeTtsAudio: HTMLAudioElement | null = null;

export function stopInlineUrduSpeech(): void {
  if (activeTtsAudio) {
    activeTtsAudio.pause();
    activeTtsAudio.currentTime = 0;
    activeTtsAudio = null;
  }
}

export async function playInlineUrduSpeech(
  text: string,
  options?: {
    voiceName?: 'Charon' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir';
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  stopInlineUrduSpeech();
  options?.onStart?.();

  try {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        voiceName: options?.voiceName || 'Charon',
      }),
    });
    const data = (await res.json()) as {
      audioBase64?: string;
      audioUrl?: string;
      mimeType?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || 'Voice synthesis failed');
    }
    const src = data.audioBase64
      ? `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
      : data.audioUrl;
    if (!src) {
      throw new Error('No audio stream returned');
    }

    const audio = new Audio(src);
    activeTtsAudio = audio;
    audio.onended = () => {
      if (activeTtsAudio === audio) activeTtsAudio = null;
      options?.onEnd?.();
    };
    audio.onerror = () => {
      if (activeTtsAudio === audio) activeTtsAudio = null;
      options?.onEnd?.();
      options?.onError?.('Unable to play generated audio.');
    };
    await audio.play();
  } catch (err) {
    activeTtsAudio = null;
    options?.onEnd?.();
    options?.onError?.(err instanceof Error ? err.message : 'Unable to speak text.');
  }
}
