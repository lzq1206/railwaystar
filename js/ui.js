export const setLoading = (isLoading) => {
  document.getElementById("loading").classList.toggle("hidden", !isLoading);
};

export const fillLineSelector = (lines, query = "") => {
  const selector = document.getElementById("line-selector");
  const keyword = query.trim();
  const filtered = keyword
    ? lines.filter((line) => line.properties.name.includes(keyword))
    : lines;

  selector.innerHTML = "";
  filtered.forEach((line) => {
    const option = document.createElement("option");
    option.value = line.properties.name;
    option.textContent = line.properties.name;
    selector.append(option);
  });

  return filtered;
};

export const renderTrainList = (trainCodes = []) => {
  const list = document.getElementById("train-list");
  list.innerHTML = "";

  trainCodes.forEach((code) => {
    const item = document.createElement("li");
    item.textContent = `• ${code}`;
    list.append(item);
  });
};

export const renderDarkStationRank = (stations) => {
  const list = document.getElementById("dark-station-list");
  list.innerHTML = "";

  stations.forEach((station, index) => {
    const item = document.createElement("li");
    item.className = "rounded border border-slate-700 bg-slate-900/70 p-2";
    item.innerHTML = `<div class="font-medium text-cyan-100">#${index + 1} ${station.name}</div><div class="text-slate-300">光污染值: ${station.lightValue} / 100</div>`;
    list.append(item);
  });
};

export const renderStationPanel = ({ name, lineName, lightValue, bortle, description }) => {
  const panel = document.getElementById("station-panel");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h3 class="mb-2 text-base font-semibold text-cyan-200">${name}</h3>
    <ul class="space-y-1 text-sm text-slate-200">
      <li>所属线路：${lineName}</li>
      <li>光污染估值：${lightValue} / 100</li>
      <li>波特尔暗空等级（估算）：${bortle}</li>
      <li>描述：${description}</li>
    </ul>
  `;
};
