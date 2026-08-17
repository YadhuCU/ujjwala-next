import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import {
  CreateUserSchema,
  UserQuerySchema,
} from "@/module/user/user.payload.schema";
import * as UserService from "@/module/user/user.service";
import {
  serializeUser,
  serializeUsers,
} from "@/module/user/user.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = UserQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const { data, meta } = await UserService.getUsers(query);

    return formatResponse({ data: serializeUsers(data), meta });
  }, [PERMISSIONS.USER_READ]);
}

export async function POST(request: Request) {
  return withAuth(
    async () => {
      const data = CreateUserSchema.parse(await request.json());
      const user = await UserService.createUser(data);

      return formatResponse({
        data: serializeUser(user),
        status: 201,
        message: "User created successfully",
      });
    },
    [PERMISSIONS.USER_CREATE],
  );
}
