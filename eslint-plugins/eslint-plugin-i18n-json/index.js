/**
 * eslint-plugin-i18n-json
 *
 * Custom ESLint plugin that enforces using react-i18next `t()` for all
 * user-facing text in JSX. Rejects raw string literals in JSX children
 * (text nodes and expression containers).
 */

"use strict";

/** Strings that are purely decorative symbols and should not be translated. */
const DEFAULT_ALLOWED = new Set([
  " ", "\u00a0", "—", "·", "↻", "×", "▾", "▸", "✕",
  "▶", "▼", "☰", "+", "…",
]);

/** @type {import("eslint").Rule.RuleModule} */
const noRawTextRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw text in JSX — use t() from react-i18next instead",
      category: "Internationalization",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedStrings: {
            type: "array",
            items: { type: "string" },
            description:
              "Strings (exact match after trim) that are allowed without t().",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawText:
        'Use t(\'key\') from react-i18next instead of raw text "{{text}}" in JSX.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowed = new Set([
      ...DEFAULT_ALLOWED,
      ...(options.allowedStrings || []),
    ]);

    /**
     * Check whether a string value is reportable.
     * Whitespace-only and allowed strings are skipped.
     */
    function isReportable(raw) {
      const trimmed = raw.trim();
      if (trimmed === "") return false;
      if (allowed.has(trimmed)) return false;
      return true;
    }

    return {
      // Bare text between JSX tags: <p>Hello</p>
      JSXText(node) {
        if (isReportable(node.value)) {
          context.report({
            node,
            messageId: "rawText",
            data: { text: node.value.trim() },
          });
        }
      },

      // String literals inside JSX expression containers: <p>{"Hello"}</p>
      JSXExpressionContainer(node) {
        const expr = node.expression;
        if (expr.type === "Literal" && typeof expr.value === "string") {
          if (isReportable(expr.value)) {
            context.report({
              node: expr,
              messageId: "rawText",
              data: { text: expr.value },
            });
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    "no-raw-text": noRawTextRule,
  },
};
