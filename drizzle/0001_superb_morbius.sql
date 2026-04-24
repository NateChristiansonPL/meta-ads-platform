CREATE TABLE `knowledge_base` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(64) DEFAULT 'general',
	`content` text NOT NULL,
	`addedByUserId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_base_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`skillId` varchar(64) NOT NULL,
	`skillName` varchar(128) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`adAccountId` varchar(64),
	`adAccountName` varchar(255),
	`businessManagerId` varchar(64),
	`datePreset` varchar(64),
	`campaignIds` json DEFAULT ('[]'),
	`extraParams` json DEFAULT ('{}'),
	`reportMarkdown` text,
	`errorMessage` text,
	`durationMs` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `skill_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `token_vault` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(255) NOT NULL,
	`businessManagerId` varchar(64) NOT NULL,
	`businessManagerName` varchar(255),
	`accessToken` text NOT NULL,
	`tokenExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`addedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `token_vault_id` PRIMARY KEY(`id`)
);
