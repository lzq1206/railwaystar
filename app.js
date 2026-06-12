import { DATA_SOURCES } from "./js/config.js";
import { loadData } from "./js/data-loader.js";
import { estimateLightPollution, getBortleScale, describeSky } from "./js/light-pollution.js";

const TILE_SERVER_URL = "https://tiles.railsmaps.com";
const DEFAULT_CENTER = [104.1376, 31.2114];
const DEFAULT_ZOOM = 4.6;

const dom = {
  map: document.getElementById("map"),
  routeSelect: document.getElementById("routeSelect"),
  lineSearch: document.getElementById("lineSearch"),
  trainList: document.getElementById("trainList"),
  darkTopList: document.getElementById("darkTopList"),
  stationCard: document.getElementById("stationCard"),
  loading: document.getElementById("loading"),
  routeCount: document.getElementById("routeCount"),
  stationCount: document.getElementById("stationCount"),
  darkestStation: document.getElementById("darkestStation"),
  selectionHint: document.getElementById("selectionHint"),
  statusPill: document.getElementById("statusPill")
};

const state = {
  map: null,
  data: null,
  lines: [],
  stationIndex: new Map(),
  selectedLine: null,
  selectedRouteMarkers: [],
  routeLayerReady: false,
  visibleLines: []
};

const stationLabelExpr = [
  "coalesce",
  ["get", "name:zh-Hans"],
  ["get", "name:zh"],
  ["get", "name"],
  ["get", "ref"]
];

const getUniqueStations = (lines) => {
  const seen = new Set();
  for (const line of lines) {
    (line.properties?.stations || []).forEach((station) => seen.add(station));
  }
  return seen.size;
};

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
    if (!normalized) return;

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

