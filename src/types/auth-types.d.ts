import { Permission } from "@/lib/permissions";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: Permission[]
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
      roles: string[];
      permissions: Permission[]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    roles: string[];
    permissions: Permission[]
  }
}
