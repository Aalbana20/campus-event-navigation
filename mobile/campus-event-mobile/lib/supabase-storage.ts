import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}campus-event-navigation/`
  : null;

const STORAGE_FILE = STORAGE_DIRECTORY
  ? `${STORAGE_DIRECTORY}supabase-auth-storage.json`
  : null;

let cachedStore: Record<string, string> | null = null;

const readStore = async (): Promise<Record<string, string>> => {
  if (cachedStore) return cachedStore;

  if (!STORAGE_FILE || !STORAGE_DIRECTORY) {
    cachedStore = {};
    return cachedStore;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(STORAGE_FILE);

    if (!fileInfo.exists) {
      cachedStore = {};
      return cachedStore;
    }

    const rawValue = await FileSystem.readAsStringAsync(STORAGE_FILE);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};

    cachedStore =
      parsedValue && typeof parsedValue === 'object'
        ? (parsedValue as Record<string, string>)
        : {};
    return cachedStore;
  } catch (error) {
    console.error('Unable to read Supabase auth storage:', error);
    cachedStore = {};
    return cachedStore;
  }
};

const writeStore = async (nextStore: Record<string, string>) => {
  cachedStore = nextStore;

  if (!STORAGE_FILE || !STORAGE_DIRECTORY) return;

  try {
    await FileSystem.makeDirectoryAsync(STORAGE_DIRECTORY, {
      intermediates: true,
    });
    await FileSystem.writeAsStringAsync(
      STORAGE_FILE,
      JSON.stringify(nextStore),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.error('Unable to write Supabase auth storage:', error);
  }
};

export const expoSupabaseStorage = {
  getItem: async (key: string) => {
    const store = await readStore();
    return store[key] ?? null;
  },
  setItem: async (key: string, value: string) => {
    const store = await readStore();
    await writeStore({
      ...store,
      [key]: value,
    });
  },
  removeItem: async (key: string) => {
    const store = await readStore();
    const nextStore = { ...store };
    delete nextStore[key];
    await writeStore(nextStore);
  },
};
