import { createFileRoute } from '@tanstack/react-router'
import { syncAllCardsFromYgocdb } from '../../../lib/ygocdb-sync.server'

export const Route = createFileRoute('/api/ygocdb/sync')({
  server: {
    handlers: {
      GET: handleSyncRequest,
      POST: handleSyncRequest,
    },
  },
})

async function handleSyncRequest() {
  try {
    const result = await syncAllCardsFromYgocdb()
    return jsonResponse(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to sync cards from YGOCDB.'

    return jsonResponse(
      {
        error: message,
      },
      500,
    )
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  })
}
