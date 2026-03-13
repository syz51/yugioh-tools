import '@tanstack/react-start/server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../env'
import * as schema from './schema'

type GlobalDb = typeof globalThis & {
  __cardCachePool?: Pool
}

const globalForDb = globalThis as GlobalDb

function createPool() {
  return new Pool({
    connectionString: env.DATABASE_URL,
  })
}

const pool = globalForDb.__cardCachePool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__cardCachePool = pool
}

export const db = drizzle(pool, { schema })
export { pool }
