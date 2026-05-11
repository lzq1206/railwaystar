import { DATA_SOURCES, DEFAULT_TRAIN_CODES } from "./config.js";
import { loadData } from "./data-loader.js";
import { createMap, createLineLayer, updateLineHighlight, clearLayerGroup } from "./map.js";
import { estimateLightPollution, getBortleScale, describeSky } from "./light-pollution.js";
import {
  setLoading,
  fillLineSelector,
  renderTrainList,
  renderDarkStationRank,
  renderStationPanel
} from "./ui.js";

const normalizeStation = (name, raw, fallbackLngLat) => {
  const lng = Number(raw?.Longitude ?? fallbackLngLat?.[0]);
  const lat = Number(raw?.Latitude ?? fallbackLngLat?.[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    name,
    lng,
    lat,
    city: raw?.city ?? "",
    province: raw?.provinces ?? ""
  };
};

const getLineStations = (lineFeature, stationDict, lightRefs) => {
  const stations = [];
  const names = lineFeature.properties.stations ?? [];
  const fallbackCoords = lineFeature.geometry.coordinates ?? [];

  names.forEach((stationName, index) => {
    const normalized = normalizeStation(stationName, stationDict[stationName], fallbackCoords[index]);
    if (!normalized) {
      return;
    }

    const lightValue = estimateLightPollution(normalized, lightRefs);
    stations.push({
      ...normalized,
      lineName: lineFeature.properties.name,
      lightValue,
      bortle: getBortleScale(lightValue),
      skyDescription: describeSky(lightValue)
    });
  });

  return stations.sort((a, b) => a.lightValue - b.lightValue);
};

const markerStyleByRank = (rank) => {
  if (rank < 3) {
    return { color: "#facc15", fillColor: "#fde047", radius: 8, weight: 2, fillOpacity: 0.95 };
  }
  return { color: "#22d3ee", fillColor: "#22d3ee", radius: 4, weight: 1, fillOpacity: 0.75 };
};

const matchesHighSpeedPattern = (name = "") => /高铁|客专|城际|京沪|京广|沪昆|兰新/.test(name);

const init = async () => {
  setLoading(true);

  try {
    const data = await loadData(DATA_SOURCES);
    const map = createMap();

    const lines = data.lineGeoJson.features.filter((feature) =>
      matchesHighSpeedPattern(feature?.properties?.name)
    );

    const stationLayerGroup = L.layerGroup().addTo(map);
    const lineLayer = createLineLayer(map, { type: "FeatureCollection", features: lines }, (feature, layer) => {
      layer.bindTooltip(feature.properties.name, { sticky: true });
    });

    const selector = document.getElementById("line-selector");
    const searchInput = document.getElementById("line-search");

    let visibleLines = fillLineSelector(lines);

    const renderByLineName = (lineName) => {
      const lineFeature = lines.find((line) => line.properties.name === lineName);
      if (!lineFeature) {
        return;
      }

      updateLineHighlight(lineLayer, lineName);
      renderTrainList(lineFeature.properties.trainCodes || DEFAULT_TRAIN_CODES);

      const rankedStations = getLineStations(lineFeature, data.stationDict, data.lightRef);
      renderDarkStationRank(rankedStations);

      clearLayerGroup(stationLayerGroup);
      rankedStations.forEach((station, rank) => {
        const marker = L.circleMarker([station.lat, station.lng], markerStyleByRank(rank)).addTo(stationLayerGroup);

        marker.bindPopup(
          `${station.name}<br/>光污染估值: ${station.lightValue}<br/>Bortle ${station.bortle}`
        );

        marker.on("click", () => {
          renderStationPanel({
            name: station.name,
            lineName: station.lineName,
            lightValue: station.lightValue,
            bortle: station.bortle,
            description: station.skyDescription
          });
        });
      });

      const bounds = L.latLngBounds(rankedStations.map((station) => [station.lat, station.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15));
      }
    };

    searchInput.addEventListener("input", () => {
      visibleLines = fillLineSelector(lines, searchInput.value);
      if (visibleLines.length) {
        renderByLineName(visibleLines[0].properties.name);
      }
    });

    selector.addEventListener("change", (event) => renderByLineName(event.target.value));

    if (visibleLines.length > 0) {
      renderByLineName(visibleLines[0].properties.name);
    }
  } catch (error) {
    console.error(error);
    alert(`数据加载失败：${error.message}`);
  } finally {
    setLoading(false);
  }
};

init();
