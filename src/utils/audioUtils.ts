export function float32ToBase64Pcm16(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function encodeWavFromMonoFloat32(samples: Float32Array, sampleRate: number): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, 1, true); // NumChannels = 1 (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate = sampleRate * 2
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function convertBlobToWav(blob: Blob): Promise<{
  wavBlob: Blob;
  mimeType: string;
  durationSec: number;
  estimatedSnrDb: number;
}> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return {
      wavBlob: blob,
      mimeType: blob.type || 'audio/webm',
      durationSec: 2.0,
      estimatedSnrDb: 18,
    };
  }

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const numChannels = audioBuffer.numberOfChannels;
    const origLen = audioBuffer.length;
    const origRate = audioBuffer.sampleRate;
    const durationSec = audioBuffer.duration;

    // Downmix to mono
    const mono = new Float32Array(origLen);
    for (let ch = 0; ch < numChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < origLen; i++) {
        mono[i] += chData[i] / numChannels;
      }
    }

    // Resample to 16kHz mono PCM for Gemini Speech/Audio accuracy
    const targetRate = 16000;
    const targetLen = Math.max(1, Math.round((origLen * targetRate) / origRate));
    const resampled = new Float32Array(targetLen);
    const ratio = origLen / targetLen;
    for (let i = 0; i < targetLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s0 = mono[idx] ?? 0;
      const s1 = mono[Math.min(origLen - 1, idx + 1)] ?? s0;
      resampled[i] = s0 + (s1 - s0) * frac;
    }

    // Estimate RMS-based SNR across 50ms windows
    const winSize = Math.max(160, Math.floor(targetRate * 0.05));
    const windowRms: number[] = [];
    for (let i = 0; i < resampled.length; i += winSize) {
      let sum = 0;
      const end = Math.min(resampled.length, i + winSize);
      for (let j = i; j < end; j++) {
        sum += resampled[j] * resampled[j];
      }
      windowRms.push(Math.sqrt(sum / Math.max(1, end - i)));
    }
    const sorted = [...windowRms].sort((a, b) => a - b);
    const noiseFloor = Math.max(0.002, sorted[Math.floor(sorted.length * 0.15)] || 0.004);
    const speechPeak = Math.max(noiseFloor * 1.1, sorted[Math.floor(sorted.length * 0.92)] || 0.05);
    const estimatedSnrDb = Number((20 * Math.log10(speechPeak / noiseFloor)).toFixed(1));

    const wavBlob = encodeWavFromMonoFloat32(resampled, targetRate);
    return {
      wavBlob,
      mimeType: 'audio/wav',
      durationSec: Number(durationSec.toFixed(2)),
      estimatedSnrDb,
    };
  } catch {
    return {
      wavBlob: blob,
      mimeType: (blob.type || 'audio/webm').split(';')[0].trim(),
      durationSec: 2.0,
      estimatedSnrDb: 18,
    };
  } finally {
    ctx.close().catch(() => {});
  }
}

export class MicrophoneRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private silenceTimer: number | null = null;
  private hasSpoken = false;
  private isPausedState = false;

  async start(options: {
    onLevel?: (level: number, voiceActive: boolean) => void;
    onAutoSilenceStop?: () => void;
    autoStopOnSilence?: boolean;
    silenceTimeoutMs?: number;
  }): Promise<void> {
    this.cleanup();
    this.chunks = [];
    this.hasSpoken = false;
    this.isPausedState = false;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };
    this.mediaRecorder.start(250);

    // Real-time audio level + Voice Activity Detection (VAD)
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const silenceMs = options.silenceTimeoutMs ?? 1700;

    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = Math.min(1, rms * 4.5);
      const voiceActive = !this.isPausedState && level > 0.08;

      if (voiceActive) {
        this.hasSpoken = true;
        if (this.silenceTimer) {
          window.clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (
        options.autoStopOnSilence &&
        this.hasSpoken &&
        !this.isPausedState &&
        !this.silenceTimer
      ) {
        this.silenceTimer = window.setTimeout(() => {
          options.onAutoSilenceStop?.();
        }, silenceMs);
      }

      options.onLevel?.(this.isPausedState ? 0 : level, voiceActive);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPausedState = true;
      if (this.silenceTimer) {
        window.clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPausedState = false;
    }
  }

  async stop(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder is not active'));
        return;
      }
      const recorder = this.mediaRecorder;
      const mimeType = recorder.mimeType || 'audio/webm';
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve({ blob, mimeType });
      };
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve({ blob, mimeType });
      }
    });
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.silenceTimer) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }
}

