import { prisma } from '@/server/db/prisma'
import {
  InsufficientBalanceError,
  InvalidStateTransitionError,
  NotFoundError
} from '@/server/domain/errors'
import { reserveIdempotencyKey } from '@/server/services/idempotencyService'

export async function placeBet(input: {
  userId: string
  gameId: string
  amount: number
  idempotencyKey: string
}) {
  // 开启事务，保证下注行为的原子性
  return prisma.$transaction(async (tx) => {
    // 1. 幂等控制：同一笔下注请求幂等拦截
    await reserveIdempotencyKey(tx, 'bet:create', input.idempotencyKey)

    const user = await tx.user.findUnique({
      where: {
        id: input.userId
      }
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    // 2. 扣减余额（核心安全控制）：
    // 通过 gte (大于等于) 的查询条件来实现乐观悲观锁结合，防止高并发下余额扣为负数
    const debitResult = await tx.user.updateMany({
      where: {
        id: input.userId,
        balance: {
          gte: input.amount
        }
      },
      data: {
        balance: {
          decrement: input.amount
        }
      }
    })

    // 如果 count 为 0，说明由于 gte 条件不满足未能更新，即抛出余额不足异常
    if (debitResult.count !== 1) {
      throw new InsufficientBalanceError()
    }

    // 3. 创建下注订单，初始状态为 PLACED
    const bet = await tx.bet.create({
      data: {
        userId: input.userId,
        gameId: input.gameId,
        amount: input.amount,
        status: 'PLACED'
      }
    })

    // 4. 追加流水至账本系统（金额为负数，代表账户扣款）
    await tx.ledgerEntry.create({
      data: {
        userId: input.userId,
        betId: bet.id,
        type: 'BET_DEBIT',
        amount: -input.amount
      }
    })

    const updatedUser = await tx.user.findUniqueOrThrow({
      where: {
        id: input.userId
      }
    })

    return {
      bet,
      balance: updatedUser.balance
    }
  })
}

export async function settleBet(betId: string, result: 'WIN' | 'LOSE') {
  // 开启结算事务
  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({
      where: {
        id: betId
      }
    })

    if (!bet) {
      throw new NotFoundError('Bet not found')
    }

    // 状态守卫：仅允许从 PLACED 状态进行流转
    if (bet.status !== 'PLACED') {
      throw new InvalidStateTransitionError('Only PLACED bets can be settled')
    }

    // 更新订单状态：使用 updateMany 额外增加 status: 'PLACED' 条件
    // 用于防止并发情况下多次结算同一订单
    const transition = await tx.bet.updateMany({
      where: {
        id: bet.id,
        status: 'PLACED'
      },
      data: {
        status: 'SETTLED',
        result,
        settledAt: new Date()
      }
    })

    // 防并发二次校验
    if (transition.count !== 1) {
      throw new InvalidStateTransitionError('Only PLACED bets can be settled')
    }

    let balance = await getUserBalance(tx, bet.userId)

    // 仅在胜利的情况下返还本金+利润
    if (result === 'WIN') {
      const updatedUser = await tx.user.update({
        where: {
          id: bet.userId
        },
        data: {
          balance: {
            increment: bet.amount
          }
        }
      })

      await tx.ledgerEntry.create({
        data: {
          userId: bet.userId,
          betId: bet.id,
          type: 'BET_CREDIT',
          amount: bet.amount
        }
      })

      balance = updatedUser.balance
    }

    const settledBet = await tx.bet.findUniqueOrThrow({
      where: {
        id: bet.id
      }
    })

    return {
      bet: settledBet,
      balance
    }
  })
}

export async function cancelBet(betId: string) {
  // 开启取消/退款事务
  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({
      where: {
        id: betId
      }
    })

    if (!bet) {
      throw new NotFoundError('Bet not found')
    }

    // 状态守卫：仅允许从 PLACED 状态取消
    if (bet.status !== 'PLACED') {
      throw new InvalidStateTransitionError('Only PLACED bets can be cancelled')
    }

    // 原子操作更新状态，防止死锁或并发错误流转
    const transition = await tx.bet.updateMany({
      where: {
        id: bet.id,
        status: 'PLACED'
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    })

    if (transition.count !== 1) {
      throw new InvalidStateTransitionError('Only PLACED bets can be cancelled')
    }

    // 执行退款：余额增补回用户的账户
    const updatedUser = await tx.user.update({
      where: {
        id: bet.userId
      },
      data: {
        balance: {
          increment: bet.amount
        }
      }
    })

    // 追加退款流水
    await tx.ledgerEntry.create({
      data: {
        userId: bet.userId,
        betId: bet.id,
        type: 'BET_REFUND',
        amount: bet.amount
      }
    })

    const cancelledBet = await tx.bet.findUniqueOrThrow({
      where: {
        id: bet.id
      }
    })

    return {
      bet: cancelledBet,
      balance: updatedUser.balance
    }
  })
}

async function getUserBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string
) {
  const user = await tx.user.findUniqueOrThrow({
    where: {
      id: userId
    }
  })

  return user.balance
}
