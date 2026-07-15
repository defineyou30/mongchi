# AI Worker Boundary

> **Status: legacy.** This is the 2026-07-03-era prototype backend. Production
> generation traffic is served by `supabase/functions` (`generate-avatar`),
> not this worker. Removal is planned as a separate post-launch PR (bundled
> with a pipeline rework) — `typecheck:worker` still depends on this tree
> today, so it stays in place until that rework lands.

AI generation worker boundary for Mongchi.

Implemented locally:

- Mock generation pipeline descriptors.
- Source photo container detection for JPEG, PNG, and WebP.
- Header dimension parsing and limits for JPEG SOF, PNG IHDR, and WebP VP8/VP8L/VP8X.
- Container integrity checks for JPEG terminal EOI and scan payload structure, PNG chunk CRC/IDAT/IEND structure, and WebP RIFF size/chunk bounds before provider-safe bytes are accepted.
- PNG IDAT raster validation that inflates combined image data and rejects invalid scanline lengths or filter bytes before provider input.
- JPEG/WebP encoded raster payload validation that rejects header-only containers before provider input.
- Sharp-backed full pixel decode validation for JPEG, PNG, and WebP source photos before provider input.
- Declared content-type versus magic-byte mismatch rejection.
- Empty, oversized, unsupported, corrupt/unreadable upload rejection.
- JPEG APP1 EXIF metadata stripping before provider-safe bytes are prepared.
- Tested source-photo safety precheck contract with a local provider-safe-byte sanity checker, provider classifier injection boundary, unsafe-source failure handling, classifier-unavailable failure handling, and manual-review metadata preservation before provider generation starts.
- Tested OpenAI source-photo safety classifier for Responses vision input, structured JSON output parsing, manual-review refusal handling, and runtime `safetyModel` selection.
- Structured generation quality gate for required asset states, species match, one-pet visibility signals, safety approval, style match, provider confidence, configurable runtime thresholds, and manual review routing.
- Tested OpenAI generation quality signal evaluator for generated assets, source-photo comparison, structured JSON output parsing, refusal-to-manual-review mapping, and trusted worker asset metadata passthrough.
- Tested generation worker runtime that claims one queued Postgres-backed job through the generation repository contract, validates source-photo bytes, calls an injected provider adapter, applies the quality gate, writes generated assets through an injected storage writer, and persists completed/failed job state.
- Tested generation worker batch runner that processes up to `maxJobs` per scheduled run, stops on idle queue drain, and can stop early after a failed job.
- Tested generation worker process runner that can run a single batch or poll on an interval, stop on idle, continue across idle runs for long-running deployments, stop after a failed batch, and return safe process-level failure metadata.
- Tested worker runtime composition helpers that build S3 worker storage from validated runtime config, wire the batch runner to injected repositories, pass validated quality thresholds into the quality gate, and can compose the OpenAI image edit, source-photo safety, and generation quality adapters from worker runtime config.
- Production worker runtime config fails closed unless explicit `TINY_PET_WORKER_MAX_JOBS_PER_RUN`, `TINY_PET_WORKER_PROVIDER_MODEL`, `TINY_PET_WORKER_PROVIDER_SAFETY_MODEL`, calibrated `TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE`, `TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE`, `TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE`, and `TINY_PET_WORKER_QUALITY_CALIBRATION_ID` values are provided.
- Tested generated-asset metadata normalization before persistence for provider/storage asset id, state, dimensions, MIME type, version, hash format, and internal `s3://` storage URI.
- Tested S3-compatible worker storage adapter that reads original-photo bytes from internal `s3://` URIs, writes generated asset bytes with signed `PUT Object`, and returns internal `s3://` asset URIs plus `sha256:` content hashes.
- Tested OpenAI image edit provider adapter for `/images/edits` that sends prepared source photos as multipart worker-only payloads, keeps the API key server-side, decodes base64 image responses, records dimensions and `sha256:` hashes, and delegates species/visibility/style quality signals to an injected evaluator.

Future ownership:

- Production calibration for species, one-pet visibility, style, and confidence threshold values, plus an approved calibration record id for `TINY_PET_WORKER_QUALITY_CALIBRATION_ID`.
- Full preprocessing beyond JPEG APP1 EXIF stripping.
- Configure production OpenAI provider credentials, image model, and safety/quality model settings, then choose calibrated worker quality threshold values and record the calibration id.
- Keep base, idle, happy, sleep, and play as the production first-pass provider outputs; expand provider-generated reaction/seasonal outputs after threshold calibration.
- Postprocess, crop, pad, compress, thumbnail, and hash assets.
- Deploy the worker process runner with production scheduler infrastructure, bucket-scoped S3 worker storage credentials/policies, retry monitoring, and provider credentials.

This worker has tested OpenAI image edit, source-photo safety, generation quality, runtime-configurable quality thresholds, calibration-id validation, runtime adapter composition, and a scheduler-friendly process runner, but local scaffold code does not mount real provider credentials, approved calibrated threshold values, or production scheduler infrastructure yet.
