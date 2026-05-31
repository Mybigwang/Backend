import { describe, expect, test } from 'vitest'
import { prisma } from '@/server/db/prisma'
import { placeBet, settleBet, cancelBet } from '@/server/services/betService'
import { deposit } from '@/server/services/userService'
import { reconcileUser } from '@/server/services/reconcileService'
import { createPlacedBet, createTestUser } from './helpers/fixtures'
import { useCleanDatabase } from './helpers/db'

useCleanDatabase()

describe('reconcileUser', () => {
  test('reports deposited account as consistent', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-deposit')

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(true)
    expect(report.storedBalance).toBe(1000)
    expect(report.ledgerBalance).toBe(1000)
    expect(report.issues).toEqual([])
  })

  test('reports placed bet as consistent', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-place-deposit')
    await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'reconcile-place-bet' })

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(true)
    expect(report.storedBalance).toBe(700)
    expect(report.ledgerBalance).toBe(700)
  })

  test('reports winning settled bet as consistent', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-win-deposit')
    const { bet } = await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'reconcile-win-bet' })
    await settleBet(bet.id, 'WIN')

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(true)
    expect(report.storedBalance).toBe(1000)
  })

  test('reports losing settled bet as consistent', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-lose-deposit')
    const { bet } = await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'reconcile-lose-bet' })
    await settleBet(bet.id, 'LOSE')

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(true)
    expect(report.storedBalance).toBe(700)
  })

  test('reports cancelled bet as consistent', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-cancel-deposit')
    const { bet } = await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'reconcile-cancel-bet' })
    await cancelBet(bet.id)

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(true)
    expect(report.storedBalance).toBe(1000)
  })

  test('detects corrupted balance', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-corrupt-deposit')
    await prisma.user.update({ where: { id: user.id }, data: { balance: 1 } })

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toContain('BALANCE_MISMATCH')
  })

  test('detects missing bet debit', async () => {
    const user = await createTestUser(1000)
    const bet = await createPlacedBet(user.id, 300)
    await prisma.ledgerEntry.deleteMany({ where: { betId: bet.id, type: 'BET_DEBIT' } })

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toContain('INVALID_BET_DEBIT_COUNT')
  })

  test('detects duplicate refund', async () => {
    const user = await createTestUser()
    await deposit(user.id, 1000, 'reconcile-refund-deposit')
    const { bet } = await placeBet({ userId: user.id, gameId: 'game-1', amount: 300, idempotencyKey: 'reconcile-refund-bet' })
    await cancelBet(bet.id)
    await prisma.ledgerEntry.create({ data: { userId: user.id, betId: bet.id, type: 'BET_REFUND', amount: 300 } })

    const report = await reconcileUser(user.id)

    expect(report.isConsistent).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toContain('INVALID_REFUND_COUNT')
  })
})
