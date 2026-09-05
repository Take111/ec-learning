// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const { fixupConfigRules } = require('@eslint/compat');
const expoConfig = require("eslint-config-expo/flat");

// 前提: eslint-config-expo が依存する第三者プラグイン(eslint-plugin-react 7.37 / eslint-plugin-import 2.32)が
// ESLint 10 で削除された context.getFilename() 等を使っており、そのままでは rule の読み込みで落ちる
// (jsx-eslint/eslint-plugin-react#3977, import-js/eslint-plugin-import#3227)。Expo 自身(config / plugin-expo)は
// ESLint 10 を許容しているので、ESLint 公式の互換シム @eslint/compat で削除 API を補って通す。
// 両プラグインの peer に ^10 が入った版に eslint-config-expo が追従したら fixupConfigRules と @eslint/compat を外す
module.exports = defineConfig([
  ...fixupConfigRules(expoConfig),
  {
    ignores: ["dist/*"],
  }
]);
