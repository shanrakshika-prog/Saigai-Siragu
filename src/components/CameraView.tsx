import { useEffect, useRef, useState } from 'react';
import { Gesture } from '../types/gesture';
import { detectFingerStates, HandLandmarks, smoothLandmarks, resetSmoothing, GestureValidator } from '../utils/handDetection';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { Mic, MicOff, Plus, X } from 'lucide-react';
import { MediaPipeCamera, MediaPipeHands, MediaPipeHandsResults } from '../types/browser';
import englishSigns from "../data/english-signs.json";
import tamilSigns from "../data/tamil-signs.json";

interface CameraViewProps {
  gestures: Gesture[];
  importedGestures: Gesture[];
  language: TranslationLanguage;
  onAddGesture?: (binaryCode: string, phrase: string) => Promise<void>;
}

export type TranslationLanguage = "default" | "en" | "ta" | "imported";

export type GestureLookupEntry = Pick<Gesture, 'binary_code' | 'phrase'>;

function findMatchingGesture(binaryCode: string, dataset: GestureLookupEntry[]): GestureLookupEntry | null {
  if (!binaryCode || binaryCode.length !== 5) {
    return null;
  }

  // Exact match only. No "closest within 1 bit" fallback: with only a
  // handful of the 32 possible codes registered per custom/imported
  // dataset, an unregistered gesture that happens to be 1 bit away from a
  // real entry would otherwise get silently snapped to that entry instead
  // of correctly showing "Unknown gesture".
  return dataset.find((item) => item.binary_code === binaryCode) ?? null;
}

