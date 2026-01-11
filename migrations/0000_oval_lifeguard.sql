-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `report` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`user_id` int(11) DEFAULT 'NULL',
	`symbol` varchar(20) DEFAULT 'NULL',
	`strategy` varchar(50) DEFAULT 'NULL',
	`trading_type` varchar(50) DEFAULT 'NULL',
	`capital` float DEFAULT 'NULL',
	`risk` float DEFAULT 'NULL',
	`confirmation` varchar(100) DEFAULT 'NULL',
	`result_summary` varchar(200) DEFAULT 'NULL',
	`report_text` text DEFAULT 'NULL',
	`rr_long` float DEFAULT 'NULL',
	`rr_short` float DEFAULT 'NULL',
	`trend` varchar(20) DEFAULT 'NULL',
	`timestamp` datetime DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `report_old` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`user_id` int(11) DEFAULT 'NULL',
	`symbol` varchar(20) DEFAULT 'NULL',
	`strategy` varchar(50) DEFAULT 'NULL',
	`trading_type` varchar(50) DEFAULT 'NULL',
	`capital` float DEFAULT 'NULL',
	`risk` float DEFAULT 'NULL',
	`confirmation` varchar(100) DEFAULT 'NULL',
	`result_summary` varchar(200) DEFAULT 'NULL',
	`report_text` text DEFAULT 'NULL',
	`rr_long` float DEFAULT 'NULL',
	`rr_short` float DEFAULT 'NULL',
	`trend` varchar(20) DEFAULT 'NULL',
	`timestamp` datetime DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `report_v2` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`user_id` int(11) DEFAULT 'NULL',
	`symbol` varchar(20) NOT NULL,
	`strategy` varchar(50) DEFAULT 'NULL',
	`trading_type` varchar(50) DEFAULT 'NULL',
	`capital` float DEFAULT 'NULL',
	`risk` float DEFAULT 'NULL',
	`confirmation` varchar(200) DEFAULT 'NULL',
	`report_text` text DEFAULT 'NULL',
	`result_summary` varchar(200) DEFAULT 'NULL',
	`rr_long` float DEFAULT 'NULL',
	`rr_short` float DEFAULT 'NULL',
	`entry_price` float DEFAULT 'NULL',
	`exit_price` float DEFAULT 'NULL',
	`direction` varchar(10) DEFAULT 'NULL',
	`trend` varchar(20) DEFAULT 'NULL',
	`timestamp` datetime DEFAULT 'current_timestamp()',
	`profit_loss` float DEFAULT 'NULL',
	`profit_loss_percent` float DEFAULT 'NULL',
	`success` tinyint(1) DEFAULT 'NULL',
	`stop_loss` float DEFAULT 'NULL',
	`take_profit` float DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_id` varchar(128) NOT NULL,
	`expires` int(11) unsigned NOT NULL,
	`data` mediumtext DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`email` varchar(120) NOT NULL,
	`password_hash` varchar(256) NOT NULL,
	`created_at` datetime DEFAULT 'NULL',
	`plan` varchar(20) DEFAULT 'NULL',
	CONSTRAINT `email` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `report` ADD CONSTRAINT `report_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `report_old` ADD CONSTRAINT `report_old_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `user_id` ON `report` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_id` ON `report_old` (`user_id`);
*/