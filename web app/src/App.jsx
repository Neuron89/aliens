import React, { useState } from 'react';
import Header from './components/Header';
import Nav from './components/Nav';
import AudioPanel from './components/AudioPanel';
import Scenarios from './components/Scenarios';
import Characters from './components/Characters';
import Maps from './components/Maps';
import DiceRoller from './components/DiceRoller';
import CheatSheets from './components/CheatSheets';
import Xenomorphs from './components/Xenomorphs';
import SessionScreen from './components/SessionScreen';
import DMDashboard from './components/DMDashboard';
import PlayerView from './components/PlayerView';
import { GameProvider, useGame } from './context/GameContext';
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { useTTS } from './hooks/useTTS';

function AppContent() {
  const [activeSection, setActiveSection] = useState('scenarios');
  const audio = useAmbientAudio();
  const tts = useTTS();
  const { role } = useGame();

  // Players see ONLY their character view
  if (role === 'player') {
    return <PlayerView />;
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

        <section className={`section${activeSection === 'session' ? ' active' : ''}`}>
          <DMDashboard />
        </section>

        <section className={`section${activeSection === 'scenarios' ? ' active' : ''}`}>
          <Scenarios tts={tts} />
        </section>

        <section className={`section${activeSection === 'characters' ? ' active' : ''}`}>
          <Characters />
        </section>

        <section className={`section${activeSection === 'maps' ? ' active' : ''}`}>
          <Maps />
        </section>

        <section className={`section${activeSection === 'dice' ? ' active' : ''}`}>
          <DiceRoller />
        </section>

        <section className={`section${activeSection === 'cheats' ? ' active' : ''}`}>
          <CheatSheets />
        </section>

        <section className={`section${activeSection === 'aliens' ? ' active' : ''}`}>
          <Xenomorphs />
        </section>
      </div>

      <AudioPanel audio={audio} />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
