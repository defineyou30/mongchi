# Placement Items Archive

Placement-driven decor, plant, light, terrain, reward, and garden object items are hidden from the current Garden Shop and inventory-facing shop shelves.

Reason:
- The app direction moved away from user-managed object placement on the home screen.
- Current retention loops focus on pet care, special consumables, themes, chat, walks, and weather/time episodes.
- Reintroducing placement items before a stable slot/grid editor would create visual mismatch and unclear ownership semantics.

Current handling:
- Shop categories are limited to Treats, Themes, and Inventory.
- Plant/decor/placement categories are filtered from the shop surface.
- Existing inventory data is preserved; hidden items are not deleted.
- Theme backgrounds remain usable because they apply globally through `selectedTerrariumThemeId`.

Reopen criteria:
- A fixed placement contract exists for home slots.
- Objects have matching style, scale, shadows, and collision rules.
- Inventory and shop clearly distinguish consumable care items, themes, and placeable decor.
