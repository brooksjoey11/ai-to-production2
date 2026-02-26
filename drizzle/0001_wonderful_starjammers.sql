CREATE TABLE `code_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalCode` text NOT NULL,
	`language` varchar(50) NOT NULL,
	`userComments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `code_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stepName` enum('forensic','rebuilder','quality') NOT NULL,
	`selectedModel` varchar(100) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_config_stepName_unique` UNIQUE(`stepName`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`forensicDossier` text NOT NULL,
	`rebuiltCode` text NOT NULL,
	`qualityReport` text NOT NULL,
	`tokensUsed` int,
	`estimatedCost` decimal(10,6),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pipeline_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyCount` int NOT NULL DEFAULT 0,
	`resetTimestamp` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_limits_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stepName` enum('forensic','rebuilder','quality') NOT NULL,
	`promptText` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_prompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_prompts_stepName_unique` UNIQUE(`stepName`)
);
--> statement-breakpoint
ALTER TABLE `code_submissions` ADD CONSTRAINT `code_submissions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pipeline_results` ADD CONSTRAINT `pipeline_results_submissionId_code_submissions_id_fk` FOREIGN KEY (`submissionId`) REFERENCES `code_submissions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rate_limits` ADD CONSTRAINT `rate_limits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;