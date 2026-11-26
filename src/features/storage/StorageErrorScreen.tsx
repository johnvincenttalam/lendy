import OllieCharacter from '../ollie/OllieCharacter'

/** Shown when the data lives in the database but the database won't open. Never shows the old copy instead. */
export default function StorageErrorScreen() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-4">
      <div role="alert" className="max-w-sm w-full bg-card rounded-3xl border border-themed p-6 text-center">
        <div className="flex justify-center mb-3">
          <OllieCharacter mood="alert" still />
        </div>
        <h1 className="font-extrabold text-primary text-[20px] tracking-tight mb-2">Ollie couldn’t open your data</h1>
        <p className="text-[14px] text-secondary mb-5">
          Another Ollie tab may be holding it. Close other Ollie tabs, then try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded-2xl bg-brand text-on-brand font-bold hover:bg-brand-light focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
