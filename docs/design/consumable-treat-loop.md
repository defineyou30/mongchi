# Consumable Treat Loop

## Product Role

Treats are the first lightweight consumable BM loop after premium chat.

The pet should always have free care actions, but purchased treats can create stronger reward moments, special reactions, and collection goals.

## Current Behavior Contract

- `treat` can still be used as a basic care action without an item.
- If `treat` is called with an owned `itemId`, one inventory quantity is consumed.
- If the consumed item was placed in the garden and quantity reaches zero, it is removed from placed items.
- The pet reaction remains authored through the normal reaction engine, currently `treat_common`.
- Credit purchase and item consumption are separate:
  - shop purchase spends credits and grants inventory
  - treat action consumes inventory and improves pet state

## UX Rule

Placed treat objects can be tapped directly in Home.

This keeps the Home screen feeling like a playable scene instead of adding another menu. It also makes the user understand that bought snacks are real objects in the pet's world.

## Future Extensions

- premium treats can trigger rarer animations
- seasonal treats can unlock limited reaction lines
- bundles can grant several quantities at once
- empty treat slots can show a soft shop prompt, not a blocking error

