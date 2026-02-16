import { useState, useRef, useCallback, useEffect } from 'react';

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

  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoice) {
        const english = available.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
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
    const synth = window.speechSynthesis;
    if (index >= paragraphsRef.current.length || cancelledRef.current) {
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

    utterance.onend = () => {
      if (!cancelledRef.current) {
        speakParagraph(index + 1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        console.error('TTS error:', e);
      }
      if (!cancelledRef.current) {
        speakParagraph(index + 1);
      }
    };

    synth.speak(utterance);
  }, [rate, pitch, selectedVoice]);

  const speak = useCallback((paragraphs) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    cancelledRef.current = false;
    paragraphsRef.current = paragraphs;
    setIsSpeaking(true);
    setIsPaused(false);
    speakParagraph(0);
  }, [speakParagraph]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    indexRef.current = -1;
  }, []);

  const skipForward = useCallback(() => {
    if (indexRef.current < paragraphsRef.current.length - 1) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      cancelledRef.current = false;
      speakParagraph(indexRef.current + 1);
    }
  }, [speakParagraph]);

  const skipBack = useCallback(() => {
    if (indexRef.current > 0) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      cancelledRef.current = false;
      speakParagraph(indexRef.current - 1);
    }
  }, [speakParagraph]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
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
