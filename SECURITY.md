# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Instead, use one of
these private channels:

- [GitHub private vulnerability reporting](https://github.com/rajtik76/exile2exile/security/advisories/new)
  (preferred), or
- email **rajtik@gmail.com** with "Security" in the subject.

Include what you found, where (URL or code path), and steps to reproduce.
A proof of concept helps, but please do not access or modify data that is not
yours while demonstrating the issue.

You can expect a first reply within a few days. This is a free, single-person
fan project with no bug bounty, but real findings get fixed with priority and
you will be credited in the changelog if you want.

## Scope

- This repository and the live site at https://poe.rajtik.com
- The patch-webhook delivery (HMAC-signed POSTs) and its subscription endpoints
- The [poe2-toolkit](https://github.com/rajtik76/poe2-toolkit) packages, which
  power the passive tree

Out of scope: denial of service, findings that require a compromised device or
browser, and anything on Grinding Gear Games' own servers or services.

## Supported versions

Only the latest code on `main` (which is what runs in production) receives
security fixes.
