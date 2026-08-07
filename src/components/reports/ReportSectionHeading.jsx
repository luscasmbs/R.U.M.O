export function ReportSectionHeading({ number, title, description }) {
  return (
    <header className="report-section-heading">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}
