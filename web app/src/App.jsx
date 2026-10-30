import React, { useState } from 'react';
import Header from './engine/components/Header';
import Nav from './engine/components/Nav';
import AudioPanel from './engine/components/AudioPanel';
import ScenarioLibrary from './engine/components/ScenarioLibrary';
import Characters from './engine/components/Characters';
import Maps from './engine/components/Maps';
import DiceRoller from './engine/components/DiceRoller';
import SessionScreen from './engine/components/SessionScreen';
import DMDashboard from './engine/components/DMDashboard';
import PlayerView from './engine/components/PlayerView';
import BoardView from './engine/components/BoardView';
import MapController from './engine/components/MapController';
import UniverseSelect, { BootOverlay } from './engine/components/UniverseSelect';
import { UniverseProvider, useUniverse } from './engine/UniverseContext';
import { ContentProvider } from './engine/ContentContext';
import { GameProvider, useGame, boardCodeForTab } from './engine/GameContext';
import { useAmbientAudio } from './engine/hooks/useAmbientAudio';
import { useTTS } from './engine/hooks/useTTS';

function Section({ id, active, children }) {
  return <section className={`section${active === id ? ' active' : ''}`}>{children}</section>;
}

const hasJoinLink = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('join');

function AppContent() {
  const [activeSection, setActiveSection] = useState('scenarios');
  const audio = useAmbientAudio();
  const tts = useTTS();
  const { role } = useGame();
  const { universe, chosen } = useUniverse();
  const [boardTab] = useState(() => !!boardCodeForTab());

  // Table board (TV): ?board=CODE — full screen map, no chrome
  if (role === 'board' || boardTab) {
    return <BoardView />;
  }

  // Players see ONLY their character view
  if (role === 'player') {
    return <PlayerView />;
  }

  // Fresh load: universe landing first (join links skip it; the server's
  // join response picks the universe).
  if (!chosen && !hasJoinLink()) {
    return <UniverseSelect />;
  }

  // No session yet — show session screen
  if (!role) {
    return (
      <>
        <div className="crt-overlay" />
        <div className="app">
          <Header />
          <SessionScreen />
        </div>
      </>
    );
  }

  // DM — full app with session management tab
  return (
    <>
      <div className="crt-overlay" />
      <div className="app">
        <Header />
        <Nav active={activeSection} onChange={setActiveSection} isDM />

        <Section id="session" active={activeSection}><DMDashboard /></Section>
        <Section id="board" active={activeSection}><MapController /></Section>
        <Section id="scenarios" active={activeSection}><ScenarioLibrary tts={tts} /></Section>
        <Section id="characters" active={activeSection}><Characters /></Section>
        <Section id="maps" active={activeSection}><Maps /></Section>
        <Section id="dice" active={activeSection}><DiceRoller /></Section>
        {(universe.navSections || []).map(({ id, Component }) => (
          <Section key={`${universe.id}:${id}`} id={id} active={activeSection}><Component /></Section>
        ))}
      </div>

      <AudioPanel audio={audio} />
    </>
  );
}

export default function App() {
  return (
    <UniverseProvider>
      <ContentProvider>
        <GameProvider>
          <AppContent />
          <BootOverlay />
        </GameProvider>
      </ContentProvider>
    </UniverseProvider>
  );
}
