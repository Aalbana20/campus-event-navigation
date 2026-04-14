const fs = require('fs');
const path = require('path');

const baseConfig = require('./app.json').expo;

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((collection, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return collection;
      }

      const [key, ...valueParts] = trimmed.split('=');
      const rawValue = valueParts.join('=').trim();
      const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

      collection[key.trim()] = normalizedValue;
      return collection;
    }, {});
};

const repoRoot = path.resolve(__dirname, '..', '..');

const env = {
  ...parseEnvFile(path.join(repoRoot, '.env')),
  ...parseEnvFile(path.join(repoRoot, '.env.local')),
  ...parseEnvFile(path.join(__dirname, '.env')),
  ...process.env,
};

module.exports = ({ config }) => {
  const resolvedConfig = config ?? baseConfig;

  return {
    ...resolvedConfig,
     plugins: [
    ...((resolvedConfig.plugins || baseConfig.plugins || [])),
    'expo-video',
  ],
  extra: {
      ...(resolvedConfig.extra || {}),
      supabaseUrl:
        env.EXPO_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '',
      supabaseAnonKey:
        env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '',
    },
  };
};
