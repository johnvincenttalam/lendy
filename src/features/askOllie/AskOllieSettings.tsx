import { useState } from 'react'
import { KeyRound, ExternalLink } from 'lucide-react'
import { useAskOllieStore } from './askOllieStore'
import { normalizeKey } from './groqClient'
import { showToast } from '../../components/Toast'

/** Settings → Ask Ollie: the owner's own Groq key. */
export default function AskOllieSettings() {
  const { apiKey, setKey, removeKey } = useAskOllieStore()
  const [draft, setDraft] = useState('')

  return (
    <div>
      <label htmlFor="groq-key" className="block text-[11px] font-semibold text-muted mb-1.5">
        Ask Ollie
      </label>

      {apiKey ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-subtle">
            <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[13px] font-medium text-primary">Groq key saved</span>
          </div>
          <button
            type="button"
            onClick={() => {
              removeKey()
              showToast('Groq key removed')
            }}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-red-500 hover:opacity-80 transition-opacity"
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!normalizeKey(draft)) return
            setKey(draft)
            setDraft('')
            showToast('Groq key saved')
          }}
        >
          <input
            id="groq-key"
            type="password"
            className="input-field flex-1 min-w-0"
            placeholder="Paste your Groq API key"
            value={draft}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            disabled={!normalizeKey(draft)}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-brand hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            Save
          </button>
        </form>
      )}

      <p className="text-[12px] text-muted mt-2">
        Your questions and a summary of your loans, bills, savings and spending are sent to Groq to answer them.
        The key stays on this device.
      </p>
      {!apiKey && (
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-semibold text-brand"
        >
          Get a free key <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}
