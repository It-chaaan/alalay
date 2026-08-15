const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The domain registries are shared source, outside either client package.
// Watch only that directory so Metro can resolve the same canonical data.
config.watchFolders = [path.resolve(__dirname, '../shared')];

// lucide-react-native 1.30.0 publishes a valid main entry alongside its
// exports map. Use the main/module fields when Metro encounters a stale or
// incomplete package export map in an installed dependency.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
