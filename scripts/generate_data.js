/**
 * Phase 1：高铁暗夜巡礼地图数据生成脚本
 *
 * 目标：
 * 1. 从 Wikidata SPARQL 获取中国大陆高铁站（尽可能完整）。
 * 2. 根据经纬度模拟光污染并计算波特尔等级（西部更暗，东部更亮）。
 * 3. 构建主要高铁线路与站点映射。
 * 4. 输出 public/data/stations.geojson 与 public/data/routes.json。
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ------- 常量定义 -------
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "public", "data");
const FALLBACK_FILE = path.join(ROOT_DIR, "data", "stations-fallback.json");
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * 主要线路关键词映射。
 * 说明：Wikidata 的线路命名存在差异，因此用关键词归类，保证前端可直接渲染主干线。
 */
const MAJOR_ROUTE_RULES = [
  { key: "京沪高铁", patterns: ["京沪", "Beijing–Shanghai"] },
  { key: "京广高铁", patterns: ["京广", "Beijing–Guangzhou"] },
  { key: "沪昆高铁", patterns: ["沪昆", "Shanghai–Kunming"] },
  { key: "兰新高铁", patterns: ["兰新", "Lanzhou–Xinjiang"] },
  { key: "京哈高铁", patterns: ["京哈", "Beijing–Harbin"] },
  { key: "徐兰高铁", patterns: ["徐兰", "Xuzhou–Lanzhou"] },
  { key: "郑渝高铁", patterns: ["郑渝", "Zhengzhou–Chongqing"] },
  { key: "贵广高铁", patterns: ["贵广", "Guiyang–Guangzhou"] }
];

/**
 * SPARQL 查询：
 * - P31 = Q10723826（高铁站）
 * - P17 = Q148（中国）
 * - 获取：站名、坐标、所属线路（P81）
 */
const STATION_QUERY = `
SELECT ?station ?stationLabel ?coord ?lineLabel WHERE {
  ?station wdt:P31 wd:Q10723826;
           wdt:P17 wd:Q148;
           wdt:P625 ?coord.
  OPTIONAL { ?station wdt:P81 ?line. }
  OPTIONAL {
    ?station wdt:P131* ?admin.
    ?admin wdt:P31/wdt:P279* wd:Q515.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
}
`;

/**
 * 将 SPARQL 的 "Point(lon lat)" 字符串解析成数值经纬度。
 */
const parsePoint = (pointStr) => {
  if (!pointStr) return null;
  const match = pointStr.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
};

/**
 * 根据经纬度模拟光污染：
 * - 东部（经度高）更亮，西部更暗；
 * - 高纬度与边疆地区轻微偏暗；
 * - 加入平滑扰动，避免同经度站点完全一致。
 */
const estimateBortle = (lng, lat) => {
  const eastFactor = Math.max(0, Math.min(1, (lng - 80) / 45));
  const latFactor = Math.max(0, Math.min(1, (35 - Math.abs(lat - 35)) / 35));
  const noise = (Math.sin(lng * 0.6) + Math.cos(lat * 0.8)) * 0.45;

  const score = 2 + eastFactor * 6.2 + latFactor * 0.8 + noise;
  const bortle = Math.max(1, Math.min(9, Math.round(score)));
  return bortle;
};

/**
 * 观星推荐指数（0~100）：等级越暗（数值越低）越高。
 */
const getStargazingIndex = (bortle) => Math.max(0, Math.min(100, Math.round((10 - bortle) * 11.1)));

/**
 * 归类主要线路。
 */
const classifyRoutes = (lineNames = []) => {
  const routeSet = new Set();
  const normalized = lineNames.filter(Boolean).map((line) => line.trim());

  normalized.forEach((line) => {
    for (const rule of MAJOR_ROUTE_RULES) {
      if (rule.patterns.some((pattern) => line.includes(pattern))) {
        routeSet.add(rule.key);
      }
    }
  });

  return [...routeSet];
};

/**
 * 从 Wikidata 拉取并转换站点。
 */
const fetchStationsFromWikidata = async () => {
  const { data } = await axios.get(SPARQL_ENDPOINT, {
    params: {
      format: "json",
      query: STATION_QUERY
    },
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "railwaystar-data-pipeline/1.0 (GitHub Actions)"
    },
    timeout: 60000
  });

  const grouped = new Map();
  for (const row of data.results.bindings) {
    const stationId = row.station.value;
    const name = row.stationLabel?.value?.trim();
    const coord = parsePoint(row.coord?.value);
    const line = row.lineLabel?.value?.trim();

    if (!name || !coord) continue;

    if (!grouped.has(stationId)) {
      grouped.set(stationId, {
        id: stationId,
        name,
        lng: coord.lng,
        lat: coord.lat,
        lineNames: new Set()
      });
    }

    if (line) grouped.get(stationId).lineNames.add(line);
  }

  return [...grouped.values()].map((item) => {
    const bortle = estimateBortle(item.lng, item.lat);
    const routes = classifyRoutes([...item.lineNames]);
    return {
      id: item.id,
      name: item.name,
      lng: item.lng,
      lat: item.lat,
      lineNames: [...item.lineNames],
      routes,
      bortle,
      lightPollution: bortle,
      stargazingIndex: getStargazingIndex(bortle)
    };
  });
};