export class LiveVoiceSessionClient {
  private ws: WebSocket | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isMuted = false;
  private playbackRate = 1.0;

  async connect(options: {
    voiceName: string;
    playbackRate?: number;
    onReady?: () => void;
    onInputTranscript?: (text: string) => void;
    onOutputTranscript?: (text: string) => void;
    onSpeakingChange?: (speaking: boolean) => void;
    onInterrupted?: () => void;
    onError?: (err: string) => void;
    onClose?: () => void;
  }): Promise<void> {
    this.playbackRate = options.playbackRate ?? 1.0;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-voice?voice=${encodeURIComponent(options.voiceName)}`;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    this.inputCtx = new AudioContext({ sampleRate: 16000 });
    this.outputCtx = new AudioContext({ sampleRate: 24000 });
    this.nextStartTime = this.outputCtx.currentTime;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (!this.inputCtx || !this.stream || !this.ws) return;
      const source = this.inputCtx.createMediaStreamSource(this.stream);
      this.processor = this.inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(this.processor);
      this.processor.connect(this.inputCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const channel = e.inputBuffer.getChannelData(0);
        // Simple local barge-in energy check if AI is currently playing audio
        let sum = 0;
        for (let i = 0; i < channel.length; i++) {
          sum += channel[i] * channel[i];
        }
        const rms = Math.sqrt(sum / channel.length);
        if (rms > 0.06 && this.activeSources.length > 0) {
          this.stopPlaybackQueue();
          options.onInterrupted?.();
        }
        const b64 = float32ToBase64Pcm16(channel);
        this.ws.send(JSON.stringify({ audio: b64 }));
      };
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          type: string;
          text?: string;
          data?: string;
          message?: string;
        };
        if (msg.type === 'ready') {
          options.onReady?.();
        } else if (msg.type === 'input_transcript' && msg.text) {
          options.onInputTranscript?.(msg.text);
        } else if (msg.type === 'output_transcript' && msg.text) {
          options.onOutputTranscript?.(msg.text);
        } else if (msg.type === 'audio' && msg.data) {
          options.onSpeakingChange?.(true);
          this.schedulePcm24k(msg.data, () => {
            if (this.activeSources.length === 0) {
              options.onSpeakingChange?.(false);
            }
          });
        } else if (msg.type === 'interrupted') {
          this.stopPlaybackQueue();
          options.onSpeakingChange?.(false);
          options.onInterrupted?.();
        } else if (msg.type === 'turn_complete') {
          // Let scheduled audio finish naturally
        } else if (msg.type === 'error') {
          options.onError?.(msg.message || 'Live voice error');
        }
      } catch {
        // ignore
      }
    };

    this.ws.onerror = () => {
      options.onError?.('WebSocket connection error');
    };

    this.ws.onclose = () => {
      options.onClose?.();
    };
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
  }

  sendTextTurn(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  stopPlaybackQueue() {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    this.activeSources = [];
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
  }

  private schedulePcm24k(base64: string, onEmpty: () => void) {
    if (!this.outputCtx) return;
    const samples = base64Pcm16ToFloat32(base64);
    const buffer = this.outputCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const src = this.outputCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = this.playbackRate;
    src.connect(this.outputCtx.destination);

    const now = this.outputCtx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.02;
    }
    src.start(this.nextStartTime);
    this.nextStartTime += buffer.duration / this.playbackRate;
    this.activeSources.push(src);

    src.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== src);
      if (this.activeSources.length === 0) {
        onEmpty();
      }
    };
  }

  disconnect() {
    this.stopPlaybackQueue();
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.inputCtx) {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
