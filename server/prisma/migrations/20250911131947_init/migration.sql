/*
  Warnings:

  - You are about to drop the column `questions` on the `interviews` table. All the data in the column will be lost.
  - Added the required column `interviewId` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "questions";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "interviewId" TEXT NOT NULL,
ADD COLUMN     "number" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
