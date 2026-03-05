ALTER TABLE `users` ADD COLUMN `oidc_subject` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `oidc_issuer` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_oidc` ON `users`(`oidc_subject`, `oidc_issuer`) WHERE `oidc_subject` IS NOT NULL;
