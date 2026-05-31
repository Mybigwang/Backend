import { Bet, LedgerEntry } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { NotFoundError } from '@/server/domain/errors'

type ReconcileIssue = {
  code: string
  betId?: string
  message: string
}

export async function reconcileUser(userId: string) {
  // 查找用户当前存储余额
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    }
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  // 并发拉取该用户的所有下注记录和全部资金流水（不分页，仅为简单全量对账示例）
  const [bets, ledgerEntries] = await Promise.all([
    prisma.bet.findMany({
      where: {
        userId
      }
    }),
    prisma.ledgerEntry.findMany({
      where: {
        userId
      }
    })
  ])

  // 计算账本累计值：历史所有正负流水相加
  const ledgerBalance = ledgerEntries.reduce((total, entry) => total + entry.amount, 0)
  
  // 组装异常记录数组：
  // 1. 检查物理余额是否和流水逻辑余额匹配
  // 2. 对每个 bet，单独检验它状态与关联流水的合法性
  const issues = [
    ...checkBalance(user.balance, ledgerBalance),
    ...bets.flatMap((bet) => checkBetLedger(bet, ledgerEntries.filter((entry) => entry.betId === bet.id)))
  ]

  return {
    userId,
    storedBalance: user.balance,
    ledgerBalance,
    balanceMatches: user.balance === ledgerBalance,
    isConsistent: issues.length === 0,
    issues,
    summary: {
      deposits: sumByType(ledgerEntries, 'DEPOSIT'),
      betDebits: sumByType(ledgerEntries, 'BET_DEBIT'),
      betCredits: sumByType(ledgerEntries, 'BET_CREDIT'),
      betRefunds: sumByType(ledgerEntries, 'BET_REFUND'),
      ledgerEntryCount: ledgerEntries.length,
      betCount: bets.length
    }
  }
}

function checkBalance(storedBalance: number, ledgerBalance: number): ReconcileIssue[] {
  if (storedBalance === ledgerBalance) {
    return []
  }

  return [
    {
      code: 'BALANCE_MISMATCH',
      message: `Stored balance ${storedBalance} does not match ledger balance ${ledgerBalance}`
    }
  ]
}

function checkBetLedger(bet: Bet, entries: LedgerEntry[]): ReconcileIssue[] {
  const debitCount = countByType(entries, 'BET_DEBIT')
  const creditCount = countByType(entries, 'BET_CREDIT')
  const refundCount = countByType(entries, 'BET_REFUND')
  const issues: ReconcileIssue[] = []

  if (debitCount !== 1) {
    issues.push({
      code: 'INVALID_BET_DEBIT_COUNT',
      betId: bet.id,
      message: `Bet must have exactly one BET_DEBIT entry, found ${debitCount}`
    })
  }

  if (bet.status === 'PLACED') {
    if (creditCount > 0 || refundCount > 0 || bet.result || bet.settledAt || bet.cancelledAt) {
      issues.push({
        code: 'INVALID_PLACED_BET_LEDGER',
        betId: bet.id,
        message: 'PLACED bet must not have settlement, refund, result, or terminal timestamps'
      })
    }
  }

  if (bet.status === 'SETTLED') {
    if (!bet.result || !bet.settledAt || bet.cancelledAt) {
      issues.push({
        code: 'INVALID_SETTLED_BET_STATE',
        betId: bet.id,
        message: 'SETTLED bet must have result and settledAt only'
      })
    }

    if (bet.result === 'WIN' && creditCount !== 1) {
      issues.push({
        code: 'INVALID_WIN_CREDIT_COUNT',
        betId: bet.id,
        message: `Winning bet must have exactly one BET_CREDIT entry, found ${creditCount}`
      })
    }

    if (bet.result === 'LOSE' && creditCount !== 0) {
      issues.push({
        code: 'LOSE_BET_HAS_CREDIT',
        betId: bet.id,
        message: 'Losing bet must not have BET_CREDIT entries'
      })
    }

    if (refundCount !== 0) {
      issues.push({
        code: 'SETTLED_BET_HAS_REFUND',
        betId: bet.id,
        message: 'Settled bet must not have BET_REFUND entries'
      })
    }
  }

  if (bet.status === 'CANCELLED') {
    if (bet.result || bet.settledAt || !bet.cancelledAt) {
      issues.push({
        code: 'INVALID_CANCELLED_BET_STATE',
        betId: bet.id,
        message: 'CANCELLED bet must have cancelledAt and no result or settledAt'
      })
    }

    if (refundCount !== 1) {
      issues.push({
        code: 'INVALID_REFUND_COUNT',
        betId: bet.id,
        message: `Cancelled bet must have exactly one BET_REFUND entry, found ${refundCount}`
      })
    }

    if (creditCount !== 0) {
      issues.push({
        code: 'CANCELLED_BET_HAS_CREDIT',
        betId: bet.id,
        message: 'Cancelled bet must not have BET_CREDIT entries'
      })
    }
  }

  return issues
}

function countByType(entries: LedgerEntry[], type: LedgerEntry['type']) {
  return entries.filter((entry) => entry.type === type).length
}

function sumByType(entries: LedgerEntry[], type: LedgerEntry['type']) {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + entry.amount, 0)
}