export function CameraView({ gestures, importedGestures, language, onAddGesture }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [binaryCode, setBinaryCode] = useState('');
  const [detectedPhrase, setDetectedPhrase] = useState('');
  const [isActive, setIsActive] = useState(false);
  const { speak } = useSpeechSynthesis();
  const {
    transcript,
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
  } = useSpeechRecognition(language === 'ta' ? 'ta-IN' : 'en-US');
  const [micEnabled, setMicEnabled] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState('');

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickPhrase, setQuickPhrase] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickSuccess, setQuickSuccess] = useState('');

  const [videoAspect, setVideoAspect] = useState('4/3');
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  const lastBinaryRef = useRef('');
  const stableStartRef = useRef(0);
  const lastSpokenRef = useRef('');
  const lastSpokenAtRef = useRef(0);
  const languageRef = useRef<TranslationLanguage>("default");

  const [stabilityThreshold, setStabilityThreshold] = useState(150);
  const [repeatInterval, setRepeatInterval] = useState(3000);
  const [speechRate, setSpeechRate] = useState(1.0);

  const stabilityThresholdRef = useRef(stabilityThreshold);
  const repeatIntervalRef = useRef(repeatInterval);
  const speechRateRef = useRef(speechRate);

  useEffect(() => {
    stabilityThresholdRef.current = stabilityThreshold;
  }, [stabilityThreshold]);

  useEffect(() => {
    repeatIntervalRef.current = repeatInterval;
  }, [repeatInterval]);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  const gestureValidatorRef = useRef(new GestureValidator());
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(0);

  const gesturesRef = useRef(gestures);
  const importedGesturesRef = useRef(importedGestures);
  const videoDimensionsRef = useRef({ w: 640, h: 480 });

  useEffect(() => {
    gesturesRef.current = gestures;
  }, [gestures]);

  useEffect(() => {
    importedGesturesRef.current = importedGestures;
  }, [importedGestures]);

  useEffect(() => {
    languageRef.current = language;
    lastBinaryRef.current = '';
    lastSpokenRef.current = '';
    lastSpokenAtRef.current = 0;
  }, [language]);

  // Dynamically resize canvas & container, and set the HiDPI context scale
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return;

    const updateCanvasSize = () => {
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      videoDimensionsRef.current = { w, h };

      setVideoAspect(`${w}/${h}`);

      const dpr = window.devicePixelRatio || 1;
      const scaledW = Math.floor(w * dpr);
      const scaledH = Math.floor(h * dpr);

      canvas.width = scaledW;
      canvas.height = scaledH;
      setCanvasSize({ width: scaledW, height: scaledH });

      // Scale the context so all drawing uses logical (CSS) pixels
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };

    if (video.readyState >= 2) {
      updateCanvasSize();
    } else {
      video.addEventListener('loadedmetadata', updateCanvasSize);
    }
    video.addEventListener('resize', updateCanvasSize);
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
      video.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isActive, videoRef.current, canvasRef.current]);

  // Camera initialization
  useEffect(() => {
    if (!isActive) return;

    let hands: MediaPipeHands | null = null;
    let camera: MediaPipeCamera | null = null;
    let isCancelled = false;
    let checkInterval: number | undefined;
    const gestureValidator = gestureValidatorRef.current;

    const initializeHandTracking = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      setError('');

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!window.Hands || !window.Camera) {
        setError('Hand tracking libraries are still loading. Please try again.');
        return;
      }

      hands = new window.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults((results: MediaPipeHandsResults) => {
        if (isCancelled) return;
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        frameCountRef.current++;
        if (performance.now() - fpsTimerRef.current > 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          fpsTimerRef.current = performance.now();
        }

        const { w, h } = videoDimensionsRef.current;

        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(results.image, 0, 0, w, h);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          let landmarks = results.multiHandLandmarks[0];
          if (!landmarks || landmarks.length !== 21) {
            ctx.restore();
            return;
          }

          landmarks = smoothLandmarks(landmarks, 0);
          drawConnectors(ctx, landmarks, w, h);
          drawLandmarks(ctx, landmarks, w, h);

          const binary = detectFingerStates(landmarks);
          const validatedBinary = gestureValidator.validateGesture(binary);

          setBinaryCode(binary);

          if (validatedBinary) {
            if (validatedBinary !== lastBinaryRef.current) {
              lastBinaryRef.current = validatedBinary;
              stableStartRef.current = Date.now();
              lastSpokenRef.current = '';
              lastSpokenAtRef.current = 0;
              const dataset =
                languageRef.current === "default"
                  ? gesturesRef.current
                  : languageRef.current === "en"
                    ? englishSigns
                    : languageRef.current === "ta"
                      ? tamilSigns
                      : importedGesturesRef.current;

              const gesture = findMatchingGesture(validatedBinary, dataset);

              const phrase = gesture?.phrase ?? "Unknown gesture";
              setDetectedPhrase(phrase);
            }

            const timeSinceStable = Date.now() - stableStartRef.current;
            const isFirstSpeak =
              timeSinceStable > stabilityThresholdRef.current &&
              lastBinaryRef.current === validatedBinary &&
              lastSpokenRef.current !== lastBinaryRef.current;

            const isRepeatSpeak =
              lastBinaryRef.current === validatedBinary &&
              lastSpokenRef.current === lastBinaryRef.current &&
              Date.now() - lastSpokenAtRef.current > repeatIntervalRef.current;

            if (isFirstSpeak || isRepeatSpeak) {
              const dataset =
                languageRef.current === "default"
                  ? gesturesRef.current
                  : languageRef.current === "en"
                    ? englishSigns
                    : languageRef.current === "ta"
                      ? tamilSigns
                      : importedGesturesRef.current;

              const gesture = findMatchingGesture(lastBinaryRef.current, dataset);

              if (gesture) {
                speak(gesture.phrase, languageRef.current === "ta" ? "ta-IN" : "en-US", speechRateRef.current);
                lastSpokenRef.current = gesture.binary_code;
                lastSpokenAtRef.current = Date.now();
              }
            }
          }
        } else {
          setBinaryCode('');
          setDetectedPhrase('No hand detected');
          gestureValidator.reset();
        }

        ctx.restore();
      });

      camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && hands && !isCancelled) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720,
      });

      try {
        await camera.start();
      } catch {
        setError('Could not start the camera. Check browser camera permissions and try again.');
        setIsActive(false);
      }
    };

    if (window.Hands && window.Camera) {
      initializeHandTracking();
    } else {
      const startedAt = Date.now();
      checkInterval = window.setInterval(() => {
        if (window.Hands && window.Camera) {
          window.clearInterval(checkInterval);
          initializeHandTracking();
        } else if (Date.now() - startedAt > 10000) {
          window.clearInterval(checkInterval);
          setError('Hand tracking could not load. Check your internet connection and refresh the page.');
          setIsActive(false);
        }
      }, 100);
    }

    return () => {
      isCancelled = true;
      if (checkInterval) {
        window.clearInterval(checkInterval);
      }
      camera?.stop();
      hands?.close();
      setFps(0);
      setBinaryCode('');
      setDetectedPhrase('');
      gestureValidator.reset();
      resetSmoothing();
    };
  }, [isActive, speak]);

  useEffect(() => {
    if (isActive && micEnabled && isSpeechSupported) {
      startSpeech();
    } else if (!micEnabled) {
      stopSpeech();
    }
  }, [isActive, micEnabled, isSpeechSupported, startSpeech, stopSpeech]);

  useEffect(() => {
    if (!isActive) {
      setMicEnabled(false);
      stopSpeech();
      setShowQuickAdd(false);
    }
  }, [isActive, stopSpeech]);

  // --- Pure neon green lines (#00FF00) ---
  const drawConnectors = (
    ctx: CanvasRenderingContext2D,
    landmarks: HandLandmarks[] | null | undefined,
    w: number,
    h: number
  ) => {
    if (!ctx || !landmarks || landmarks.length < 2) return;

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];

    ctx.strokeStyle = '#00FF00'; // Pure neon green
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      if (!startPoint || !endPoint) return;

      ctx.beginPath();
      ctx.moveTo(startPoint.x * w, startPoint.y * h);
      ctx.lineTo(endPoint.x * w, endPoint.y * h);
      ctx.stroke();
    });
  };

  // --- Solid red dots (#FF0000) with NO white outline ---
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: HandLandmarks[] | null | undefined,
    w: number,
    h: number
  ) => {
    if (!ctx || !landmarks || landmarks.length === 0) return;

    const radius = 7;

    landmarks.forEach((landmark) => {
      if (!landmark) return;
      const x = landmark.x * w;
      const y = landmark.y * h;
      ctx.beginPath();
      ctx.fillStyle = '#FF0000';
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const handleQuickAdd = async () => {
    setQuickError('');
    setQuickSuccess('');

    if (!onAddGesture) {
      setQuickError('Add Gesture is unavailable right now.');
      return;
    }
    if (!/^[01]{5}$/.test(binaryCode)) {
      setQuickError('Hold a clear, steady gesture in view first.');
      return;
    }
    const cleanPhrase = quickPhrase.trim();
    if (!cleanPhrase) {
      setQuickError('Enter a phrase for this gesture.');
      return;
    }

    setQuickSaving(true);
    try {
      await onAddGesture(binaryCode, cleanPhrase);
      setQuickSuccess(`Saved "${cleanPhrase}"`);
      setQuickPhrase('');
      setTimeout(() => {
        setShowQuickAdd(false);
        setQuickSuccess('');
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'DUPLICATE_GESTURE') {
        setQuickError('This binary code is already saved.');
      } else {
        setQuickError('Failed to save gesture.');
      }
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="relative w-full lg:flex-1 min-w-0">
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
            {!isActive ? (
              <div className="flex flex-col items-center justify-center min-h-[70vh] sm:min-h-[500px] bg-gray-800 gap-6 p-6">
                {error && (
                  <p className="max-w-md text-center text-sm text-red-200">
                    {error}
                  </p>
                )}
                <button
                  onClick={() => setIsActive(true)}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Start Camera
                </button>
              </div>
            ) : (
              <div className="relative">
                <video
                  ref={videoRef}
                  className="hidden"
                  autoPlay
                  playsInline
                  muted
                />

                <div
                  className="w-full max-h-[75vh] sm:max-h-[520px] md:max-h-[650px] mx-auto bg-black overflow-hidden"
                  style={{ aspectRatio: videoAspect }}
                >
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    className="w-full h-full object-contain"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>

                {/* FPS & Binary */}
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/70 rounded-xl px-3 py-2 sm:px-4">
                  <p className="text-green-400 font-mono text-xs sm:text-sm">
                    {binaryCode || "-----"}
                  </p>
                  <p className="text-gray-300 text-[11px] sm:text-xs mt-1">
                    {fps} FPS
                  </p>
                </div>

                {/* Controls */}
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex items-center gap-2">
                  {onAddGesture && (
                    <button
                      onClick={() => {
                        setQuickError('');
                        setQuickSuccess('');
                        setShowQuickAdd(!showQuickAdd);
                      }}
                      className={`p-2 sm:p-3 rounded-xl transition-colors text-white ${
                        showQuickAdd
                          ? "bg-blue-700 hover:bg-blue-800"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                      title="Add Gesture"
                    >
                      {showQuickAdd ? <X size={18} /> : <Plus size={18} />}
                    </button>
                  )}

                  {isSpeechSupported && (
                    <button
                      onClick={() => setMicEnabled(!micEnabled)}
                      className={`p-2 sm:p-3 rounded-xl transition-colors ${
                        micEnabled
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-gray-600 hover:bg-gray-700"
                      } text-white`}
                    >
                      {micEnabled ? (
                        <Mic size={18} />
                      ) : (
                        <MicOff size={18} />
                      )}
                    </button>
                  )}
                </div>

                {/* Quick Add panel */}
                {showQuickAdd && (
                  <div className="absolute top-14 right-2 sm:top-20 sm:right-4 w-64 max-w-[calc(100%-1rem)] sm:w-72 bg-black/85 border border-blue-500 rounded-xl p-3 sm:p-4 z-10">
                    <p className="text-xs text-gray-300 mb-2">Current gesture</p>
                    <p className="font-mono text-green-400 text-sm mb-3">
                      {/^[01]{5}$/.test(binaryCode) ? binaryCode : "Show a steady gesture..."}
                    </p>
                    <input
                      type="text"
                      value={quickPhrase}
                      onChange={(e) => setQuickPhrase(e.target.value)}
                      placeholder="Phrase for this gesture"
                      className="w-full px-3 py-2 mb-2 rounded-lg bg-gray-800 text-white text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    {quickError && (
                      <p className="text-xs text-red-300 mb-2">{quickError}</p>
                    )}
                    {quickSuccess && (
                      <p className="text-xs text-green-300 mb-2">{quickSuccess}</p>
                    )}
                    <button
                      onClick={handleQuickAdd}
                      disabled={quickSaving}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {quickSaving ? 'Saving...' : 'Save Gesture'}
                    </button>
                  </div>
                )}

                {/* Detected Text */}
                <div className="absolute top-20 sm:top-24 left-2 right-2 sm:left-4 sm:right-4 bg-black/70 rounded-xl px-3 py-3">
                  <p className="text-center text-base sm:text-xl font-semibold text-blue-300">
                    {detectedPhrase || "Waiting for gesture..."}
                  </p>
                </div>

                {/* Speech Transcript */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 border-t border-green-500 px-4 py-3 sm:py-4">
                  <p
                    className={`text-center text-base sm:text-lg font-bold ${
                      transcript
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    {transcript || (language === 'ta' ? "பேசுங்கள்..." : "Say something...")}
                  </p>
                  {speechError && (
                    <p className="text-center text-xs text-red-300 mt-1">
                      {speechError}
                    </p>
                  )}
                  {isListening && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      <span className="text-xs text-red-400">
                        Listening...
                      </span>
                    </div>
                  )}
                </div>

                {/* Stop Button */}
                <button
                  onClick={() => setIsActive(false)}
                  className="absolute bottom-24 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm shadow-lg"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Response Settings Panel */}
        <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl shadow-lg border border-gray-200 p-4 space-y-5">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Response Settings
          </h3>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">
                Reaction Speed
              </label>
              <span className="text-xs font-mono text-blue-600">
                {stabilityThreshold}ms
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={10}
              value={stabilityThreshold}
              onChange={(e) => setStabilityThreshold(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              How long a gesture must hold steady before it's spoken. Lower = faster response, but more false triggers.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">
                Repeat Interval
              </label>
              <span className="text-xs font-mono text-blue-600">
                {(repeatInterval / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={10000}
              step={100}
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              How often the same held gesture is spoken again while you keep showing it.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">
                Voice Speed
              </label>
              <span className="text-xs font-mono text-blue-600">
                {speechRate.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              How fast the spoken phrase is read aloud.
            </p>
          </div>

          <button
            onClick={() => {
              setStabilityThreshold(150);
              setRepeatInterval(3000);
              setSpeechRate(1.0);
            }}
            className="w-full py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}