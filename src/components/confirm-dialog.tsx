"use client";

import { AlertCircle } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

export type ConfirmDialogTone = "neutral" | "danger";

/**
 * Modal confirmation dialog in the app's own vocabulary — replaces the raw
 * browser `confirm()` on destructive paths (Remove / Delete forever / bulk
 * purge). Delegates the surface + focus trap to <Modal>, so both dialogs on
 * the Files page share one shell.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "neutral",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      // Destructive confirmations are announced with alertdialog so screen
      // readers treat them as a synchronous interruption.
      role="alertdialog"
      tone={tone === "danger" ? "danger" : "neutral"}
      size="md"
      icon={<AlertCircle size={22} />}
      title={title}
      dismissOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive-solid" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
