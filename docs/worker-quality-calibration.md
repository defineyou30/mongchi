# Worker Quality Calibration

Production generation quality thresholds must be backed by a calibration record before release.

Required production env:

- `TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE`
- `TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE`
- `TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE`
- `TINY_PET_WORKER_QUALITY_CALIBRATION_ID`

`TINY_PET_WORKER_QUALITY_CALIBRATION_ID` must identify the approved calibration run used to choose the three threshold values. Keep the record in the deployment/release evidence system with:

- Provider and model ids for image generation, source-photo safety, and generation quality evaluation.
- Sample count, species mix, and accepted/rejected/manual-review counts.
- Candidate threshold values and the selected threshold values.
- False accept and false reject review notes.
- Reviewer, approval timestamp, and release profile.

The code validates that the id is present and safe for production. It does not invent threshold values without provider sample evidence.
