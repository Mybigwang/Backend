import { describe, expect, test } from 'vitest'
import { prisma } from '@/server/db/prisma'
import { ConflictError, InsufficientBalanceError, NotFoundError } from '@/server/domain/errors'
import { placeBet } from '@/server/services/betService'
import { createTestUser } from './helpers/fixtures'
import { useCleanDatabase } from './helpers/db'

useCleanDatabase()

describe('placeBet', () => {
  test('creates placed bet, debits balance, and appends ledger entry', async () => {
    const user = await createTestUser(1000)

    const result = await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'bet-1' })

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    const ledgerEntry = await prisma.ledgerEntry.findFirstOrThrow({ where: { betId: result.bet.id } })
    expect(result.bet).toMatchObject({ userId: user.id, gameId: 'game-1', amount: 300, status: 'PLACED' })
    expect(result.balance).toBe(700)
    expect(updatedUser.balance).toBe(700)
    expect(ledgerEntry).toMatchObject({ type: 'BET_DEBIT', amount: -300 })
  })

  test('rejects insufficient balance without creating bet or ledger', async () => {
    const user = await createTestUser(100)

    await expect(
      placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'bet-poor' })
    ).rejects.toBeInstanceOf(InsufficientBalanceError)

    expect(await prisma.bet.count()).toBe(0)
    expect(await prisma.ledgerEntry.count()).toBe(0)
  })

  test('rejects duplicate idempotency key without double debiting', async () => {
    const user = await createTestUser(1000)

    await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'bet-duplicate' })

    await expect(
      placeBet({ userId: user.id, gameId: 'game-2', amount: 300, idempotencyKey: 'bet-duplicate' })
    ).rejects.toBeInstanceOf(ConflictError)

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(updatedUser.balance).toBe(700)
    expect(await prisma.bet.count()).toBe(1)
    expect(await prisma.ledgerEntry.count()).toBe(1)
  })

  test('rejects unknown user', async () => {
    await expect(
      placeBet({ userId: 'missing-user', gameId: 'game-1', amount: 100, idempotencyKey: 'bet-missing' })
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
