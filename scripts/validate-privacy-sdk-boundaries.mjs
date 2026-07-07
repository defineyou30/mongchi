import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = new Set();

const packageManifestPaths = [
  "package.json",
  "apps/mobile/package.json",
  "packages/shared/package.json",
  "services/api/package.json",
  "workers/ai/package.json"
];

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundleDependencies",
  "bundledDependencies"
];

const disallowedSdkPackageMatchers = [
  {
    label: "Sentry crash/diagnostics SDK",
    matches: (name) => name === "sentry-expo" || name.startsWith("@sentry/")
  },
  {
    label: "Firebase analytics/crash SDK",
    matches: (name) =>
      name === "expo-firebase-analytics" ||
      name === "expo-firebase-core" ||
      name === "firebase" ||
      name.startsWith("@react-native-firebase/")
  },
  {
    label: "Crashlytics SDK",
    matches: (name) => name.includes("crashlytics")
  },
  {
    label: "tracking transparency / IDFA SDK",
    matches: (name) => name === "expo-tracking-transparency"
  },
  {
    label: "advertising SDK",
    matches: (name) =>
      name === "expo-ads-admob" ||
      name === "react-native-google-mobile-ads" ||
      name.startsWith("@react-native-admob/")
  },
  {
    label: "Amplitude analytics SDK",
    matches: (name) => name === "amplitude-js" || name.startsWith("@amplitude/")
  },
  {
    label: "Segment analytics SDK",
    matches: (name) => name === "analytics-react-native" || name.startsWith("@segment/")
  },
  {
    label: "Mixpanel analytics SDK",
    matches: (name) => name === "mixpanel" || name === "mixpanel-react-native" || name.startsWith("@mixpanel/")
  },
  {
    label: "PostHog analytics SDK",
    matches: (name) => name === "posthog-js" || name === "posthog-react-native" || name.startsWith("posthog-")
  },
  {
    label: "Datadog mobile diagnostics SDK",
    matches: (name) => name === "@datadog/mobile-react-native" || name.startsWith("@datadog/")
  },
  {
    label: "Bugsnag crash/diagnostics SDK",
    matches: (name) => name === "@bugsnag/react-native" || name.startsWith("@bugsnag/")
  },
  {
    label: "EAS Insights diagnostics SDK",
    matches: (name) => name === "expo-insights" || name === "@expo/insights"
  }
];

