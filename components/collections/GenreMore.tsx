"use client";

import { useId, useState } from "react";

type GenreTip = {
  name: string;
  count: string | null;
};

export function GenreMore({ genres }: { genres: readonly GenreTip[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`demo-card-more-control${isOpen ? " is-open" : ""}`}>
      <button
        className="demo-card-more"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Еще ${genres.length} скрытых стилей`}
        onClick={() => setIsOpen((open) => !open)}
      >
        +{genres.length}
      </button>
      <span className="demo-card-more-popover" id={panelId} role="tooltip">
        {genres.map((genre) => (
          <span
            className="demo-card-more-item"
            key={`${genre.name}-${genre.count ?? "none"}`}
          >
            <span>{genre.name}</span>
            {genre.count ? <strong>{genre.count}</strong> : null}
          </span>
        ))}
      </span>
    </div>
  );
}
