# railwaystar

China Railway Dark Sky Map（单页面应用）

## 数据来源（已在代码中引用）

- 铁路车站数据（GitHub）：`undef-i/China-Railway-Station-Database`
  - https://github.com/undef-i/China-Railway-Station-Database
- 高铁线路 GeoJSON（项目内 `data/high-speed-railway.json`，支持替换为 GitHub Raw 源）
- RailsMaps 中国铁路站点/铁路底图：`https://railsmaps.com/zh/china/stations`
  - 底层采用 RailsMaps / Protomaps 的矢量瓦片服务（`https://tiles.railsmaps.com/basemap/{z}/{x}/{y}`）
- 夜间灯光瓦片：NASA VIIRS CityLights WMTS（叠加在底图之上）
  - https://gibs.earthdata.nasa.gov/

## 本地运行

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```
