CREATE TABLE `decay_notification_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`ad_id` varchar(64),
	`ad_name` text,
	`signal_level` enum('emerging','possible','probable') NOT NULL,
	`fatigue_score` int,
	`first_detected_at` timestamp,
	`notified_at` timestamp NOT NULL DEFAULT (now()),
	`notify_user_id` int,
	`date_from` varchar(16),
	`date_to` varchar(16),
	CONSTRAINT `decay_notification_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meta_sync_schedule` ADD `notify_user_id` int;--> statement-breakpoint
CREATE INDEX `dnl_account_idx` ON `decay_notification_log` (`account_id`);--> statement-breakpoint
CREATE INDEX `dnl_notified_at_idx` ON `decay_notification_log` (`notified_at`);