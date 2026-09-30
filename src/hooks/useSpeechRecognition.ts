import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BrowserSpeechRecognition,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
} from '../types/browser';

export function useSpeechRecognition(lang: string = 'en-US') {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const shouldListenRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            setTranscript(transcript);
          } else {
            interim += transcript;
          }
        }

        if (interim) {
          setTranscript(interim);
        }

        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }

        silenceTimeoutRef.current = setTimeout(() => {
          setTranscript('');
        }, 3000);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') {
          return;
        }

        setError(`Speech recognition error: ${event.error}`);
        shouldListenRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        if (shouldListenRef.current) {
          try {
            recognition.start();
          } catch {
            setError('Speech recognition could not restart.');
            shouldListenRef.current = false;
          }
        }
      };

      recognitionRef.current = recognition;

      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore — onend/start races are harmless here
        }
      }
    }

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const start = useCallback(() => {
    if (recognitionRef.current && isSupported) {
      shouldListenRef.current = true;
      setError('');
      try {
        recognitionRef.current.start();
      } catch {
        setError('Speech recognition is already running.');
      }
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current.abort();
      }
    }
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    start,
    stop,
  };
  
}