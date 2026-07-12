"use client";

import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  title: string;
  detail: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  locale: "bn" | "en";
}

export function ConfirmModal({ title, detail, danger, onCancel, onConfirm, locale }: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const bn = locale === "bn";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      if (!dialog.open) {
        dialog.showModal();
      }
      cancelBtnRef.current?.focus();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="operation-form compact-form"
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-detail"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "8px",
        padding: "24px",
        background: "var(--canvas)",
        color: "var(--ink)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        maxWidth: "480px",
        width: "calc(100% - 32px)",
        margin: "auto",
      }}
    >
      <h2 id="confirm-title" style={{ marginTop: 0, fontSize: "18px", fontWeight: 600 }}>{title}</h2>
      <p id="confirm-detail" style={{ margin: "12px 0 24px", color: "var(--ink-secondary)", fontSize: "14px", lineHeight: "1.5" }}>{detail}</p>
      <div className="form-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          ref={cancelBtnRef}
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          {bn ? "বাতিল" : "Cancel"}
        </button>
        <button
          className={`button ${danger ? "button-danger" : "button-primary"}`}
          type="button"
          onClick={onConfirm}
        >
          {bn ? "নিশ্চিত করুন" : "Confirm"}
        </button>
      </div>
    </dialog>
  );
}
