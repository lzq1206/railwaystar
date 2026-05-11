import { BASEMAP, LIGHT_POLLUTION_TILE } from "./config.js";

export const createMap = () => {
  const map = L.map("map", {
    center: [35.5, 104.0],
    zoom: 5,
    minZoom: 4,
    preferCanvas: true
  });

  L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map);
  L.tileLayer(LIGHT_POLLUTION_TILE.url, LIGHT_POLLUTION_TILE.options).addTo(map);

  return map;
};

export const createLineLayer = (map, geojson, onEachFeature) =>
  L.geoJSON(geojson, {
    style: {
      color: "#38bdf8",
      weight: 3,
      opacity: 0.6
    },
    onEachFeature
  }).addTo(map);

export const updateLineHighlight = (layer, selectedLineName) => {
  layer.eachLayer((featureLayer) => {
    const lineName = featureLayer.feature?.properties?.name;
    const selected = lineName === selectedLineName;

    featureLayer.setStyle({
      color: selected ? "#22d3ee" : "#38bdf8",
      weight: selected ? 5 : 2,
      opacity: selected ? 0.95 : 0.35
    });
  });
};

export const clearLayerGroup = (layerGroup) => {
  layerGroup.clearLayers();
};
