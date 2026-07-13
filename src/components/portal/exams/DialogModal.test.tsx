// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogModal } from "./DialogModal";

describe("DialogModal Component", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("renders correctly when open", () => {
    const onClose = vi.fn();
    render(
      <DialogModal isOpen={true} onClose={onClose} title="Test Title" size="standard">
        <div>Test Content</div>
      </DialogModal>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <DialogModal isOpen={true} onClose={onClose} title="Test Title" size="standard">
        <div>Test Content</div>
      </DialogModal>
    );

    const closeButton = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies the correct sizing class based on props", () => {
    const { rerender } = render(
      <DialogModal isOpen={true} onClose={vi.fn()} title="Test Title" size="standard">
        <div>Test Content</div>
      </DialogModal>
    );
    expect(screen.getByRole("dialog")).toHaveClass("dialog-standard");

    rerender(
      <DialogModal isOpen={true} onClose={vi.fn()} title="Test Title" size="form">
        <div>Test Content</div>
      </DialogModal>
    );
    expect(screen.getByRole("dialog")).toHaveClass("dialog-form");

    rerender(
      <DialogModal isOpen={true} onClose={vi.fn()} title="Test Title" size="complex">
        <div>Test Content</div>
      </DialogModal>
    );
    expect(screen.getByRole("dialog")).toHaveClass("dialog-complex");
  });
});
