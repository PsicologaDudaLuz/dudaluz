(function () {
  const VISITOR_ID_KEY = "dudaluz_visitor_id";
  const VISITS_KEY = "dudaluz_visits";
  const MAX_STORED_VISITS = 2000;

  function safeReadVisits() {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function safeWriteVisits(visits) {
    try {
      localStorage.setItem(VISITS_KEY, JSON.stringify(visits.slice(-MAX_STORED_VISITS)));
    } catch (error) {
      // Silently ignore storage failures.
    }
  }

  function getVisitorId() {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) {
      return existing;
    }

    const generated = (self.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `v-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  }

  function collectVisit() {
    const visit = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      visitorId: getVisitorId(),
      timestamp: new Date().toISOString(),
      path: window.location.pathname || "/",
      fullUrl: window.location.href,
      referrer: document.referrer || "direto",
      language: navigator.language || "desconhecido",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "desconhecido",
      platform: navigator.platform || "desconhecido",
      userAgent: navigator.userAgent || "desconhecido",
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };

    const visits = safeReadVisits();
    visits.push(visit);
    safeWriteVisits(visits);
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleString("pt-BR");
  }

  function normalizeReferrer(referrer) {
    if (!referrer || referrer === "direto") return "direto";

    try {
      const url = new URL(referrer);
      return url.hostname;
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

  function renderInsights() {
    const root = document.getElementById("insights-root");
    if (!root) return;

    const visits = safeReadVisits().sort(function (a, b) {
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
      tableBody.innerHTML = '<tr><td colspan="8">Nenhuma visita registrada ainda.</td></tr>';
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
          <td title="${visit.userAgent || "-"}">${(visit.platform || "-")}</td>
        </tr>`;
      })
      .join("");
  }

  collectVisit();
  document.addEventListener("DOMContentLoaded", renderInsights);
})();
