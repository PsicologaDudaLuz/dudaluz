(function () {
  const LOCAL_VISITOR_ID_KEY = "dudaluz_local_visitor_id";
  const LOCAL_VISITS_KEY = "dudaluz_local_visits";
  const MAX_LOCAL_VISITS = 2000;

  // Namespace global compartilhado entre todos os visitantes do site.
  const GLOBAL_NAMESPACE = "dudaluz_psicologia_site";
  const GLOBAL_TOTAL_KEY = "site_total_views_v1";

  const KNOWN_PATHS = ["/", "/empresarial.html", "/insights/"];

  function normalizePath(pathname) {
    if (!pathname || pathname === "") return "/";
    if (pathname.endsWith("/index.html")) return pathname.replace("index.html", "");
    return pathname;
  }

  function pathToKey(path) {
    const clean = path === "/" ? "home" : path.replace(/[^a-zA-Z0-9]/g, "_");
    return `path_${clean}_views_v1`;
  }

  function safeReadLocalVisits() {
    try {
      const raw = localStorage.getItem(LOCAL_VISITS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function safeWriteLocalVisits(visits) {
    try {
      localStorage.setItem(LOCAL_VISITS_KEY, JSON.stringify(visits.slice(-MAX_LOCAL_VISITS)));
    } catch (error) {
      // Ignora falhas de storage sem quebrar UX.
    }
  }

  function getLocalVisitorId() {
    const existing = localStorage.getItem(LOCAL_VISITOR_ID_KEY);
    if (existing) return existing;

    const generated = (self.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `v-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    localStorage.setItem(LOCAL_VISITOR_ID_KEY, generated);
    return generated;
  }

  async function countApiHit(key) {
    const url = `https://api.countapi.xyz/hit/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}`;
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao registrar contador global");
    return response.json();
  }

  async function countApiGet(key) {
    const url = `https://api.countapi.xyz/get/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}`;
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) return { value: 0 };
    const payload = await response.json();
    return { value: Number(payload.value) || 0 };
  }

  async function collectVisit() {
    const path = normalizePath(window.location.pathname || "/");
    const visit = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      visitorId: getLocalVisitorId(),
      timestamp: new Date().toISOString(),
      path,
      fullUrl: window.location.href,
      referrer: document.referrer || "direto",
      language: navigator.language || "desconhecido",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "desconhecido",
      platform: navigator.platform || "desconhecido",
      userAgent: navigator.userAgent || "desconhecido",
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };

    const visits = safeReadLocalVisits();
    visits.push(visit);
    safeWriteLocalVisits(visits);

    // Contador global (todos os visitantes/dispositivos).
    try {
      await Promise.all([
        countApiHit(GLOBAL_TOTAL_KEY),
        countApiHit(pathToKey(path))
      ]);
    } catch (error) {
      // Se rede falhar, o local continua funcionando.
    }
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
  }

  function normalizeReferrer(referrer) {
    if (!referrer || referrer === "direto") return "direto";
    try {
      return new URL(referrer).hostname;
    } catch (error) {
      return referrer;
    }
  }

  function groupCount(items, selector) {
    return items.reduce(function (acc, item) {
      const key = selector(item) || "desconhecido";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function topEntries(map, limit) {
    return Object.entries(map)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, limit);
  }

  function renderTopList(containerId, entries, labelEmpty) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `<li>${labelEmpty}</li>`;
      return;
    }

    container.innerHTML = entries
      .map(function ([label, total]) { return `<li><span>${label}</span><strong>${total}</strong></li>`; })
      .join("");
  }

  async function renderGlobalInsights() {
    const globalTotalEl = document.getElementById("global-total-visits");
    const globalPagesEl = document.getElementById("global-top-pages");
    if (!globalTotalEl && !globalPagesEl) return;

    try {
      const [globalTotal, ...pathCounters] = await Promise.all([
        countApiGet(GLOBAL_TOTAL_KEY),
        ...KNOWN_PATHS.map(function (path) { return countApiGet(pathToKey(path)); })
      ]);

      if (globalTotalEl) {
        globalTotalEl.textContent = String(globalTotal.value || 0);
      }

      if (globalPagesEl) {
        const entries = KNOWN_PATHS
          .map(function (path, index) { return [path, pathCounters[index].value || 0]; })
          .sort(function (a, b) { return b[1] - a[1]; });

        globalPagesEl.innerHTML = entries
          .map(function ([path, total]) { return `<li><span>${path}</span><strong>${total}</strong></li>`; })
          .join("");
      }
    } catch (error) {
      if (globalTotalEl) globalTotalEl.textContent = "indisponível";
      if (globalPagesEl) {
        globalPagesEl.innerHTML = "<li>Falha ao carregar dados globais no momento.</li>";
      }
    }
  }

  async function renderInsights() {
    const root = document.getElementById("insights-root");
    if (!root) return;

    await renderGlobalInsights();

    const visits = safeReadLocalVisits().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const uniqueVisitors = new Set(visits.map(function (visit) { return visit.visitorId; })).size;
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const visitsToday = visits.filter(function (visit) {
      const t = new Date(visit.timestamp).getTime();
      return t >= startOfToday.getTime();
    }).length;

    const visitsLast7Days = visits.filter(function (visit) {
      const t = new Date(visit.timestamp).getTime();
      return t >= (now - (7 * 24 * 60 * 60 * 1000));
    }).length;

    const pageCounts = groupCount(visits, function (visit) { return visit.path || "/"; });
    const referrerCounts = groupCount(visits, function (visit) { return normalizeReferrer(visit.referrer); });

    const totalEl = document.getElementById("total-visits");
    const uniqueEl = document.getElementById("unique-visitors");
    const todayEl = document.getElementById("visits-today");
    const last7El = document.getElementById("visits-7d");
    const lastVisitEl = document.getElementById("last-visit");

    if (totalEl) totalEl.textContent = String(visits.length);
    if (uniqueEl) uniqueEl.textContent = String(uniqueVisitors);
    if (todayEl) todayEl.textContent = String(visitsToday);
    if (last7El) last7El.textContent = String(visitsLast7Days);
    if (lastVisitEl) lastVisitEl.textContent = visits[0] ? formatDateTime(visits[0].timestamp) : "Sem dados";

    renderTopList("top-pages", topEntries(pageCounts, 5), "Sem páginas registradas");
    renderTopList("top-referrers", topEntries(referrerCounts, 5), "Sem origens registradas");

    const tableBody = document.getElementById("insights-table-body");
    if (!tableBody) return;

    if (!visits.length) {
      tableBody.innerHTML = '<tr><td colspan="8">Nenhuma visita registrada neste navegador ainda.</td></tr>';
      return;
    }

    tableBody.innerHTML = visits
      .slice(0, 50)
      .map(function (visit) {
        return `<tr>
          <td>${formatDateTime(visit.timestamp)}</td>
          <td>${visit.path || "-"}</td>
          <td>${normalizeReferrer(visit.referrer)}</td>
          <td>${visit.language || "-"}</td>
          <td>${visit.timezone || "-"}</td>
          <td>${visit.screen || "-"}</td>
          <td>${visit.viewport || "-"}</td>
          <td title="${visit.userAgent || "-"}">${visit.platform || "-"}</td>
        </tr>`;
      })
      .join("");
  }

  collectVisit();
  document.addEventListener("DOMContentLoaded", function () {
    renderInsights();
  });
})();
