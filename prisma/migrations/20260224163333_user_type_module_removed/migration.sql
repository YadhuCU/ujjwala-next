/*
  Warnings:

  - You are about to drop the column `usertype_id` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the `user_types` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Owner', 'Office', 'Sales');

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_usertype_id_fkey";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "usertype_id",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'Sales';

-- DropTable
DROP TABLE "user_types";
