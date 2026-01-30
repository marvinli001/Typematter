import type { ReactNode } from "react";

export type BadgeVariant =
  | "note"
  | "tip"
  | "danger"
  | "success"
  | "caution"
  | "default";

export type BadgeSize = "small" | "medium" | "large";

export type BadgeProps = {
  text?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: ReactNode;
};

export function Badge({
  text,
  variant = "default",
  size = "medium",
  children,
}: BadgeProps) {
  const content = text ?? children;
  if (!content) {
    return null;
  }

  return (
    <span className={`badge ${variant} size-${size}`}>{content}</span>
  );
}
