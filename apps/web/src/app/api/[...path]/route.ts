import { NextRequest, NextResponse } from "next/server";
const API_ORIGIN = process.env.QUANTUMFX_API_URL ?? "http://127.0.0.1:8000";
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  const target = new URL("/api/" + params.path.join("/"), API_ORIGIN);
  target.search = request.nextUrl.search;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  try {
    const response = await fetch(target, init);
    const body = await response.text();
    return new NextResponse(body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ detail: "QuantumFX API is not reachable. Start FastAPI on port 8000." }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
