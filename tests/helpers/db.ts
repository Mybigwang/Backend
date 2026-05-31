import { beforeEach, afterAll } from 'vitest'
import { prisma } from '@/server/db/prisma'

export function useCleanDatabase() {
  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany()
    await prisma.ledgerEntry.deleteMany()
    await prisma.bet.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
}
