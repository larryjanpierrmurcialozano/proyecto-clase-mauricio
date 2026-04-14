CREATE DATABASE `mauricio` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `mauricio`;

CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(200) NOT NULL,
  `password_hash` VARCHAR(300) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'cliente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `item` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'disponible',
  `condition` VARCHAR(50) NOT NULL DEFAULT 'bueno',
  `image` VARCHAR(400) NULL,
  `price` INT NOT NULL DEFAULT 10000,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reservation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `item_id` INT NOT NULL,
  `client` VARCHAR(200) NOT NULL,
  `document` VARCHAR(50) NULL,
  `phone` VARCHAR(30) NULL,
  `start_date` VARCHAR(32) NOT NULL,
  `end_date` VARCHAR(32) NOT NULL,
  `price` INT NOT NULL DEFAULT 10000,
  `condition_at_loan` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_reservation_item_id` (`item_id`),
  CONSTRAINT `fk_reservation_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `item_id` INT NOT NULL,
  `ticket_type` VARCHAR(50) NOT NULL DEFAULT 'devolucion',
  `description` TEXT NULL,
  `condition_before` VARCHAR(50) NULL,
  `condition_after` VARCHAR(50) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'abierto',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  `created_by` VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_ticket_item_id` (`item_id`),
  CONSTRAINT `fk_ticket_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `session` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(128) NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_token` (`token`),
  KEY `ix_session_user_id` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;