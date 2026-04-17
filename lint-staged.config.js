export default {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write", "vitest related --run"],
  "*.md": ["prettier --write"],
};
