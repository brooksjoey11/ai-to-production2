CREATE INDEX `idx_submissions_user_date` ON `code_submissions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_results_submission` ON `pipeline_results` (`submissionId`);