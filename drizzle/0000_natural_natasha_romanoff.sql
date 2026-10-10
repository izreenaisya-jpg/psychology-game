CREATE TABLE `live_answers` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`question_index` integer NOT NULL,
	`choice` integer NOT NULL,
	`answered_at` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`correct` integer NOT NULL,
	`points` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `live_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `live_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_answer_once` ON `live_answers` (`room_id`,`player_id`,`question_index`);--> statement-breakpoint
CREATE INDEX `live_answer_round` ON `live_answers` (`room_id`,`question_index`);--> statement-breakpoint
CREATE TABLE `live_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`nickname` text NOT NULL,
	`name_key` text NOT NULL,
	`token_hash` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `live_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_player_name` ON `live_players` (`room_id`,`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_player_token` ON `live_players` (`token_hash`);--> statement-breakpoint
CREATE TABLE `live_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`question_index` integer NOT NULL,
	`deck_json` text NOT NULL,
	`seconds` integer NOT NULL,
	`speed_bonus` integer NOT NULL,
	`opened_at` integer,
	`closes_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_room_code` ON `live_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `live_room_owner` ON `live_rooms` (`owner_id`,`created_at`);