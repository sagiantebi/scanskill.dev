ALTER TABLE `jobs` ADD `progress` integer DEFAULT 8 NOT NULL;
--> statement-breakpoint
UPDATE `jobs` SET `progress` = 100 WHERE `status` = 'completed';
--> statement-breakpoint
UPDATE `jobs` SET `progress` = 33 WHERE `status` IN ('queued', 'processing');
--> statement-breakpoint
UPDATE `jobs` SET `progress` = 0 WHERE `status` = 'failed';