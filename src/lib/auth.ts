import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { Permission } from "./permissions";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials.username as string;
        const password = credentials.password as string;

        if (!username || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            username: username,
            isDeleted: false,
          },
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: {
                          select: {
                            code: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
          }
        });


        if (!user || !user.isActive) return null;

        const roles = user.userRoles.map(x => x.role.name)
        const permissions = user.userRoles.map(x => x.role.rolePermissions.map(x => x.permission.code)).flat() as Permission[]

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          image: null,
          roles,
          permissions
        };
      },
    }),
  ],
});
