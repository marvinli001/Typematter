"use client";

import { useState } from "react";

type CopyPageButtonProps = {
  markdown: string;
  label?: string;
  copiedLabel?: string;
};

export default function CopyPageButton({
  markdown,
  label = "Copy page",
  copiedLabel = "Copied",
}: CopyPageButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = markdown;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        // ignore copy errors
      }
    }
  };

  return (
    <button
      className={`copy-page${copied ? " copied" : ""}`}
      type="button"
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
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
      <span className="copy-page-label">{copied ? copiedLabel : label}</span>
    </button>
  );
}
