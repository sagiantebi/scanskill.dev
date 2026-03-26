# Privacy

This document describes how **Skills Scanner** handles data when you run or deploy it. Wording applies to the software and a typical public deployment; your operator may publish additional terms.

## What we process

- **Skill content** you submit (plain text or content fetched from a URL you provide).
- An optional **`userId`** string if your client sends it with the API request (used only as stored metadata for that job, if implemented in your deployment).

## What we store

- Job and scan records in **Cloudflare D1** (or your configured database), including sanitized text, extracted URLs, tags, risk level, and similar scan outputs described in the project README.
- **Deduplication**: text inputs are hashed (SHA-256 of normalized content) so identical submissions can be linked to an existing job.

## Subprocessors / infrastructure

A standard deployment uses **Cloudflare** (Workers, Queues, D1, optional Workers AI for tagging/summary in worker 2). Processing occurs on Cloudflare’s platform under their terms and privacy policy.

## Retention

Retention is **deployment-specific**. Open source operators should document their own retention and deletion practices. This repository does not impose a global retention policy.

## Analytics

The reference project does not require analytics. A hosted instance may add its own analytics; that would be disclosed by the operator, not by this file alone.

## Contact

For privacy questions about a **specific hosted instance**, contact that instance’s operator. For issues with **this open source project**, use the issue tracker or security reporting process in [SECURITY.md](SECURITY.md) where appropriate.