const createBasemapStyle = () => ({
  version: 8,
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/grayscale",
  sources: {
    basemap: {
      type: "vector",
      tiles: [`${TILE_SERVER_URL}/basemap/{z}/{x}/{y}`],
      minzoom: 2,
      maxzoom: 14
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#050816" }
    },
    {
      id: "earth",
      type: "fill",
      source: "basemap",
      "source-layer": "earth",
      paint: { "fill-color": "#0f172a" }
    },
    {
      id: "landcover",
      type: "fill",
      source: "basemap",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "forest",
          "#103024",
          "scrub",
          "#132c22",
          "grassland",
          "#123225",
          "farmland",
          "#16273d",
          "urban_area",
          "#111827",
          "barren",
          "#181d2c",
          "glacier",
          "#1d2734",
          "#0f172a"
        ],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.92, 7, 0.8, 11, 0.7]
      }
    },
    {
      id: "landuse_green",
      type: "fill",
      source: "basemap",
      "source-layer": "landuse",
      filter: [
        "in",
        "kind",
        "national_park",
        "park",
        "nature_reserve",
        "forest",
        "wood",
        "grass",
        "grassland",
        "scrub",
        "cemetery",
        "village_green",
        "allotments",
        "playground"
      ],
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "national_park",
          "#123524",
          "park",
          "#123524",
          "nature_reserve",
          "#123524",
          "forest",
          "#112d21",
          "wood",
          "#112d21",
          "grass",
          "#153728",
          "grassland",
          "#153728",
          "scrub",
          "#183025",
          "cemetery",
          "#1b2430",
          "village_green",
          "#153728",
          "allotments",
          "#153728",
          "playground",
          "#153728",
          "#0f172a"
        ],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.55, 9, 0.85]
      }
    },
    {
      id: "landuse_sensitive",
      type: "fill",
      source: "basemap",
      "source-layer": "landuse",
      filter: ["in", "kind", "hospital", "industrial", "school", "university", "college", "beach", "sand", "airfield", "military", "naval_base"] ,
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "hospital",
          "#2a2432",
          "industrial",
          "#1f2430",
          "school",
          "#252235",
          "university",
          "#252235",
          "college",
          "#252235",
          "beach",
          "#1a2333",
          "sand",
          "#1a2333",
          "airfield",
          "#1b2230",
          "military",
          "#1a1f2a",
          "naval_base",
          "#1a1f2a",
          "#111827"
        ],
        "fill-opacity": 0.72
      }
    },
    {
      id: "water",
      type: "fill",
      source: "basemap",
      "source-layer": "water",
      paint: {
        "fill-color": "#0b4f6c",
        "fill-opacity": 0.88
      }
    },
    {
      id: "roads_minor",
      type: "line",
      source: "basemap",
      "source-layer": "roads",
      filter: ["all", ["==", "kind", "minor_road"], ["!has", "is_bridge"], ["!has", "is_tunnel"]],
      paint: {
        "line-color": "#233041",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.12, 9, 0.45, 12, 1.2, 16, 3],
        "line-opacity": 0.62
      }
    },
    {
      id: "roads_major",
      type: "line",
      source: "basemap",
      "source-layer": "roads",
      filter: ["all", ["in", "kind", "major_road", "highway"], ["!has", "is_bridge"], ["!has", "is_tunnel"]],
      paint: {
        "line-color": "#4b5563",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.2, 8, 0.55, 12, 1.5, 16, 4],
        "line-opacity": 0.72
      }
    },
    {
      id: "roads_rail",
      type: "line",
      source: "basemap",
      "source-layer": "roads",
      filter: ["==", "kind", "rail"],
      paint: {
        "line-color": "#7dd3fc",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.15, 7, 0.5, 11, 1.6, 14, 3.8],
        "line-dasharray": [1.35, 1.05],
        "line-opacity": 0.58
      }
    },
    {
      id: "boundaries_country",
      type: "line",
      source: "basemap",
      "source-layer": "boundaries",
      filter: ["<=", "kind_detail", 2],
      paint: {
        "line-color": "#475569",
        "line-width": 0.8,
        "line-dasharray": [2, 1]
      }
    },
    {
      id: "boundaries_local",
      type: "line",
      source: "basemap",
      "source-layer": "boundaries",
      filter: [">", "kind_detail", 2],
      paint: {
        "line-color": "#334155",
        "line-width": 0.45,
        "line-dasharray": [2, 1]
      }
    },
    {
      id: "places",
      type: "symbol",
      source: "basemap",
      "source-layer": "places",
      filter: ["in", "kind", "country", "state", "region", "city", "town", "village", "suburb"],
      layout: {
        "text-field": ["coalesce", ["get", "name:zh-Hans"], ["get", "name:zh"], ["get", "name"], ["get", "ref"]],
        "text-font": ["Noto Sans Regular"],
        "text-variable-anchor": ["center"],
        "text-justify": "auto",
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 12, 9, 16, 12, 24],
        "text-letter-spacing": 0.02
      },
      paint: {
        "text-color": [
          "match",
          ["get", "kind"],
          "country",
          "#cbd5e1",
          "state",
          "#d1d5db",
          "region",
          "#cbd5e1",
          "city",
          "#e2e8f0",
          "town",
          "#cbd5e1",
          "village",
          "#94a3b8",
          "suburb",
          "#94a3b8",
          "#cbd5e1"
        ],
        "text-halo-color": "#020617",
        "text-halo-width": 1.4
      }
    },
    {
      id: "pois_stations",
      type: "symbol",
      source: "basemap",
      "source-layer": "pois",
      filter: ["==", "kind", "station"],
      minzoom: 4,
      layout: {
        "icon-image": "train_station",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 9, 0.72, 12, 0.95, 14, 1.1],
        "icon-allow-overlap": false,
        "text-field": stationLabelExpr,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 11, 14, 14],
        "text-offset": [1.05, 0],
        "text-anchor": "left",
        "text-variable-anchor": ["left", "right"],
        "text-allow-overlap": false
      },
      paint: {
        "text-color": "#dbeafe",
        "text-halo-color": "#020617",
        "text-halo-width": 1.5
      }
    }
  ]
});

