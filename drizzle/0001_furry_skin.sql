CREATE TABLE `mask_collection_versions` (
	`version` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection` text NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mask_collection_versions_request_id_unique` ON `mask_collection_versions` (`request_id`);