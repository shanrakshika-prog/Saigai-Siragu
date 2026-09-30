import { useCallback, useEffect, useRef } from 'react';

let voicesPreloaded = false;

function preloadVoices() {
  if (voicesPreloaded || !('speechSynthesis' in window)) return;
  voicesPreloaded = true;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export function useSpeechSynthesis() {
  useEffect(() => {
    preloadVoices();
  }, []);

  const currentTextRef = useRef<string | null>(null);

  const speak = useCallback((text: string, lang = 'en-US', rate = 1.0) => {
    if (!('speechSynthesis' in window) || !text) return;

    // If this exact phrase is already being spoken, let it finish instead of
    // cutting it off and restarting. Repeatedly cancel()+speak()-ing the same
    // utterance in quick succession is a known way to make some browsers'
    // speech engines silently stop working altogether.
    if (window.speechSynthesis.speaking && currentTextRef.current === text) {
      return;
    }

    window.speechSynthesis.cancel();
    currentTextRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      if (currentTextRef.current === text) {
        currentTextRef.current = null;
      }
    };
    utterance.onerror = () => {
      if (currentTextRef.current === text) {
        currentTextRef.current = null;
      }
    };

    const voice = window.speechSynthesis
      .getVoices()
      .find((availableVoice) => availableVoice.lang.toLowerCase().startsWith(lang.toLowerCase()));

    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  const reset = useCallback(() => {
    currentTextRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, reset };
}