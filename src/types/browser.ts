import { HandLandmarks } from '../utils/handDetection';

export interface MediaPipeHandsResults {
  image: CanvasImageSource;
  multiHandLandmarks?: HandLandmarks[][];
}

export interface MediaPipeHands {
  setOptions(options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }): void;
  onResults(callback: (results: MediaPipeHandsResults) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

export interface MediaPipeHandsConstructor {
  new (options: { locateFile: (file: string) => string }): MediaPipeHands;
}

export interface MediaPipeCamera {
  start(): Promise<void> | void;
  stop(): void;
}

export interface MediaPipeCameraConstructor {
  new (
    video: HTMLVideoElement,
    options: {
      onFrame: () => Promise<void>;
      width: number;
      height: number;
    }
  ): MediaPipeCamera;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    Hands?: MediaPipeHandsConstructor;
    Camera?: MediaPipeCameraConstructor;
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}
