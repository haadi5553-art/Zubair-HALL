#!/usr/bin/env node
// ------------------------------------------------------------------
// Picks the Prisma provider automatically from DATABASE_URL, so the
// same codebase runs on SQLite (own PC) AND Postgres/Neon (Vercel)
// without anyone editing schema.prisma.
//   postgres://... / postgresql://... / prisma+postgres:  -> postgresql
//   anything else (file:...)                              -> sqlite
// Runs as the first step of every build (package.json / vercel.json).
// ------------------------------------------------------------------
import fs from "fs";
import path from "path";

const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

// Read DATABASE_URL from the environment, falling back to the .env file.
let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
    const m = /^DATABASE_URL=(.*)$/m.exec(envText);
    if (m) url = m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env file - fine */
  }
}

const isPostgres = !!url && /^(postgres(ql)?:\/\/|prisma\+postgres:)/.test(url);
const provider = isPostgres ? "postgresql" : "sqlite";

const currentProvider = /datasource\s+db\s*\{[^}]*provider\s*=\s*"([^"]+)"/.exec(schema)?.[1];
if (currentProvider !== provider) {
  schema = schema.replace(
    /(datasource\s+db\s*\{[^}]*provider\s*=\s*")[^"]+(")/,
    `$1${provider}$2`,
  );
  fs.writeFileSync(schemaPath, schema);
  console.log(`[resolve-prisma-provider] provider switched to "${provider}".`);
} else {
  console.log(`[resolve-prisma-provider] provider already "${provider}".`);
}
