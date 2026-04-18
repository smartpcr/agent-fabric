/**
 * ESLint configuration — strict TypeScript linting.
 *
 * Uses "plugin:@typescript-eslint/strict-type-checked", the canonical
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
    project: "./tsconfig.eslint.json",
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
    // Reject hard-coded strings in JSX text nodes — use t() from react-i18next instead.
    "react/jsx-no-literals": [
      "warn",
      {
        noStrings: true,
        ignoreProps: true,
        allowedStrings: [
          " ", "\u00a0", "—", "·", "↻", "×", "▾", "▸", "✕",
          "true", "false",
        ],
      },
    ],

  },
  ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.config.*"],
};
