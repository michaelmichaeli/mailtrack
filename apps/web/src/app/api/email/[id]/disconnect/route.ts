import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = request.headers.get("authorization");

  const res = await fetch(`${API_BASE}/api/email/${id}`, {
    method: "DELETE",
    headers: auth ? { Authorization: auth } : {},
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
