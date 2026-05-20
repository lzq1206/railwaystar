/**
 * China Railway Dark Sky Map 前端入口
 *
 * 本文件按题目要求分为两部分：
 * 1) 地图初始化与图层加载
 * 2) 侧边栏交互、最暗车站算法与动态更新
 */

// =========================
// 第一部分：地图初始化与图层加载逻辑
// =========================

/** 地图与图层的全局状态，集中管理，降低耦合。 */
const state = {
  map: null,
  routes: [],
  stationGeoJson: null,
  stationIndex: new Map(),
  routeLayerGroup: null,
  stationLayerGroup: null,
  highlightLayerGroup: null
};

/** 线路车次缺失时使用的默认模拟车次。 */
const DEFAULT_TRAIN_CODES = ["G101", "G103", "G105"];

/** 颜色映射：波特尔等级越高（越亮），颜色越偏红。 */
const getBortleColor = (bortle) => {
  if (bortle <= 3) return "#22c55e";
  if (bortle <= 5) return "#84cc16";
  if (bortle <= 6) return "#eab308";
  if (bortle <= 7) return "#f97316";
  return "#ef4444";
};

/** 初始化 Leaflet 地图和暗色底图。 */
function initMap() {
  state.map = L.map("map", {
    center: [35.5, 104.0],
    zoom: 5,
    minZoom: 4,
    preferCanvas: true
  });

  // 底图：CartoDB Dark Matter
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(state.map);

  // 光污染图层：使用 NASA VIIRS 夜间灯光图层，半透明叠加
  L.tileLayer(
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/2012-12-31/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    {
      maxZoom: 8,
      opacity: 0.5,
      attribution: "NASA VIIRS"
    }
  ).addTo(state.map);

  state.routeLayerGroup = L.layerGroup().addTo(state.map);
  state.stationLayerGroup = L.layerGroup().addTo(state.map);
  state.highlightLayerGroup = L.layerGroup().addTo(state.map);
}

/**
 * 异步加载数据：
 * - routes.json：线路与站点映射
 * - stations.geojson：站点几何与属性
 */
async function loadData() {
  const [routesRes, stationsRes] = await Promise.all([
    fetch("./public/data/routes.json"),
    fetch("./public/data/stations.geojson")
  ]);

  if (!routesRes.ok || !stationsRes.ok) {
    throw new Error("数据文件加载失败，请先运行 npm run generate:data");
  }

  state.routes = await routesRes.json();
  state.stationGeoJson = await stationsRes.json();

  // 构建车站索引：车站名 -> Feature
  state.stationGeoJson.features.forEach((feature) => {
    state.stationIndex.set(feature.properties.name, feature);
  });
}

/** 绘制所有线路。 */
function drawAllRoutes() {
  state.routeLayerGroup.clearLayers();

  state.routes.forEach((route) => {
    if (!Array.isArray(route.coordinates) || route.coordinates.length < 2) return;

    const latlngs = route.coordinates.map(([lng, lat]) => [lat, lng]);
    L.polyline(latlngs, {
      color: "#38bdf8",
      weight: 3,
      opacity: 0.55
    })
      .bindTooltip(route.name, { sticky: true })
      .addTo(state.routeLayerGroup);
  });
}

/** 绘制站点图层并绑定点击事件。 */
function drawStations() {
  state.stationLayerGroup.clearLayers();

  state.stationGeoJson.features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties;

    const marker = L.circleMarker([lat, lng], {
      radius: 5,
      color: getBortleColor(p.bortle),
      fillColor: getBortleColor(p.bortle),
      fillOpacity: 0.85,
      weight: 1
    }).addTo(state.stationLayerGroup);

    marker.on("click", () => showStationCard(p, [lat, lng]));
  });
}

// =========================
// 第二部分：侧边栏交互、最暗车站计算算法、UI 动态更新
// =========================

const routeSelectEl = document.getElementById("routeSelect");
const trainListEl = document.getElementById("trainList");
const darkTopListEl = document.getElementById("darkTopList");
const stationCardEl = document.getElementById("stationCard");

/** 观星指数文案（等级越暗越推荐）。 */
function getRecommendText(index) {
  if (index >= 80) return "极佳观星";
  if (index >= 60) return "适合观星";
  if (index >= 40) return "一般";
  return "城市光害较明显";
}

/** 更新线路选择器。 */
function initRouteSelector() {
  routeSelectEl.innerHTML = state.routes
    .map((route, idx) => `<option value="${idx}">${route.name}</option>`)
    .join("");

  routeSelectEl.addEventListener("change", () => {
    const selected = state.routes[Number(routeSelectEl.value)];
    if (selected) renderRouteInsight(selected);
  });
}

