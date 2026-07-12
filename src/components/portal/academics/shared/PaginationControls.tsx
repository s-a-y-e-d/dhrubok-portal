"use client";

interface PaginationControlsProps {
  pageIndex: number;
  isDone: boolean;
  continueCursor: string | null;
  onNext: (cursor: string) => void;
  onPrev: () => void;
  locale: "bn" | "en";
}

export function PaginationControls({ pageIndex, isDone, continueCursor, onNext, onPrev, locale }: PaginationControlsProps) {
  const bn = locale === "bn";
  if (pageIndex === 0 && !continueCursor) return null;

  return (
    <div className="form-actions" style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "16px" }}>
      <button
        className="button button-secondary"
        type="button"
        disabled={pageIndex === 0}
        onClick={onPrev}
      >
        {bn ? "পূর্ববর্তী" : "← Previous"}
      </button>
      <span style={{ fontSize: "13px", color: "var(--ink-mute)", minWidth: "60px", textAlign: "center" }}>
        {bn ? `পৃষ্ঠা ${pageIndex + 1}` : `Page ${pageIndex + 1}`}
      </span>
      <button
        className="button button-secondary"
        type="button"
        disabled={isDone || !continueCursor}
        onClick={() => continueCursor && onNext(continueCursor)}
      >
        {bn ? "পরবর্তী" : "Next →"}
      </button>
    </div>
  );
}
