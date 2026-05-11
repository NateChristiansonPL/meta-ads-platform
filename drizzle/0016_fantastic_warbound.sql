CREATE TABLE `first_fatigue_detected` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`content_fingerprint` varchar(128) NOT NULL,
	`level` enum('emerging','possible','probable') NOT NULL,
	`first_detected_at` timestamp NOT NULL DEFAULT (now()),
	`representative_name` text,
	CONSTRAINT `first_fatigue_detected_id` PRIMARY KEY(`id`),
	CONSTRAINT `ffd_account_fp_level_unique` UNIQUE(`account_id`,`content_fingerprint`,`level`)
);
--> statement-breakpoint
ALTER TABLE `meta_sync_history` ADD `history_campaign_status_filter` enum('active','active_30d','inactive','all');--> statement-breakpoint
ALTER TABLE `meta_sync_history` ADD `sync_type` enum('sync','analysis','combined') DEFAULT 'combined';--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `sync_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `sync_utc_hour` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `sync_rolling_days` int DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `sync_preset` varchar(32) DEFAULT 'rolling' NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `campaign_status_filter` enum('active','active_30d','inactive','all') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `analysis_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `analysis_utc_hour` int DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `analysis_rolling_days` int DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `notify_emerging` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `notify_possible` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `notify_probable` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `only_live_ads` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `last_analysis_at` timestamp;--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `last_analysis_status` enum('success','partial','error');--> statement-breakpoint
CREATE INDEX `ffd_account_idx` ON `first_fatigue_detected` (`account_id`);