const disallowedSourcePatterns = [
  {
    label: "Sentry crash/diagnostics SDK",
    pattern: /(?:["'](?:@sentry\/[^"']+|sentry-expo)["']|\bSentry\s*\.\s*init\s*\()/i
  },
  {
    label: "Firebase analytics/crash SDK",
    pattern:
      /["'](?:@react-native-firebase\/(?:app|analytics|crashlytics)|expo-firebase-(?:analytics|core)|firebase\/(?:analytics|crashlytics))["']/i
  },
  {
    label: "tracking transparency / IDFA SDK",
    pattern: /(?:["']expo-tracking-transparency["']|\brequestTrackingPermissionsAsync\s*\()/i
  },
  {
    label: "advertising SDK",
    pattern: /["'](?:expo-ads-admob|react-native-google-mobile-ads|@react-native-admob\/[^"']+)["']/i
  },
  {
    label: "Amplitude analytics SDK",
    pattern: /["'](?:@amplitude\/[^"']+|amplitude-js)["']/i
  },
  {
    label: "Segment analytics SDK",
    pattern: /["'](?:@segment\/[^"']+|analytics-react-native)["']/i
  },
  {
    label: "Mixpanel analytics SDK",
    pattern: /["'](?:@mixpanel\/[^"']+|mixpanel|mixpanel-react-native)["']/i
  },
  {
    label: "PostHog analytics SDK",
    pattern: /["'](?:posthog-js|posthog-react-native|posthog-[^"']+)["']/i
  },
  {
    label: "Datadog mobile diagnostics SDK",
    pattern: /["'](?:@datadog\/[^"']+)["']/i
  },
  {
    label: "Bugsnag crash/diagnostics SDK",
    pattern: /["'](?:@bugsnag\/[^"']+)["']/i
  },
  {
    label: "EAS Insights diagnostics SDK",
    pattern: /["'](?:expo-insights|@expo\/insights)["']/i
  }
];

const scannedSourceRoots = [
  "apps/mobile/app",
  "apps/mobile/src",
  "apps/mobile/app.json",
  "apps/mobile/babel.config.js",
  "apps/mobile/metro.config.js",
  "apps/mobile/package.json",
  "packages/shared/src",
  "services/api/src",
  "workers/ai/src"
];

const textExtensions = new Set([".cjs", ".js", ".jsx", ".json", ".mjs", ".ts", ".tsx"]);

const addFailure = (message) => {
  failures.add(message);
};

const readJson = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    addFailure(`${relativePath} is missing.`);
    return null;
  }

  return JSON.parse(readFileSync(absolutePath, "utf8"));
};

const matchingSdkLabel = (packageName) => {
  const matcher = disallowedSdkPackageMatchers.find(({ matches }) => matches(packageName));

  return matcher?.label ?? null;
};

const reportDisallowedPackage = (source, packageName) => {
  const label = matchingSdkLabel(packageName);

  if (label) {
    addFailure(
      `${source} includes ${packageName} (${label}). Update the privacy policy, App Store privacy labels, Google Play Data safety answers, and this boundary before adding the SDK.`
    );
  }
};

const dependencyNamesForField = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string");
  }

  if (typeof value === "object") {
    return Object.keys(value);
  }

  return [];
};

for (const manifestPath of packageManifestPaths) {
  const manifest = readJson(manifestPath);

  if (!manifest) {
    continue;
  }

  for (const field of dependencyFields) {
    for (const packageName of dependencyNamesForField(manifest[field])) {
      reportDisallowedPackage(`${manifestPath} ${field}`, packageName);
    }
  }
}

const lock = readJson("package-lock.json");

if (lock?.packages && typeof lock.packages === "object") {
  for (const [lockPath, packageEntry] of Object.entries(lock.packages)) {
    const packageName =
      packageEntry && typeof packageEntry.name === "string"
        ? packageEntry.name
        : lockPath.includes("node_modules/")
          ? lockPath.slice(lockPath.lastIndexOf("node_modules/") + "node_modules/".length)
          : null;

    if (packageName) {
      reportDisallowedPackage(`package-lock.json ${lockPath || "<root>"}`, packageName);
    }
  }
}

const listFiles = (absolutePath) => {
  if (!existsSync(absolutePath)) {
    addFailure(`${relative(ROOT, absolutePath)} is missing.`);
    return [];
  }

  const stats = statSync(absolutePath);

  if (stats.isFile()) {
    return [absolutePath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      return listFiles(childPath);
    }

    return entry.isFile() ? [childPath] : [];
  });
};

const lineNumberForIndex = (content, index) => content.slice(0, index).split(/\r?\n/).length;

const sourceFiles = scannedSourceRoots
  .flatMap((rootPath) => listFiles(resolve(ROOT, rootPath)))
  .filter((filePath) => textExtensions.has(extname(filePath)));

for (const filePath of sourceFiles) {
  const relativePath = relative(ROOT, filePath);
  const content = readFileSync(filePath, "utf8");

  for (const { label, pattern } of disallowedSourcePatterns) {
    const match = pattern.exec(content);

    if (match?.index !== undefined) {
      addFailure(
        `${relativePath}:${lineNumberForIndex(content, match.index)} references ${label}. Update store privacy/data-safety answers and this boundary before using it.`
      );
    }
  }
}

if (failures.size > 0) {
  console.error("Privacy SDK boundary validation failed:");
  [...failures].sort().forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Privacy SDK boundary validation passed.");
