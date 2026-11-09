# Security boundaries

## Identity and tenant access

Better Auth owns persistent email/password identities and database-backed sessions. Passwords have a 12-character minimum and sessions expire after seven days. The test identity cookie is accepted only in development/test when the explicit test mode and signing secret are set; it is unavailable in production.

The server resolves user identity from the session cookie. Protected app operations recheck PostgreSQL membership and platform role on each request. Client-provided user IDs, account IDs, and roles are not authorization evidence. Platform owner/administrator/member roles are distinct from generated-app roles. App records are selected by app and environment, with composite foreign keys protecting tenant boundaries.

## Generated applications

Generated outputs are validated declarative JSON interpreted by trusted BuildLoop components. Arbitrary JavaScript, HTML, CSS, package installation, server access, external network access, and filesystem access are not part of the generated-app format. Published V4 app access uses real signed-in identities and server-side memberships. Do not enable arbitrary code execution or weaken artifact validation to simplify hosting.

## Secrets and origins

Database, Better Auth, Builder, and email credentials are server-only. Never use `NEXT_PUBLIC_` for secrets, commit `.env.local`, or log tokens/credentials. Configure canonical application origins per environment; do not derive security-sensitive invitation URLs from an untrusted Host header. Production must use HTTPS and secure cookies.

## Known hardening work before public launch

- Builder spend limits, Better Auth authentication throttles, app creation, invitation create/resend, and publish/rollback operations use atomic PostgreSQL-backed fixed-window counters shared across instances. Apply migration `0004_shared_operation_rate_limits` before enabling these operations in a hosted environment. Limits are per learner; user-supplied application identifiers do not create separate buckets.
- Configure a verified sender and verify email-confirmation and password-reset links before allowing untrusted public signups.
- Configure Sentry and verify a test event; extend structured audit events to cover authentication denials, invitation mail/acceptance failures, publishing, rollback, and provider failures.
- Complete production-origin, CSRF, content-security-policy, and generated-app iframe review against the deployed configuration.
- Learner Mission rows are keyed by the session user. Studio learning rows are keyed by session user and app membership; project reflection is never placed in shared app metadata for collaborators. Unit/API tests cover user scoping, membership checks, and stale revisions.

## Threat assumptions

Assume every request body, URL parameter, browser save, generated artifact, model output, and forwarded header can be attacker-controlled. Require bounded payloads, schema validation, same-origin mutation policy, server-side authorization, safe error responses, and non-enumerating invitation behavior. Managed database credentials must use TLS and least privilege. Backups and restore databases must be isolated from production until verified.
