import { describe, expect, test } from 'vitest'
import { prisma } from '@/server/db/prisma'
import { InvalidStateTransitionError, NotFoundError } from '@/server/domain/errors'
import { cancelBet, settleBet } from '@/server/services/betService'
import { createPlacedBet, createTestUser } from './helpers/fixtures'
import { useCleanDatabase } from './helpers/db'

useCleanDatabase()

describe('settleBet', () => {
  test('settles winning bet and credits balance', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    const result = await settleBet(bet.id, 'WIN')

    const credit = await prisma.ledgerEntry.findFirstOrThrow({ where: { betId: bet.id, type: 'BET_CREDIT' } })
    expect(result.bet.status).toBe('SETTLED')
    expect(result.bet.result).toBe('WIN')
    expect(result.balance).toBe(1000)
    expect(credit.amount).toBe(300)
  })

  test('settles losing bet without crediting balance', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    const result = await settleBet(bet.id, 'LOSE')

    expect(result.bet.status).toBe('SETTLED')
    expect(result.bet.result).toBe('LOSE')
    expect(result.balance).toBe(700)
    expect(await prisma.ledgerEntry.count({ where: { betId: bet.id, type: 'BET_CREDIT' } })).toBe(0)
  })

  test('rejects already settled bet', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    await settleBet(bet.id, 'WIN')

    await expect(settleBet(bet.id, 'LOSE')).rejects.toBeInstanceOf(InvalidStateTransitionError)
  })

  test('rejects cancelled bet', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    await cancelBet(bet.id)

    await expect(settleBet(bet.id, 'WIN')).rejects.toBeInstanceOf(InvalidStateTransitionError)
  })

  test('rejects unknown bet', async () => {
    await expect(settleBet('missing-bet', 'WIN')).rejects.toBeInstanceOf(NotFoundError)
  })
})
