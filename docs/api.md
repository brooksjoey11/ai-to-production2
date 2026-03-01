# API Reference

The orchestrator exposes a REST API and a WebSocket endpoint.

## Base URL
All endpoints are prefixed with `http://localhost:8000` (configurable via `PORT`).

## Authentication
All REST endpoints except `/health`, `/metrics`, `/docs`, and `/openapi.json` require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /auth/token`.

---

## Endpoints

### Health

#### `GET /health`
Returns service health status.

**Response**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "uptime": 1234.56
}
```

---

### Authentication

#### `POST /auth/token`
Authenticate and receive a JWT token.

**Request Body**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

### Jobs

#### `POST /jobs`
Submit a new job to the orchestrator.

**Request Body**
```json
{
  "task": "string",
  "context": {}
}
```

**Response**
```json
{
  "job_id": "string",
  "status": "queued"
}
```

#### `GET /jobs/{job_id}`
Get status and result of a job.

**Response**
```json
{
  "job_id": "string",
  "status": "queued | running | completed | failed",
  "result": null,
  "error": null,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### WebSocket

#### `WS /ws`
Connect to receive real-time job updates.

**Message format (server → client)**
```json
{
  "type": "job_update",
  "job_id": "string",
  "status": "string",
  "data": {}
}
```

---

## Metrics

#### `GET /metrics`
Prometheus-format metrics endpoint.

---

## OpenAPI

#### `GET /docs`
Interactive Swagger UI documentation.

#### `GET /openapi.json`
OpenAPI 3.0 JSON schema.
