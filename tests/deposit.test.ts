import { describe, expect, test } from 'vitest'
import { prisma } from '@/server/db/prisma'
import { ConflictError, NotFoundError } from '@/server/domain/errors'
import { deposit } from '@/server/services/userService'
import { createTestUser } from './helpers/fixtures'
import { useCleanDatabase } from './helpers/db'

useCleanDatabase()

describe('deposit', () => {
  test('increases balance and creates deposit ledger entry', async () => {
    const user = await createTestUser()

    const result = await deposit(user.id, 500, 'deposit-1')

    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { userId: user.id } })
    expect(result.balance).toBe(500)
    expect(ledgerEntries).toHaveLength(1)
    expect(ledgerEntries[0]).toMatchObject({ type: 'DEPOSIT', amount: 500 })
  })

  test('rejects duplicate idempotency key without double crediting', async () => {
    const user = await createTestUser()

    await deposit(user.id, 500, 'deposit-duplicate')

    await expect(deposit(user.id, 500, 'deposit-duplicate')).rejects.toBeInstanceOf(ConflictError)

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    const ledgerCount = await prisma.ledgerEntry.count({ where: { userId: user.id } })
    expect(updatedUser.balance).toBe(500)
    expect(ledgerCount).toBe(1)
  })

  test('rejects unknown user', async () => {
    await expect(deposit('missing-user', 100, 'deposit-missing')).rejects.toBeInstanceOf(NotFoundError)
  })
})
