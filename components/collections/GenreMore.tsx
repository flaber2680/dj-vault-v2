type GenreTip = {
  name: string;
  count: string | null;
};

export function GenreMore({ genres }: { genres: readonly GenreTip[] }) {
  return (
    <div className="demo-card-more-control">
      <span className="demo-card-more" aria-hidden="true">
        +{genres.length}
      </span>
      <span className="demo-card-more-popover">
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
