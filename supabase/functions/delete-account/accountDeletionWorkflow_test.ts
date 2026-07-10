import { assertEquals } from "jsr:@std/assert@1";

import { runAccountDeletionWorkflow } from "./accountDeletionWorkflow.ts";
import type { AccountDeletionOperations, AuthDeleteOutcome } from "./accountDeletionWorkflow.ts";
import type { RecursiveDeleteOutcome } from "./deletionPlan.ts";

const success = (deletedCount = 0): RecursiveDeleteOutcome => ({ deletedCount, errors: [] });
const failure = (): RecursiveDeleteOutcome => ({ deletedCount: 0, errors: ["storage failed"] });

type WorkflowFixture = {
  readonly originalPhotos: readonly RecursiveDeleteOutcome[];
  readonly avatars: readonly RecursiveDeleteOutcome[];
  readonly auth: readonly AuthDeleteOutcome[];
};

const createOperations = (fixture: WorkflowFixture): { readonly operations: AccountDeletionOperations; readonly calls: string[] } => {
  const calls: string[] = [];
  let originalPhotosRun = 0;
  let avatarsRun = 0;
  let authRun = 0;

  const operations: AccountDeletionOperations = {
    deleteOriginalPhotos: () => {
      calls.push("original-photos");
      const outcome = fixture.originalPhotos[originalPhotosRun] ?? success();
      originalPhotosRun += 1;
      return Promise.resolve(outcome);
    },
    deleteAvatars: () => {
      calls.push("avatars");
      const outcome = fixture.avatars[avatarsRun] ?? success();
      avatarsRun += 1;
      return Promise.resolve(outcome);
    },
    deleteAuthUser: () => {
      calls.push("auth");
      const outcome = fixture.auth[authRun] ?? { ok: true };
      authRun += 1;
      return Promise.resolve(outcome);
    }
  };

  return { operations, calls };
};

Deno.test("account deletion keeps auth when original-photo deletion fails", async () => {
  // Given the first storage prefix fails while the second succeeds.
  const fixture = createOperations({ originalPhotos: [failure()], avatars: [success()], auth: [{ ok: true }] });

  // When deletion runs, Then both storage prefixes are attempted but auth is untouched.
  const result = await runAccountDeletionWorkflow(fixture.operations);
  assertEquals(result, { ok: false, code: "storage_delete_failed", retryable: true });
  assertEquals(fixture.calls, ["original-photos", "avatars"]);
});

Deno.test("account deletion keeps auth when avatar deletion fails", async () => {
  // Given only the second storage prefix fails.
  const fixture = createOperations({ originalPhotos: [success()], avatars: [failure()], auth: [{ ok: true }] });

  // When deletion runs, Then auth is untouched.
  const result = await runAccountDeletionWorkflow(fixture.operations);
  assertEquals(result, { ok: false, code: "storage_delete_failed", retryable: true });
  assertEquals(fixture.calls, ["original-photos", "avatars"]);
});

Deno.test("account deletion treats already-missing storage as a no-op and deletes auth last", async () => {
  // Given both storage prefixes are already empty.
  const fixture = createOperations({ originalPhotos: [success()], avatars: [success()], auth: [{ ok: true }] });

  // When deletion runs, Then the successful auth deletion is the final operation.
  const result = await runAccountDeletionWorkflow(fixture.operations);
  assertEquals(result, {
    ok: true,
    storage: { originalPhotos: success(), avatars: success() }
  });
  assertEquals(fixture.calls, ["original-photos", "avatars", "auth"]);
});

Deno.test("account deletion returns a retryable auth failure after storage succeeds", async () => {
  // Given both storage prefixes succeed but auth deletion fails.
  const fixture = createOperations({ originalPhotos: [success(1)], avatars: [success(2)], auth: [{ ok: false }] });

  // When deletion runs, Then the failure stays typed and retryable.
  const result = await runAccountDeletionWorkflow(fixture.operations);
  assertEquals(result, { ok: false, code: "auth_delete_failed", retryable: true });
  assertEquals(fixture.calls, ["original-photos", "avatars", "auth"]);
});

Deno.test("account deletion retry completes after an earlier storage failure", async () => {
  // Given the first request partially fails and the replay sees idempotent empty storage.
  const fixture = createOperations({
    originalPhotos: [failure(), success()],
    avatars: [success(), success()],
    auth: [{ ok: true }]
  });

  // When the same workflow is replayed, Then auth is deleted only by the successful replay.
  const first = await runAccountDeletionWorkflow(fixture.operations);
  const second = await runAccountDeletionWorkflow(fixture.operations);
  assertEquals(first, { ok: false, code: "storage_delete_failed", retryable: true });
  assertEquals(second.ok, true);
  assertEquals(fixture.calls, ["original-photos", "avatars", "original-photos", "avatars", "auth"]);
});

Deno.test("account deletion keeps auth and returns a typed failure when the storage client throws", async () => {
  // Given the original-photo storage client rejects while avatars remain reachable.
  const calls: string[] = [];
  const operations: AccountDeletionOperations = {
    deleteOriginalPhotos: () => {
      calls.push("original-photos");
      return Promise.reject(new Error("network failure"));
    },
    deleteAvatars: () => {
      calls.push("avatars");
      return Promise.resolve(success());
    },
    deleteAuthUser: () => {
      calls.push("auth");
      return Promise.resolve({ ok: true });
    }
  };

  // When deletion runs, Then the sibling prefix still runs and auth remains untouched.
  const result = await runAccountDeletionWorkflow(operations);
  assertEquals(result, { ok: false, code: "storage_delete_failed", retryable: true });
  assertEquals(calls, ["original-photos", "avatars"]);
});

Deno.test("account deletion returns a typed retryable failure when the auth client throws", async () => {
  // Given storage is clear and the auth provider rejects.
  const fixture = createOperations({ originalPhotos: [success()], avatars: [success()], auth: [] });
  const operations: AccountDeletionOperations = {
    ...fixture.operations,
    deleteAuthUser: () => Promise.reject(new Error("auth unavailable"))
  };

  // When deletion runs, Then the provider exception becomes a retryable auth failure.
  const result = await runAccountDeletionWorkflow(operations);
  assertEquals(result, { ok: false, code: "auth_delete_failed", retryable: true });
});
