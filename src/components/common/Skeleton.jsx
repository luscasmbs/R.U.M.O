export function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-stack" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="skeleton-line" />
      ))}
    </div>
  );
}
