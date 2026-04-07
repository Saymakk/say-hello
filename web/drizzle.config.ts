import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/** Миграции лежат в корневой папке `db/`, чтобы БД была отдельно от кода приложения. */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "../db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "",
  },
});
