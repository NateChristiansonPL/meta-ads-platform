ALTER TABLE `skill_runs` ADD `taskUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `skill_runs` ADD `attachments` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `skill_runs` ADD `statusLog` json DEFAULT ('[]');