export const DATA_SOURCES = {
  lines: [
    "https://raw.githubusercontent.com/lzq1206/railwaystar/main/data/high-speed-railway.json",
    "./data/high-speed-railway.json"
  ],
  stations: [
    "https://raw.githubusercontent.com/undef-i/China-Railway-Station-Database/f8df6545e2200fd96a1b778b3f244870d01ff434/data.json",
    "./data/stations-fallback.json"
  ],
  lightRef: ["./data/light-pollution-reference.json"]
};

export const LIGHT_POLLUTION_TILE = {
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/2012-12-31/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
  options: {
    opacity: 0.5,
    maxZoom: 8,
    tileSize: 256,
    attribution:
      'Night Lights: <a href="https://earthdata.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA EarthData / VIIRS</a>'
  }
};

export const BASEMAP = {
  url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
  options: {
    subdomains: "1234",
    maxZoom: 19,
    attribution: ""
  }
};

export const DEFAULT_TRAIN_CODES = ["G1001", "G1003", "G1005"];
