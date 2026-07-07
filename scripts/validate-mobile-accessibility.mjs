import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const scanDirs = [path.join(rootDir, "apps/mobile/src"), path.join(rootDir, "apps/mobile/app")];
const targetExtensions = new Set([".tsx"]);
const failures = [];
const screenHeaderContracts = [
  "apps/mobile/src/features/appShell/ShellScreen.tsx",
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  "apps/mobile/src/features/generation/GenerationScreen.tsx",
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  "apps/mobile/src/features/legal/PrivacyScreen.tsx",
  "apps/mobile/src/features/legal/SupportScreen.tsx",
  "apps/mobile/src/features/legal/TermsScreen.tsx",
  "apps/mobile/src/features/onboarding/OnboardingScreen.tsx",
  "apps/mobile/src/features/onboarding/SplashScreen.tsx",
  "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
  "apps/mobile/src/features/petSetup/PetSetupScreen.tsx",
  "apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx",
  "apps/mobile/src/features/settings/SettingsScreen.tsx",
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx"
];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (targetExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length;

const hasProp = (tag, propName) => new RegExp(`\\b${propName}(?:\\s*=|\\s|>|$)`).test(tag);

const findOpeningTags = (content, tagName) => {
  const tags = [];
  const tagPattern = new RegExp(`<${tagName}\\b`, "g");
  let match;

  while ((match = tagPattern.exec(content)) !== null) {
    let index = match.index;
    let quote = null;
    let braceDepth = 0;

    for (; index < content.length; index += 1) {
      const char = content[index];
      const previous = content[index - 1];

      if (quote) {
        if (char === quote && previous !== "\\") {
          quote = null;
        }

        continue;
      }

      if (char === "\"" || char === "'") {
        quote = char;
        continue;
      }

      if (char === "{") {
        braceDepth += 1;
        continue;
      }

      if (char === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }

      if (char === ">" && braceDepth === 0) {
        tags.push({
          tag: content.slice(match.index, index + 1),
          index: match.index
        });
        break;
      }
    }
  }

  return tags;
};

const checkFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(rootDir, filePath);

  for (const { tag, index } of findOpeningTags(content, "Pressable")) {
    if (!hasProp(tag, "accessibilityRole")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} Pressable missing accessibilityRole.`);
    }

    if (!hasProp(tag, "accessibilityLabel")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} Pressable missing accessibilityLabel.`);
    }

    if (tag.includes('accessibilityRole="checkbox"') && !tag.includes("checked")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} checkbox Pressable missing checked accessibilityState.`);
    }

    if (hasProp(tag, "disabled") && !hasProp(tag, "accessibilityState")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} disabled Pressable missing disabled accessibilityState.`);
    }
  }

  for (const { tag, index } of findOpeningTags(content, "TextInput")) {
    if (!hasProp(tag, "accessibilityLabel")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} TextInput missing accessibilityLabel.`);
    }
  }

  for (const { tag, index } of findOpeningTags(content, "Image")) {
    if (!hasProp(tag, "accessibilityLabel") && !hasProp(tag, "accessibilityElementsHidden")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} Image missing accessibilityLabel or accessibilityElementsHidden.`);
    }

    if (!hasProp(tag, "accessibilityIgnoresInvertColors")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} Image missing accessibilityIgnoresInvertColors.`);
    }

    if (hasProp(tag, "accessibilityElementsHidden") && !hasProp(tag, "importantForAccessibility")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} hidden Image missing importantForAccessibility for Android.`);
    }
  }

  for (const { tag, index } of findOpeningTags(content, "ImageBackground")) {
    if (!hasProp(tag, "accessibilityLabel") && !hasProp(tag, "accessibilityElementsHidden")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} ImageBackground missing accessibilityLabel or accessibilityElementsHidden.`);
    }
  }

  for (const { tag, index } of findOpeningTags(content, "View")) {
    if (tag.includes('accessibilityRole="progressbar"') && !hasProp(tag, "accessibilityValue")) {
      failures.push(`${relativePath}:${lineNumberAt(content, index)} progressbar View missing accessibilityValue.`);
    }
  }
};

for (const dir of scanDirs) {
  for (const filePath of walk(dir)) {
    checkFile(filePath);
  }
}

for (const relativePath of screenHeaderContracts) {
  const filePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath} is missing from the screen header accessibility contract.`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (!content.includes('accessibilityRole="header"')) {
    failures.push(`${relativePath} must expose the primary screen title with accessibilityRole="header".`);
  }
}

if (failures.length > 0) {
  console.error("Mobile accessibility validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Mobile accessibility validation passed.");
