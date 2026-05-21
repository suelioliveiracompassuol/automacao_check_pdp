import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import playwright from "eslint-plugin-playwright";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    ...playwright.configs["flat/recommended"],
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "curly": ["error", "all"],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "reports/", "playwright-report/", "test-results/"],
  }
);
