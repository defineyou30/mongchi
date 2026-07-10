# MongChi Utility Icon Pack v1

This pack contains 48 transparent 192 × 192 PNG masters at [utility-icons/v1](/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/assets/generated/ui/utility-icons/v1). It is an asset-only delivery: no screen, registry, consumer, Shop, Moment, or Expression behavior was changed.

The pack follows the established MongChi visual language: cocoa outline, upper-left pixel gloss, warm cream/coral/leaf/sky palette, and a 26px measured safety inset. The new art was produced from nine newly generated source sheets and chroma-key alpha-matted locally; source sheet 9 specifically replaced five semantics that independent review found unclear at 18px. The earlier concept board was consulted only as direction and was not cropped or reused as production pixels. Hashes, source-sheet provenance, all 48 filenames, and the 43 audited Lucide migration mappings are in [manifest.json](/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/assets/generated/ui/utility-icons/v1/manifest.json).

Validation:

```sh
node scripts/validate-mongchi-utility-icons.mjs
```

The validator checks the exact 48-key set, 192 × 192 dimensions, alpha/transparent corners, 12% safe inset, per-master integrity hash, duplicate bytes, cocoa-outline/highlight heuristics, all source-sheet provenance hashes, and all 43 current Lucide glyph mappings. It deliberately does not claim that an automated pixel check can substitute for semantic visual review; those raw review artifacts remain local QA evidence and are not committed.
