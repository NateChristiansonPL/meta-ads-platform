CREATE TABLE `adset_goals` (
	`adset_id` varchar(128) NOT NULL,
	`adset_name` text,
	`account_id` varchar(64),
	`campaign_id` varchar(128),
	`optimization_goal` varchar(128),
	`custom_conversion_id` varchar(128),
	`custom_event_type` varchar(128),
	`pixel_id` varchar(128),
	`conv_event_label` varchar(256),
	`last_fetched_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adset_goals_adset_id` PRIMARY KEY(`adset_id`)
);
--> statement-breakpoint
CREATE INDEX `ag_account_idx` ON `adset_goals` (`account_id`);--> statement-breakpoint
CREATE INDEX `ag_campaign_idx` ON `adset_goals` (`campaign_id`);