# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/ixciamakima/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/ixciamakima/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Ixcia Dip-and-Ride: a conservative single-position mean-reversion bot that trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on make.fun. It buys 0.7% below its EMA(120), sells 1.0% above it (with a 1.1% trailing stop and a 1.2% hard stop), and holds at most one position. Tuned for robustness across three 24-hour windows (0511, 0603, 1444 dev windows: +1.04%, +1.76%, +1.00% net in local simulation) — the dev window is only the qualification gate; the race window is what pays.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot <repo-dir> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=z00wg8vw&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
