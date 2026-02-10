(function () {
  const GLOBAL_NAMESPACE = "dudaluz_psicologia_site";
  const GLOBAL_UNIQUE_VISITORS_KEY = "site_unique_visitors_v3";
  const GLOBAL_TOTAL_EVENTS_KEY = "site_total_events_v3";

  const KNOWN_PATHS = ["/", "/empresarial.html", "/insights/"];
  const GLOBAL_COUNTRIES = [
    "Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda", "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão", "Bahamas", "Bangladesh", "Barbados", "Barein", "Bélgica", "Belize", "Benin", "Belarus", "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burkina Faso", "Burundi", "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão", "Chade", "Chile", "China", "Chipre", "Cingapura", "Colômbia", "Comores", "Congo", "Coreia do Norte", "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba", "Dinamarca", "Djibuti", "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia", "Eslovênia", "Espanha", "Estados Unidos", "Estônia", "Eswatini", "Etiópia", "Fiji", "Filipinas", "Finlândia", "França", "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala", "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Honduras", "Hungria", "Iêmen", "Ilhas Marshall", "Índia", "Indonésia", "Irã", "Iraque", "Irlanda", "Islândia", "Israel", "Itália", "Jamaica", "Japão", "Jordânia", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia", "Luxemburgo", "Macedônia do Norte", "Madagascar", "Malásia", "Malawi", "Maldivas", "Mali", "Malta", "Marrocos", "Maurícia", "Mauritânia", "México", "Micronésia", "Moçambique", "Moldávia", "Mônaco", "Mongólia", "Montenegro", "Myanmar", "Namíbia", "Nauru", "Nepal", "Nicarágua", "Níger", "Nigéria", "Noruega", "Nova Zelândia", "Omã", "Países Baixos", "Palau", "Panamá", "Papua-Nova Guiné", "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal", "Quênia", "Quirguistão", "Reino Unido", "República Centro-Africana", "República Democrática do Congo", "República Dominicana", "República Tcheca", "Romênia", "Ruanda", "Rússia", "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Nevis", "São Tomé e Príncipe", "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Síria", "Somália", "Sri Lanka", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname", "Tailândia", "Taiwan", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago", "Tunísia", "Turcomenistão", "Turquia", "Tuvalu", "Ucrânia", "Uganda", "Uruguai", "Uzbequistão", "Vanuatu", "Vaticano", "Venezuela", "Vietnã", "Zâmbia", "Zimbábue", "Desconhecido"
  ];

  const COUNTER_ENDPOINTS = ["https://api.countapi.xyz", "https://countapi.xyz"];

  function sanitizeKey(value) {
    return String(value || "desconhecido").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
  }

  function normalizePath(pathname) {
    if (!pathname || pathname === "") return "/";
    if (pathname.endsWith("/index.html")) return pathname.replace("index.html", "");
    return pathname;
  }

  function pathUniqueKey(path) {
    const clean = path === "/" ? "home" : sanitizeKey(path);
    return `path_${clean}_unique_v3`;
  }

  function uniqueIpSeenKey(ip) {
    return `ip_${sanitizeKey(ip)}_seen_v3`;
  }

  function uniquePathIpSeenKey(path, ip) {
    return `path_${sanitizeKey(path)}_ip_${sanitizeKey(ip)}_seen_v3`;
  }

  function uniqueCountryIpSeenKey(country, ip) {
    return `country_${sanitizeKey(country)}_ip_${sanitizeKey(ip)}_seen_v3`;
  }

  function countryUniqueKey(country) {
    return `country_${sanitizeKey(country)}_unique_v3`;
  }

  async function requestCounter(pathname) {
    let lastError = null;
    for (const baseUrl of COUNTER_ENDPOINTS) {
      try {
        const response = await fetch(`${baseUrl}${pathname}`, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error(`Counter indisponível em ${baseUrl}`);
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Falha ao consultar contador global");
  }

  async function countApiHit(key) {
    return requestCounter(`/hit/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}`);
  }

  async function countApiGet(key) {
    const payload = await requestCounter(`/get/${encodeURIComponent(GLOBAL_NAMESPACE)}/${encodeURIComponent(key)}`);
    return { value: Number(payload.value) || 0 };
  }

  async function ensureUniqueHitOnce(uniqueMarkerKey, aggregateKeys) {
    const marker = await countApiGet(uniqueMarkerKey);
    if ((marker.value || 0) > 0) return false;

    await Promise.all([
      countApiHit(uniqueMarkerKey),
      ...aggregateKeys.map(function (key) { return countApiHit(key); })
    ]);
    return true;
  }

  async function resolveVisitorGeo() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 3000);
      const response = await fetch("https://ipwho.is/", { method: "GET", cache: "no-store", signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error("Falha ao obter geolocalização");

      const payload = await response.json();
      return {
        ip: payload.ip || "desconhecido",
        country: payload.country || "Desconhecido"
      };
    } catch (error) {
      return { ip: "desconhecido", country: "Desconhecido" };
    }
  }

  async function collectVisit() {
    const path = normalizePath(window.location.pathname || "/");
    const geo = await resolveVisitorGeo();

    try {
      await countApiHit(GLOBAL_TOTAL_EVENTS_KEY);

      await ensureUniqueHitOnce(uniqueIpSeenKey(geo.ip), [
        GLOBAL_UNIQUE_VISITORS_KEY
      ]);

      await ensureUniqueHitOnce(uniquePathIpSeenKey(path, geo.ip), [
        pathUniqueKey(path)
      ]);

      await ensureUniqueHitOnce(uniqueCountryIpSeenKey(geo.country, geo.ip), [
        countryUniqueKey(geo.country)
      ]);
    } catch (error) {
      // Mantém site funcional quando contador global estiver indisponível.
    }
  }

  function setGlobalLoadingState() {
    const uniqueVisitorsEl = document.getElementById("global-unique-visitors");
    const totalEventsEl = document.getElementById("global-total-events");
    const globalPagesEl = document.getElementById("global-top-pages");
    const globalCountriesEl = document.getElementById("global-top-countries");
    const updatedAtEl = document.getElementById("global-updated-at");

    if (uniqueVisitorsEl) uniqueVisitorsEl.textContent = "BUSCANDO...";
    if (totalEventsEl) totalEventsEl.textContent = "BUSCANDO...";
    if (globalPagesEl) globalPagesEl.innerHTML = "<li><span>BUSCANDO...</span><strong>...</strong></li>";
    if (globalCountriesEl) globalCountriesEl.innerHTML = "<li><span>BUSCANDO...</span><strong>...</strong></li>";
    if (updatedAtEl) updatedAtEl.textContent = "BUSCANDO...";
  }

  function setGlobalUnavailableState() {
    const uniqueVisitorsEl = document.getElementById("global-unique-visitors");
    const totalEventsEl = document.getElementById("global-total-events");
    const globalPagesEl = document.getElementById("global-top-pages");
    const globalCountriesEl = document.getElementById("global-top-countries");
    const updatedAtEl = document.getElementById("global-updated-at");

    if (uniqueVisitorsEl) uniqueVisitorsEl.textContent = "indisponível";
    if (totalEventsEl) totalEventsEl.textContent = "indisponível";
    if (globalPagesEl) globalPagesEl.innerHTML = "<li>Contador global indisponível no momento.</li>";
    if (globalCountriesEl) globalCountriesEl.innerHTML = "<li>Contador global indisponível no momento.</li>";
    if (updatedAtEl) updatedAtEl.textContent = "indisponível";
  }

  function renderList(containerId, entries, emptyLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `<li><span>${emptyLabel}</span><strong>0</strong></li>`;
      return;
    }

    container.innerHTML = entries
      .map(function ([label, total]) { return `<li><span>${label}</span><strong>${total}</strong></li>`; })
      .join("");
  }

  async function renderGlobalInsights() {
    const root = document.getElementById("insights-root");
    if (!root) return;

    setGlobalLoadingState();

    try {
      const [uniqueVisitors, totalEvents, ...pathCounters] = await Promise.all([
        countApiGet(GLOBAL_UNIQUE_VISITORS_KEY),
        countApiGet(GLOBAL_TOTAL_EVENTS_KEY),
        ...KNOWN_PATHS.map(function (path) { return countApiGet(pathUniqueKey(path)); })
      ]);

      const uniqueVisitorsEl = document.getElementById("global-unique-visitors");
      const totalEventsEl = document.getElementById("global-total-events");
      const updatedAtEl = document.getElementById("global-updated-at");

      if (uniqueVisitorsEl) uniqueVisitorsEl.textContent = String(uniqueVisitors.value || 0);
      if (totalEventsEl) totalEventsEl.textContent = String(totalEvents.value || 0);
      if (updatedAtEl) updatedAtEl.textContent = new Date().toLocaleString("pt-BR");

      const pageEntries = KNOWN_PATHS
        .map(function (path, index) { return [path, pathCounters[index].value || 0]; })
        .sort(function (a, b) { return b[1] - a[1]; });

      renderList("global-top-pages", pageEntries, "Sem páginas registradas");

      const countryCounters = await Promise.all(GLOBAL_COUNTRIES.map(function (country) {
        return countApiGet(countryUniqueKey(country));
      }));

      const countryEntries = GLOBAL_COUNTRIES
        .map(function (country, index) { return [country, countryCounters[index].value || 0]; })
        .filter(function (entry) { return entry[1] > 0; })
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 10);

      renderList("global-top-countries", countryEntries, "Sem dados globais de localização ainda");
    } catch (error) {
      setGlobalUnavailableState();
    }
  }

  collectVisit();
  document.addEventListener("DOMContentLoaded", function () {
    renderGlobalInsights();
  });
})();
