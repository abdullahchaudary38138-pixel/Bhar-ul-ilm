import React, { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { TopBar, type ActiveTab } from './components/TopBar.tsx';
import { QuranStudioView } from './components/QuranStudioView.tsx';
import { LiveTilawatView } from './components/LiveTilawatView.tsx';
import { BookLibraryView } from './components/BookLibraryView.tsx';
import { VoiceStudio } from './components/VoiceStudio.tsx';
import { ResearchHubView } from './components/ResearchHubView.tsx';
import { KidsAcademyView } from './components/KidsAcademyView.tsx';
import { ReligionsExplorerView } from './components/ReligionsExplorerView.tsx';
import { VideoStudioView } from './components/VideoStudioView.tsx';
import type { CorpusPassage, QiraatEdition, QuranAyah, ResearchTopic } from './types.ts';

function createInitialTopic(): ResearchTopic {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`,
    title: 'New Research Session',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('quran');
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedAyahNum, setSelectedAyahNum] = useState<number>(1);
  const [tilawatAyah, setTilawatAyah] = useState<QuranAyah | null>(null);
  const [qiraat] = useState<QiraatEdition>("Hafs 'an Asim (Madinah Uthmani)");

  const [topics, setTopics] = useState<ResearchTopic[]>(() => [createInitialTopic()]);
  const [activeTopicId, setActiveTopicId] = useState<string>(() => topics[0].id);
  const [seededPrompt, setSeededPrompt] = useState<string | null>(null);
  const [externalSpeakRequest, setExternalSpeakRequest] = useState<string | null>(null);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/conversation/topics')
      .then((r) => r.json())
      .then((data: { topics?: ResearchTopic[] }) => {
        if (data.topics && data.topics.length > 0) {
          setTopics(data.topics);
          setActiveTopicId(data.topics[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const activeTopic = topics.find((t) => t.id === activeTopicId) || topics[0];

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/conversation/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Research Session' }),
      });
      const data = await res.json();
      if (data.topic) {
        setTopics((prev) => [data.topic, ...prev]);
        setActiveTopicId(data.topic.id);
        setActiveTab('voice');
        return;
      }
    } catch {
      // fallback
    }
    const fresh = createInitialTopic();
    setTopics((prev) => [fresh, ...prev]);
    setActiveTopicId(fresh.id);
    setActiveTab('voice');
  };

  const handleUpdateTopic = (updated: ResearchTopic) => {
    setTopics((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((t) => (t.id === updated.id ? updated : t));
    });
    setActiveTopicId(updated.id);
  };

  const handleAskInStudio = (passage: CorpusPassage) => {
    setSeededPrompt(
      `Research "${passage.title}" (${passage.book}, ${passage.page}) in detail and explain its classical context.`
    );
    setActiveTab('voice');
  };

  const handleOpenContextInVoice = (contextPrompt: string) => {
    setSeededPrompt(contextPrompt);
    setActiveTab('voice');
  };

  const handleReadAloud = (text: string) => {
    setExternalSpeakRequest(text);
    setActiveTab('voice');
  };

  const handlePracticeTilawat = (ayah: QuranAyah) => {
    setTilawatAyah(ayah);
    setActiveTab('tilawat');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[var(--color-navy)] text-[var(--color-ink)]">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onNewSession={handleNewSession}
        />

        <main className="flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'quran' && (
                <QuranStudioView
                  selectedSurah={selectedSurah}
                  selectedAyahNum={selectedAyahNum}
                  onChangeSurahAyah={(surah, ayah) => {
                    setSelectedSurah(surah);
                    setSelectedAyahNum(ayah);
                  }}
                  onPracticeTilawat={handlePracticeTilawat}
                  onOpenInLiveVoice={handleOpenContextInVoice}
                  onSpeakText={handleReadAloud}
                />
              )}

              {activeTab === 'tilawat' && (
                <LiveTilawatView
                  activeAyah={tilawatAyah}
                  qiraat={qiraat}
                  onSpeakPakistaniUrdu={handleReadAloud}
                />
              )}

              {activeTab === 'kids' && (
                <KidsAcademyView onOpenVideosTab={() => setActiveTab('videos')} />
              )}

              {activeTab === 'videos' && <VideoStudioView />}

              {activeTab === 'religions' && <ReligionsExplorerView />}

              {activeTab === 'library' && (
                <BookLibraryView
                  onSpeakText={handleReadAloud}
                  onAskInLiveVoice={handleOpenContextInVoice}
                />
              )}

              {activeTab === 'voice' && activeTopic && (
                <VoiceStudio
                  activeTopic={activeTopic}
                  topics={topics}
                  onSelectTopic={(id) => setActiveTopicId(id)}
                  onUpdateTopic={handleUpdateTopic}
                  onNewTopic={handleNewSession}
                  seededPrompt={seededPrompt}
                  onClearSeededPrompt={() => setSeededPrompt(null)}
                  externalSpeakRequest={externalSpeakRequest}
                  onClearExternalSpeak={() => setExternalSpeakRequest(null)}
                  onNoteSaved={() => setNotesRefreshKey((k) => k + 1)}
                  activeContextSummary={`Surah ${selectedSurah}, Ayah ${selectedAyahNum} (${qiraat})`}
                />
              )}

              {activeTab === 'research' && (
                <ResearchHubView
                  key={notesRefreshKey}
                  onReadAloud={handleReadAloud}
                  onAskInStudio={handleAskInStudio}
                  onJumpToAyah={(surah, ayah) => {
                    setSelectedSurah(surah);
                    setSelectedAyahNum(ayah);
                    setActiveTab('quran');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-[var(--color-border-hairline)] bg-[var(--color-navy)] py-4 px-6 text-xs text-[var(--color-ink-subtle)]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
            <span>Bahr-ul-Ilm AI · Quran Teacher, Tilawat Coaching, Digital Library & Pakistani Urdu Live Voice</span>
            <span>AI-assisted learning & research — verify formal Tajweed certification with a Qari and Fiqh rulings with qualified scholars.</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
