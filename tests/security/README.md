# Security Testing

## Penetration Testing

### Recommended Provider
- **Autonoma** - Automated security testing

### Areas to Test

1. **Authentication & Authorization**
   - Session/JWT token handling
   - Token permission escalation
   - ReBAC permission bypass attempts
   - API key security

2. **API Security**
   - Injection attacks (SQL, NoSQL, command)
   - IDOR (Insecure Direct Object Reference)
   - Rate limiting bypass
   - Input validation

3. **Data Protection**
   - Sensitive data exposure
   - Improper error handling (info leakage)
   - Webhook signature verification

4. **Infrastructure**
   - CORS misconfiguration
   - Header security (CSP, HSTS, etc.)
   - Dependency vulnerabilities

### Pre-Pentest Checklist

- [ ] All auth flows documented
- [ ] API endpoints cataloged (OpenAPI spec)
- [ ] Test environment provisioned
- [ ] Scope defined with provider

### Running Security Scans Locally

```bash
# TODO: Add security scanning tools
# npm audit
# bun audit (when available)
# OWASP ZAP
# Nuclei templates
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
