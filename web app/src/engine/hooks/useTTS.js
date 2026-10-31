import { useState, useRef, useCallback, useEffect } from 'react';

/* Narration read-aloud (Web Speech API). Every utterance carries the generation it was queued in:
   cancel() fires the old utterance's onerror('interrupted'/'canceled') asynchronously, so skip/stop
   bump the generation and stale callbacks are ignored (otherwise a skip advanced twice). */
const speech = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(0.85);
  const [pitch, setPitch] = useState(0.9);

  const paragraphsRef = useRef([]);
  const indexRef = useRef(-1);
  const cancelledRef = useRef(false);
  const genRef = useRef(0);

  useEffect(() => {
    const synth = speech();
    if (!synth) return undefined;
    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoice) {
        const english = available.find(v => v.lang.startsWith('en') && /(^|[^a-z])male([^a-z]|$)/i.test(v.name))
          || available.find(v => v.lang.startsWith('en'))
          || available[0];
        setSelectedVoice(english);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.onvoiceschanged = null; };
  }, [selectedVoice]);

  const speakParagraph = useCallback((index) => {
    const synth = speech();
    if (!synth || index >= paragraphsRef.current.length || cancelledRef.current) {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentIndex(-1);
      indexRef.current = -1;
      return;
    }

    indexRef.current = index;
    setCurrentIndex(index);

    const utterance = new SpeechSynthesisUtterance(paragraphsRef.current[index]);
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (selectedVoice) utterance.voice = selectedVoice;
    const gen = genRef.current;

    utterance.onend = () => {
      if (gen === genRef.current && !cancelledRef.current) {
        speakParagraph(index + 1);
      }
    };

    utterance.onerror = (e) => {
      if (gen !== genRef.current) return; // cancelled by skip/stop/speak
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.error('TTS error:', e);
      }
      if (!cancelledRef.current) {
        speakParagraph(index + 1);
      }
    };

    synth.speak(utterance);
  }, [rate, pitch, selectedVoice]);

  const speak = useCallback((paragraphs) => {
    const synth = speech();
    if (!synth) return;
    genRef.current += 1;
    synth.cancel();
    cancelledRef.current = false;
    paragraphsRef.current = paragraphs;
    setIsSpeaking(true);
    setIsPaused(false);
    speakParagraph(0);
  }, [speakParagraph]);

  const pause = useCallback(() => {
    speech()?.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    speech()?.resume();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    genRef.current += 1;
    speech()?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;
  }, []);

  const skipForward = useCallback(() => {
    if (indexRef.current < paragraphsRef.current.length - 1) {
      genRef.current += 1;
      speech()?.cancel();
      speakParagraph(indexRef.current + 1);
    }
  }, [speakParagraph]);

  const skipBack = useCallback(() => {
    if (indexRef.current > 0) {
      genRef.current += 1;
      speech()?.cancel();
      speakParagraph(indexRef.current - 1);
    }
  }, [speakParagraph]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      genRef.current += 1;
      speech()?.cancel();
    };
  }, []);

  return {
    isSpeaking,
    isPaused,
    currentIndex,
    voices,
    selectedVoice,
    rate,
    pitch,
    speak,
    pause,
    resume,
    stop,
    skipForward,
    skipBack,
    setSelectedVoice,
    setRate,
    setPitch,
  };
}
