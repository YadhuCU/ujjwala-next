import { Permission } from "@/lib/permissions";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

// The client reads roles/permissions from here to decide what to render. It is
// a hint, refreshed on a timer — never the authorization decision itself, which
// `withAuth` makes server-side against a fresh database read.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: Permission[];
      isOwner: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    roles: string[];
    permissions: Permission[];
    isOwner: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    roles: string[];
    permissions: Permission[];
    isOwner: boolean;
    /** Epoch ms of the last refresh from the database. */
    rbacAt: number;
  }
}
