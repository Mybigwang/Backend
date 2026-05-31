import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import { reserveIdempotencyKey } from '@/server/services/idempotencyService'

export async function createUser(username: string) {
  try {
    return await prisma.user.create({
      data: {
        username
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Username already exists')
    }

    throw error
  }
}

export async function deposit(userId: string, amount: number, idempotencyKey: string) {
  // 开启数据库事务，确保充值、流水记录和幂等键保存要么全部成功，要么全部失败
  return prisma.$transaction(async (tx) => {
    // 1. 幂等性校验：同一用户的同一幂等键只能请求一次，重复时在底层抛出 409 Conflict
    await reserveIdempotencyKey(tx, `deposit:user:${userId}`, idempotencyKey)

    const user = await tx.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    // 2. 更新用户余额：原油余额增加充值金额
    const updatedUser = await tx.user.update({
      where: {
        id: userId
      },
      data: {
        balance: {
          increment: amount
        }
      }
    })

    // 3. 记录追加式账本：记录此笔充值流水 (类型为 DEPOSIT)
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount
      }
    })

    return {
      userId,
      balance: updatedUser.balance,
      ledgerEntryId: ledgerEntry.id
    }
  })
}
