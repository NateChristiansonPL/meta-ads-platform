CREATE TABLE `admin_feedback_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lastReadAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_feedback_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_feedback_reads_userId_unique` UNIQUE(`userId`)
);
