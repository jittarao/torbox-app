import { Check } from '@/components/icons';

export function SheetRow({ label, selected, onClick, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-white
        active:bg-white/10 touch-manipulation"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-white/60">{description}</span> : null}
      </span>
      {selected ? <Check className="size-5 shrink-0 text-accent dark:text-accent-dark" /> : null}
    </button>
  );
}

export function SectionTitle({ children }) {
  return (
    <h3 className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-white/50">
      {children}
    </h3>
  );
}
