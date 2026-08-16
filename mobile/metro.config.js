const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, '../shared');

// The domain registries are shared source, outside either client package.
// Watch only that directory so Metro can resolve the same canonical data.
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@shared': sharedRoot,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@shared/')) {
    const sharedModule = moduleName.slice('@shared/'.length);
    return {
      type: 'sourceFile',
      filePath: path.join(sharedRoot, `${sharedModule}.ts`),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

// lucide-react-native 1.30.0 publishes a valid main entry alongside its
// exports map. Use the main/module fields when Metro encounters a stale or
// incomplete package export map in an installed dependency.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
