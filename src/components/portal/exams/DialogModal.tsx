"use client";

import React, { useEffect, useRef } from "react";

let activeDialogCount = 0;

function lockScroll() {
  activeDialogCount++;
  if (activeDialogCount === 1) {
    document.body.classList.add("modal-open");
  }
}

function unlockScroll() {
  activeDialogCount = Math.max(0, activeDialogCount - 1);
  if (activeDialogCount === 0) {
    document.body.classList.remove("modal-open");
  }
}

interface DialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "standard" | "form" | "complex";
  children: React.ReactNode;
}

export function DialogModal({
  isOpen,
  onClose,
  title,
  size = "standard",
  children,
}: DialogModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isLockedRef = useRef(false);

  // Sync native showModal/close and manage scroll locking
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        if (!isLockedRef.current) {
          lockScroll();
          isLockedRef.current = true;
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      if (isLockedRef.current) {
        unlockScroll();
        isLockedRef.current = false;
      }
    }
  }, [isOpen]);

  // Clean up scroll lock on unmount
  useEffect(() => {
    return () => {
      if (isLockedRef.current) {
        unlockScroll();
        isLockedRef.current = false;
      }
    };
  }, []);

  // Listen to native cancel event (Escape key) and backdrop clicks
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;

      if (!isInDialog) {
        onClose();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleBackdropClick);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleBackdropClick);
    };
  }, [onClose]);

  const sizeClass =
    size === "complex"
      ? "dialog-complex"
      : size === "form"
        ? "dialog-form"
        : "dialog-standard";

  return (
    <dialog
      ref={dialogRef}
      className={`accessible-dialog ${sizeClass}`}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-content">
        <header className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
