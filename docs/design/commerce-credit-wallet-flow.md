# Commerce Credit Wallet Flow

## Product Role

Credits are the paid currency bridge for premium chat, special treats, and future shop objects.

Store purchases must not only create an entitlement audit record. Consumable credit products also need to update the user's wallet so the value is immediately usable in the app.

## Current Contract

- `premium_chat_monthly` grants a subscription entitlement.
- `extra_pet_slot_1` and `theme_pack_starter` grant durable entitlements.
- `regeneration_credit_1` is a legacy prototype SKU and is hidden from the mobile shop. It does not authorize a photo remake.
- A future photo-remake product will cost 12 wallet credits and must atomically create the remake job, preserve the accepted pet until success, and refund failures.
- Purchase verification returns the granted entitlements and, when a wallet value changed or is relevant to a consumable restore, the latest `wallet`.
- Mobile syncs the returned wallet into the active session after verify or restore.

## Idempotency Rule

Wallet value is granted only when the purchase ledger gets a new transaction.

The same `transactionId` can be verified again or restored without granting credits twice. This keeps retry, restore, and store callback flows safe.

## Future Extensions

Add new paid currency products through a server-owned wallet grant map, not from mobile UI assumptions.

Examples:

- `credit_pack_small`: paid credits
- `chat_ticket_pack`: free chat tickets
- `starter_treat_bundle`: credits plus inventory through a dedicated bundle grant path

The mobile shop should treat server verification as authoritative and only display optimistic state after the API returns the updated wallet or entitlement list.
