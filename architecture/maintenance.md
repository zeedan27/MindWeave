# MindWeave — Maintenance & Operations Runbook

> **Status:** Initialized (Phase 0). Populate concrete URLs, deployment commands, and alert channels during Phase 3–5.

---

## 1. Environment Variables
- See `.env.example` for the authoritative list of required/optional environment keys.
- Never commit `.env` or plain-text secrets. Rotate immediately if exposed.

## 2. Health & Readiness Endpoints
- *(To be defined in Phase 1/3 once runtime stack is locked — e.g., `/api/healthz/live`, `/api/healthz/ready`).*

## 3. Rollback Procedure
- *(To be populated in Phase 5 based on the selected Layer 5/6 deployment target.)*

## 4. Secret Rotation Guide
- *(To be populated in Phase 2/5 with provider-specific rotation steps.)*

## 5. Deferred Layer Revisit Triggers
- *(Mirror all `Deferred` entries and revisit triggers from `findings.md`'s 12-Layer Decision Table once finalized in Phase 1.)*
