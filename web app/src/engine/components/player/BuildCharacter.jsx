import React from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import CharacterBuilder from '../CharacterBuilder';

/* In-phone character builder for an unassigned seat (builder part 2).
   SUBMIT → socket `character-submit {character}`; SAVE keeps a copy on this
   device (localStorage engine.player.saved.<universeId>) and submits too. */
const savedKey = (u) => `engine.player.saved.${u}`;

export default function BuildCharacter({ onDone }) {
  const { submitCharacter, connectedPlayers, myPlayer } = useGame();
  const { universe } = useUniverse();
  const names = (connectedPlayers || []).filter((p) => p.id !== myPlayer?.id).map((p) => p.name);

  const submit = (char) => submitCharacter(char, (r) => { if (r?.success) setTimeout(onDone, 900); });
  const save = (char) => {
    try { localStorage.setItem(savedKey(universe.id), JSON.stringify(char)); } catch { /* ignore */ }
    submit(char);
    return true;
  };

  return (
    <div className="pv-pane ph-builder">
      <CharacterBuilder onBack={onDone} onSave={save} onSubmit={submit} connectedPlayers={names} />
    </div>
  );
}
