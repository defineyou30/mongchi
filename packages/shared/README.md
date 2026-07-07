# Shared Package

Shared TypeScript contracts for Mongchi.

This package owns:

- Domain models for pets, generation jobs, generated assets, care state, reactions, inventory, walks, conversations, and entitlements.
- Mock prototype data.
- Provider-neutral mobile API request/response contracts.
- Local authored reaction selection.
- Local care transition helpers for prototype screens.

The contracts are intentionally provider-neutral. Real AI calls, payment verification, and production persistence belong in backend services and workers, not this package.