const createMap = () => {
  const map = new maplibregl.Map({
    container: dom.map,
    style: createBasemapStyle(),
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    pitch: 0,
    bearing: 0,
    attributionControl: false
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

  map.on("load", () => {
    dom.statusPill.textContent = "RailsMaps tiles live";
    if (!map.getSource("selected-route")) {
      map.addSource("selected-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
    }

    if (!map.getLayer("selected-route-glow")) {
      map.addLayer({
        id: "selected-route-glow",
        type: "line",
        source: "selected-route",
        paint: {
          "line-color": "#22d3ee",
          "line-width": 12,
          "line-opacity": 0.14,
          "line-blur": 4
        }
      });
    }

    if (!map.getLayer("selected-route-core")) {
      map.addLayer({
        id: "selected-route-core",
        type: "line",
        source: "selected-route",
        paint: {
          "line-color": "#67e8f9",
          "line-width": 4,
          "line-opacity": 0.95
        }
      });
    }

    state.routeLayerReady = true;
    if (state.selectedLine && map.getSource("selected-route")) {
      map.getSource("selected-route").setData(state.selectedLine);
    }
  });

  return map;
};

const clearMarkers = () => {
  state.selectedRouteMarkers.forEach((marker) => marker.remove());
  state.selectedRouteMarkers = [];
};

const createRouteMarkerElement = (station, rank) => {
  const el = document.createElement("button");
  const isTop3 = rank < 3;
  el.type = "button";
  el.className = isTop3 ? "route-marker route-marker--top" : "route-marker";
  el.title = `${station.name} · Bortle ${station.bortle}`;
  el.dataset.rank = String(rank + 1);
  el.innerHTML = isTop3 ? "★" : "";
  return el;
};

const renderStationPanel = (station) => {
  dom.stationCard.classList.remove("hidden");
  dom.stationCard.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold text-cyan-200">${station.name}</h3>
        <p class="mt-1 text-xs text-slate-400">${station.lineName}</p>
      </div>
      <button type="button" class="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10" id="closeStationCard">关闭</button>
    </div>
    <div class="mt-3 space-y-2 text-sm text-slate-200">
      <div class="flex gap-2 text-xs text-slate-400">
        <span class="pill">${station.province || "未知省份"}</span>
        <span class="pill">${station.city || "未知城市"}</span>
        <span class="pill">Bortle ${station.bortle}</span>
      </div>
      <div class="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
        <div class="text-xs uppercase tracking-[0.25em] text-slate-500">光污染估值</div>
        <div class="mt-1 text-2xl font-semibold text-amber-200">${station.lightValue} / 100</div>
        <p class="mt-2 leading-relaxed text-slate-300">${station.skyDescription}</p>
      </div>
    </div>
  `;

  document.getElementById("closeStationCard")?.addEventListener("click", () => {
    dom.stationCard.classList.add("hidden");
  });
};

const renderDarkStationRank = (stations) => {
  dom.darkTopList.innerHTML = "";
  stations.slice(0, 3).forEach((station, index) => {
    const item = document.createElement("li");
    item.className = "rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-400/30 hover:bg-slate-900/70";
    item.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm font-medium text-cyan-100">#${index + 1} ${station.name}</div>
        <span class="pill pill--gold">Bortle ${station.bortle}</span>
      </div>
      <div class="mt-1 text-xs text-slate-400">${station.province || ""}${station.city ? ` · ${station.city}` : ""}</div>
      <div class="mt-2 text-sm text-slate-300">${station.lightValue} / 100 · ${station.skyDescription}</div>
    `;
    dom.darkTopList.append(item);
  });
};

const renderTrainList = (trainCodes = []) => {
  dom.trainList.innerHTML = "";
  trainCodes.forEach((code) => {
    const item = document.createElement("li");
    item.className = "inline-flex rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100";
    item.textContent = code;
    dom.trainList.append(item);
  });
};

const updateMetrics = ({ routeCount, stationCount, darkestStation }) => {
  dom.routeCount.textContent = String(routeCount);
  dom.stationCount.textContent = String(stationCount);
  dom.darkestStation.textContent = darkestStation || "—";
};

const setLoading = (isLoading) => {
  dom.loading.classList.toggle("hidden", !isLoading);
};

const buildRouteMarkers = (stations, map) => {
  clearMarkers();
  stations.forEach((station, index) => {
    const markerEl = createRouteMarkerElement(station, index);
    const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
      .setLngLat([station.lng, station.lat])
      .addTo(map);

    markerEl.addEventListener("click", () => renderStationPanel(station));
    state.selectedRouteMarkers.push(marker);
  });
};

const focusRoute = (lineFeature, stations) => {
  const coords = lineFeature.geometry?.coordinates ?? [];
  if (state.routeLayerReady && state.map.getSource("selected-route")) {
    state.map.getSource("selected-route").setData(lineFeature);
  }

  if (coords.length >= 2) {
    const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
    coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
    state.map.fitBounds(bounds, { padding: 60, duration: 1200, maxZoom: 8.2 });
  }

  buildRouteMarkers(stations, state.map);
};

const renderSelection = (lineFeature) => {
  if (!lineFeature) return;

  const stations = getLineStations(lineFeature, state.data.stationDict, state.data.lightRef);
  state.selectedLine = lineFeature;

  dom.selectionHint.textContent = `${lineFeature.properties.name} · ${stations.length} 站`;
  renderTrainList(lineFeature.properties.trainCodes || []);
  renderDarkStationRank(stations);

  const darkest = stations[0]?.name || "—";
  updateMetrics({
    routeCount: state.visibleLines.length,
    stationCount: getUniqueStations(state.visibleLines),
    darkestStation: darkest
  });

  focusRoute(lineFeature, stations);
};

const fillRouteSelector = (lines, query = "") => {
  const keyword = query.trim();
  const filtered = keyword
    ? lines.filter((line) => line.properties?.name?.includes(keyword))
    : lines;

  dom.routeSelect.innerHTML = "";

  if (!filtered.length) {
    const option = document.createElement("option");
    option.textContent = "没有匹配的线路";
    option.value = "";
    dom.routeSelect.append(option);
    return filtered;
  }

  filtered.forEach((line) => {
    const option = document.createElement("option");
    option.value = line.properties.name;
    option.textContent = line.properties.name;
    dom.routeSelect.append(option);
  });

  return filtered;
};

const init = async () => {
  setLoading(true);

  try {
    const data = await loadData(DATA_SOURCES);
    const lines = data.lineGeoJson.features.filter((feature) => feature?.properties?.name);

    state.data = data;
    state.lines = lines;
    state.map = createMap();
    await new Promise((resolve) => state.map.once("load", resolve));
    state.visibleLines = fillRouteSelector(lines);

    updateMetrics({
      routeCount: state.visibleLines.length,
      stationCount: getUniqueStations(state.visibleLines),
      darkestStation: "—"
    });

    const initialLine = state.visibleLines[0] ?? lines[0];
    if (initialLine) {
      dom.routeSelect.value = initialLine.properties.name;
      renderSelection(initialLine);
    }

    dom.routeSelect.addEventListener("change", (event) => {
      const selected = state.visibleLines.find((line) => line.properties.name === event.target.value);
      if (selected) renderSelection(selected);
    });

    dom.lineSearch.addEventListener("input", () => {
      state.visibleLines = fillRouteSelector(lines, dom.lineSearch.value);
      updateMetrics({
        routeCount: state.visibleLines.length,
        stationCount: getUniqueStations(state.visibleLines),
        darkestStation: state.selectedLine ? (getLineStations(state.selectedLine, state.data.stationDict, state.data.lightRef)[0]?.name || "—") : "—"
      });

      if (!state.visibleLines.length) {
        dom.selectionHint.textContent = "没有找到线路";
        dom.trainList.innerHTML = "";
        dom.darkTopList.innerHTML = "";
        clearMarkers();
        if (state.map?.getSource("selected-route")) {
          state.map.getSource("selected-route").setData({ type: "FeatureCollection", features: [] });
        }
        return;
      }

      const next = state.visibleLines[0];
      dom.routeSelect.value = next.properties.name;
      renderSelection(next);
    });
  } catch (error) {
    console.error(error);
    dom.selectionHint.textContent = `数据加载失败：${error.message}`;
  } finally {
    setLoading(false);
  }
};

init();
