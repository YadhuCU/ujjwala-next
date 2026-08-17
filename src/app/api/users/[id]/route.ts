import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  SetUserActiveSchema,
  UpdateUserSchema,
} from "@/module/user/user.payload.schema";
import * as UserService from "@/module/user/user.service";
import { serializeUser } from "@/module/user/user.serializer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  return withAuth(async () => {
    const { id } = await params;
    const user = await UserService.getUserById(Number(id));
    return formatResponse({ data: serializeUser(user) });
  }, [PERMISSIONS.USER_READ]);
}

export async function PUT(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ userId, isOwner, name }) => {
      const { id } = await params;
      const data = UpdateUserSchema.parse(await req.json());

      const user = await UserService.updateUser(Number(id), data, {
        userId,
        isOwner,
        name,
      });

      return formatResponse({
        data: serializeUser(user),
        message: "User updated successfully",
      });
    },
    [PERMISSIONS.USER_UPDATE],
  );
}

// Activate / deactivate — a login switch, not a delete.
export async function PATCH(req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: actorId }) => {
      const { id } = await params;
      const { isActive } = SetUserActiveSchema.parse(await req.json());

      const user = await UserService.setUserActive(
        Number(id),
        isActive,
        Number(actorId),
      );

      return formatResponse({
        data: serializeUser(user),
        message: isActive ? "User activated" : "User deactivated",
      });
    },
    [PERMISSIONS.USER_UPDATE],
  );
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  return withAuth(
    async ({ id: actorId }) => {
      const { id } = await params;

      await UserService.deleteUser(Number(id), Number(actorId));

      return formatResponse({
        data: null,
        message: "User deleted successfully",
      });
    },
    [PERMISSIONS.USER_DELETE],
  );
}
