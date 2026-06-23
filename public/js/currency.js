/** Numismatic Overhaul: 100 bronze = 1 silver, 100 silver = 1 gold */
export const GOLD_VALUE = 10000;
export const SILVER_VALUE = 100;

export function splitCurrencyValue(value) {
  const total = Math.max(0, Number(value) || 0);
  const gold = Math.floor(total / GOLD_VALUE);
  const remainder = total % GOLD_VALUE;
  const silver = Math.floor(remainder / SILVER_VALUE);
  const bronze = remainder % SILVER_VALUE;
  return { value: total, totalValue: total, gold, silver, bronze };
}

/** Carry bronze into silver and silver into gold (same rules as in-game). */
export function normalizeCurrencyParts(gold = 0, silver = 0, bronze = 0) {
  let b = Math.max(0, Number(bronze) || 0);
  let s = Math.max(0, Number(silver) || 0) + Math.floor(b / SILVER_VALUE);
  b %= SILVER_VALUE;
  const g = Math.max(0, Number(gold) || 0) + Math.floor(s / SILVER_VALUE);
  s %= SILVER_VALUE;
  return splitCurrencyValue(g * GOLD_VALUE + s * SILVER_VALUE + b);
}

export function resolveCurrency(currency) {
  const value = Number(currency?.value ?? currency?.totalValue ?? 0);
  if (value > 0) return splitCurrencyValue(value);
  return normalizeCurrencyParts(currency?.gold, currency?.silver, currency?.bronze);
}

export function goldNetworth(value) {
  const total = Math.max(0, Number(value) || 0);
  return total / GOLD_VALUE;
}

/** Single net-worth figure in gold (decimal when under 1 gold). */
export function formatGoldNetworth(value) {
  const net = goldNetworth(value);
  if (net <= 0) return '0';
  if (net < 1) return net.toFixed(5);
  return net.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function aggregateEconomy(players) {
  const raw = players.reduce(
    (acc, p) => {
      const c = resolveCurrency(p.currency ?? {});
      acc.gold += c.gold;
      acc.silver += c.silver;
      acc.bronze += c.bronze;
      return acc;
    },
    { gold: 0, silver: 0, bronze: 0 }
  );
  const converted = normalizeCurrencyParts(raw.gold, raw.silver, raw.bronze);
  const totalPlaytimeMinutes = players.reduce((sum, p) => sum + (p.playtimeMinutes ?? 0), 0);
  return {
    raw,
    gold: converted.gold,
    silver: converted.silver,
    bronze: converted.bronze,
    value: converted.value,
    totalValue: converted.value,
    totalPlaytimeMinutes,
  };
}