/**
 * Wikidata 不可用时，使用仓库内后备数据兜底。
 */
const loadFallbackStations = () => {
  const fallback = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"));
  return Object.entries(fallback).map(([name, value], idx) => {
    const lng = Number(value.Longitude);
    const lat = Number(value.Latitude);
    const bortle = estimateBortle(lng, lat);

    let routes = [];
    if (["北京南", "天津南", "济南西", "徐州东", "南京南", "上海虹桥"].includes(name)) routes.push("京沪高铁");
    if (["北京西", "石家庄", "郑州东", "武汉", "长沙南", "广州南"].includes(name)) routes.push("京广高铁");
    if (["兰州西", "西宁", "张掖西", "嘉峪关南", "哈密", "乌鲁木齐"].includes(name)) routes.push("兰新高铁");
    if (["上海虹桥", "杭州东", "南昌西", "长沙南", "贵阳北", "昆明南"].includes(name)) routes.push("沪昆高铁");

    return {
      id: `fallback-${idx}`,
      name,
      lng,
      lat,
      lineNames: routes,
      routes,
      bortle,
      lightPollution: bortle,
      stargazingIndex: getStargazingIndex(bortle)
    };
  });
};

/**
 * 基于站点集合构建路线 JSON：
 * - 每条路线包含站点名、坐标序列、模拟车次。
 */
const buildRoutes = (stations) => {
  const routeMap = new Map();

  for (const station of stations) {
    const routeNames = station.routes.length ? station.routes : ["其他高铁线路"];

    for (const routeName of routeNames) {
      if (!routeMap.has(routeName)) {
        routeMap.set(routeName, {
          name: routeName,
          stations: [],
          coordinates: [],
          trains: []
        });
      }

      const route = routeMap.get(routeName);
      route.stations.push(station.name);
      route.coordinates.push([station.lng, station.lat]);
    }
  }

  for (const route of routeMap.values()) {
    route.stations = [...new Set(route.stations)];
    // 仅做坐标合法性过滤，保留站点原始加入顺序，避免错误重排线路走向。
    route.coordinates = route.coordinates.filter(
      ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)
    );

    // 生成模拟车次：线路名前两个字拼接序号。
    const prefix = route.name.replace(/高铁|线路/g, "").slice(0, 2) || "G";
    route.trains = [1, 2, 3, 4, 5].map((n) => `${prefix}${(n * 7).toString().padStart(2, "0")}`);
  }

  return [...routeMap.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
};

/**
 * 输出 GeoJSON 文件。
 */
const writeStationsGeoJson = (stations) => {
  const geojson = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lng, station.lat]
      },
      properties: {
        id: station.id,
        name: station.name,
        lineNames: station.lineNames,
        routes: station.routes,
        bortle: station.bortle,
        lightPollution: station.lightPollution,
        stargazingIndex: station.stargazingIndex
      }
    }))
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "stations.geojson"), JSON.stringify(geojson, null, 2), "utf8");
};

/**
 * 输出路线 JSON 文件。
 */
const writeRoutesJson = (routes) => {
  fs.writeFileSync(path.join(OUTPUT_DIR, "routes.json"), JSON.stringify(routes, null, 2), "utf8");
};

/**
 * 主流程：优先拉取 Wikidata，失败则自动回退。
 */
const main = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let stations;
  try {
    stations = await fetchStationsFromWikidata();
    if (!stations.length) {
      throw new Error("Wikidata 返回空结果");
    }
    console.log(`✅ 已从 Wikidata 获取站点：${stations.length}`);
  } catch (error) {
    console.warn(`⚠️ Wikidata 获取失败，使用后备数据：${error.message}`);
    stations = loadFallbackStations();
    console.log(`✅ 后备站点数量：${stations.length}`);
  }

  const routes = buildRoutes(stations);
  writeStationsGeoJson(stations);
  writeRoutesJson(routes);

  console.log(`✅ 已输出 ${path.join("public", "data", "stations.geojson")}`);
  console.log(`✅ 已输出 ${path.join("public", "data", "routes.json")}`);
  console.log(`✅ 主要线路数量：${routes.length}`);
};

main().catch((error) => {
  console.error("❌ 数据生成失败：", error);
  process.exit(1);
});
