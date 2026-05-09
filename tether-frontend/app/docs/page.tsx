"use client";

import { useEffect } from "react";

const SPEC_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://statvora-backend.vercel.app"}/api/docs`;

export default function DocsPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css";
    document.head.appendChild(link);

    const presetScript = document.createElement("script");
    presetScript.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js";
    presetScript.crossOrigin = "anonymous";
    document.body.appendChild(presetScript);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      // @ts-expect-error — SwaggerUIBundle loaded from CDN
      const ui = window.SwaggerUIBundle({
        url: SPEC_URL,
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
          request.credentials = "include";
          return request;
        },
      });
      // @ts-expect-error — attach to window for debugging
      window.ui = ui;
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
      document.body.removeChild(presetScript);
    };
  }, []);

  return (
    <>
      <div style={{ background: "#1a1a2e", borderBottom: "1px solid #16213e", padding: "0.85rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#e2e8f0", letterSpacing: "-0.01em" }}>Statvora</span>
          <span style={{ fontFamily: "sans-serif", fontSize: "0.8rem", color: "#718096", borderLeft: "1px solid #2d3748", paddingLeft: "1rem" }}>API Documentation</span>
        </div>
        <a href="/" style={{ fontFamily: "sans-serif", fontSize: "0.85rem", color: "#90cdf4", textDecoration: "none" }}>← Back</a>
      </div>
      <div id="swagger-ui" />
      <style>{`
        body { margin: 0; background: #fff; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { font-size: 2rem; }
        .swagger-ui .scheme-container { background: #f7fafc; box-shadow: none; border-bottom: 1px solid #e2e8f0; }
        .swagger-ui .opblock-tag { font-size: 1rem; border-bottom: 1px solid #e2e8f0; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #3182ce; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #38a169; }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #d69e2e; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #e53e3e; }
      `}</style>
    </>
  );
}
