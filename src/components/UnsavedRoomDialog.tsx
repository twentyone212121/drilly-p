import { useLayoutEffect, useRef } from "react";

export function UnsavedRoomDialog({
  canTest,
  onSave,
  onDiscard,
  onCancel,
}: {
  canTest: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLElement>("h2")
      ?.focus({ preventScroll: true });
  }, []);
  return (
    <dialog
      ref={dialog}
      className="game-overlay"
      aria-labelledby="unsaved-room-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <button
        className="result-close"
        aria-label="Close and keep editing"
        onClick={onCancel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <h2 id="unsaved-room-title" tabIndex={-1}>
        Save your changes?
      </h2>
      <p>
        {canTest
          ? "Pass a test to save this room, or discard your edits."
          : "Add a treasure before testing and saving your room."}
      </p>
      <button
        className="game-button primary"
        disabled={!canTest}
        onClick={onSave}
      >
        Test and save
      </button>
      <button className="game-button" onClick={onDiscard}>
        Discard changes
      </button>
    </dialog>
  );
}
