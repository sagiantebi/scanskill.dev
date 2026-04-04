import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  inputHash: text('input_hash').unique().notNull(),
  originalText: text('original_text').notNull(),
  sourceType: text('source_type', { enum: ['text', 'url'] }).notNull().default('text'),
  url: text('url'),
  userId: text('user_id'),
  status: text('status', { enum: ['queued', 'processing', 'completed', 'failed'] }).notNull().default('queued'),
  stage: integer('stage').notNull().default(1),
  progress: integer('progress').notNull().default(8),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const scanResults = sqliteTable('scan_results', {
  id: text('id').primaryKey(),
  jobId: text('job_id').references(() => jobs.id),
  sanitizedText: text('sanitized_text'),
  urls: text('urls', { mode: 'json' }),
  shellCommands: text('shell_commands', { mode: 'json' }),
  injections: text('injections', { mode: 'json' }),
  tags: text('tags', { mode: 'json' }),
  riskLevel: text('risk_level', { enum: ['low', 'medium', 'high'] }).default('low'),
  tldr: text('tldr'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})
