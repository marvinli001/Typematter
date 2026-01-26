export default function Loading() {
  return (
    <div className="loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-card">
        <div className="loading-row">
          <div className="skeleton skeleton-line" style={{ width: "22%" }} />
          <div className="skeleton skeleton-line" style={{ width: "14%" }} />
        </div>

        <div className="skeleton skeleton-title" style={{ width: "38%" }} />
        <div className="loading-row">
          <div className="skeleton skeleton-chip" style={{ width: "76px" }} />
          <div className="skeleton skeleton-chip" style={{ width: "92px" }} />
        </div>

        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "88%" }} />
          <div className="skeleton skeleton-line" style={{ width: "84%" }} />
          <div className="skeleton skeleton-line" style={{ width: "62%" }} />
        </div>

        <div className="skeleton skeleton-section" style={{ width: "24%" }} />
        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton skeleton-line" style={{ width: "86%" }} />
          <div className="skeleton skeleton-line" style={{ width: "80%" }} />
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
        </div>

        <div className="skeleton skeleton-section" style={{ width: "26%" }} />
        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "88%" }} />
          <div className="skeleton skeleton-line" style={{ width: "84%" }} />
          <div className="skeleton skeleton-line" style={{ width: "72%" }} />
        </div>

        <div className="loading-row">
          <div className="skeleton skeleton-chip" style={{ width: "140px" }} />
        </div>
      </div>
    </div>
  );
}
