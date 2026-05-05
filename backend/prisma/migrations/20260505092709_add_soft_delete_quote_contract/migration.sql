-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "deletedAt" TIMESTAMP(3);
