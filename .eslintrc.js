module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module"
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "apps/*/node_modules/",
    "apps/*/.next/",
    "apps/*/dist/"
  ]
};