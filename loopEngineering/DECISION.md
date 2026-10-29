## [2026-10-19] Login milestone and verification

- **Context**: Customer User flow confirmed in CLARIFICATIONS.md. No browser is connected in this session.
- **Decision**: Build login with native ES modules and a protected dashboard shell; stop for human verification before dashboard widgets. Run mock API checks separately from live account checks. Serve static files locally because ES modules cannot reliably run through file://. The local static server is development tooling, not a custom API backend.
- **Alternatives**: Tenant Admin support, external frameworks and a custom backend are outside scope.

## [2026-10-19] Authentication failures

- **Context**: Contract requires one reactive refresh for protected requests and no automatic retries for login/refresh failures.
- **Decision**: Use ten-second AbortController deadlines, validate JSON shapes, share concurrent refresh work, retry protected requests once after 401, clear only app session keys on failure/logout, and show friendly status-specific messages. Passwords are never stored; no request/response or credential logging.
- **Alternatives**: Persistent storage and repeated retries were rejected by project standards.
