import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin", 10);

  const admin = await prisma.account.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      name: "Admin",
      isActive: true,
      isSuperuser: true,
    },
  });

  console.log("✅ Admin user created:", admin.username);

  const staffPassword = await bcrypt.hash("staff", 10);

  const staff = await prisma.account.upsert({
    where: { username: "staff" },
    update: {},
    create: {
      username: "staff",
      password: staffPassword,
      name: "Staff User",
      isActive: true,
      isSuperuser: false,
    },
  });

  console.log("✅ Staff user created:", staff.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
