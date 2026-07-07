export interface PrivateStorageObjectDeletionInput {
  uris: readonly string[];
}

export type PrivateStorageObjectDeletionResult =
  | {
      ok: true;
      deletedUriCount: number;
    }
  | {
      ok: false;
      failureCode: string;
      failureMessageSafe: string;
    };

export interface PrivateStorageObjectDeleter {
  deleteObjects: (input: PrivateStorageObjectDeletionInput) => Promise<PrivateStorageObjectDeletionResult>;
}

export const uniqueStorageUris = (uris: readonly (string | null | undefined)[]): string[] =>
  Array.from(new Set(uris.map((uri) => uri?.trim()).filter((uri): uri is string => !!uri)));
