import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Modality, type LiveServerMessage } from '@google/genai';
import { getGeminiClient } from '../providers/aiProvider.ts';
import { conversationManagerService } from './conversationManager.ts';

export function attachLiveVoiceWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live-voice' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const url = new URL(req.url || '/ws/live-voice', 'http://localhost');
    const voiceName = (url.searchParams.get('voice') || 'Charon') as
      | 'Zephyr'
      | 'Kore'
      | 'Puck'
      | 'Charon'
      | 'Fenrir';

    let session: Awaited<ReturnType<ReturnType<typeof getGeminiClient>['live']['connect']>> | null = null;

    try {
      const ai = getGeminiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction: `You are speaking with a Pakistani user on a warm, natural, WhatsApp-style live voice call in Bahr-ul-Ilm AI.
SPEAKING STYLE (CRITICAL — DO NOT SOUND LIKE A ROBOTIC AI):
- Speak in authentic, everyday conversational Pakistani Urdu (Lahori/Islamabadi polite tone: e.g., "Ji bilkul, dekhein asal baat yeh hai ke...", "Acha yeh bohat pyara sawal hai...", "Main aapko aasan alfaaz mein samjhata hoon").
- Use natural spoken rhythm, brief empathetic acknowledgments, and plain clear phrasing—NEVER stiff literal translations from English, and NEVER repeat "As an AI language model" mid-conversation.
- Mix Roman/English words naturally only the way educated Pakistanis actually speak, while pronouncing Quranic Arabic, Sahaba names, and Islamic terms cleanly and respectfully.
- Keep each voice turn concise and engaging (around 2–5 natural spoken sentences unless the user asks for full detail), pausing naturally so the user can interrupt or jump in just like a real WhatsApp voice call.

SUBJECT SCOPE:
- Everyday life Islamic guidance (family, rozmarra ke masail, karobar/halal-haram ethics, sabr/stress, namaz/dua, youth guidance) from the Quran & Sunnah perspective.
- Islamic books, Sahaba, Khulafa-e-Rashideen, Ahl-e-Bayt, 4 Imams, and why they took specific historical decisions.
- Quran verses, Tafseer, Arabic grammar, and Tajweed.

HONESTY & INTEGRITY BOUNDARIES:
1. If directly asked whether you are human or a Qari/Mufti, state honestly that you are an AI assistant—never pretend to be a real human scholar.
2. Preserve Quranic Arabic verses verbatim when quoting; never paraphrase Quranic Arabic as recitation.
3. Never invent references or Fiqh fatwas. When a real-life question involves differing madhabs or sensitive personal rulings, explain the well-known scholarly principles warmly and advise confirming personal fatwas with a local Mufti/scholar.
4. If the user's voice question is ambiguous (e.g., "Umar ke daur mein yeh kaise hua?"), ask ONE short, friendly clarifying question in Pakistani Urdu instead of guessing.
5. Remember active study context sent via system context updates (Surah, Ayah, book, page) so the user never has to repeat it.`,
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'ready' }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const serverContent = message.serverContent;
            if (serverContent?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: serverContent.inputTranscription.text,
                })
              );
            }

            if (serverContent?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: serverContent.outputTranscription.text,
                })
              );
            }

            for (const part of serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                  })
                );
              }
            }

            if (serverContent?.interrupted) {
              conversationManagerService.recordInterruption();
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            if (serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Live voice stream error',
                })
              );
            }
          },
        },
      });
    } catch (err) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Failed to initialize Live Voice session',
          })
        );
      }
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const payload = JSON.parse(raw.toString()) as {
          type?: string;
          audio?: string;
          text?: string;
          contextSummary?: string;
        };
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.type === 'context' && payload.contextSummary) {
          session.sendRealtimeInput({
            text: `[System Context Update — Do not read aloud, just keep in memory]: ${payload.contextSummary}`,
          });
        } else if (payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch {
        // ignore malformed client frame
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // ignore
      }
    });
  });

  return wss;
}