/** 渲染模拟车次列表。 */
function renderTrainList(route) {
  const trains = Array.isArray(route.trains) && route.trains.length ? route.trains : DEFAULT_TRAIN_CODES;
  trainListEl.innerHTML = trains.map((code) => `<li class="rounded bg-slate-800/70 px-2 py-1">${code}</li>`).join("");
}

/**
 * 核心算法“寻暗者”：
 * - 从选中线路提取所有站点
 * - 按波特尔等级升序（越低越暗）
 * - 输出 Top 3
 */
function findTopDarkStations(route) {
  const stations = (route.stations || [])
    .map((name) => state.stationIndex.get(name))
    .filter(Boolean)
    .map((feature) => {
      const p = feature.properties;
      return {
        name: p.name,
        bortle: Number(p.bortle),
        stargazingIndex: Number(p.stargazingIndex),
        lineNames: p.lineNames,
        coordinates: feature.geometry.coordinates
      };
    })
    .sort((a, b) => {
      // 第一优先级：波特尔等级更低
      if (a.bortle !== b.bortle) return a.bortle - b.bortle;
      // 第二优先级（同级平手时）：观星指数更高
      return b.stargazingIndex - a.stargazingIndex;
    });

  return stations.slice(0, 3);
}

/** 在侧边栏渲染 Top3。 */
function renderDarkTopList(top3) {
  darkTopListEl.innerHTML = top3
    .map(
      (station, idx) => `
      <li class="rounded-lg border border-slate-700 bg-slate-800/70 p-2">
        <div class="text-cyan-200">#${idx + 1} ${station.name}</div>
        <div class="mt-1 text-slate-300">Bortle ${station.bortle} · 推荐指数 ${station.stargazingIndex}</div>
      </li>`
    )
    .join("");
}

/** 使用闪烁星标高亮 Top3 站点。 */
function highlightTopStations(top3) {
  state.highlightLayerGroup.clearLayers();

  top3.forEach((station) => {
    const [lng, lat] = station.coordinates;

    const starIcon = L.divIcon({
      className: "",
      html: '<div class="star-marker">★</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    L.marker([lat, lng], { icon: starIcon })
      .bindTooltip(`${station.name}（Top 暗夜站）`, { direction: "top" })
      .addTo(state.highlightLayerGroup);
  });
}

/** 高亮当前线路，并自动缩放至线路范围。 */
function focusRoute(route) {
  state.routeLayerGroup.clearLayers();

  if (!Array.isArray(route.coordinates) || route.coordinates.length < 2) return;

  const latlngs = route.coordinates.map(([lng, lat]) => [lat, lng]);
  L.polyline(latlngs, {
    color: "#22d3ee",
    weight: 5,
    opacity: 0.95
  })
    .bindTooltip(route.name, { sticky: true })
    .addTo(state.routeLayerGroup);

  state.map.fitBounds(latlngs, { padding: [40, 40] });
}

/** 点击车站后展示详情卡片。 */
function showStationCard(properties, latlng) {
  stationCardEl.classList.remove("hidden");
  stationCardEl.innerHTML = `
    <h3 class="text-base font-semibold text-cyan-300">${properties.name}</h3>
    <div class="mt-2 space-y-1 text-sm text-slate-200">
      <p>线路：${(properties.lineNames || []).join(" / ") || "未标注"}</p>
      <p>坐标：${latlng[0].toFixed(4)}, ${latlng[1].toFixed(4)}</p>
      <p>波特尔等级：Bortle ${properties.bortle}</p>
      <p>观星推荐指数：${properties.stargazingIndex}（${getRecommendText(properties.stargazingIndex)}）</p>
    </div>
  `;
}

/** 将某条线路的全套洞察结果渲染到 UI。 */
function renderRouteInsight(route) {
  renderTrainList(route);
  focusRoute(route);

  const top3 = findTopDarkStations(route);
  renderDarkTopList(top3);
  highlightTopStations(top3);
}

/** 应用启动。 */
async function bootstrap() {
  initMap();
  await loadData();

  drawAllRoutes();
  drawStations();
  initRouteSelector();

  if (state.routes.length) {
    routeSelectEl.value = "0";
    renderRouteInsight(state.routes[0]);
  }
}

bootstrap().catch((error) => {
  console.error(error);
  alert(`初始化失败：${error.message}`);
});
