import { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Gesture } from '../types/gesture';
import type { ParsedGestureEntry } from '../utils/datasetImport';

const CUSTOM_STORAGE_KEY = 'sign-language-translator-gestures';
const IMPORTED_STORAGE_KEY = 'sign-language-translator-imported-gestures';

const DEFAULT_GESTURES: Gesture[] = [
  createLocalGesture('00000', 'Hello'),
  createLocalGesture('10000', 'How are you'),
  createLocalGesture('01000', 'I am fine'),
  createLocalGesture('11000', 'Thank you'),
  createLocalGesture('10100', 'Can you help me'),
  createLocalGesture('11111', 'Good morning'),
  createLocalGesture('00011', 'Good night'),
];

function createLocalGesture(binaryCode: string, phrase: string): Gesture {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    binary_code: binaryCode,
    phrase,
    created_at: now,
    updated_at: now,
  };
}

function loadStoredGestures(storageKey: string, fallback: Gesture[]): Gesture[] {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    localStorage.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      throw new Error('Gesture cache is not an array');
    }

    return parsed.filter(
      (gesture): gesture is Gesture =>
        typeof gesture?.id === 'string' &&
        /^[01]{5}$/.test(gesture.binary_code) &&
        typeof gesture.phrase === 'string'
    );
  } catch {
    localStorage.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }
}

function saveStoredGestures(storageKey: string, gestures: Gesture[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(gestures));
  }
}

function describeSupabaseError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message: unknown }).message);
    if (message.includes('relation') && message.includes('does not exist')) {
      return 'The "gestures" table does not exist yet. Run the migration in supabase/migrations against your project.';
    }
    if (message.toLowerCase().includes('jwt') || message.toLowerCase().includes('api key')) {
      return 'Supabase rejected the API key. Check VITE_SUPABASE_ANON_KEY.';
    }
    if (message.toLowerCase().includes('failed to fetch')) {
      return 'Could not reach Supabase. Check VITE_SUPABASE_URL and your network connection.';
    }
    return `Supabase error: ${message}`;
  }
  return 'Could not reach Supabase.';
}

export function useGestures() {
  const [gestures, setGestures] = useState<Gesture[]>(() => loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES));
  const [importedGestures, setImportedGestures] = useState<Gesture[]>(() => loadStoredGestures(IMPORTED_STORAGE_KEY, []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supabaseAvailable, setSupabaseAvailable] = useState(isSupabaseConfigured);

  const fetchGestures = async () => {
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured || !supabase) {
      setSupabaseAvailable(false);
      setGestures(loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES));
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('gestures')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching gestures:', fetchError);
      setError(describeSupabaseError(fetchError));
      setSupabaseAvailable(false);
      setGestures(loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES));
    } else {
      setSupabaseAvailable(true);
      const nextGestures = data || [];
      saveStoredGestures(CUSTOM_STORAGE_KEY, nextGestures);
      setGestures(nextGestures);
    }
    setLoading(false);
  };

  const addGesture = async (binaryCode: string, phrase: string) => {
    const cleanPhrase = phrase.trim();

    if (!supabaseAvailable || !supabase) {
      const currentGestures = loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES);
      if (currentGestures.some((gesture) => gesture.binary_code === binaryCode)) {
        throw new Error('DUPLICATE_GESTURE');
      }

      const nextGestures = [...currentGestures, createLocalGesture(binaryCode, cleanPhrase)];
      saveStoredGestures(CUSTOM_STORAGE_KEY, nextGestures);
      setGestures(nextGestures);
      return;
    }

    const { error: insertError } = await supabase
      .from('gestures')
      .insert({ binary_code: binaryCode, phrase: cleanPhrase });

    if (insertError) {
      console.error('Error adding gesture:', insertError);
      setError(describeSupabaseError(insertError));
      setSupabaseAvailable(false);
      throw insertError;
    }
    await fetchGestures();
  };

  const updateGesture = async (id: string, phrase: string) => {
    const cleanPhrase = phrase.trim();

    if (!supabaseAvailable || !supabase) {
      const currentGestures = loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES);
      const now = new Date().toISOString();
      const nextGestures = currentGestures.map((gesture) =>
        gesture.id === id ? { ...gesture, phrase: cleanPhrase, updated_at: now } : gesture
      );
      saveStoredGestures(CUSTOM_STORAGE_KEY, nextGestures);
      setGestures(nextGestures);
      return;
    }

    const { error: updateError } = await supabase
      .from('gestures')
      .update({ phrase: cleanPhrase, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating gesture:', updateError);
      setError(describeSupabaseError(updateError));
      setSupabaseAvailable(false);
      throw updateError;
    }
    await fetchGestures();
  };

  const deleteGesture = async (id: string) => {
    if (!supabaseAvailable || !supabase) {
      const nextGestures = loadStoredGestures(CUSTOM_STORAGE_KEY, DEFAULT_GESTURES).filter((gesture) => gesture.id !== id);
      saveStoredGestures(CUSTOM_STORAGE_KEY, nextGestures);
      setGestures(nextGestures);
      return;
    }

    const { error: deleteError } = await supabase
      .from('gestures')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting gesture:', deleteError);
      setError(describeSupabaseError(deleteError));
      setSupabaseAvailable(false);
      throw deleteError;
    }
    await fetchGestures();
  };

  const importGestureDataset = async (entries: ParsedGestureEntry[]) => {
    const nextGestures = entries.reduce<Gesture[]>((accumulator, entry) => {
      if (accumulator.some((gesture) => gesture.binary_code === entry.binary_code)) {
        return accumulator;
      }

      return [...accumulator, createLocalGesture(entry.binary_code, entry.phrase)];
    }, []);

    saveStoredGestures(IMPORTED_STORAGE_KEY, nextGestures);
    setImportedGestures(nextGestures);
  };

  const addImportedGesture = async (binaryCode: string, phrase: string) => {
    const cleanPhrase = phrase.trim();
    const currentGestures = loadStoredGestures(IMPORTED_STORAGE_KEY, []);

    if (currentGestures.some((gesture) => gesture.binary_code === binaryCode)) {
      throw new Error('DUPLICATE_GESTURE');
    }

    const nextGestures = [...currentGestures, createLocalGesture(binaryCode, cleanPhrase)];
    saveStoredGestures(IMPORTED_STORAGE_KEY, nextGestures);
    setImportedGestures(nextGestures);
  };

  const updateImportedGesture = async (id: string, phrase: string) => {
    const cleanPhrase = phrase.trim();
    const currentGestures = loadStoredGestures(IMPORTED_STORAGE_KEY, []);
    const now = new Date().toISOString();
    const nextGestures = currentGestures.map((gesture) =>
      gesture.id === id ? { ...gesture, phrase: cleanPhrase, updated_at: now } : gesture
    );
    saveStoredGestures(IMPORTED_STORAGE_KEY, nextGestures);
    setImportedGestures(nextGestures);
  };

  const deleteImportedGesture = async (id: string) => {
    const nextGestures = loadStoredGestures(IMPORTED_STORAGE_KEY, []).filter((gesture) => gesture.id !== id);
    saveStoredGestures(IMPORTED_STORAGE_KEY, nextGestures);
    setImportedGestures(nextGestures);
  };

  useEffect(() => {
    fetchGestures();
  }, []);

  return {
    gestures,
    importedGestures,
    loading,
    error,
    isUsingLocalStorage: !supabaseAvailable,
    addGesture,
    updateGesture,
    deleteGesture,
    addImportedGesture,
    updateImportedGesture,
    deleteImportedGesture,
    importGestureDataset,
    refreshGestures: fetchGestures,
  };
}