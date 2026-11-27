export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-red-700 dark:text-red-300">
        *
      </span>
      <span className="sr-only">(obligatorio)</span>
    </>
  );
}
