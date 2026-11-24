import { handleAsk } from '../src/server/askHandler'

/**
 * POST /api/ask — Ask Ollie's server. The Groq key comes from the
 * GROQ_API_KEY environment variable set in the Vercel project.
 */
export default {
  fetch: (request: Request) => handleAsk(request, { apiKey: process.env.GROQ_API_KEY }),
}
