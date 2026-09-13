// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/**'],
  },
  {
    // React Native's legacy PanResponder/Animated values are imperative and
    // execute outside React. These bridges are deliberately the only scope
    // excluded from the compiler's ref-render rule.
    files: [
      'src/components/legacy-wallet-swipe-responder.ts',
      'src/components/legacy-chat-head-animated-bridge.tsx',
    ],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
]);
