CREATE TABLE `api_providers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(50) NOT NULL,
  `baseUrl` varchar(255) NOT NULL,
  `authType` enum('bearer','header','custom') NOT NULL DEFAULT 'bearer',
  `authHeaderName` varchar(50) NOT NULL DEFAULT 'Authorization',
  `authPrefix` varchar(20) NOT NULL DEFAULT 'Bearer ',
  `requiresApiKey` int NOT NULL DEFAULT 1,
  `isActive` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `api_providers_id` PRIMARY KEY(`id`),
  CONSTRAINT `api_providers_name_unique` UNIQUE(`name`)
);

CREATE TABLE `provider_api_keys` (
  `id` int AUTO_INCREMENT NOT NULL,
  `providerId` int NOT NULL,
  `keyValue` text NOT NULL,
  `isActive` int NOT NULL DEFAULT 1,
  `lastTested` timestamp NULL,
  `lastTestStatus` varchar(50),
  `lastTestMessage` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `provider_api_keys_id` PRIMARY KEY(`id`)
);

CREATE TABLE `provider_models` (
  `id` int AUTO_INCREMENT NOT NULL,
  `providerId` int NOT NULL,
  `modelName` varchar(120) NOT NULL,
  `displayName` varchar(120),
  `contextLength` int,
  `isEnabled` int NOT NULL DEFAULT 1,
  `lastSynced` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `provider_models_id` PRIMARY KEY(`id`),
  CONSTRAINT `provider_models_provider_model_unique` UNIQUE(`providerId`,`modelName`)
);

ALTER TABLE `provider_api_keys`
  ADD CONSTRAINT `provider_api_keys_providerId_api_providers_id_fk`
  FOREIGN KEY (`providerId`) REFERENCES `api_providers`(`id`)
  ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE `provider_models`
  ADD CONSTRAINT `provider_models_providerId_api_providers_id_fk`
  FOREIGN KEY (`providerId`) REFERENCES `api_providers`(`id`)
  ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE `model_config`
  ADD COLUMN `providerModelId` int NULL;

ALTER TABLE `model_config`
  ADD CONSTRAINT `model_config_providerModelId_provider_models_id_fk`
  FOREIGN KEY (`providerModelId`) REFERENCES `provider_models`(`id`)
  ON DELETE SET NULL ON UPDATE no action;
