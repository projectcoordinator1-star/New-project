import { normalizeOperationalState } from "./stateGroups";

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

export const MONTHLY_STATE_AOP_OVERRIDES = {
  "2026-04": {
    KN: { hkAopCount: 562.4, mepcAopCount: 131.62 },
    KL: { hkAopCount: 211, mepcAopCount: 55 },
    TN: { hkAopCount: 302.9, mepcAopCount: 56.9 },
    "AP-1": { hkAopCount: 156, mepcAopCount: 28 },
    "AP-2": { hkAopCount: 292, mepcAopCount: 47 },
    TG: { hkAopCount: 216, mepcAopCount: 29 },
  },
};

export function buildStateAopMap(stores, month) {
  const baseStateMap = new Map();

  stores.forEach((store) => {
    const state = getStoreState(store);
    if (!baseStateMap.has(state)) {
      baseStateMap.set(state, { hkAopCount: 0, mepcAopCount: 0 });
    }

    const current = baseStateMap.get(state);
    current.hkAopCount += safeNumber(store?.hkAopCount);
    current.mepcAopCount += safeNumber(store?.mepcAopCount);
  });

  const overrides = MONTHLY_STATE_AOP_OVERRIDES[month];
  if (!overrides) {
    return baseStateMap;
  }

  Object.entries(overrides).forEach(([state, counts]) => {
    baseStateMap.set(state, {
      hkAopCount: safeNumber(counts.hkAopCount),
      mepcAopCount: safeNumber(counts.mepcAopCount),
    });
  });

  return baseStateMap;
}

function getStoreState(store) {
  return normalizeOperationalState(store?.state || store?.region || "Unknown");
}

function buildBaseStoreEntry(store) {
  return {
    hkAopCount: safeNumber(store?.hkAopCount),
    mepcAopCount: safeNumber(store?.mepcAopCount),
  };
}

export function buildAdjustedStoreAopMap(stores, month) {
  const overrides = MONTHLY_STATE_AOP_OVERRIDES[month];
  const adjustedMap = new Map();

  if (!overrides) {
    stores.forEach((store) => {
      adjustedMap.set(store.storeId, buildBaseStoreEntry(store));
    });

    return adjustedMap;
  }

  const storesByState = new Map();

  stores.forEach((store) => {
    const state = getStoreState(store);
    if (!storesByState.has(state)) {
      storesByState.set(state, []);
    }

    storesByState.get(state).push(store);
  });

  storesByState.forEach((stateStores, state) => {
    const stateOverride = overrides[state];

    if (!stateOverride) {
      stateStores.forEach((store) => {
        adjustedMap.set(store.storeId, buildBaseStoreEntry(store));
      });

      return;
    }

    const baseTotals = stateStores.reduce(
      (acc, store) => {
        acc.hkAopCount += safeNumber(store.hkAopCount);
        acc.mepcAopCount += safeNumber(store.mepcAopCount);
        return acc;
      },
      { hkAopCount: 0, mepcAopCount: 0 },
    );

    const hkRatio = baseTotals.hkAopCount > 0 ? stateOverride.hkAopCount / baseTotals.hkAopCount : 0;
    const mepcRatio = baseTotals.mepcAopCount > 0 ? stateOverride.mepcAopCount / baseTotals.mepcAopCount : 0;
    const evenHkValue = stateStores.length ? stateOverride.hkAopCount / stateStores.length : 0;
    const evenMepcValue = stateStores.length ? stateOverride.mepcAopCount / stateStores.length : 0;

    stateStores.forEach((store) => {
      adjustedMap.set(store.storeId, {
        hkAopCount: baseTotals.hkAopCount > 0 ? safeNumber(store.hkAopCount) * hkRatio : evenHkValue,
        mepcAopCount: baseTotals.mepcAopCount > 0 ? safeNumber(store.mepcAopCount) * mepcRatio : evenMepcValue,
      });
    });
  });

  return adjustedMap;
}
