const fetchJsonFromSources = async (sources) => {
  const errors = [];

  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(`全部数据源加载失败: ${errors.join(" | ")}`);
};

export const loadData = async (config) => {
  const [lineGeoJson, stationDict, lightRef] = await Promise.all([
    fetchJsonFromSources(config.lines),
    fetchJsonFromSources(config.stations),
    fetchJsonFromSources(config.lightRef)
  ]);

  return {
    lineGeoJson,
    stationDict,
    lightRef
  };
};
