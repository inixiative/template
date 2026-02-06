# OTEL-001: Observability Infrastructure

**Status**: 🆕 Not Started
**Assignee**: Hernan
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement comprehensive observability infrastructure with OpenTelemetry instrumentation, self-hosted analytics, and monitoring dashboards.

## Objectives

- ✅ Full OpenTelemetry instrumentation across the stack
- ✅ Self-hosted analytics platform (OpenPanel)
- ✅ Superadmin observability dashboard
- ✅ Integration with existing logger (Consola)

---

## Tasks

### 1. OpenTelemetry Instrumentation

Implement OTEL spans and hooks throughout the application:

#### Database Layer
- [ ] Instrument Prisma queries with spans
- [ ] Track query performance and slow queries
- [ ] Add connection pool metrics

#### Redis Layer
- [ ] Instrument Redis operations with spans
- [ ] Track cache hit/miss rates
- [ ] Monitor connection health

#### Integration Wrapper
Create a reusable wrapper for external operations:
- [ ] API calls (external services)
- [ ] AI calls (LLM providers)
- [ ] Generic async operation wrapper
- [ ] Automatic error tracking and retry metrics

#### Workers
- [ ] Instrument BullMQ job processing
- [ ] Track job duration and success/failure rates
- [ ] Monitor queue depth and processing lag

### 2. OpenPanel Self-Hosted Analytics

Deploy OpenPanel for event tracking and analytics:

- [ ] Add OpenPanel to `docker-compose.yml`
- [ ] Configure environment variables
- [ ] Set up initial dashboards
- [ ] Document integration points

**Note**: CI/CD deployment not included in this ticket - manual docker-compose setup only.

### 3. Superadmin Dashboard Integration

Expose observability data in the superadmin app:

- [ ] Add instrumentation metrics view
  - Active spans
  - Trace viewer
  - Performance metrics
- [ ] Integrate OpenPanel dashboard
  - Embed analytics views
  - Event stream visualization
- [ ] Add health check dashboard
  - Service status
  - Resource utilization

### 4. Logger Integration

Hook up Consola with OpenTelemetry:

- [ ] Bridge Consola logs to OTEL
- [ ] Ensure trace context propagation
- [ ] Add span IDs to log output
- [ ] Configure log level filtering

---

## Open Questions

### Prometheus Integration

**Question**: Should we implement Prometheus for metrics, or stub out hooks for platform-native solutions?

**Context**:
- We're expecting to use **Render** and **Vercel** for deployment
- Both platforms have native monitoring capabilities
- Prometheus adds operational overhead

**Options**:

A. **Implement Prometheus now**
   - ✅ Complete local development parity
   - ✅ Platform-agnostic metrics
   - ❌ Additional service to maintain
   - ❌ May duplicate platform metrics

B. **Stub out hooks for platform metrics**
   - ✅ Lighter local setup
   - ✅ Use platform-native solutions
   - ❌ Platform lock-in
   - ❌ Different monitoring in dev vs prod

C. **Hybrid approach**
   - OTEL exporters configured via env vars
   - Prometheus available for local/self-hosted
   - Cloud platforms use native exporters
   - ✅ Best of both worlds
   - ❌ More configuration complexity

**Recommendation needed**: @Aron - which approach aligns with deployment strategy?

---

## Implementation Notes

### Integration Wrapper Pattern

```typescript
// Suggested structure for the integration wrapper
import { trace } from '@opentelemetry/api';

export async function instrumentedOperation<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> {
  const span = trace.getTracer('app').startSpan(name, { attributes });
  try {
    const result = await operation();
    span.setStatus({ code: 0 }); // OK
    return result;
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### Docker Compose Addition

```yaml
# Add to docker-compose.yml
openpanel:
  image: openpanel/openpanel:latest
  ports:
    - "3001:3000"
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/openpanel
  depends_on:
    - postgres
```

---

## Definition of Done

- [ ] All instrumentation points implemented and tested
- [ ] OpenPanel running in docker-compose
- [ ] Superadmin dashboard displaying metrics
- [ ] Consola integrated with trace context
- [ ] Documentation updated in `/docs/claude/LOGGING.md` and `/docs/claude/MONITORING.md`
- [ ] Open question resolved with @Aron
- [ ] Example traces visible in dev environment

---

## Resources

- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/languages/js/)
- [OpenPanel Documentation](https://docs.openpanel.dev/)
- [Consola Documentation](https://github.com/unjs/consola)
- Template docs: `docs/claude/LOGGING.md`

---

## Related Tickets

- None yet

---

## Comments

_Add implementation notes, blockers, or updates here as work progresses._
