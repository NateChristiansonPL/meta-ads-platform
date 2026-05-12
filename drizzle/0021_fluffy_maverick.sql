CREATE TABLE `decay_reports` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`account_name` text,
	`campaign_ids` text,
	`date_from` varchar(16) NOT NULL,
	`date_to` varchar(16) NOT NULL,
	`report_type` enum('manual','auto') NOT NULL,
	`signal_count` int NOT NULL DEFAULT 0,
	`probable_count` int NOT NULL DEFAULT 0,
	`possible_count` int NOT NULL DEFAULT 0,
	`emerging_count` int NOT NULL DEFAULT 0,
	`report_json` mediumtext NOT NULL,
	`label` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decay_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `decay_notification_log` ADD `campaign_name` text;--> statement-breakpoint
ALTER TABLE `decay_notification_log` ADD `adset_name` text;--> statement-breakpoint
ALTER TABLE `decay_notification_log` ADD `notified_via_app` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `decay_notification_log` ADD `notified_via_slack` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `user_id` int;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `always_send_report` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `slack_webhook_url` text;--> statement-breakpoint
CREATE INDEX `dr_user_idx` ON `decay_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `dr_user_account_idx` ON `decay_reports` (`user_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `dr_created_at_idx` ON `decay_reports` (`created_at`);