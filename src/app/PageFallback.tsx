/** Shown for the moment a page's code is loading. */
export default function PageFallback() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-7 space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-xl bg-subtle motion-safe:animate-pulse" />
      <div className="h-28 rounded-3xl bg-subtle motion-safe:animate-pulse" />
      <div className="h-20 rounded-3xl bg-subtle motion-safe:animate-pulse" />
    </div>
  )
}
