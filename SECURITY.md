# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Active support  |

## Reporting a Vulnerability

If you discover a security vulnerability in ShiftSafe-DT, please report it responsibly:

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email the team directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

ShiftSafe-DT implements the following security measures:

- **Input Validation**: All API endpoints validate and sanitize inputs
- **Parameterized Queries**: SQLite queries use prepared statements (no SQL injection)
- **Rate Limiting**: API endpoints are designed with rate limiting considerations
- **Fraud Detection**: Isolation Forest ML model detects GPS spoofing and anomalous behavior
- **Weekly Claim Limits**: Maximum coverage caps prevent abuse (₹2000/week)
- **Automated Scanning**: CodeQL and npm audit run on every PR

## Dependencies

We regularly audit our dependencies using:
- `npm audit` — Checks for known vulnerabilities in npm packages
- **GitHub Dependabot** — Automated dependency updates
- **CodeQL** — Static analysis for security vulnerabilities
