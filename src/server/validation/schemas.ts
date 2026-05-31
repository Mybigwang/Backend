import { z } from 'zod'

const positiveAmount = z.number().int().positive()
const id = z.string().trim().min(1).max(128)
const username = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)
const gameId = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)

export const createUserSchema = z.object({
  username
})

export const depositSchema = z.object({
  amount: positiveAmount
})

export const placeBetSchema = z.object({
  userId: id,
  gameId,
  amount: positiveAmount
})

export const settleBetSchema = z.object({
  result: z.enum(['WIN', 'LOSE'])
})

export const routeIdSchema = z.object({
  id
})

export const reconcileQuerySchema = z.object({
  userId: id
})
