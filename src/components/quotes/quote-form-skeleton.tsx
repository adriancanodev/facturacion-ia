export function QuoteFormSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true" className="flex flex-col gap-1.5">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
      <div
        aria-hidden="true"
        className="h-32 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
      />
    </div>
  );
}
