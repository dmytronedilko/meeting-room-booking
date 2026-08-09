# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue or PR.

- **Preferred:** on this repository go to **Security → Report a vulnerability** to
  open a private security advisory. Private vulnerability reporting is enabled.

You'll receive an acknowledgement within a few days. Please include steps to
reproduce and the affected area (`backend`, `frontend`, or `infra`). We'll
coordinate a fix and a disclosure timeline with you.

## Supported versions

This is an actively developed project; only the latest `main` is supported.

## How this project defends itself

Security is enforced in CI on every push and pull request
(see [`docs/CI-and-Security.md`](docs/CI-and-Security.md)):

- **Dependencies** — Snyk SCA, gating the pipeline on CRITICAL severity.
- **Container images** — Snyk container scan; images run as a non-root user with
  build-time tooling (`npm`/`corepack`) stripped from the runtime layer.
- **Static analysis** — CodeQL (SAST) and a SonarQube quality gate.
- **Secrets** — gitleaks in CI plus GitHub secret scanning with push protection.
- **Supply chain** — every GitHub Action is pinned to a full commit SHA.
