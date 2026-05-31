import { Prisma, PrismaClient } from '@prisma/client'
import { ConflictError } from '@/server/domain/errors'

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export async function reserveIdempotencyKey(tx: TransactionClient, scope: string, key: string) {
  try {
    return await tx.idempotencyKey.create({
      data: {
        key,
        scope
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Duplicate Idempotency-Key')
    }

    throw error
  }
}
