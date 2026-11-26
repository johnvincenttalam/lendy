import { Navigate, useLocation } from 'react-router-dom'

/** Old #/calendar links (with any ?y=&m=&d=) open the Planner's calendar on the same month. */
export default function CalendarRedirect() {
  const params = new URLSearchParams(useLocation().search)
  params.set('view', 'calendar')
  return <Navigate to={`/planner?${params.toString()}`} replace />
}
