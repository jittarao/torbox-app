/**
 * Shared empty-state card: icon, title, description, and a "how it works"
 * notes box. Extra content renders below the notes via `children`.
 */
export default function EmptyStateCard({
  icon: Icon,
  title,
  description,
  notesTitle,
  notes = [],
  children,
}) {
  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-8 md:p-12">
      <div className="text-center">
        <Icon className="size-16 mx-auto mb-4 text-primary-text/40 dark:text-primary-text-dark/40" />
        <h2 className="text-lg font-medium text-primary-text dark:text-primary-text-dark mb-2">
          {title}
        </h2>
        <p className="text-md text-primary-text/70 dark:text-primary-text-dark/70 max-w-xl mx-auto mb-4">
          {description}
        </p>
        <div className="mt-6 p-4 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
          <p className="text-md text-primary-text/60 dark:text-primary-text-dark/60 mb-2">
            <strong className="text-primary-text dark:text-primary-text-dark">{notesTitle}</strong>
          </p>
          <ul className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 text-left space-y-1 max-w-md mx-auto">
            {notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>

        {children}
      </div>
    </div>
  );
}
