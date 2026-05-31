import { prisma } from '@/server/db/prisma'

let counter = 0

export async function createTestUser(balance = 0) {
  counter += 1

  return prisma.user.create({
    data: {
      username: `user-${process.pid}-${Date.now()}-${counter}`,
      balance
    }
  })
}

export async function createPlacedBet(userId: string, amount = 100, gameId = 'game-1') {
  const bet = await prisma.bet.create({
    data: {
      userId,
      gameId,
      amount,
      status: 'PLACED'
    }
  })

  await prisma.ledgerEntry.create({
    data: {
      userId,
      betId: bet.id,
      type: 'BET_DEBIT',
      amount: -amount
    }
  })

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      balance: {
        decrement: amount
      }
    }
  })

  return bet
}
