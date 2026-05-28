export default function LocaleLoading() {
  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <div
        className="animate-spin rounded-full size-8 border-b-2 border-accent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
