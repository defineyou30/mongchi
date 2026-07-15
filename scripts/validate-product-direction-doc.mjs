import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const productDirectionPath = path.join(rootDir, "docs/product-direction.md");
const manifestPath = path.join(rootDir, "docs/store-screenshot-manifest.json");

const content = fs.readFileSync(productDirectionPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const failures = [];

const requireText = (text, message) => {
  if (!content.includes(text)) {
    failures.push(message);
  }
};

requireText("iOS/Android", "Product direction must describe the native iOS/Android target.");
requireText(
  manifest.sourceFlow,
  "Product direction must match the store screenshot source flow."
);
requireText(
  "Reference/mockup screen crops are not used as UI.",
  "Product direction must preserve the decomposed reference-art rule."
);
requireText(
  "provider keys, service credentials, payment verification secrets, receipt data, and storage credentials out of the mobile app",
  "Product direction must keep production secrets out of mobile."
);
requireText(
  "Production still requires deployment verification for local chat billing/idempotency/global throttling/reporting migrations `0014`-`0015`, expert-reviewed crisis copy, store verification and products, public legal/support release values, remote monitoring, and final release QA.",
  "Product direction must state remaining production external dependencies."
);
requireText(
  "Android store screenshot coverage/contact sheet and Android export have current local evidence",
  "Product direction must keep Android evidence current without moving Android into the intermediate iOS loop."
);
requireText(
  "Care, relationship, and monetization stay separate: heart/mood is derived satisfaction, bond is long-term relationship XP, credits/tickets are spendable value, and short local reactions remain free/authored.",
  "Product direction must preserve the care economy separation."
);
requireText(
  "Photo-generated pet avatars must preserve the user's actual pet identity before generic cuteness; all required states should have distinct pose/expression/silhouette while staying one consistent dog or cat identity.",
  "Product direction must preserve the source-photo avatar identity rule."
);

const stalePatterns = [
  /current scaffold supports the guide's prototype stage/i,
  /Mock photo and mock generation state instead of real upload\/generation/i,
  /Backend, worker, and commerce boundaries documented but not connected/i,
  /reference\/mockup screen crops are used as UI/i
];

for (const pattern of stalePatterns) {
  if (pattern.test(content)) {
    failures.push(`Product direction contains stale wording: ${pattern}`);
  }
}

if (failures.length > 0) {
  console.error("Product direction validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Product direction validation passed.");
