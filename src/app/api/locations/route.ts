import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET() {
  return withAuth(async () => {
    const locations = await prisma.location.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(locations);
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const data = await request.json();
      const location = await prisma.location.create({
        data: {
          name: data.name,
          district: data.district,
          pincode: data.pincode,
          locality: data.locality,
        },
      });
      return NextResponse.json(location, { status: 201 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create location";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }, "admin");
}
