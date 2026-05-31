import { describe, expect, test } from 'vitest'
import { prisma } from '@/server/db/prisma'
import { InvalidStateTransitionError, NotFoundError } from '@/server/domain/errors'
import { cancelBet, settleBet } from '@/server/services/betService'
import { createPlacedBet, createTestUser } from './helpers/fixtures'
import { useCleanDatabase } from './helpers/db'

useCleanDatabase()

describe('cancelBet', () => {
  test('cancels placed bet, refunds balance, and appends ledger entry', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    const result = await cancelBet(bet.id)

    const refund = await prisma.ledgerEntry.findFirstOrThrow({ where: { betId: bet.id, type: 'BET_REFUND' } })
    expect(result.bet.status).toBe('CANCELLED')
    expect(result.balance).toBe(1000)
    expect(refund.amount).toBe(300)
  })

  test('rejects settled bet', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    await settleBet(bet.id, 'LOSE')

    await expect(cancelBet(bet.id)).rejects.toBeInstanceOf(InvalidStateTransitionError)
  })

  test('rejects already cancelled bet', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)

    await cancelBet(bet.id)

    await expect(cancelBet(bet.id)).rejects.toBeInstanceOf(InvalidStateTransitionError)
  })

  test('rejects unknown bet', async () => {
    await expect(cancelBet('missing-bet')).rejects.toBeInstanceOf(NotFoundError)
  })
})
