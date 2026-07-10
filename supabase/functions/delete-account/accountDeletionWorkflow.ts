import type { RecursiveDeleteOutcome } from "./deletionPlan.ts";

export type AuthDeleteOutcome = { readonly ok: true } | { readonly ok: false };

export type AccountDeletionOperations = {
  readonly deleteOriginalPhotos: () => Promise<RecursiveDeleteOutcome>;
  readonly deleteAvatars: () => Promise<RecursiveDeleteOutcome>;
  readonly deleteAuthUser: () => Promise<AuthDeleteOutcome>;
};

export type AccountDeletionWorkflowResult =
  | {
      readonly ok: true;
      readonly storage: {
        readonly originalPhotos: RecursiveDeleteOutcome;
        readonly avatars: RecursiveDeleteOutcome;
      };
    }
  | {
      readonly ok: false;
      readonly code: "storage_delete_failed" | "auth_delete_failed";
      readonly retryable: true;
    };

const runStorageOperation = async (
  operation: () => Promise<RecursiveDeleteOutcome>
): Promise<RecursiveDeleteOutcome> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) return { deletedCount: 0, errors: ["storage operation failed"] };
    throw error;
  }
};

export const runAccountDeletionWorkflow = async (
  operations: AccountDeletionOperations
): Promise<AccountDeletionWorkflowResult> => {
  const originalPhotos = await runStorageOperation(operations.deleteOriginalPhotos);
  const avatars = await runStorageOperation(operations.deleteAvatars);

  if (originalPhotos.errors.length > 0 || avatars.errors.length > 0) {
    return { ok: false, code: "storage_delete_failed", retryable: true };
  }

  let auth: AuthDeleteOutcome;

  try {
    auth = await operations.deleteAuthUser();
  } catch (error) {
    if (error instanceof Error) return { ok: false, code: "auth_delete_failed", retryable: true };
    throw error;
  }

  if (!auth.ok) {
    return { ok: false, code: "auth_delete_failed", retryable: true };
  }

  return { ok: true, storage: { originalPhotos, avatars } };
};
