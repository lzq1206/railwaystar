const normalizeLightValue = (value) => Math.max(5, Math.min(99, Math.round(value)));

const distanceSquared = (a, b) => {
  const lngDiff = a.lng - b.lng;
  const latDiff = a.lat - b.lat;
  return lngDiff * lngDiff + latDiff * latDiff;
};

export const estimateLightPollution = (station, refs) => {
  if (!refs.length) {
    return 50;
  }

  const weighted = refs.reduce(
    (acc, ref) => {
      const dist = distanceSquared(station, ref);
      const w = 1 / Math.max(dist, 0.05);
      acc.weightedSum += w * ref.value;
      acc.weights += w;
      return acc;
    },
    { weightedSum: 0, weights: 0 }
  );

  return normalizeLightValue(weighted.weightedSum / weighted.weights);
};

export const getBortleScale = (lightValue) => {
  if (lightValue <= 20) return 2;
  if (lightValue <= 35) return 3;
  if (lightValue <= 50) return 4;
  if (lightValue <= 65) return 5;
  if (lightValue <= 78) return 6;
  if (lightValue <= 88) return 7;
  return 8;
};

export const describeSky = (lightValue) => {
  if (lightValue <= 25) return "银河清晰可见，适合深空摄影。";
  if (lightValue <= 45) return "肉眼可见大量星群，适合广角星野拍摄。";
  if (lightValue <= 65) return "可见主亮星，建议避开月光并提高曝光时间。";
  if (lightValue <= 82) return "城市辉光明显，适合月面或行星摄影。";
  return "强光污染区域，不建议进行暗空观测。";
};
