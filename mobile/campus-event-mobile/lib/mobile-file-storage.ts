import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}campus-event-navigation/`
  : null;

const createExpoFileStorage = (storageFileName: string, label: string) => {
  const storageFile = STORAGE_DIRECTORY
    ? `${STORAGE_DIRECTORY}${storageFileName}`
    : null;

  let cachedStore: Record<string, string> | null = null;
  let hasLoggedReadError = false;
  let hasLoggedWriteError = false;

  const logReadErrorOnce = (error: unknown) => {
    if (hasLoggedReadError) return;
    hasLoggedReadError = true;
    console.error(`Unable to read ${label}:`, error);
  };

  const logWriteErrorOnce = (error: unknown) => {
    if (hasLoggedWriteError) return;
    hasLoggedWriteError = true;
    console.error(`Unable to write ${label}:`, error);
  };

  const readStore = async (): Promise<Record<string, string>> => {
    if (cachedStore) return cachedStore;

    if (!STORAGE_DIRECTORY || !storageFile) {
      cachedStore = {};
      return cachedStore;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(storageFile);

      if (!fileInfo.exists) {
        cachedStore = {};
        return cachedStore;
      }

      const rawValue = await FileSystem.readAsStringAsync(storageFile);
      const parsedValue = rawValue ? JSON.parse(rawValue) : {};

      cachedStore =
        parsedValue && typeof parsedValue === 'object'
          ? (parsedValue as Record<string, string>)
          : {};
      return cachedStore;
    } catch (error) {
      logReadErrorOnce(error);
      cachedStore = {};
      return cachedStore;
    }
  };

  const writeStore = async (nextStore: Record<string, string>) => {
    cachedStore = nextStore;

    if (!STORAGE_DIRECTORY || !storageFile) return;

    try {
      await FileSystem.makeDirectoryAsync(STORAGE_DIRECTORY, {
        intermediates: true,
      });
      await FileSystem.writeAsStringAsync(
        storageFile,
        JSON.stringify(nextStore),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      logWriteErrorOnce(error);
    }
  };

  return {
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
};

export const mobileSettingsStorage = createExpoFileStorage(
  'mobile-settings-storage.json',
  'mobile settings storage'
);
