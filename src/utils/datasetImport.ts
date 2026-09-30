import * as XLSX from 'xlsx';

export interface ParsedGestureEntry {
  binary_code: string;
  phrase: string;
}

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const getMatchingColumnKey = (row: Record<string, unknown>, aliases: string[]): string | null => {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  for (const key of Object.keys(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      return key;
    }
  }

  return null;
};

const normalizeBinaryCode = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\s,._-]+/g, '').trim();
    return /^[01]{5}$/.test(cleaned) ? cleaned : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const cleaned = String(value).trim();
    return /^[01]{5}$/.test(cleaned) ? cleaned : null;
  }

  return null;
};

const normalizePhrase = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
};

const normalizeRow = (row: Record<string, unknown>): ParsedGestureEntry | null => {
  const binaryKey = getMatchingColumnKey(row, ['binary_code', 'binarycode', 'binary', 'code', 'gesture_code', 'gesturecode', 'signcode']);
  const phraseKey = getMatchingColumnKey(row, ['phrase', 'word', 'text', 'value', 'meaning', 'label', 'gesture', 'sign', 'translation', 'gesturename', 'signname']);

  if (!binaryKey || !phraseKey) {
    return null;
  }

  const binaryCode = normalizeBinaryCode(row[binaryKey]);
  const phrase = normalizePhrase(row[phraseKey]);

  if (!binaryCode || !phrase) {
    return null;
  }

  return { binary_code: binaryCode, phrase };
};

const extractRowsFromWorkbook = (workbook: XLSX.WorkBook): ParsedGestureEntry[] => {
  const rows: ParsedGestureEntry[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    rawRows.forEach((row) => {
      const parsed = normalizeRow(row);
      if (parsed) {
        rows.push(parsed);
      }
    });
  });

  return rows;
};

export async function parseGestureDatasetFile(file: File): Promise<ParsedGestureEntry[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            return normalizeRow(item as Record<string, unknown>);
          }
          return null;
        })
        .filter((item): item is ParsedGestureEntry => Boolean(item));
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const candidate = Array.isArray(record.gestures)
        ? record.gestures
        : Array.isArray(record.data)
          ? record.data
          : Array.isArray(record.rows)
            ? record.rows
            : null;

      if (candidate) {
        return candidate
          .map((item) => {
            if (typeof item === 'object' && item !== null) {
              return normalizeRow(item as Record<string, unknown>);
            }
            return null;
          })
          .filter((item): item is ParsedGestureEntry => Boolean(item));
      }
    }

    throw new Error('The JSON file did not contain any gesture rows.');
  }

  const arrayBuffer = await file.arrayBuffer();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const rows = extractRowsFromWorkbook(workbook);

    if (rows.length === 0) {
      throw new Error('No valid gestures were found in the spreadsheet. Make sure the file has columns such as "Binary Code" and "Phrase" with 5-bit codes.');
    }

    return rows;
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = new TextDecoder().decode(arrayBuffer);
    const workbook = XLSX.read(text, { type: 'string' });
    const rows = extractRowsFromWorkbook(workbook);

    if (rows.length === 0) {
      throw new Error('No valid gestures were found in the file. Make sure the file has columns such as "Binary Code" and "Phrase" with 5-bit codes.');
    }

    return rows;
  }

  throw new Error('Unsupported file type. Please upload a JSON, CSV, TSV, XLSX, or XLS file.');
}
