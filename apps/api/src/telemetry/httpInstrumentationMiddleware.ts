import type { Span, TimeInput } from "@opentelemetry/api";
import {
  context as otelContext,
  metrics,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  ValueType,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_FULL,
} from "@opentelemetry/semantic-conventions";
import {
  METRIC_HTTP_SERVER_ACTIVE_REQUESTS,
  METRIC_HTTP_SERVER_REQUEST_DURATION,
} from "@opentelemetry/semantic-conventions/incubating";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";

export type HttpInstrumentationConfig = {
  captureRequestHeaders?: string[];
  captureResponseHeaders?: string[];
  getTime?(): TimeInput;
  disableLogging?: boolean;
  disableTracing?: boolean;
};

export type NormalizedHttpInstrumentationConfig = Omit<
  HttpInstrumentationConfig,
  "captureRequestHeaders" | "captureResponseHeaders"
> & {
  readonly requestHeaderSet: ReadonlySet<string>;
  readonly responseHeaderSet: ReadonlySet<string>;
  readonly captureRequestHeaders?: readonly string[];
  readonly captureResponseHeaders?: readonly string[];
};

const normalizeConfig = (
  config?: HttpInstrumentationConfig,
): NormalizedHttpInstrumentationConfig => {
  const reqHeadersSrc = [...(config?.captureRequestHeaders ?? [])];
  const resHeadersSrc = [...(config?.captureResponseHeaders ?? [])];
  const requestHeaderSet = new Set(reqHeadersSrc.map((h) => h.toLowerCase()));
  const responseHeaderSet = new Set(resHeadersSrc.map((h) => h.toLowerCase()));
  return {
    ...config,
    requestHeaderSet,
    responseHeaderSet,
    captureRequestHeaders: reqHeadersSrc,
    captureResponseHeaders: resHeadersSrc,
  };
};

export const httpInstrumentationMiddleware = (
  userConfig: HttpInstrumentationConfig = {
    captureRequestHeaders: [],
    captureResponseHeaders: [],
    disableTracing: false,
  },
): MiddlewareHandler => {
  const config = normalizeConfig(userConfig);

  const tracer = config.disableTracing ? undefined : trace.getTracer("http");

  const spanName = (c: Context) => `${c.req.method} ${routePath(c)}`;

  const activeReqsCounter = metrics
    .getMeter("http")
    .createUpDownCounter(METRIC_HTTP_SERVER_ACTIVE_REQUESTS, {
      description: "Number of active (in-flight) HTTP server requests",
      valueType: ValueType.INT,
    });

  const requestDurationHistogram = metrics
    .getMeter("http")
    .createHistogram(METRIC_HTTP_SERVER_REQUEST_DURATION, {
      description: "Duration of HTTP requests in seconds",
      unit: "s",
      valueType: ValueType.DOUBLE,
    });

  return createMiddleware(async (c, next) => {
    const parent = propagation.extract(otelContext.active(), c.req.header());

    activeReqsCounter.add(1);
    const monotonicStartTime = performance.now();

    const deferredRequestHeaderAttributes: Record<string, string> = {};
    const reqHeaders = c.req.header();
    for (const [rawName, value] of Object.entries(reqHeaders)) {
      const name = rawName.toLowerCase();
      if (config.requestHeaderSet.has(name)) {
        deferredRequestHeaderAttributes[ATTR_HTTP_REQUEST_HEADER(name)] = value;
      }
    }

    const finalize = (span: Span | undefined, error: unknown) => {
      try {
        const status = c.res.status;

        if (span) {
          const captureResp = config.responseHeaderSet;
          for (const [name, value] of c.res.headers.entries()) {
            const lower = name.toLowerCase();
            if (captureResp.has(lower)) {
              span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(lower), value);
            }
          }

          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
          if (status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }

          if (error) {
            try {
              span.recordException(error as Error);
            } catch {
              // Ignore errors when recording exception
            }
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
        }
      } finally {
        activeReqsCounter.add(-1);
        // Update route and name since they may have changed after routing finished
        span?.setAttribute(ATTR_HTTP_ROUTE, routePath(c));

        span?.updateName(spanName(c));
        requestDurationHistogram.record(
          performance.now() - monotonicStartTime,
          {
            [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
            [ATTR_HTTP_ROUTE]: routePath(c),
            [ATTR_HTTP_RESPONSE_STATUS_CODE]: c.res.status,
          },
        );
      }
    };

    if (!tracer) {
      try {
        await next();
        finalize(undefined, undefined);
      } catch (e) {
        finalize(undefined, e);
        throw e;
      }
      return;
    }

    return tracer.startActiveSpan(
      spanName(c),
      {
        kind: SpanKind.SERVER,
        startTime: config.getTime?.(),
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR_URL_FULL]: c.req.url,
          [ATTR_HTTP_ROUTE]: routePath(c),
        },
      },
      parent,
      async (span) => {
        try {
          for (const [k, v] of Object.entries(
            deferredRequestHeaderAttributes,
          )) {
            span.setAttribute(k, v);
          }
          await next();
          finalize(span, c.error);
        } catch (error) {
          finalize(span, error);
          throw error;
        } finally {
          span.end(config.getTime?.());
        }
      },
    );
  });
};
