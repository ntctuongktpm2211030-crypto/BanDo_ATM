const map = L.map("map").setView([10.03, 105.77], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const bankSelect = document.getElementById("bankFilter");
const countLabel = document.getElementById("countLabel");

let allAtms = [];

async function loadATM() {
  try {
    const res = await fetch("/api/atm");
    const data = await res.json();
    allAtms = data;
    populateBankSelect(data);
    renderMarkers(data);
  } catch (err) {
    console.error("Lỗi tải ATM:", err);
    countLabel.textContent = "Không tải được dữ liệu ATM!";
  }
}

function populateBankSelect(list) {
  const banks = Array.from(
    new Set(
      list
        .map((x) => x.bank || x.name)
        .filter(Boolean)
        .map((x) => x.trim())
    )
  ).sort();
  banks.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    bankSelect.appendChild(opt);
  });
}

function renderMarkers(list) {
  markersLayer.clearLayers();
  let count = 0;
  list.forEach((a) => {
    if (!a.lat || !a.lng) return;
    const marker = L.marker([a.lat, a.lng]);
    marker.bindPopup(`
      <b>${a.bank || a.name || "ATM"}</b><br/>
      ${a.address ? "📍 " + a.address + "<br/>" : ""}
      Nguồn: ${a.source || "?"}
    `);
    marker.addTo(markersLayer);
    count++;
  });
  countLabel.textContent = `Hiển thị: ${count} ATM`;
}

bankSelect.addEventListener("change", () => {
  const val = bankSelect.value;
  if (!val) {
    renderMarkers(allAtms);
  } else {
    const filtered = allAtms.filter((x) =>
      (x.bank || x.name || "").includes(val)
    );
    renderMarkers(filtered);
  }
});

loadATM();
