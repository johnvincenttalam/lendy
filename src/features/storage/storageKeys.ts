/** Which storage holds the data: 'indexeddb', 'localstorage' (moved back), or missing (not moved yet). */
export const STORAGE_FLAG_KEY = 'loan-tracker-storage'
/** When the data moved to the database (ISO), kept outside it for the recovery screen. */
export const MOVED_AT_KEY = 'loan-tracker-storage-moved-at'
/** The last automatic move that failed: { outcome: 'failed', at, reason }. */
export const MOVE_STATUS_KEY = 'loan-tracker-storage-move'
