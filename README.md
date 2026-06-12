# RailwayStar

中国高铁暗夜巡礼地图。

## 功能

- 自动加载 `./data/high-speed-railway.json`
- 使用 Leaflet + 深色底图 + NASA VIIRS 夜间灯光叠加
- 支持线路搜索、线路选择、暗夜站点排行
- 点击站点查看光污染估值与暗空等级

## 本地运行

用任意静态服务器打开即可，例如：

```bash
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000/`

## 数据位置

- `./data/high-speed-railway.json`
- `./data/stations-fallback.json`
- `./data/light-pollution-reference.json`
