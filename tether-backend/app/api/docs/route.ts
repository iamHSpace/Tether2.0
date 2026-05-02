import { NextResponse } from "next/server";
import { getSwaggerSpec } from "@/lib/swagger";

/**
 * GET /api/docs
 *
 * Serves the OpenAPI 3.0.3 specification as JSON.
 * Consumed by the Swagger UI page at /docs.
 */
export async function GET() {
  const spec = getSwaggerSpec();
  return NextResponse.json(spec);
}
