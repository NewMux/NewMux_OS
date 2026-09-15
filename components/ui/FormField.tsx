"use client";

import { useId } from "react";
import { Label } from "./Label";
import { cn } from "@/lib/utils";

/**
 * Wires a label, control and error message together: generates the id, points
 * htmlFor at it, and exposes `aria-invalid`/`aria-describedby` through a render
 * prop so screen readers announce the error with the field.
 */
export function FormField({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
