CREATE TABLE `invited_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`inviteToken` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`acceptedAt` timestamp,
	`acceptedUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invited_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `invited_users_email_unique` UNIQUE(`email`),
	CONSTRAINT `invited_users_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `authProvider` enum('manus','google') DEFAULT 'manus' NOT NULL;