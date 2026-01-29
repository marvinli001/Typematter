import type { ReactNode } from "react";

type StepsProps = {
  children: ReactNode;
};

type StepProps = {
  title?: string;
  children: ReactNode;
};

export function Steps({ children }: StepsProps) {
  return <ol className="steps">{children}</ol>;
}

export function Step({ title, children }: StepProps) {
  return (
    <li className="step">
      {title ? <div className="step-title">{title}</div> : null}
      {children}
    </li>
  );
}
