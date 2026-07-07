# App Shell

The mobile app is scaffolded around the first-session and daily-loop screens from the guide.

## Routes

```text
/onboarding
/pet-setup
/photo-upload
/generation
/pet-reveal
/terrarium
/chat
/inventory
/shop
/settings
```

## Screen Intent

- `onboarding`: welcome popup and first CTA.
- `pet-setup`: name, species, personality, talking style, favorite thing.
- `photo-upload`: native photo picker, source-photo validation, sample fallback, and consent copy.
- `generation`: hatching progress states backed by mock job status.
- `pet-reveal`: generated pet acceptance, retry, and category-only support report entry.
- `terrarium`: main home, care actions, local authored reactions.
- `chat`: quick local reaction plus API-backed premium chat gate, Plus pass shop CTA, disclosure, and provider-backed conversation UI when entitlement is active.
- `inventory`: owned items, API-backed/local place/remove controls, and decoration path.
- `shop`: Plus pass destination, local item preview, or API-backed product catalog/entitlement state; purchases stay locked unless native checkout is configured.
- `settings`: privacy controls, destructive-action confirmations, legal links, and API-backed restore-purchases control.

## Next Screen Work

The shell cards have been replaced for the native MVP slice. A user can complete the mocked first-session flow end to end, enter the terrarium, trigger care reactions, send the pet on a walk, claim a walk reward, and confirm local privacy deletion actions.

Expo app icon, Android adaptive icon foreground, splash image assets, background/item PNGs, and bundled dog/cat generated-pet PNG assets for core, reaction, chat, walk, garden, and seasonal states are generated locally and covered by `npm run validate:mobile-assets`, `npm run validate:mobile-visual-assets`, and the generated-art contact sheet at `docs/qa-screenshots/mobile-generated-assets-contact-sheet.png`. Reveal, terrarium, and chat screens render the pet through an asset-id registry instead of View-only placeholder art, with terrarium reactions selecting the matching reaction/category state when available. Hatching progress now runs through a generation-job polling boundary and respects the OS reduce-motion setting by using a tested policy that switches active generation from scheduled polling to manual continue.

The first-session route/CTA sequence and terrarium hub paths are covered by `npm run validate:mobile-flow`, which checks Welcome, Photo upload, Pet setup, Hatching, Reveal, Terrarium, Chat, Inventory/Shop, Settings, Support report controls, and Walk reward contracts.

After a walk reward is claimed, the main home keeps a reward summary panel visible from the claimed walk reward item id, with the claimed item art, owned quantity, and direct Inventory/Shop CTAs. Inventory rows can now place or remove owned items from the local tiny home layout. The premium chat gate also routes locked longer chat users directly to the shop for the Plus pass.

Next screen work should focus on approved final generated pet art, later reaction/seasonal state assets, and visual/accessibility QA on iOS/Android devices.
