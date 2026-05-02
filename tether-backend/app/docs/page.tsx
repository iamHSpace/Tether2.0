"use client";

/**
 * /docs — Swagger UI
 *
 * Renders an interactive API explorer powered by Swagger UI (loaded from CDN).
 * The spec is fetched at runtime from GET /api/docs so it always reflects the
 * current server-side environment (base URL, etc.).
 *
 * No npm packages required — Swagger UI is loaded from unpkg CDN.
 */

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    // Dynamically inject Swagger UI CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css";
    document.head.appendChild(link);

    // Dynamically inject Swagger UI JS bundle
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      // @ts-expect-error — SwaggerUIBundle is loaded from CDN, not typed
      const ui = window.SwaggerUIBundle({
        url: "/api/docs",
        dom_id: "#swagger-ui",
        presets: [
          // @ts-expect-error — CDN global
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error — CDN global
          window.SwaggerUIStandalonePreset,
        ],
        layout: "StandaloneLayout",
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        requestInterceptor: (request: { credentials: string }) => {
          // Include cookies so authenticated endpoints work from the browser
          request.credentials = "include";
          return request;
        },
      });
      // @ts-expect-error — attach to window for debugging
      window.ui = ui;
    };
    document.body.appendChild(script);

    // Also inject the standalone preset
    const presetScript = document.createElement("script");
    presetScript.src =
      "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js";
    presetScript.crossOrigin = "anonymous";
    document.body.appendChild(presetScript);

    return () => {
      // Cleanup on unmount
      document.head.removeChild(link);
      document.body.removeChild(script);
      document.body.removeChild(presetScript);
    };
  }, []);

  return (
    <>
      {/* Page header */}
      <div
        style={{
          background: "#1a1a2e",
          borderBottom: "1px solid #16213e",
          padding: "0.85rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              fontFamily: "sans-serif",
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "#e2e8f0",
              letterSpacing: "-0.01em",
            }}
          >
            Tether 2.0
          </span>
          <span
            style={{
              fontFamily: "sans-serif",
              fontSize: "0.8rem",
              color: "#718096",
              borderLeft: "1px solid #2d3748",
              paddingLeft: "1rem",
            }}
          >
            API Documentation
          </span>
        </div>
        <a
          href="/"
          style={{
            fontFamily: "sans-serif",
            fontSize: "0.85rem",
            color: "#90cdf4",
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </a>
      </div>

      {/* Swagger UI mounts here */}
      <div id="swagger-ui" />

      {/* Override Swagger UI styles to match our dark header */}
      <style>{`
        body {
          margin: 0;
          background: #fff;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info .title {
          font-size: 2rem;
        }
        .swagger-ui .scheme-container {
          background: #f7fafc;
          box-shadow: none;
          border-bottom: 1px solid #e2e8f0;
        }
        .swagger-ui .opblock-tag {
          font-size: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #3182ce;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #38a169;
        }
      `}</style>
    </>
  );
}
