// Guards against the release-blocking bug where an EXPO_PUBLIC_* env var read
// silently comes back `undefined` in production builds.
//
// babel-preset-expo's inline-env-vars plugin (apps/mobile/node_modules/
// babel-preset-expo/build/plugins/inline-env-vars.js) only substitutes a
// *literal* member access -- `process.env.EXPO_PUBLIC_X` -- with the build's
// env value. Anything that reaches the same value through a non-literal
// path (a bracket/computed key, a variable holding the key name, optional
// chaining before the property, or destructuring off `process.env`) is
// invisible to that plugin: the access survives into the release bundle
// untouched and evaluates to `undefined` at runtime, because Metro does not
// otherwise expose real process.env values on-device.
//
// This shipped as a real bug: apps/mobile/src/features/session/
// supabaseClient.ts used to read `process.env?.[key]` through a shared
// `readEnvVar(key)` helper, so EXPO_PUBLIC_SUPABASE_URL /
// EXPO_PUBLIC_SUPABASE_ANON_KEY were always undefined in release builds and
// the app silently fell back to local-only mode (confirmed by grepping the
// exported production bundle for the Supabase project ref and finding zero
// matches). Every EXPO_PUBLIC_* read in apps/mobile/src must therefore stay
// a plain, static `process.env.EXPO_PUBLIC_X` expression.
//
// Scope is deliberately apps/mobile/src only: test files run under vitest
// (no babel-preset-expo transform, real Node process.env), so a test helper
// that pokes at `process.env[key]` to fixture arbitrary env vars around an
// assertion (see publicReleaseConfig.test.ts's `withEnv`) is legitimate and
// out of scope for this check.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC_ROOT = resolve(ROOT, "apps/mobile/src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const testFilePattern = /\.(test|spec)\.tsx?$/;

const failures = [];

const listFiles = (absolutePath) => {
  if (!existsSync(absolutePath)) {
    failures.push(`${relative(ROOT, absolutePath)} is missing.`);
    return [];
  }

  if (statSync(absolutePath).isFile()) {
    return [absolutePath];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(absolutePath, entry.name);

    return entry.isDirectory() ? listFiles(childPath) : entry.isFile() ? [childPath] : [];
  });
};

const checkedFiles = listFiles(SRC_ROOT).filter(
  (filePath) => sourceExtensions.has(extname(filePath)) && !testFilePattern.test(filePath)
);

// Strips /* ... */ block comments (replacing their content with spaces, so
// reported line numbers stay accurate) so the checks below never trip on a
// comment that explains this exact anti-pattern for future readers.
const stripBlockComments = (content) => content.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));

const violationPatterns = [
  {
    pattern: /process\.env\s*\?\.\s*\[/,
    describe: () => "reads process.env via optional-chained bracket access (`process.env?.[...]`)"
  },
  {
    pattern: /process\.env\s*\[/,
    describe: () => "reads process.env via bracket/computed access (`process.env[...]`)"
  },
  {
    pattern: /process\.env\s*\?\./,
    describe: () => "reads process.env via optional chaining (`process.env?.`)"
  },
  {
    pattern: /(?:const|let|var)\s*\{[^}]*\}\s*=\s*process\.env\b/,
    describe: () => "destructures keys off process.env instead of a literal member access"
  },
  {
    pattern: /EXPO_PUBLIC_[A-Z0-9_]*\$\{/,
    describe: () => "builds an EXPO_PUBLIC_* key name from a template literal"
  },
  {
    pattern: /["']EXPO_PUBLIC_[A-Z0-9_]*["']\s*\+|\+\s*["']EXPO_PUBLIC_/,
    describe: () => "builds an EXPO_PUBLIC_* key name via string concatenation"
  }
];

for (const filePath of checkedFiles) {
  const relativePath = relative(ROOT, filePath);
  const content = stripBlockComments(readFileSync(filePath, "utf8"));
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("//") || trimmed === "") {
      return;
    }

    for (const { pattern, describe } of violationPatterns) {
      if (pattern.test(line)) {
        failures.push(`${relativePath}:${index + 1} ${describe()} -- babel-preset-expo cannot inline this at build time; use a literal \`process.env.EXPO_PUBLIC_X\` member access instead.`);
        break;
      }
    }
  });
}

if (failures.length > 0) {
  console.error("Mobile env-var inlining validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Mobile env-var inlining validation passed (${checkedFiles.length} files checked).`);
