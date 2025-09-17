/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `interviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `interviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `interviews` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."interviews" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "interviews_code_key" ON "public"."interviews"("code");
