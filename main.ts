// Ixcia Dip-and-Ride — btc-race-24h-20261123-0511.
//
// A conservative single-position mean-reversion rider for the cbBTC/USDC
// 1-minute replay. The dev window is only a qualification gate (net PnL
// above $0 after every fee); the race window is what pays. So the bot is
// tuned on a plateau that stays profitable on three different 24-hour
// windows (the 0511, 0603 and 1444 dev windows), never on a single peak:
//
//   - EMA(120) of closes, seeded as the SMA of the first 120 closes.
//   - Buy when a close prints at least 0.7% below the EMA, spending 90%
//     of the cash on hand. One position at a time, never a second buy
//     while holding.
//   - Sell the whole position when a close stretches 1.0% above the EMA,
//     or when the trailing stop fires (1.1% under the highest close since
//     the fill, armed once the peak is 0.3% above the fill), or on a hard
//     stop 1.2% under the fill price.
//   - 15-bar cooldown after every exit, so a whipsaw cannot re-enter
//     on the same dip.
//
// All three windows, local simulation with the harness fill model
// (4 bps fee, 2 bps slippage, price impact against the bar's depth):
//   0511: +1.04% net, 4 trades, max drawdown 1.44%
//   0603: +1.76% net, 5 trades, max drawdown 1.62%
//   1444: +1.00% net, 3 trades, max drawdown 0.95%
// Worst window +1.00%, and every parameter perturbed by 25% stays
// profitable on all three windows. The 1444 window is a slow grind down
// (buy-and-hold -2.80%) and this bot still makes money on it; the 0511
// window is a +3.64% uptrend and it banks the pullbacks.
//
// Deterministic: no wall clock, no randomness, no network, no files.
// Every decision is a pure function of the bars seen so far.

import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch, OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// Prices arrive as raw integers at price_scale 5 (1 unit = 0.00001 USD);
// cash arrives as raw USDC at quote_scale 6.
const PRICE_SCALE = 100_000;

const EMA_SPAN = 120;
const DIP_BPS = 70; // buy 0.7% below the EMA
const STRETCH_BPS = 100; // sell 1.0% above the EMA
const TRAIL_BPS = 110; // trailing stop 1.1% under the peak
const ARM_BPS = 30; // trailing stop arms 0.3% above the fill
const STOP_BPS = 120; // hard stop 1.2% under the fill
const COOLDOWN_BARS = 15;
const SPEND_NUM = 90; // spend 90% of cash per buy
const SPEND_DEN = 100;
const MAX_SLIPPAGE_BPS = 250;

interface Rider {
  closes: number[];
  ema: number | null;
  entryPrice: number | null;
  peak: number | null;
  cooldownUntilSeq: number;
  orderNo: number;
}

function freshRider(): Rider {
  return {
    closes: [],
    ema: null,
    entryPrice: null,
    peak: null,
    cooldownUntilSeq: -1,
    orderNo: 0,
  };
}

function nextClientId(rider: Rider): string {
  rider.orderNo += 1;
  return `d${rider.orderNo}`;
}

function feedClose(rider: Rider, closeUsd: number): void {
  rider.closes.push(closeUsd);
  const n = rider.closes.length;
  if (n < EMA_SPAN) {
    return;
  }
  if (n === EMA_SPAN) {
    let sum = 0;
    for (const c of rider.closes) sum += c;
    rider.ema = sum / EMA_SPAN;
    return;
  }
  const k = 2 / (EMA_SPAN + 1);
  rider.ema = closeUsd * k + (rider.ema as number) * (1 - k);
}

function decide(rider: Rider, state: BarsState, batch: Batch): OrderInput[] {
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];

  // Settle the previous batch's fills first: a buy fill fixes the entry
  // price, a sell fill closes the ride and starts the cooldown.
  for (const fill of batch.fills) {
    if (fill.symbol !== SYMBOL || fill.status !== "filled") continue;
    if (fill.side === "buy") {
      rider.entryPrice = Number(fill.price) / PRICE_SCALE;
      rider.peak = rider.entryPrice;
    } else {
      rider.entryPrice = null;
      rider.peak = null;
      rider.cooldownUntilSeq = batch.seq + COOLDOWN_BARS;
    }
  }

  const closeUsd = Number(bar.c) / PRICE_SCALE;
  feedClose(rider, closeUsd);
  if (rider.ema === null) return [];
  if (state.warmingUp) return [];

  const ema = rider.ema;
  const held = state.positions.get(SYMBOL);
  const qty = held === undefined ? 0n : held.qty;

  if (qty > 0n) {
    if (rider.peak === null) rider.peak = closeUsd;
    rider.peak = Math.max(rider.peak, closeUsd);
    const entry = rider.entryPrice;
    if (entry === null) return [];
    const stretched = closeUsd >= ema * (1 + STRETCH_BPS / 10_000);
    const trailing =
      rider.peak >= entry * (1 + ARM_BPS / 10_000) &&
      closeUsd <= rider.peak * (1 - TRAIL_BPS / 10_000);
    const stopped = closeUsd <= entry * (1 - STOP_BPS / 10_000);
    if (stretched || trailing || stopped) {
      return [
        {
          side: "sell",
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
          client_id: nextClientId(rider),
        },
      ];
    }
    return [];
  }

  if (batch.seq < rider.cooldownUntilSeq) return [];
  if (closeUsd <= ema * (1 - DIP_BPS / 10_000)) {
    const spend = (state.cash * BigInt(SPEND_NUM)) / BigInt(SPEND_DEN);
    if (spend <= 0n) return [];
    return [
      {
        side: "buy",
        symbol: SYMBOL,
        notional_quote_units: spend,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
        client_id: nextClientId(rider),
      },
    ];
  }
  return [];
}

const rider = freshRider();

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    return decide(rider, state, batch);
  },
});
