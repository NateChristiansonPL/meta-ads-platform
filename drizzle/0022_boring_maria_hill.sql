ALTER TABLE `ad_performance` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `ad_performance` ADD PRIMARY KEY(`ad_id`,`date`,`publisher_platform`);