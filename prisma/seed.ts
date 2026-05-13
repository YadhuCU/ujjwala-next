import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@/generated/client";
import { PERMISSIONS } from "@/lib/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const permissions = Object.values(PERMISSIONS)

  // Creating permission table.
  for (let permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission },
      create: { code: permission },
      update: {}
    })
  }

  // Creating Role Table.
  const adminRole = await prisma.role.upsert({
    where: { name: "OWNER" },
    create: { name: "OWNER" },
    update: {}
  })


  const allPermissions = await prisma.permission.findMany()

  for (let p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          permissionId: p.id,
          roleId: adminRole.id
        }
      },
      create: {
        permissionId: p.id,
        roleId: adminRole.id
      },
      update: {}
    })
  }

  // Creating Admin User
  const hashedPassword = await bcrypt.hash("admin", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      name: "Admin",
      isActive: true,
      roleId: adminRole.id
    },
  });

  console.log("✅ Admin user created:", admin.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
