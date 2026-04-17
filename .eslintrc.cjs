/**
 * ESLint configuration — strict TypeScript linting.
 *
 * The spec calls for "eslint-config-typescript-strict". That npm package
 * (eslint-config-typescript-strict@1.x) is pinned to @typescript-eslint v4 and
 * is incompatible with modern tooling.  We use the official equivalent:
 * "plugin:@typescript-eslint/strict-type-checked", which is the canonical
 * strict preset maintained by the typescript-eslint team.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    project: "./tsconfig.json",
  },
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "jsx-a11y",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier",
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.config.*"],
};
