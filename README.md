# railwaystar

China Railway Dark Sky Map（单页面应用）

## 数据来源（已在代码中引用）

- 铁路车站数据（GitHub）：`undef-i/China-Railway-Station-Database`
  - https://github.com/undef-i/China-Railway-Station-Database
- 高铁线路 GeoJSON（项目内 `data/high-speed-railway.json`，支持替换为 GitHub Raw 源）
- 夜间灯光瓦片：NASA VIIRS CityLights WMTS（通过 Leaflet TileLayer 叠加）
  - https://gibs.earthdata.nasa.gov/

## 本地运行

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```
