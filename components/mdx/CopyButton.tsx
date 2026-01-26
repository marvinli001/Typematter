"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
};

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore clipboard errors for now.
    }
  };

  return (
    <button
      className={`icon-button copy-button${copied ? " copied" : ""}`}
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <path d="M5 12l4 4L19 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <rect x="5" y="5" width="10" height="10" rx="2" />
        </svg>
      )}
    </button>
  );
}
