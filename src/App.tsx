import { useState } from 'react';
import { CameraView } from './components/CameraView';
import type { TranslationLanguage } from './components/CameraView';
import { GestureManager } from './components/GestureManager';
import { useGestures } from './hooks/useGestures';
import { BookOpen, Camera, Hand, Languages, Mic, Settings } from 'lucide-react';

function App() {
  const {
    gestures,
    importedGestures,
    loading,
    addGesture,
    updateGesture,
    deleteGesture,
    addImportedGesture,
    updateImportedGesture,
    deleteImportedGesture,
    importGestureDataset,
  } = useGestures();
  const [showManager, setShowManager] = useState(false);
  const [showLiveCaptions, setShowLiveCaptions] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<TranslationLanguage>('default');

  const selectDataset = (nextDataset: TranslationLanguage) => {
    setSelectedDataset((currentDataset) => currentDataset === nextDataset ? 'default' : nextDataset);
  };

  const activeDataset =
    selectedDataset === 'default'
      ? 'Add Gesture dictionary'
      : selectedDataset === 'en'
        ? 'English dataset'
        : selectedDataset === 'ta'
          ? 'Tamil dataset'
          : 'Imported dataset';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading gestures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <header className="bg-white/90 shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hand className="text-blue-600" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Sign Language Translator
                </h1>
                <p className="text-sm text-gray-600">
                  Camera translation with custom, offline, and imported datasets
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => {
                  setShowLiveCaptions(!showLiveCaptions);
                  setShowManager(false);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
              >
                <Mic size={20} />
                {showLiveCaptions ? "Camera View" : "Live Captions"}
              </button>
              <button
                onClick={() => {
                  setShowManager(!showManager);
                  setShowLiveCaptions(false);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {showManager ? <Camera size={20} /> : <Settings size={20} />}
                {showManager ? "Camera View" : "Manage Gestures"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showLiveCaptions ? (
          <section className="bg-white rounded-lg shadow-md border border-blue-100 overflow-hidden">
            <div className="flex flex-col gap-3 p-5 border-b border-blue-100 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Live Captions
                </h2>
                <p className="text-sm text-gray-600">
                  Convert speech to captions in real time.
                </p>
              </div>
              <a
                href="https://sign-language-translator-new.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Open in a new tab
              </a>
            </div>
            <iframe
              title="Live Captions"
              src="https://sign-language-translator-new.vercel.app/"
              allow="microphone"
              className="h-[calc(100vh-15rem)] min-h-[520px] w-full border-0"
            />
          </section>
        ) : !showManager ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-white rounded-lg shadow-md p-5 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Languages className="text-blue-600" size={22} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active Dataset</p>
                    <p className="font-semibold text-gray-900">
                      {activeDataset}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 border border-blue-100">
                <p className="text-sm text-gray-500">Saved Gestures</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {selectedDataset === "imported"
                    ? importedGestures.length
                    : gestures.length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 border border-blue-100">
                <p className="text-sm text-gray-500">Speech Output</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedDataset === "ta"
                    ? "Tamil voice enabled"
                    : "English voice enabled"}
                </p>
              </div>
            </div>

            <CameraView
              gestures={gestures}
              importedGestures={importedGestures}
              language={selectedDataset}
            />

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Dataset Dictionary
                  </h3>
                  <p className="text-sm text-gray-600">
                    Switch between custom, offline, or imported gestures from
                    the manager.
                  </p>
                </div>
                <button
                  onClick={() => setShowManager(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors text-sm"
                >
                  <BookOpen size={18} />
                  Open Manager
                </button>
              </div>
              {selectedDataset === "default" ? (
                gestures.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {gestures.map((gesture) => (
                      <div
                        key={gesture.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <span className="font-mono text-sm font-bold text-blue-600 min-w-[60px]">
                          {gesture.binary_code}
                        </span>
                        <span className="text-gray-700 text-sm">
                          {gesture.phrase}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    No custom gestures yet.
                  </div>
                )
              ) : selectedDataset === "imported" ? (
                importedGestures.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {importedGestures.map((gesture) => (
                      <div
                        key={gesture.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <span className="font-mono text-sm font-bold text-blue-600 min-w-[60px]">
                          {gesture.binary_code}
                        </span>
                        <span className="text-gray-700 text-sm">
                          {gesture.phrase}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    No imported gestures yet.
                  </div>
                )
              ) : (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  Built-in dataset selected. Use the manager to switch back to
                  custom or imported words.
                </div>
              )}
            </div>
          </div>
        ) : (
          <GestureManager
            gestures={gestures}
            importedGestures={importedGestures}
            selectedDataset={selectedDataset}
            onSelectDataset={selectDataset}
            onAdd={addGesture}
            onAddImported={addImportedGesture}
            onUpdate={updateGesture}
            onUpdateImported={updateImportedGesture}
            onDelete={deleteGesture}
            onDeleteImported={deleteImportedGesture}
            onImportDataset={importGestureDataset}
          />
        )}
      </main>

      <footer className="bg-white mt-12 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-600">
          <p>AI-Based Sign Language to Voice Application</p>
          <p className="text-sm mt-1">
            Pocket-Based Assistive Communication System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
