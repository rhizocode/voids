CREATE TABLE `collection_cache` (
	`collection_id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`backdrop_path` text,
	`parts` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`server_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text,
	`type` text,
	`collection_type` text,
	`enabled` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`server_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `media_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`address` text NOT NULL,
	`port` integer NOT NULL,
	`use_https` integer DEFAULT false NOT NULL,
	`token` text
);
--> statement-breakpoint
CREATE TABLE `movie_cache` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`imdb_id` text,
	`title` text,
	`year` integer,
	`collection_id` integer,
	`collection_title` text,
	`genres` text,
	`poster_path` text,
	`backdrop_path` text,
	`release_status` text,
	`release_date` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_providers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`config` text,
	`notification_types` text
);
--> statement-breakpoint
CREATE TABLE `owned_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`library_key` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`collection_id` integer,
	`collection_title` text,
	`poster_url` text,
	`backdrop_url` text,
	`language` text DEFAULT 'en' NOT NULL,
	`overview` text,
	`genres` text,
	`media_item_id` text,
	`media_item_key` text
);
--> statement-breakpoint
CREATE INDEX `owned_movies_tmdb_idx` ON `owned_movies` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `owned_movies_imdb_idx` ON `owned_movies` (`imdb_id`);--> statement-breakpoint
CREATE INDEX `owned_movies_lib_idx` ON `owned_movies` (`server_id`,`library_key`);--> statement-breakpoint
CREATE TABLE `recommended_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`library_key` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`collection_id` integer,
	`collection_title` text,
	`poster_url` text,
	`backdrop_url` text,
	`language` text DEFAULT 'en' NOT NULL,
	`overview` text,
	`genres` text,
	`status` text DEFAULT 'new' NOT NULL,
	`discovered_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recommended_movies_tmdb_idx` ON `recommended_movies` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `recommended_movies_lib_idx` ON `recommended_movies` (`server_id`,`library_key`);--> statement-breakpoint
CREATE TABLE `search_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text,
	`library_key` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`searched_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error` text,
	`cancel_requested` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_jobs_status_idx` ON `search_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_api_key` text,
	`schedule` text,
	`movie_status` integer DEFAULT 1 NOT NULL,
	`auth_mode` text DEFAULT 'none' NOT NULL,
	`auth_username` text,
	`auth_password_hash` text,
	`connect_timeout_ms` integer DEFAULT 10000 NOT NULL,
	`read_timeout_ms` integer DEFAULT 60000 NOT NULL,
	`auto_push_radarr` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
