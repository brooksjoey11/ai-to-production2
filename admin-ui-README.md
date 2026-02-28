# Admin UI – API Provider & Multi-Model Pipeline System

This document describes the complete Admin UI system for managing:

- Multi-provider LLM configuration
- Per-step pipeline model selection
- Secure API key storage
- Provider connection testing
- Model syncing
- Submission inspection

The goal of this system is to eliminate hardcoded models and remove the need to modify code when switching providers or models.

---

# Overview

The application uses a **3-step execution pipeline**:

Step 1: forensic Step 2: rebuilder Step 3: quality

Each step:

- Can use a different provider
- Can use a different model
- Uses its own API key
- Is executed independently
- Passes output forward in sequence

Pipeline flow:

User Input ↓ Forensic (Provider A, Model X) ↓ Rebuilder (Provider B, Model Y) ↓ Quality (Provider C, Model Z) ↓ Final Output

---

# Admin Dashboard Structure

ADMIN DASHBOARD ├── System Prompts ├── Model Config ├── API Providers └── Submissions

---

# API Providers Tab

Purpose: Configure and manage external LLM providers without modifying code.

## Features

- Add Provider
- Edit provider base URL and auth configuration
- Store encrypted API keys
- Test provider connection
- Sync available models
- Enable/disable models per provider
- View provider status

---

## Adding a Provider

Click **Add Provider** and provide:

- Provider Name (unique)
- Base URL (e.g., https://openrouter.ai/api/v1)
- Auth Type (`bearer`, `header`, `custom`)
- Auth Header Name (e.g., `Authorization`)
- Auth Prefix (e.g., `Bearer `)
- API Key

API keys are encrypted before storage.

---

## Provider Status States

| Status     | Meaning |
|------------|----------|
| UNTESTED   | Provider has not been tested |
| CONNECTED  | Last connection test succeeded |
| FAILED     | Last test failed (error stored) |

The system stores:

- `last_tested`
- `last_test_status`
- `last_test_message`

---

## Test Connection

Test performs:

1. Loads provider configuration
2. Decrypts API key
3. Makes minimal request to provider
4. Interprets response
5. Stores result in database
6. Returns human-readable message

Errors are classified into plain English.

Examples:

- "Invalid API key"
- "Model not found"
- "Rate limit exceeded"
- "Provider unavailable"

---

# Database Schema

## api_providers

Stores provider metadata.

```sql
CREATE TABLE api_providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  base_url VARCHAR(255) NOT NULL,
  auth_type ENUM('bearer', 'header', 'custom') DEFAULT 'bearer',
  auth_header_name VARCHAR(50),
  auth_prefix VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);


---

provider_api_keys

Stores encrypted API keys.

CREATE TABLE provider_api_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  key_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_tested TIMESTAMP NULL,
  last_test_status VARCHAR(50),
  last_test_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE
);


---

provider_models

Stores models fetched from provider.

CREATE TABLE provider_models (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  is_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE KEY (provider_id, model_name),
  FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE
);


---

model_config (Modified)

ALTER TABLE model_config
ADD COLUMN provider_model_id INT NULL;

ALTER TABLE model_config
ADD FOREIGN KEY (provider_model_id)
REFERENCES provider_models(id);

selectedModel remains for backward compatibility.


---

Pipeline Configuration

Each step now supports:

Provider dropdown

Model dropdown (filtered by provider)

Step-level test button

Last test status indicator


Pipeline resolution flow:

1. Get model_config for step


2. If provider_model_id exists:

Lookup provider_models

Lookup api_providers

Lookup provider_api_keys

Decrypt key

Execute provider-specific call



3. If not:

Fallback to legacy Manus proxy





---

LLM Execution Flow

callLLM(step, messages)
    ↓
getModelConfigForStep(step)
    ↓
if provider_model_id:
    getProviderForModel()
    callProvider()
else:
    callLegacyManus()


---

Retry Logic

All provider calls use:

3 retries

Exponential backoff

Retry only on retryable errors

Final classified error if failed


Backoff schedule:

Attempt 1 → immediate
Attempt 2 → +1s
Attempt 3 → +2s

Retryable conditions:

429

5xx

Network timeout



---

Error Classification

Raw HTTP errors are never shown to admins.

Instead:

HTTP	Displayed Message

401	Invalid API key
404	Model not found
429	Rate limit exceeded
500	Provider unavailable
400	Invalid request format


Errors are normalized before display.


---

Model Syncing

When "Sync Models" is clicked:

1. Provider /models endpoint called


2. Returned list parsed


3. provider_models updated


4. Models available for pipeline selection



Only enabled models appear in dropdowns.


---

Submission History

Admin can:

View all submissions

Inspect input

Inspect forensic output

Inspect rebuilt code

Inspect quality report

Copy all content

Refresh result state



---

Security

API keys encrypted before storage

Decrypted only at runtime

Never logged

Only accessible to admin role

Provider calls isolated per step



---

Supported Providers (Phase 1)

OpenRouter (hardcoded auth pattern)


Planned:

Mistral

OpenAI

Groq

Together

Any OpenAI-compatible endpoint



---

Implementation Phases

Phase 1

Database tables

API Providers tab

OpenRouter support

Test Connection


Phase 2

Model sync

Model enable/disable

Pipeline dropdown integration


Phase 3

Multi-provider per step

Step test functionality


Phase 4

Retry logic

Error classification

Degraded model detection


Phase 5

Full provider configurability

Additional providers

UI polish

Documentation



---

Degraded Model Handling (Planned)

If a model fails 3 consecutive times:

Mark provider_model as degraded

Show warning badge in UI

Allow manual override

Allow backup model selection



---

Testing Matrix

Forensic	Rebuilder	Quality	Expected

OpenRouter	OpenRouter	OpenRouter	Success
Mistral	Mistral	Mistral	Success
OpenRouter	Mistral	OpenAI	Success
Invalid Key	Valid	Valid	Step 1 fails
Valid	Invalid Model	Valid	Step 2 fails
Rate Limited	Valid	Valid	Retries then fail
Provider Down	Valid	Valid	Step fails clearly



---

Design Goals

No hardcoded models

No code changes to switch providers

Clear human-readable errors

Per-step provider isolation

Secure key storage

Backward compatibility

Production-safe behavior



---

Operational Result

Once implemented:

1. Add provider


2. Paste key


3. Test connection


4. Sync models


5. Select provider + model per step


6. Save


7. Pipeline runs using correct provider per step



No code changes required.


---

Summary

The Admin UI transforms the system from:

Hardcoded models + single proxy

Into:

Fully configurable multi-provider execution engine

With:

Encrypted credentials

Independent step routing

Retry logic

Error classification

Admin observability

Zero redeploy model switching
