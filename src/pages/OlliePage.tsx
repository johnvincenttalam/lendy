import PageHeader from '../components/PageHeader'
import OllieCompanion from '../features/ollie/OllieCompanion'
import AskOllieChat from '../features/askOllie/AskOllieChat'

/**
 * Ollie's own tab: what Ollie wants you to know right now, then the chat.
 * Private-folder loans never appear here; the folder has its own chat.
 */
export default function OlliePage() {
  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader title="Ollie" subtitle="Your money buddy" />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 lg:pb-6">
        <OllieCompanion className="mb-5" />
        <AskOllieChat
          includePrivate={false}
          frame={(conversation, input) => (
            <>
              <section aria-label="Chat with Ollie" className="min-h-[30vh]">{conversation}</section>
              {/* Stays above the bottom nav on phones, at the foot of the page on desktop. */}
              <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-4 mt-4 rounded-2xl bg-card border border-themed p-2.5">
                {input}
              </div>
            </>
          )}
        />
      </div>
    </div>
  )
}
