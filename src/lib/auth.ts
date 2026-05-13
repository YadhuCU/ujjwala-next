import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: {
            username: credentials.username as string,
            isDeleted: false,
          },
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
        });


        console.log({ user, permissions: user?.role.rolePermissions })

        if (!user || !user.isActive) return null;

        const permissions = user.role.rolePermissions.map(x => x.permission.code)

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          image: null,
          role: user.role.name,
          permissions
        };
      },
    }),
  ],
});
