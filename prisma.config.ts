import fs from 'fs';
import path from 'path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Check if we're in a context where DATABASE_URL is needed
const isGenerationContext = process.argv.includes('generate') || 
                           process.argv.includes('prisma generate') ||
                           !process.env.DATABASE_URL;

// load .env from project root into process.env if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    });
  } catch (err) {
    // ignore if .env missing; we'll throw below with a clear message
  }
}

// Only require DATABASE_URL if we're not just generating the client
if (!process.env.DATABASE_URL && !isGenerationContext) {
  throw new Error('DATABASE_URL is not set. Add it to .env at project root or export it in your shell.');
}

// Use a dummy URL during generation if needed
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  experimental: {
    adapter: true,
  },

  // required by `pnpm prisma db pull`
  datasource: {
    provider: 'postgresql',
    url: databaseUrl,
  },

  // keep for runtime/adapter if you need it
  datasources: {
    db: {
      provider: 'postgresql',
      url: databaseUrl,
    },
  },

  adapter: async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for database adapter');
    }
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    return new PrismaPg(pool);
  },
} as any);