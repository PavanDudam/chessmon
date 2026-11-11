import type { MoveReview } from '../types'

export type ChapterKind = 'opening' | 'swing' | 'phase' | 'conversion'

export type Chapter = {
  startPly: number
  endPly: number
  title: string
  swing: number
  kind: ChapterKind
}

type PlyPoint = { i: number; win: number; cls: string; isBook: boolean; white: boolean }

function winAt(move: MoveReview): number {
  if (move.win_pct_after != null) return move.win_pct_after
  if (move.mate_after != null) return move.mate_after > 0 ? 99 : 1
  if (move.cp_after != null) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * move.cp_after)) - 1)
  }
  return 50
}

function nameSwing(prev: PlyPoint | undefined, cur: PlyPoint, whiteName: string, blackName: string): string {
  const player = cur.white ? whiteName : blackName
  if (cur.cls === 'Blunder') return `${player} drops the centre`
  if (prev && Math.sign(prev.win - 50) !== Math.sign(cur.win - 50) && Math.abs(cur.win - 50) > 5) {
    return 'The lead changes hands'
  }
  if (Math.abs(cur.win - 50) > 45) return 'Mate pressure on the board'
  if (Math.abs(cur.win - (prev?.win ?? 50)) >= 15) return `${player} swings the game`
  return 'Scramble'
}

export function buildChapters(
  moves: MoveReview[],
  opts: { swingPct?: number; minGap?: number; whiteName?: string; blackName?: string } = {},
): Chapter[] {
  const swingPct = opts.swingPct ?? 15
  const minGap = opts.minGap ?? 4
  const whiteName = opts.whiteName ?? 'White'
  const blackName = opts.blackName ?? 'Black'
  if (moves.length === 0) return []

  const plies: PlyPoint[] = moves.map((m) => ({
    i: m.ply,
    win: winAt(m),
    cls: m.label,
    isBook: m.label === 'Book',
    white: m.moved_by_white,
  }))

  type Boundary = { ply: number; kind: ChapterKind; title: string; swing: number }
  const candidates: Boundary[] = []

  let bookEnd = 0
  for (const p of plies) {
    if (p.isBook) bookEnd = p.i
    else break
  }
  if (bookEnd > 0) {
    candidates.push({ ply: bookEnd, kind: 'opening', title: 'Opening', swing: 0 })
  }

  for (let i = 1; i < plies.length; i++) {
    const delta = Math.abs(plies[i].win - plies[i - 1].win)
    if (delta >= swingPct) {
      candidates.push({
        ply: plies[i].i,
        kind: 'swing',
        title: nameSwing(plies[i - 1], plies[i], whiteName, blackName),
        swing: Math.round(delta),
      })
    }
  }

  const conversion = plies.find((p) => Math.abs(p.win - 50) > 40)
  if (conversion) {
    candidates.push({
      ply: conversion.i,
      kind: 'conversion',
      title: conversion.win > 50 ? `${whiteName} converts` : `${blackName} converts`,
      swing: Math.round(Math.abs(conversion.win - 50)),
    })
  }

  candidates.sort((a, b) => a.ply - b.ply || b.swing - a.swing)
  const merged: Boundary[] = []
  for (const c of candidates) {
    const last = merged[merged.length - 1]
    if (last && c.ply - last.ply < minGap) {
      if (c.swing > last.swing) merged[merged.length - 1] = c
      continue
    }
    merged.push(c)
  }

  let kept = merged
  if (kept.length > 5) {
    const opening = kept.filter((b) => b.kind === 'opening')
    const rest = kept
      .filter((b) => b.kind !== 'opening')
      .sort((a, b) => b.swing - a.swing)
      .slice(0, 5 - opening.length)
      .sort((a, b) => a.ply - b.ply)
    kept = [...opening, ...rest].sort((a, b) => a.ply - b.ply)
  }

  if (kept.length === 0) {
    return [
      {
        startPly: 0,
        endPly: moves[moves.length - 1].ply,
        title: 'The game',
        swing: 0,
        kind: 'phase',
      },
    ]
  }

  const chapters: Chapter[] = []
  let start = 0
  for (let i = 0; i < kept.length; i++) {
    const b = kept[i]
    if (i === 0 && b.kind === 'opening') {
      chapters.push({
        startPly: 0,
        endPly: b.ply,
        title: b.title,
        swing: b.swing,
        kind: b.kind,
      })
      start = b.ply
      continue
    }
    chapters.push({
      startPly: start,
      endPly: b.ply,
      title: b.title,
      swing: b.swing,
      kind: b.kind,
    })
    start = b.ply
  }
  if (start < moves[moves.length - 1].ply) {
    chapters.push({
      startPly: start,
      endPly: moves[moves.length - 1].ply,
      title: 'Finish',
      swing: 0,
      kind: 'phase',
    })
  }

  return chapters.slice(0, 5)
}
