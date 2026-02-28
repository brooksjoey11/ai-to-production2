# Deployment Strategy

This document defines the supported production topology and required infrastructure
for the AI-to-Production system.

---

## 1. Supported Runtime Models

### A. Single-Node Deployment (Baseline)

Recommended for:
- Small teams
- Low-to-moderate traffic
- Simpler operational footprint

Components running on a single host:

- API server process
- Worker process
- MySQL database
- Redis instance (recommended but optional)
- Reverse proxy (e.g., NGINX or cloud load balancer)

Processes:

pnpm start pnpm start:worker

Characteristics:
- Horizontal scaling not supported
- Redis improves job reliability
- Worker isolated from API (separate process)
- DB is authoritative store for results

---

### B. Multi-Instance Deployment (Horizontal Scale)

Recommended for:
- High submission volume
- Production with redundancy
- Multiple API replicas

Required:

- Shared MySQL database
- Shared Redis instance
- One or more API instances
- One or more Worker instances
- Load balancer

Topology:

┌───────────────┐
             │ Load Balancer │
             └───────┬───────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼

API Instance 1   API Instance 2   API Instance N │                │                │ └────────────────┼────────────────┘ │ Shared Redis │ Worker Instance(s) │ Shared MySQL

Rules:
- API processes must initialize queue in "api" mode only.
- Worker processes must initialize queue in "worker" mode only.
- Redis must be highly available.
- MySQL must support concurrent connections and indexing.

---

## 2. Required Infrastructure

### Mandatory
- MySQL-compatible database
- JWT_SECRET configured
- OAuth server configured
- Forge API key configured

### Strongly Recommended
- Redis (for BullMQ queue reliability)
- Reverse proxy (TLS termination)
- Health monitoring
- Log aggregation

---

## 3. Environment Variables (Production Minimum)

Required:

- DATABASE_URL
- JWT_SECRET
- OAUTH_SERVER_URL
- OWNER_OPEN_ID
- BUILT_IN_FORGE_API_URL
- BUILT_IN_FORGE_API_KEY

Optional tuning:

- REDIS_URL
- QUEUE_WORKER_CONCURRENCY
- QUEUE_LIMITER_MAX
- QUEUE_LIMITER_DURATION_MS
- LOG_LEVEL
- PORT

---

## 4. Startup Order

Production startup sequence:

1. Database available
2. Redis available
3. Start worker process
4. Start API process
5. Confirm /health returns OK

---

## 5. Health Expectations

`GET /health` must report:

- database: up
- redis: up (or degraded if intentionally disabled)
- llm: up

Status logic:

- If database or LLM is down → overall status = down
- If redis only is down → overall status = degraded

---

## 6. Scaling Guidelines

Scale API instances when:
- CPU bound
- High concurrent request load

Scale Worker instances when:
- Queue backlog increases
- Job processing latency increases

Tune via environment variables:
- QUEUE_WORKER_CONCURRENCY
- QUEUE_LIMITER_MAX
- QUEUE_LIMITER_DURATION_MS

---

## 7. Backup Strategy

Minimum:

- Daily database backup
- Backup retention ≥ 7 days

Optional:

- Redis snapshotting (if job durability required)

---

## 8. Unsupported Topologies

- Serverless worker execution
- Multi-region without DB replication
- In-memory-only job processing in distributed mode

---

## 9. Production Checklist

- [ ] DATABASE_URL configured
- [ ] JWT_SECRET configured
- [ ] Forge API key valid
- [ ] Redis reachable
- [ ] Worker process running
- [ ] API process running
- [ ] Health endpoint verified
- [ ] CI pipeline passing

VERIFICATION:

· Change integrates with existing patterns
· Error paths handled
· Logging present
· Types preserved/extended
