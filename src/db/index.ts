import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

/** Один клиент Drizzle на запрос serverless: использует пул Vercel Postgres. */
export const db = drizzle(sql, { schema });
