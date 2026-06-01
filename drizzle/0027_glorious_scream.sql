CREATE TABLE `creative_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ad_account_id` varchar(64) NOT NULL,
	`row_id` varchar(64) NOT NULL,
	`creative_id` varchar(128),
	`ad_type` varchar(20) NOT NULL DEFAULT 'static',
	`row_data` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creative_library_id` PRIMARY KEY(`id`),
	CONSTRAINT `cl_account_row_idx` UNIQUE(`ad_account_id`,`row_id`)
);
--> statement-breakpoint
CREATE INDEX `cl_account_idx` ON `creative_library` (`ad_account_id`);