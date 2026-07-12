"use client";

import type { ReactNode, FormEvent } from "react";

interface AcademicFormProps {
  title: string;
  children: ReactNode;
  onSubmit: (data: FormData, form: HTMLFormElement) => void;
}

export function AcademicForm({ title, children, onSubmit }: AcademicFormProps) {
  return (
    <form
      className="operation-form compact-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget), event.currentTarget);
      }}
    >
      <fieldset style={{ minWidth: 0, margin: 0, padding: "24px" }}>
        <legend style={{ paddingInline: "8px", fontWeight: 600, fontSize: "15px" }}>{title}</legend>
        {children}
      </fieldset>
    </form>
  );
}
