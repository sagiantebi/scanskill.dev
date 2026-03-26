CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`input_hash` text NOT NULL,
	`original_text` text NOT NULL,
	`source_type` text DEFAULT 'text' NOT NULL,
	`url` text,
	`user_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_input_hash_unique` ON `jobs` (`input_hash`);--> statement-breakpoint
CREATE TABLE `scan_results` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`sanitized_text` text,
	`urls` text,
	`shell_commands` text,
	`injections` text,
	`tags` text,
	`risk_level` text DEFAULT 'low',
	`tldr` text,
	`metadata` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
