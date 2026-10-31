import React, { useState, useEffect } from 'react';
import Header from './engine/components/Header';
import Nav, { DmBanners, NAV_RESELECT } from './engine/components/Nav';
import ScenarioLibrary from './engine/components/ScenarioLibrary';
import Characters from './engine/components/Characters';
import Maps from './engine/components/Maps';
import DiceRoller from './engine/components/DiceRoller';
import SessionScreen from './engine/components/SessionScreen';
import DMDashboard from './engine/components/DMDashboard';
import PlayerView from './engine/components/PlayerView';
import BoardView from './engine/components/BoardView';
import MapController from './engine/components/MapController';
import RunView from './engine/components/run/RunView';
import RollFeed from './engine/components/run/RollFeed';
import UniverseSelect, { BootOverlay } from './engine/components/UniverseSelect';
import { UniverseProvider, useUniverse } from './engine/UniverseContext';
import { ContentProvider } from './engine/ContentContext';
import { GameProvider, useGame, boardCodeForTab } from './engine/GameContext';
import { useAmbientAudio } from './engine/hooks/useAmbientAudio';
import { useTTS } from './engine/hooks/useTTS';

function Section({ id, active, children, className = '' }) {
  return <section className={`section sec-${id}${active === id ? ' active' : ''} ${className}`} aria-hidden={active === id ? undefined : true}>{children}</section>;
}

const hasJoinLink = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('join');

/* RULES: one rail entry; the universe's reference sections (universe.navSections) are its sub-tabs. */
function RulesSection() {
  const { universe } = useUniverse();
  const subs = universe.navSections || [];
  const [tab, setTab] = useState(subs[0]?.id || null);
  useEffect(() => {
    if (!subs.some((s) => s.id === tab)) setTab(subs[0]?.id || null);
  }, [subs, tab]);
  useEffect(() => {
    const h = (e) => { if (e.detail === 'rules') setTab(subs[0]?.id || null); };
    window.addEventListener(NAV_RESELECT, h);
    return () => window.removeEventListener(NAV_RESELECT, h);
  }, [subs]);
  const current = subs.find((s) => s.id === tab) || subs[0];
  if (!current) return <div className="panel"><p className="run-empty">No reference sections for {universe.name}.</p></div>;
  const { Component } = current;
  return (
    <div className="rules">
      <div className="subtabs" role="tablist" aria-label="Rules reference">
        {subs.map((s) => (
          <button key={`${universe.id}:${s.id}`} type="button" role="tab" aria-selected={s.id === current.id}
            className={s.id === current.id ? 'on' : ''} onClick={() => setTab(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="rules-body" role="tabpanel" aria-label={current.label}>
        <Component key={`${universe.id}:${current.id}`} />
      </div>
    </div>
  );
}

function AppContent() {
  const [activeSection, setActiveSection] = useState('scenarios');
  const audio = useAmbientAudio();
  const tts = useTTS();
  const { role, gameCode, packId } = useGame();
  const { chosen } = useUniverse();
  const [boardTab] = useState(() => !!boardCodeForTab());

  // Session features: once a DM session is live, land on RUN (scenario) or the crew dashboard (sandbox).
  useEffect(() => {
    if (role === 'dm' && gameCode) setActiveSection(packId ? 'run' : 'session');
  }, [role, gameCode, packId]);

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

  // No session yet — the same status strip, no rail.
  if (!role) {
    return (
      <>
        <div className="crt-overlay" />
        <div className="deck no-rail">
          <Header />
          <main className="deck-main">
            <SessionScreen />
          </main>
        </div>
      </>
    );
  }

  // GM terminal: status strip + left rail + one section at a time.
  return (
    <>
      <div className="crt-overlay" />
      <div className={`deck on-${activeSection}`}>
        <Header onNavigate={setActiveSection} />
        <Nav active={activeSection} onChange={setActiveSection} audio={audio} />
        <main className="deck-main" id="deck-main">
          <div className="deck-banners"><DmBanners onChange={setActiveSection} /></div>
          <Section id="run" active={activeSection}>
            <RunView tts={tts} audio={audio} active={activeSection === 'run'} onNavigate={setActiveSection} />
          </Section>
          <Section id="session" active={activeSection}><DMDashboard /></Section>
          <Section id="board" active={activeSection}><MapController /></Section>
          <Section id="scenarios" active={activeSection}><ScenarioLibrary tts={tts} /></Section>
          <Section id="characters" active={activeSection}><Characters /></Section>
          <Section id="maps" active={activeSection}><Maps /></Section>
          <Section id="dice" active={activeSection}>
            <div className="dice-page">
              <div className="dice-page-roller"><DiceRoller /></div>
              {gameCode && <RollFeed limit={20} title="ROLL FEED" className="dice-page-feed" />}
            </div>
          </Section>
          <Section id="rules" active={activeSection}><RulesSection /></Section>
        </main>
      </div>
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
