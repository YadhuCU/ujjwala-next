import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { formatResponse } from "@/lib/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, userRoles, ...safeUser } = user;
    const roles = userRoles.map((x) => ({ id: x.role.id, name: x.role.name }));

    return formatResponse({ data: { ...safeUser, userRoles: roles } });
  }, [PERMISSIONS.USER_READ]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const userId = parseInt(id);

    const data = await request.json();

    const currentUserRoles: number[] = data.userRoles || [];

    // 1. Validate Roles.
    if (currentUserRoles.length > 0) {
      const roles = await prisma.role.findMany({
        where: {
          id: {
            in: currentUserRoles,
          },
        },
      });

      if (roles.length !== currentUserRoles.length) {
        throw new BadRequestError("Invalid role(s) provided");
      }
    }

    // Transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update User
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile,

          ...(data.password && {
            password: await bcrypt.hash(data.password, 10),
          }),
        },
      });

      // Replace Roles

      // remove old roles.
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Insert new Role
      if (currentUserRoles.length > 0) {
        await tx.userRole.createMany({
          data: currentUserRoles.map((roleId) => ({
            userId,
            roleId,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = updatedUser;
    return formatResponse({ data: safeUser, message: "" });
  }, [PERMISSIONS.USER_UPDATE]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });
    return formatResponse({ data: null });
  }, [PERMISSIONS.USER_DELETE]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await params;
    const data = await request.json();

    if (typeof data.isActive === "boolean") {
      await prisma.user.update({
        where: { id: parseInt(id) },
        data: { isActive: data.isActive },
      });
    }

    return formatResponse({ data: null });
  }, [PERMISSIONS.USER_UPDATE]);
}
