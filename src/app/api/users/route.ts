import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import { BadRequestError } from "@/lib/errors";

export async function GET() {
  return withAuth(async () => {
    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
    const safeUsers = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, userRoles, ...rest } = user;
      return {
        ...rest,
        userRoles: userRoles.map((x) => ({ id: x.role.id, name: x.role.name })),
      };
    });
    return formatResponse({ data: safeUsers });
  }, [PERMISSIONS.USER_READ]);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const data = await request.json();

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const currentUserRoles: number[] = data.userRoles || [];

    // Validate UserRoles
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

    // Transaction.
    const user = await prisma.$transaction(async (tx) => {
      // Create User
      const createdUser = await tx.user.create({
        data: {
          username: data.username,
          name: data.name,
          password: hashedPassword,
          email: data.email,
          mobile: data.mobile,
        },
      });

      // Create User Roles
      if (currentUserRoles.length > 0) {
        await tx.userRole.createMany({
          data: currentUserRoles.map((roleId) => ({
            userId: createdUser.id,
            roleId,
          })),
          skipDuplicates: true,
        });
      }

      return createdUser;
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return formatResponse({ data: safeUser, status: 201 });
  }, [PERMISSIONS.USER_CREATE]);
}
