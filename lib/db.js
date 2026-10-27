import pg from "pg";

const { Pool } = pg;
let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false }
  });
  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}
