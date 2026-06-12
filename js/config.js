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

export const LIGHT_POLLUTION_OVERLAY = {
  url:
    "https://www.lightpollutionmap.info/geoserver/PostGIS/wms?service=WMS&version=1.1.0&request=GetMap&layers=PostGIS:SB_2025_raw&styles=WA_select&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}",
  options: {
    opacity: 0.6,
    attribution: 'Light pollution overlay: <a href="https://www.lightpollutionmap.info/" target="_blank" rel="noopener noreferrer">lightpollutionmap.info</a>'
  }
};

export const BASEMAP = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  options: {
    subdomains: "abcd",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
  }
};

export const DEFAULT_TRAIN_CODES = ["G1001", "G1003", "G1005"];
