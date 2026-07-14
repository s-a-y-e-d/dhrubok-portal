// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React, { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogModal } from "./DialogModal";

describe("DialogModal Component", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
      const focusEvent = new Event("focus");
      this.dispatchEvent(focusEvent);
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("renders correctly when open", () => {
    const onClose = vi.fn();
    render(
      <DialogModal isOpen={true} onClose={onClose} title="Test Title">
        <div>Test Content</div>
      </DialogModal>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <DialogModal isOpen={true} onClose={onClose} title="Test Title">
        <div>Test Content</div>
      </DialogModal>
    );

    const closeButton = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("generates unique title and description IDs to prevent collisions", () => {
    const { container: container1 } = render(
      <DialogModal isOpen={true} onClose={vi.fn()} title="Dialog 1" description="Desc 1">
        <div>Content 1</div>
      </DialogModal>
    );
    const dialog1 = container1.querySelector("dialog");
    const labelId1 = dialog1?.getAttribute("aria-labelledby");
    const descId1 = dialog1?.getAttribute("aria-describedby");

    const { container: container2 } = render(
      <DialogModal isOpen={true} onClose={vi.fn()} title="Dialog 2" description="Desc 2">
        <div>Content 2</div>
      </DialogModal>
    );
    const dialog2 = container2.querySelectorAll("dialog")[1];
    const labelId2 = dialog2?.getAttribute("aria-labelledby");
    const descId2 = dialog2?.getAttribute("aria-describedby");

    expect(labelId1).not.toBe(labelId2);
    expect(descId1).not.toBe(descId2);
  });

  it("focuses initialFocusRef when provided", () => {
    const TestComponent = () => {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <DialogModal isOpen={true} onClose={vi.fn()} title="Dialog Title" initialFocusRef={inputRef}>
          <div>
            <button type="button">Close</button>
            <input data-testid="target-input" ref={inputRef} />
          </div>
        </DialogModal>
      );
    };

    render(<TestComponent />);
    const input = screen.getByTestId("target-input");
    expect(document.activeElement).toBe(input);
  });
});
