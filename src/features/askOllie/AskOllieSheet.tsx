import Sheet from '../../components/Sheet'
import AskOllieChat from './AskOllieChat'

/** Ask Ollie in a sheet: used in the private folder, where the chat must not outlive the visit. */
export default function AskOllieSheet({ includePrivate, onClose }: { includePrivate: boolean; onClose: () => void }) {
  return (
    <AskOllieChat
      includePrivate={includePrivate}
      frame={(conversation, input) => (
        <Sheet title="Ask Ollie" onClose={onClose} footer={input}>{conversation}</Sheet>
      )}
    />
  )
}
