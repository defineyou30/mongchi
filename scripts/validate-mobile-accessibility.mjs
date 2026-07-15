import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const scanDirs = [path.join(rootDir, "apps/mobile/src"), path.join(rootDir, "apps/mobile/app")];
const targetExtensions = new Set([".tsx"]);
const failures = [];
const screenHeaderContracts = [
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
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (targetExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const resolveTargets = () => {
  const requested = process.argv.slice(2);

  if (requested.length === 0) {
    return scanDirs.flatMap(walk);
  }

  return requested.flatMap((requestedPath) => {
    const absolutePath = path.resolve(rootDir, requestedPath);
    return fs.statSync(absolutePath).isDirectory() ? walk(absolutePath) : [absolutePath];
  });
};

const tagName = (node) => node.tagName.getText();
const attributesOf = (node) => node.attributes.properties.filter(ts.isJsxAttribute);
const attributeNamed = (node, name) => attributesOf(node).find((attribute) => attribute.name.getText() === name);
const hasAttribute = (node, name) => attributeNamed(node, name) !== undefined;
const lineNumberAt = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

const literalValue = (attribute) => {
  if (!attribute?.initializer) {
    return true;
  }

  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }

  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
    return undefined;
  }

  const expression = attribute.initializer.expression;

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword || expression.kind === ts.SyntaxKind.NullKeyword) {
    return false;
  }

  return undefined;
};

const hasValidLabel = (node) => {
  const label = attributeNamed(node, "accessibilityLabel") ?? attributeNamed(node, "aria-label");
  const value = literalValue(label);
  return label !== undefined && !(typeof value === "string" && value.trim().length === 0) && value !== false;
};

const lottieLabelMode = (node) => {
  const label = attributeNamed(node, "accessibilityLabel");

  if (!label) {
    return "absent";
  }

  const value = literalValue(label);

  if (typeof value === "string") {
    return value.trim().length > 0 ? "safe" : "empty";
  }

  if (!ts.isJsxExpression(label.initializer) || !label.initializer.expression || !ts.isTemplateExpression(label.initializer.expression)) {
    return "dynamic";
  }

  const template = label.initializer.expression;
  const literalText = `${template.head.text}${template.templateSpans.map((span) => span.literal.text).join("")}`;
  return literalText.trim().length > 0 ? "safe" : "dynamic";
};

const lottieDecorativeMode = (node) => {
  const decorative = attributeNamed(node, "decorative");

  if (!decorative) {
    return "absent";
  }

  return literalValue(decorative) === true ? "true" : "unsafe";
};

const hasTextName = (node) => {
  let found = false;

  const visit = (child) => {
    if (found) {
      return;
    }

    if (ts.isJsxElement(child) && tagName(child.openingElement) === "Text") {
      const content = child.children.map((textChild) => textChild.getText()).join("").replace(/[{}]/g, "").trim();
      found = content.length > 0;
    }

    ts.forEachChild(child, visit);
  };

  ts.forEachChild(node, visit);
  return found;
};

const hasModalSemantics = (node) => {
  let found = false;

  const visit = (child) => {
    if (found) {
      return;
    }

    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const opening = ts.isJsxElement(child) ? child.openingElement : child;

      if (hasAttribute(opening, "accessibilityViewIsModal") && hasValidLabel(opening)) {
        found = true;
      }
    }

    if (found) {
      return;
    }

    ts.forEachChild(child, visit);
  };

  ts.forEachChild(node, visit);
  return found;
};

const checkFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relativePath = path.relative(rootDir, filePath);

  const addFailure = (node, message) => failures.push(`${relativePath}:${lineNumberAt(sourceFile, node)} ${message}`);
  const checkOpening = (node, element) => {
    const name = tagName(node);

    if (name === "Pressable") {
      if (literalValue(attributeNamed(node, "accessible")) === false) {
        return;
      }

      if (!hasAttribute(node, "accessibilityRole")) {
        addFailure(node, "Pressable missing accessibilityRole.");
      }

      if (!hasValidLabel(node) && !hasTextName(element)) {
        addFailure(node, "Pressable missing an accessibilityLabel or readable Text child.");
      }

      const role = literalValue(attributeNamed(node, "accessibilityRole"));
      const state = attributeNamed(node, "accessibilityState")?.getText() ?? "";

      if (role === "checkbox" && !state.includes("checked")) {
        addFailure(node, "checkbox Pressable missing checked accessibilityState.");
      }
    }

    if (name === "TextInput" && !hasValidLabel(node)) {
      addFailure(node, "TextInput missing a non-empty accessibilityLabel.");
    }

    if (name === "Image" || name === "ImageBackground") {
      const hidden = hasAttribute(node, "accessibilityElementsHidden");

      if (!hasValidLabel(node) && !hidden) {
        addFailure(node, `${name} missing accessibilityLabel or accessibilityElementsHidden.`);
      }

      if (name === "Image" && !hasAttribute(node, "accessibilityIgnoresInvertColors")) {
        addFailure(node, "Image missing accessibilityIgnoresInvertColors.");
      }

      if (name === "Image" && hidden && !hasAttribute(node, "importantForAccessibility")) {
        addFailure(node, "hidden Image missing importantForAccessibility for Android.");
      }
    }

    if (name === "LottieAnimation") {
      const labelMode = lottieLabelMode(node);
      const decorativeMode = lottieDecorativeMode(node);
      const isValidLottieContract =
        (labelMode === "safe" && decorativeMode === "absent") || (labelMode === "absent" && decorativeMode === "true");

      if (!isValidLottieContract) {
        if (labelMode === "empty" || labelMode === "dynamic") {
          addFailure(node, "LottieAnimation accessibilityLabel must be statically non-empty; use decorative for visual-only animation.");
        } else {
          addFailure(node, "LottieAnimation must choose exactly one safe semantic mode: decorative or a non-empty accessibilityLabel.");
        }
      }
    }

    if (name === "View" && literalValue(attributeNamed(node, "accessibilityRole")) === "progressbar" && !hasAttribute(node, "accessibilityValue")) {
      addFailure(node, "progressbar View missing accessibilityValue.");
    }

    if (name === "Modal" && !hasModalSemantics(element)) {
      addFailure(node, "Modal missing labeled modal accessibility semantics.");
    }
  };

  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      checkOpening(node.openingElement, node);
    } else if (ts.isJsxSelfClosingElement(node)) {
      checkOpening(node, node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const requestedPaths = process.argv.slice(2);

for (const filePath of resolveTargets()) {
  checkFile(filePath);
}

if (requestedPaths.length === 0) {
  const sharedHeaderPath = path.join(rootDir, "apps/mobile/src/shared/ui/ScreenHeaderRow.tsx");
  const sharedHeaderHasAccessibleTitle =
    fs.existsSync(sharedHeaderPath) &&
    fs.readFileSync(sharedHeaderPath, "utf8").includes('accessibilityRole="header"');

  for (const relativePath of screenHeaderContracts) {
    const filePath = path.join(rootDir, relativePath);
    const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    const usesAccessibleSharedHeader = source.includes("<ScreenHeaderRow") && sharedHeaderHasAccessibleTitle;

    if (!source.includes('accessibilityRole="header"') && !usesAccessibleSharedHeader) {
      failures.push(`${relativePath} must expose a primary screen title with accessibilityRole="header".`);
    }
  }
}

if (failures.length > 0) {
  console.error("Mobile accessibility validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mobile accessibility validation passed.");
