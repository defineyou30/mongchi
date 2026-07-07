import { generatedAssetStates, type GeneratedAssetState, type GenerationJob, type GenerationJobStatus } from "@mongchi/shared";

export interface MockPipelineStep {
  status: GenerationJobStatus;
  label: string;
  workerOnly: boolean;
}

export interface MockGenerationPlan {
  jobId: string;
  petId: string;
  provider: "mock";
  requiredAssetStates: GeneratedAssetState[];
  steps: MockPipelineStep[];
  forbiddenInMobile: string[];
}

export const productionGeneratedAssetStates: GeneratedAssetState[] = [...generatedAssetStates];
export const firstPassAssetStates: GeneratedAssetState[] = productionGeneratedAssetStates;

export const mockPipelineSteps: MockPipelineStep[] = [
  { status: "validating", label: "Validate source photo metadata and decode.", workerOnly: true },
  { status: "preprocessing", label: "Strip metadata, normalize size, and prepare provider input.", workerOnly: true },
  { status: "safety_checking", label: "Run upload safety precheck.", workerOnly: true },
  { status: "generating", label: "Generate Mongchi avatar assets.", workerOnly: true },
  { status: "postprocessing", label: "Crop, pad, compress, thumbnail, and hash outputs.", workerOnly: true },
  { status: "quality_checking", label: "Reject wrong species, missing face, extra animals, unsafe content, or style mismatch.", workerOnly: true },
  { status: "uploading_assets", label: "Upload app-private generated assets.", workerOnly: true },
  { status: "completed", label: "Mark job complete for pet reveal.", workerOnly: false }
];

export const createMockGenerationPlan = (job: GenerationJob): MockGenerationPlan => ({
  jobId: job.id,
  petId: job.petId,
  provider: "mock",
  requiredAssetStates: firstPassAssetStates,
  steps: mockPipelineSteps,
  forbiddenInMobile: [
    "AI provider keys",
    "service role credentials",
    "raw source photo analytics",
    "provider request payloads",
    "production storage secrets"
  ]
});
