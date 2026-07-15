import * as FileSystem from "expo-file-system/legacy";

import { reporter } from "../../shared/errors/reporter";

/**
 * Best-effort, idempotent delete of the on-device file backing a
 * `file://` original-photo URI. Called from TerrariumSessionProvider's
 * deleteOriginalPhoto right before it clears `state.photo.selectedPhotoUri`
 * -- previously that clear only forgot the file's path, it never removed
 * the bytes themselves, so tapping "Delete local photo copy" left the
 * original photo sitting on disk indefinitely.
 *
 * Deliberately never throws and never blocks the caller: a `sample://` mock
 * photo, a `null` uri (nothing selected), a file the OS already reclaimed,
 * or any other FileSystem error must not stop the local state clear from
 * completing -- SettingsScreen's deletePhotoMessage copy promises this
 * action always succeeds from the player's point of view.
 */
export const deleteOriginalPhotoFile = async (
  uri: string | null,
  deleteAsync: typeof FileSystem.deleteAsync = FileSystem.deleteAsync
): Promise<void> => {
  if (!uri || !uri.startsWith("file://")) {
    return;
  }

  try {
    await deleteAsync(uri, { idempotent: true });
  } catch (cause) {
    reporter.captureMessage("photo: original photo file delete failed", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
};
