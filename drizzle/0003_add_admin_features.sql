-- 1. API Providers (must be first - others depend on it)
CREATE TABLE api_providers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    base_url VARCHAR(255) NOT NULL,
    auth_type ENUM('bearer', 'header', 'basic', 'custom') DEFAULT 'bearer',
    auth_header_name VARCHAR(50) DEFAULT 'Authorization',
    auth_prefix VARCHAR(20) DEFAULT 'Bearer ',
    version VARCHAR(20),
    test_prompt TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_active (is_active)
);

-- 2. Provider API Keys (encrypted)
CREATE TABLE provider_api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_id INT NOT NULL,
    key_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_tested TIMESTAMP NULL,
    last_test_status ENUM('ok', 'failed', 'untested') DEFAULT 'untested',
    last_test_message TEXT,
    last_error JSON,
    last_updated_by INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (last_updated_by) REFERENCES users(id)
);

-- 3. Provider Models
CREATE TABLE provider_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_id INT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    context_length INT,
    rpm_limit INT,
    tpm_limit INT,
    is_enabled BOOLEAN DEFAULT TRUE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    UNIQUE KEY (provider_id, model_name),
    FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE,
    INDEX idx_enabled (is_enabled)
);

-- 4. Provider Audit Log
CREATE TABLE provider_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by INT NOT NULL,
    details JSON,
    performed_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id),
    INDEX idx_provider (provider_id),
    INDEX idx_performed (performed_at)
);

-- 5. Dead Letter Queue
CREATE TABLE dead_letter_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id VARCHAR(100) NOT NULL,
    submission_id INT,
    step VARCHAR(50),
    provider VARCHAR(100),
    model VARCHAR(100),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    failed_at TIMESTAMP DEFAULT NOW(),
    retry_count INT DEFAULT 0,
    payload JSON,
    status ENUM('pending', 'retried', 'deleted') DEFAULT 'pending',
    INDEX idx_failed_at (failed_at),
    INDEX idx_status (status),
    INDEX idx_provider (provider)
);

-- 6. Idempotency Keys
CREATE TABLE idempotency_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    submission_id INT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (submission_id) REFERENCES code_submissions(id)
);

-- 7. Audit Logs
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    before_value JSON,
    after_value JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. Provider Health History
CREATE TABLE provider_health_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INT,
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_provider (provider_id),
    INDEX idx_checked (checked_at),
    FOREIGN KEY (provider_id) REFERENCES api_providers(id)
);

-- 9. Runtime Configuration
CREATE TABLE runtime_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL UNIQUE,
    value JSON NOT NULL,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    version INT DEFAULT 1,
    FOREIGN KEY (updated_by) REFERENCES users(id),
    INDEX idx_key (`key`)
);

-- 10. User Rate Overrides
CREATE TABLE user_rate_overrides (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    `limit` INT NOT NULL,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- 11. Daily Usage
CREATE TABLE daily_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    count INT DEFAULT 0,
    UNIQUE KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 12. Backups
CREATE TABLE backups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    size VARCHAR(50),
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    download_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP NULL
);

-- 13. Modify model_config
ALTER TABLE model_config ADD COLUMN provider_model_id INT NULL;
ALTER TABLE model_config ADD CONSTRAINT fk_model_config_provider_model FOREIGN KEY (provider_model_id) REFERENCES provider_models(id);
