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
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { useTTS } from './hooks/useTTS';

export default function App() {
  const [activeSection, setActiveSection] = useState('scenarios');
  const audio = useAmbientAudio();
  const tts = useTTS();

  return (
    <>
      <div className="crt-overlay" />
      <div className="app">
        <Header />
        <Nav active={activeSection} onChange={setActiveSection} />

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
