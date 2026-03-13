import type { CSSProperties } from "react";

type PreviewFrameType = "iframe" | "image" | "video";

type PreviewFrameProps = {
  src: string;
  title: string;
  caption?: string;
  type?: PreviewFrameType;
  ratio?: string;
  height?: number | string;
  allow?: string;
  poster?: string;
};

function detectType(src: string, type?: PreviewFrameType) {
  if (type) {
    return type;
  }
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(src)) {
    return "image";
  }
  if (/\.(mp4|webm|ogg)$/i.test(src)) {
    return "video";
  }
  return "iframe";
}

function resolveRatioPadding(ratio?: string) {
  if (!ratio) {
    return "56.25%";
  }
  const match = ratio.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return "56.25%";
  }
  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) {
    return "56.25%";
  }
  return `${(height / width) * 100}%`;
}

export function PreviewFrame({
  src,
  title,
  caption,
  type,
  ratio = "16:9",
  height,
  allow,
  poster,
}: PreviewFrameProps) {
  const resolvedType = detectType(src, type);
  const style = {
    "--preview-ratio": resolveRatioPadding(ratio),
    "--preview-height":
      height !== undefined ? (typeof height === "number" ? `${height}px` : height) : "auto",
  } as CSSProperties;

  return (
    <figure className="preview-frame" style={style}>
      <div className="preview-frame-head">
        <div className="preview-frame-title">{title}</div>
        <a
          className="preview-frame-link"
          href={src}
          target="_blank"
          rel="noreferrer"
        >
          Open source
        </a>
      </div>
      <div className={`preview-frame-media ${resolvedType}`}>
        {resolvedType === "iframe" ? (
          <iframe
            src={src}
            title={title}
            loading="lazy"
            allow={allow}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
        {resolvedType === "image" ? <img src={src} alt={title} loading="lazy" /> : null}
        {resolvedType === "video" ? (
          <video controls playsInline preload="metadata" poster={poster}>
            <source src={src} />
          </video>
        ) : null}
      </div>
      {caption ? <figcaption className="preview-frame-caption">{caption}</figcaption> : null}
    </figure>
  );
}
