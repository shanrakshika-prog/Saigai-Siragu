import { useRef, useState, type ChangeEvent } from 'react';
import { Gesture } from '../types/gesture';
import { BookOpen, Edit2, FileUp, Languages, Plus, Save, Trash2, X } from 'lucide-react';
import type { TranslationLanguage } from './CameraView';
import englishSigns from '../data/english-signs.json';
import tamilSigns from '../data/tamil-signs.json';
import { parseGestureDatasetFile, type ParsedGestureEntry } from '../utils/datasetImport';

interface GestureManagerProps {
  gestures: Gesture[];
  importedGestures: Gesture[];
  selectedDataset: TranslationLanguage;
  onSelectDataset: (dataset: TranslationLanguage) => void;
  onAdd: (binaryCode: string, phrase: string) => Promise<void>;
  onAddImported: (binaryCode: string, phrase: string) => Promise<void>;
  onUpdate: (id: string, phrase: string) => Promise<void>;
  onUpdateImported: (id: string, phrase: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteImported: (id: string) => Promise<void>;
  onImportDataset: (entries: ParsedGestureEntry[]) => Promise<void>;
}

function createBuiltInGesture(dataset: string, index: number, entry: { binary_code: string; phrase: string }): Gesture {
  return {
    id: `${dataset}-${index}`,
    binary_code: entry.binary_code,
    phrase: entry.phrase,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function GestureManager({
  gestures,
  importedGestures,
  selectedDataset,
  onSelectDataset,
  onAdd,
  onAddImported,
  onUpdate,
  onUpdateImported,
  onDelete,
  onDeleteImported,
  onImportDataset,
}: GestureManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBinary, setNewBinary] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const [editPhrase, setEditPhrase] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditableDataset = selectedDataset === 'default' || selectedDataset === 'imported';
  const currentGestures =
    selectedDataset === 'default'
      ? gestures
      : selectedDataset === 'imported'
        ? importedGestures
        : selectedDataset === 'en'
          ? englishSigns.map((entry, index) => createBuiltInGesture('en', index, entry))
          : tamilSigns.map((entry, index) => createBuiltInGesture('ta', index, entry));

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message === 'DUPLICATE_GESTURE') {
      return 'This binary code already exists';
    }

    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === '23505'
    ) {
      return 'This binary code already exists';
    }

    return fallback;
  };

  const handleAdd = async () => {
    setError('');
    const cleanBinary = newBinary.trim();
    const cleanPhrase = newPhrase.trim();

    if (!/^[01]{5}$/.test(cleanBinary)) {
      setError('Binary code must be exactly 5 digits (0 or 1)');
      return;
    }
    if (!cleanPhrase) {
      setError('Phrase cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedDataset === 'imported') {
        await onAddImported(cleanBinary, cleanPhrase);
      } else {
        await onAdd(cleanBinary, cleanPhrase);
      }
      setNewBinary('');
      setNewPhrase('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add gesture'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    const cleanPhrase = editPhrase.trim();
    if (!cleanPhrase) {
      setError('Phrase cannot be empty');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      if (selectedDataset === 'imported') {
        await onUpdateImported(id, cleanPhrase);
      } else {
        await onUpdate(id, cleanPhrase);
      }
      setEditingId(null);
      setEditPhrase('');
    } catch {
      setError('Failed to update gesture');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this gesture?')) {
      setError('');
      setIsSaving(true);
      try {
        if (selectedDataset === 'imported') {
          await onDeleteImported(id);
        } else {
          await onDelete(id);
        }
      } catch {
        setError('Failed to delete gesture');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const startEdit = (gesture: Gesture) => {
    setEditingId(gesture.id);
    setEditPhrase(gesture.phrase);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPhrase('');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setImportingFile(true);
    setImportMessage('');

    try {
      const entries = await parseGestureDatasetFile(file);
      await onImportDataset(entries);
      setSelectedFileName(file.name);
      onSelectDataset('imported');
      setImportMessage(`Imported ${entries.length} gestures from ${file.name}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setImportingFile(false);
      event.target.value = '';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6 border border-blue-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Languages className="text-blue-600" size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Dataset Selection</h2>
              <p className="text-sm text-gray-600 mt-1">
                Pick a custom, offline, or uploaded dataset for translation and editing.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-sm text-gray-600 mt-1">
              {selectedDataset === 'default'
                ? 'Using custom gesture dictionary'
                : selectedDataset === 'en'
                  ? 'Using English dataset'
                  : selectedDataset === 'ta'
                    ? 'Using Tamil dataset'
                    : 'Using imported dataset'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onSelectDataset('default')}
                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                  selectedDataset === 'default'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Custom
              </button>
              <button
                onClick={() => onSelectDataset('en')}
                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                  selectedDataset === 'en'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                English
              </button>
              <button
                onClick={() => onSelectDataset('ta')}
                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                  selectedDataset === 'ta'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Tamil
              </button>
              <button
                onClick={() => onSelectDataset('imported')}
                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                  selectedDataset === 'imported'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Import File
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 border border-blue-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="text-blue-600" size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Gesture Dictionary</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedDataset === 'default'
                  ? `${gestures.length} custom gestures saved`
                  : selectedDataset === 'imported'
                    ? `${importedGestures.length} imported gestures available`
                    : 'Built-in dataset preview'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedDataset === 'imported' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.tsv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                  disabled={importingFile}
                >
                  <FileUp size={18} />
                  {importingFile ? 'Importing...' : 'Upload File'}
                </button>
              </>
            )}
            <button
              onClick={() => (isEditableDataset ? setShowAddForm(!showAddForm) : onSelectDataset('default'))}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {showAddForm ? <X size={18} /> : <Plus size={18} />}
              {showAddForm ? 'Cancel' : isEditableDataset ? 'Add Gesture' : 'Switch to Custom'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {selectedDataset === 'imported' && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Upload a JSON, CSV, TSV, or Excel file to build a new imported dataset. The translator will use it immediately.
            </p>
            {selectedFileName && <p className="mt-2 text-sm text-amber-700">Last file: {selectedFileName}</p>}
            {importMessage && <p className="mt-2 text-sm font-medium text-amber-700">{importMessage}</p>}
          </div>
        )}

        {showAddForm && isEditableDataset && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Add New Gesture</h3>
            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Binary Code
                </label>
                <input
                  type="text"
                  value={newBinary}
                  onChange={(e) => setNewBinary(e.target.value)}
                  placeholder="10101"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phrase
                </label>
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  placeholder="Hello, how are you?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={isSaving}
              className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Add Gesture'}
            </button>
          </div>
        )}

        {!isEditableDataset && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
            Built-in datasets are read-only. Switch back to Custom or Imported to add or edit gestures.
          </div>
        )}

        <div className="space-y-2">
          {currentGestures.map((gesture) => (
            <div
              key={gesture.id}
              className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="font-mono text-lg font-bold text-blue-600 min-w-[80px]">
                  {gesture.binary_code}
                </span>
                {editingId === gesture.id ? (
                  <input
                    type="text"
                    value={editPhrase}
                    onChange={(e) => setEditPhrase(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                ) : (
                  <span className="text-gray-800 flex-1 min-w-0 break-words">{gesture.phrase}</span>
                )}
              </div>
              {isEditableDataset && (
                <div className="flex items-center gap-2 sm:justify-end">
                  {editingId === gesture.id ? (
                    <>
                      <button
                        onClick={() => handleEdit(gesture.id)}
                        disabled={isSaving}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(gesture)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(gesture.id)}
                        disabled={isSaving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {currentGestures.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No gestures available for this dataset yet.
          </div>
        )}
      </div>
    </div>
  );
}
