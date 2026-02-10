(function () {
  const GLOBAL_NAMESPACE = "dudaluz_psicologia_site";
  const GLOBAL_TOTAL_KEY = "site_total_views_v2";

  const KNOWN_PATHS = ["/", "/empresarial.html"];
  const KNOWN_REFERRERS = ["direto", "google.com", "instagram.com", "facebook.com", "linkedin.com", "t.co", "whatsapp.com"];
  const KNOWN_DEVICES = ["Android", "Iphone", "Computador"];

  const COUNTER_API_BASE_URL = "https://api.counterapi.dev/v1";
  const COUNT_API_COOLDOWN_MS = 10 * 60 * 1000;
  let countApiDisabledUntil = 0;

  function normalizePath(pathname) {
    if (!pathname || pathname === "") return "/";
    if (pathname.endsWith("/index.html")) return pathname.replace("index.html", "");
    return pathname;
  }

  function shouldTrackPath(path) {
    return !String(path || "").endsWith("/insights/");
  }

  function pathToKey(path) {
    const clean = path === "/" ? "home" : path.replace(/[^a-zA-Z0-9]/g, "_");
    return `path_${clean}_views_v2`;
  }

  function sanitizeKeyPart(value) {
    return String(value || "desconhecido").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
  }

  function referrerToKey(referrer) {
    return `referrer_${sanitizeKeyPart(referrer)}_views_v2`;
  }

  function deviceToKey(device) {
    return `device_${sanitizeKeyPart(device)}_views_v2`;
  }

  function dayToKey(day) {
    return `day_${day}_views_v1`;
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}_${month}_${day}`;
  }

  function lastNDaysKeys(days) {
    const keys = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = 0; i < days; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      keys.push(dayToKey(formatDateKey(d)));
    }
    return keys;
  }

  function normalizeReferrer(referrer) {
    if (!referrer) return "direto";
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      return host.replace(/^www\./, "");
    } catch (error) {
      return "direto";
    }
  }

  function detectDeviceType() {
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipod")) return "Iphone";
    if (ua.includes("android")) return "Android";
    return "Computador";
  }

  async function requestCounterApi(path, defaultPayload) {
    if (Date.now() < countApiDisabledUntil) return defaultPayload;

    const url = `${COUNTER_API_BASE_URL}${path}`;
    try {
      const response = await fetch(url, { method: "GET", cache: "no-store", keepalive: true });
      // Para leitura de chaves ainda não criadas, a API pode retornar 400.
      if (!response.ok) return defaultPayload;
      return await response.json();
    } catch (error) {
      countApiDisabledUntil = Date.now() + COUNT_API_COOLDOWN_MS;
      return defaultPayload;
    }
  }

  async function countApiHit(key) {
    const path = `/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}/up`;
    const payload = await requestCounterApi(path, null);
    return payload || { value: 0 };
  }

  async function countApiGet(key) {
    const path = `/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}/`;
    const payload = await requestCounterApi(path, { count: 0 });
    return { value: Number(payload.count) || 0 };
  }

  async function collectVisit() {
    const path = normalizePath(window.location.pathname || "/");
    if (!shouldTrackPath(path)) return;

    const referrer = normalizeReferrer(document.referrer || "");
    const device = detectDeviceType();

    try {
      await Promise.all([
        countApiHit(GLOBAL_TOTAL_KEY),
        countApiHit(dayToKey(formatDateKey(new Date()))),
        countApiHit(pathToKey(path)),
        countApiHit(referrerToKey(referrer)),
        countApiHit(deviceToKey(device))
      ]);
    } catch (error) {
      // Falha de rede não deve quebrar a navegação.
    }
  }

  function renderList(container, entries, emptyLabel) {
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = `<li><span>${emptyLabel}</span><strong>0</strong></li>`;
      return;
    }

    container.innerHTML = entries
      .map(function ([label, total]) { return `<li><span>${label}</span><strong>${total}</strong></li>`; })
      .join("");
  }

  async function renderInsights() {
    const root = document.getElementById("insights-root");
    if (!root) return;

    const globalTotalEl = document.getElementById("global-total-visits");
    const todayVisitsEl = document.getElementById("global-visits-today");
    const visits7dEl = document.getElementById("global-visits-7d");
    const visits30dEl = document.getElementById("global-visits-30d");
    const globalPagesEl = document.getElementById("global-top-pages");
    const globalReferrersEl = document.getElementById("global-top-referrers");
    const globalDevicesEl = document.getElementById("global-top-devices");

    try {
      const [total, ...pathCounts] = await Promise.all([
        countApiGet(GLOBAL_TOTAL_KEY),
        ...KNOWN_PATHS.map(function (path) { return countApiGet(pathToKey(path)); })
      ]);

      if (globalTotalEl) globalTotalEl.textContent = String(total.value || 0);

      const pageEntries = KNOWN_PATHS
        .map(function (path, index) { return [path, pathCounts[index].value || 0]; })
        .sort(function (a, b) { return b[1] - a[1]; });
      renderList(globalPagesEl, pageEntries, "Sem dados");

      const [todayCounts, last7Counts, last30Counts] = await Promise.all([
        Promise.all(lastNDaysKeys(1).map(function (key) { return countApiGet(key); })),
        Promise.all(lastNDaysKeys(7).map(function (key) { return countApiGet(key); })),
        Promise.all(lastNDaysKeys(30).map(function (key) { return countApiGet(key); }))
      ]);

      const sumValues = function (items) {
        return items.reduce(function (acc, item) { return acc + (item.value || 0); }, 0);
      };

      if (todayVisitsEl) todayVisitsEl.textContent = String(sumValues(todayCounts));
      if (visits7dEl) visits7dEl.textContent = String(sumValues(last7Counts));
      if (visits30dEl) visits30dEl.textContent = String(sumValues(last30Counts));

      const referrerCounts = await Promise.all(KNOWN_REFERRERS.map(function (referrer) {
        return countApiGet(referrerToKey(referrer));
      }));
      const referrerEntries = KNOWN_REFERRERS
        .map(function (referrer, index) { return [referrer, referrerCounts[index].value || 0]; })
        .filter(function (entry) { return entry[1] > 0; })
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 8);
      renderList(globalReferrersEl, referrerEntries, "Sem origens registradas");

      const deviceCounts = await Promise.all(KNOWN_DEVICES.map(function (device) {
        return countApiGet(deviceToKey(device));
      }));
      const deviceEntries = KNOWN_DEVICES
        .map(function (device, index) { return [device, deviceCounts[index].value || 0]; })
        .filter(function (entry) { return entry[1] > 0; })
        .sort(function (a, b) { return b[1] - a[1]; });
      renderList(globalDevicesEl, deviceEntries, "Sem dispositivos registrados");
    } catch (error) {
      if (globalTotalEl) globalTotalEl.textContent = "indisponível";
      if (todayVisitsEl) todayVisitsEl.textContent = "indisponível";
      if (visits7dEl) visits7dEl.textContent = "indisponível";
      if (visits30dEl) visits30dEl.textContent = "indisponível";
      renderList(globalPagesEl, [], "Falha ao carregar páginas");
      renderList(globalReferrersEl, [], "Falha ao carregar origens");
      renderList(globalDevicesEl, [], "Falha ao carregar dispositivos");
    }
  }

  collectVisit();
  document.addEventListener("DOMContentLoaded", function () {
    renderInsights();
  });
})();
