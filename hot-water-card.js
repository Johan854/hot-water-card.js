/*
 * Hot Water Tank Card (FR)
 * Carte Home Assistant pour ballon d'eau chaude (ECS) : ballon animé avec charge thermique et températures
 * haut/moyenne/bas, autonomie, performance du dernier cycle (COP), routeur solaire et commandes.
 * Style verre, thème clair/sombre automatique, éditeur visuel.
 */

const CARD_VERSION = "1.0.0";

const DEFAULTS = {
  title: "Ballon ECS",
  theme: "auto", // auto | light | dark
  // Ballon
  charge_entity: "", // charge thermique (%)
  energy_entity: "", // énergie stockée (kWh)
  max_energy: 0, // kWh à 100 % (0 = non affiché en barre)
  top_entity: "",
  avg_entity: "",
  bottom_entity: "",
  autonomy_entity: "", // nombre de douches
  volume_entity: "", // volume d'eau à 40 °C
  charge_warn: 75, // en dessous : orange
  charge_alert: 40, // en dessous : rouge
  // Dernier cycle
  cop_entity: "",
  thermal_entity: "",
  electric_entity: "",
  duration_entity: "",
  cop_good: 3.5,
  cop_ok: 2.5,
  // Routeur solaire
  router_entity: "", // utilisation du routeur (%)
  grid_entity: "",
  pv_entity: "",
  hp_entity: "",
  resistor_entity: "",
  hp_threshold: 10, // W : au-dessus, le groupe extérieur de la PAC s'affiche
  resistor_threshold: 0, // % du routeur : au-dessus, le symbole de résistance s'affiche
  toggles: [],
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = (v) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
const bad = (st) => !st || st.state === "unavailable" || st.state === "unknown";
let UID = 0;

class HotWaterCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("hot-water-card-editor");
  }

  static getStubConfig() {
    return { ...DEFAULTS, toggles: [] };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
    this._uid = ++UID;
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config };
    if (!Array.isArray(this._config.toggles)) this._config.toggles = [];
    this._sig = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = this._ids().map((e) => { const s = hass.states[e]; return s ? s.state : "x"; }).join("|") + "#" + (this._isDark() ? "d" : "l");
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  getCardSize() { return 8; }

  _ids() {
    const c = this._config;
    return [
      c.charge_entity, c.energy_entity, c.top_entity, c.avg_entity, c.bottom_entity, c.autonomy_entity, c.volume_entity,
      c.cop_entity, c.thermal_entity, c.electric_entity, c.duration_entity,
      c.router_entity, c.grid_entity, c.pv_entity, c.hp_entity, c.resistor_entity, ...c.toggles.map((t) => t.entity),
    ].filter(Boolean);
  }

  _isDark() {
    const t = this._config && this._config.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
    if (typeof dm === "boolean") return dm;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _num(eid) {
    const s = eid && this._hass.states[eid];
    return !bad(s) && isNum(s.state) ? Number(s.state) : null;
  }

  _fmt(n, max = 1) {
    const lang = (this._hass && this._hass.locale && this._hass.locale.language) || "fr";
    return new Intl.NumberFormat(lang, { maximumFractionDigits: Number.isInteger(Number(n)) ? 0 : max }).format(Number(n));
  }

  // valeur + unité d'une entité ("—" si indisponible)
  _val(eid, fallbackUnit = "") {
    const s = eid && this._hass.states[eid];
    if (bad(s)) return "—";
    if (!isNum(s.state)) return String(s.state);
    const u = s.attributes.unit_of_measurement !== undefined ? s.attributes.unit_of_measurement : fallbackUnit;
    return this._fmt(s.state) + (u ? " " + u : "");
  }

  _more(id) {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
  }

  _tone(charge) {
    const c = this._config;
    if (charge === null) return "off";
    if (charge > Number(c.charge_warn)) return "ok";
    if (charge > Number(c.charge_alert)) return "warn";
    return "err";
  }

  _tank(charge, tone) {
    const c = this._config;
    const pct = charge === null ? 0 : Math.max(0, Math.min(100, charge));
    const top = 30, bottom = 176, h = bottom - top;
    const y = bottom - (h * pct) / 100;
    const u = this._uid;
    const rt = this._num(c.router_entity);
    const resOn = rt !== null && rt > Number(c.resistor_threshold);
    const lbl = (eid, name, yy) => {
      if (!eid) return "";
      return `<g class="tl" data-more="${esc(eid)}"><line x1="92" y1="${yy}" x2="104" y2="${yy}" stroke="var(--tk-line)" stroke-width="1"/>
        <text x="108" y="${yy - 2}" class="tn">${esc(name)}</text><text x="108" y="${yy + 9}" class="tv">${esc(this._val(eid, "°C"))}</text></g>`;
    };
    return `
<svg viewBox="0 0 190 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="tk-c-${u}"><rect x="28" y="${top}" width="64" height="${h}" rx="10"/></clipPath>
    <linearGradient id="tk-g-${u}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--tk-fill)" stop-opacity="1"/><stop offset="1" stop-color="var(--tk-fill)" stop-opacity=".55"/>
    </linearGradient>
  </defs>
  <rect x="28" y="${top}" width="64" height="${h}" rx="10" fill="var(--tk-empty)"/>
  <g clip-path="url(#tk-c-${u})">
    <rect x="28" y="${y}" width="64" height="${bottom - y}" fill="url(#tk-g-${u})" class="lvl"/>
    ${pct > 0 ? `<path class="wave" d="M20 ${y} q 11 -5 22 0 t 22 0 t 22 0 t 22 0 V ${y + 8} H20Z" fill="var(--tk-fill)" opacity=".55"/>` : ""}
    <rect x="28" y="${top}" width="12" height="${h}" fill="#fff" opacity=".1"/>
  </g>
  <rect x="28" y="${top}" width="64" height="${h}" rx="10" fill="none" stroke="var(--tk-line)" stroke-width="1.6"/>
  <rect x="38" y="${top - 8}" width="44" height="9" rx="3" fill="var(--tk-empty)" stroke="var(--tk-line)"/>
  <rect x="44" y="${bottom}" width="8" height="12" fill="var(--tk-line)" opacity=".7"/><rect x="68" y="${bottom}" width="8" height="12" fill="var(--tk-line)" opacity=".7"/>
  ${resOn ? `<g class="elem"><title>Résistance en marche</title><path d="M36 154 h6 l4 -9 l8 18 l8 -18 l8 18 l4 -9 h6" fill="none" stroke="#ff6a3d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M36 154 h6 l4 -9 l8 18 l8 -18 l8 18 l4 -9 h6" fill="none" stroke="#ffd166" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></g>` : ""}
  <text x="60" y="${(top + bottom) / 2 + 6}" text-anchor="middle" class="pct">${charge === null ? "—" : Math.round(charge) + "%"}</text>
  ${lbl(c.top_entity, "Haut", top + 12)}${lbl(c.avg_entity, "Moyenne", (top + bottom) / 2 + 2)}${lbl(c.bottom_entity, "Bas", bottom - 16)}
</svg>`;
  }

  _stat(icon, label, eid, extra = "") {
    if (!eid) return "";
    return `<button class="stat ${extra}" data-more="${esc(eid)}"><ha-icon icon="${icon}"></ha-icon><span class="sl">${label}</span><span class="sv">${esc(this._val(eid))}</span></button>`;
  }

  _render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return;
    const dark = this._isDark();
    const charge = this._num(c.charge_entity);
    const tone = this._tone(charge);
    const energy = this._num(c.energy_entity);
    const maxE = Number(c.max_energy);

    // Groupe extérieur (PAC) : visible quand la puissance dépasse le seuil
    const hpW = this._num(c.hp_entity);
    const hpOn = hpW !== null && hpW > Number(c.hp_threshold);
    const outdoor = hpOn ? `
      <button class="odu" data-more="${esc(c.hp_entity)}" title="PAC en marche">
        <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="6" width="112" height="66" rx="8" fill="var(--tk-empty)" stroke="var(--tk-line)" stroke-width="1.6"/>
          <g stroke="var(--tk-line)" stroke-width="1.2" opacity=".7"><line x1="94" y1="16" x2="108" y2="16"/><line x1="94" y1="24" x2="108" y2="24"/><line x1="94" y1="32" x2="108" y2="32"/><line x1="94" y1="40" x2="108" y2="40"/><line x1="94" y1="48" x2="108" y2="48"/><line x1="94" y1="56" x2="108" y2="56"/><line x1="94" y1="64" x2="108" y2="64"/></g>
          <circle cx="48" cy="39" r="27" fill="none" stroke="var(--tk-line)" stroke-width="1.4"/>
          <circle cx="48" cy="39" r="21" fill="none" stroke="var(--tk-line)" stroke-width=".8" opacity=".6"/>
          <g class="spin" style="transform-origin:48px 39px"><path d="M48 39 C44 28 46 20 52 18 C56 24 54 33 48 39Z M48 39 C59 35 67 37 69 43 C63 47 54 45 48 39Z M48 39 C52 50 50 58 44 60 C40 54 42 45 48 39Z M48 39 C37 43 29 41 27 35 C33 31 42 33 48 39Z" fill="var(--tk-acc)" opacity=".9"/></g>
          <circle cx="48" cy="39" r="4" fill="var(--tk-line)"/>
          <rect x="14" y="72" width="14" height="6" rx="2" fill="var(--tk-line)" opacity=".6"/><rect x="92" y="72" width="14" height="6" rx="2" fill="var(--tk-line)" opacity=".6"/>
        </svg>
        <span class="sl"><ha-icon icon="mdi:heat-pump"></ha-icon>PAC en marche</span><span class="sv">${esc(this._val(c.hp_entity, "W"))}</span>
      </button>` : "";

    // Autonomie
    const autonomy = c.autonomy_entity || c.volume_entity ? `
      <div class="auto">
        ${c.autonomy_entity ? `<button class="stat big" data-more="${esc(c.autonomy_entity)}"><ha-icon icon="mdi:shower"></ha-icon><span class="sl">Autonomie</span><span class="sv">${esc(this._val(c.autonomy_entity, ""))}${isNum((h.states[c.autonomy_entity] || {}).state) ? " douches" : ""}</span></button>` : ""}
        ${c.volume_entity ? `<button class="stat big" data-more="${esc(c.volume_entity)}"><ha-icon icon="mdi:water-thermometer"></ha-icon><span class="sl">Eau à 40 °C</span><span class="sv">${esc(this._val(c.volume_entity, "L"))}</span></button>` : ""}
      </div>` : "";

    // Énergie stockée (barre)
    const energyBar = c.energy_entity ? `
      <button class="en" data-more="${esc(c.energy_entity)}">
        <span class="row"><span class="sl"><ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>Énergie stockée</span><span class="sv">${esc(this._val(c.energy_entity, "kWh"))}${maxE > 0 ? ` <small>/ ${this._fmt(maxE)}</small>` : ""}</span></span>
        ${maxE > 0 && energy !== null ? `<i class="bar ${energy > maxE ? "over" : ""}"><u style="width:${Math.max(0, Math.min(100, (energy / maxE) * 100))}%"></u></i>` : ""}
        ${maxE > 0 && energy !== null && energy > maxE ? `<span class="ov"><ha-icon icon="mdi:white-balance-sunny"></ha-icon>Surcharge solaire : +${this._fmt(energy - maxE)} kWh au-dessus de la référence</span>` : ""}
      </button>` : "";

    // Dernier cycle
    const cop = this._num(c.cop_entity);
    const copTone = cop === null ? "off" : cop >= Number(c.cop_good) ? "ok" : cop >= Number(c.cop_ok) ? "warn" : "err";
    const cycleHas = c.cop_entity || c.thermal_entity || c.electric_entity || c.duration_entity;
    const cycle = cycleHas ? `
      <div class="sec"><div class="st"><ha-icon icon="mdi:heat-pump"></ha-icon>Dernier cycle</div>
        <div class="tiles">
          ${c.cop_entity ? `<button class="tile ${copTone}" data-more="${esc(c.cop_entity)}"><span class="sl">COP</span><span class="sv">${esc(this._val(c.cop_entity))}</span></button>` : ""}
          ${c.thermal_entity ? `<button class="tile" data-more="${esc(c.thermal_entity)}"><span class="sl">Thermique</span><span class="sv">${esc(this._val(c.thermal_entity, "kWh"))}</span></button>` : ""}
          ${c.electric_entity ? `<button class="tile" data-more="${esc(c.electric_entity)}"><span class="sl">Électrique</span><span class="sv">${esc(this._val(c.electric_entity, "kWh"))}</span></button>` : ""}
          ${c.duration_entity ? `<button class="tile" data-more="${esc(c.duration_entity)}"><span class="sl">Durée</span><span class="sv">${esc(this._val(c.duration_entity, "min"))}</span></button>` : ""}
        </div></div>` : "";

    // Routeur solaire
    const router = this._num(c.router_entity);
    const routerHas = c.router_entity || c.grid_entity || c.pv_entity || c.hp_entity || c.resistor_entity;
    const pw = (eid, label, icon) => eid ? `<button class="tile" data-more="${esc(eid)}"><span class="sl"><ha-icon icon="${icon}"></ha-icon>${label}</span><span class="sv">${esc(this._val(eid, "W"))}</span></button>` : "";
    const solar = routerHas ? `
      <div class="sec"><div class="st"><ha-icon icon="mdi:solar-power-variant"></ha-icon>Routeur solaire</div>
        ${c.router_entity ? `<button class="en" data-more="${esc(c.router_entity)}"><span class="row"><span class="sl">Utilisation du routeur</span><span class="sv">${router === null ? "—" : Math.round(router) + " %"}</span></span>
          <i class="bar sun"><u style="width:${router === null ? 0 : Math.max(0, Math.min(100, router))}%"></u></i></button>` : ""}
        <div class="tiles">
          ${pw(c.grid_entity, "Réseau", "mdi:transmission-tower")}${pw(c.pv_entity, "PV", "mdi:solar-power-variant")}
          ${pw(c.hp_entity, "PAC", "mdi:heat-pump")}${pw(c.resistor_entity, "Résistance", "mdi:flash")}
        </div></div>` : "";

    // Commandes
    const toggles = c.toggles.filter((t) => t.entity).map((t, i) => {
      const s = h.states[t.entity];
      const na = bad(s);
      const on = !na && s.state === "on";
      const name = t.name || (s && s.attributes.friendly_name) || t.entity;
      const icon = t.icon || (s && s.attributes.icon) || "mdi:toggle-switch-variant";
      return `<button class="tg ${on ? "on" : ""} ${na ? "na" : ""}" data-t="${c.toggles.indexOf(t)}"><ha-icon icon="${esc(icon)}"></ha-icon><span class="tt"><b>${esc(name)}</b><small>${na ? "Indisponible" : on ? "Activé" : "Désactivé"}</small></span></button>`;
    }).join("");
    const controls = toggles ? `<div class="sec"><div class="st"><ha-icon icon="mdi:tune"></ha-icon>Pilotage</div><div class="tgs">${toggles}</div></div>` : "";

    const stateTxt = charge === null ? "Indisponible" : charge > 100 || (energy !== null && maxE > 0 && energy > maxE) ? "Surcharge solaire" : tone === "ok" ? "Bien chargé" : tone === "warn" ? "Charge moyenne" : "Charge faible";

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing:border-box; }
        ha-card.dark {
          --tk-text:#f4f6fb; --tk-muted:#a9afc0; --tk-bg:linear-gradient(160deg,#1b1e32 0%,#241a2a 55%,#2d1519 100%);
          --tk-border:rgba(255,255,255,.14); --tk-shadow:0 .6em 2em rgba(0,0,0,.35);
          --tk-glass:rgba(255,255,255,.07); --tk-glass-b:rgba(255,255,255,.13); --tk-fillc:rgba(255,255,255,.09); --tk-fill-b:rgba(255,255,255,.16);
          --tk-ok:#3ddc84; --tk-warn:#ffb86b; --tk-err:#ff5a5f; --tk-off:#8a8f9c; --tk-acc:#4fc3f7; --tk-sun:#ffd166;
          --tk-line:#8a93a8; --tk-empty:rgba(255,255,255,.06);
        }
        ha-card.light {
          --tk-text:#1c2030; --tk-muted:#5d6477; --tk-bg:linear-gradient(160deg,#f8f9fd 0%,#eef1f8 55%,#f8eff0 100%);
          --tk-border:rgba(20,24,40,.12); --tk-shadow:0 .4em 1.4em rgba(20,24,40,.12);
          --tk-glass:rgba(255,255,255,.7); --tk-glass-b:rgba(20,24,40,.1); --tk-fillc:rgba(20,24,40,.06); --tk-fill-b:rgba(20,24,40,.14);
          --tk-ok:#1a9d55; --tk-warn:#c77a14; --tk-err:#d32f35; --tk-off:#8a8f9c; --tk-acc:#0f8fc4; --tk-sun:#d99a00;
          --tk-line:#8d95a8; --tk-empty:rgba(20,24,40,.05);
        }
        ha-card { --tk-fill:var(--tk-${tone}); display:flex; flex-direction:column; gap:14px; padding:16px; overflow:hidden; color:var(--tk-text);
          border-radius:24px; border:1px solid var(--tk-border); background:var(--tk-bg); box-shadow:var(--tk-shadow); }
        ha-icon { --mdc-icon-size:1.15em; flex:none; }
        button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; padding:0; text-align:left; -webkit-tap-highlight-color:transparent; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .head b { font-size:1.1em; font-weight:650; display:flex; align-items:center; gap:.5em; }
        .badge { font-size:.78em; font-weight:650; padding:.3em .8em; border-radius:2em; color:var(--tk-${tone}); background:var(--tk-fillc); border:1px solid currentColor; }
        .panel { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:10px; align-items:center; padding:12px; border-radius:18px;
          background:var(--tk-glass); border:1px solid var(--tk-glass-b); -webkit-backdrop-filter:blur(18px) saturate(140%); backdrop-filter:blur(18px) saturate(140%); }
        .panel svg { width:100%; height:auto; display:block; max-width:230px; }
        .tn { font-size:7.5px; fill:var(--tk-muted); font-family:inherit; } .tv { font-size:11px; font-weight:700; fill:var(--tk-text); font-family:inherit; }
        .pct { font-size:20px; font-weight:800; fill:var(--tk-text); font-family:inherit; paint-order:stroke; stroke:var(--tk-empty); stroke-width:3px; }
        .tl { cursor:pointer; }
        .wave { animation:tk-wave 4s linear infinite; } @keyframes tk-wave { to { transform:translateX(-22px); } }
        .side { display:flex; flex-direction:column; gap:8px; min-width:0; }
        .stat { display:flex; flex-direction:column; gap:.15em; padding:.55em .7em; border-radius:.9em; background:var(--tk-fillc); border:1px solid var(--tk-fill-b); min-width:0; }
        .sl { display:flex; align-items:center; gap:.4em; font-size:.74em; color:var(--tk-muted); }
        .sv { font-size:1.05em; font-weight:700; font-variant-numeric:tabular-nums; }
        .sv small { font-weight:500; color:var(--tk-muted); }
        .odu { display:flex; flex-direction:column; gap:.2em; padding:.5em .6em; border-radius:.9em; background:var(--tk-fillc); border:1px solid var(--tk-acc); }
        .odu svg { width:100%; max-width:130px; align-self:center; height:auto; }
        .odu .sl ha-icon { display:inline-block; }
        .spin { animation:tk-spin 1s linear infinite; } @keyframes tk-spin { to { transform:rotate(360deg); } }
        .elem { animation:tk-elem 1.2s ease-in-out infinite; filter:drop-shadow(0 0 3px #ff6a3d); } @keyframes tk-elem { 50% { opacity:.45; } }
        .auto { display:flex; flex-direction:column; gap:8px; }
        .stat ha-icon { display:none; }
        .en { display:flex; flex-direction:column; gap:.45em; padding:.7em .85em; border-radius:1em; background:var(--tk-glass); border:1px solid var(--tk-glass-b); width:100%; }
        .row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .bar { display:block; height:.45em; border-radius:.3em; background:var(--tk-fill-b); overflow:hidden; }
        .bar u { display:block; height:100%; border-radius:inherit; background:var(--tk-acc); text-decoration:none; transition:width .4s; }
        .bar.over u { background:var(--tk-sun); }
        .ov { display:flex; align-items:center; gap:.4em; font-size:.74em; font-weight:600; color:var(--tk-sun); }
        .bar.sun u { background:var(--tk-sun); }
        .sec { display:flex; flex-direction:column; gap:8px; }
        .st { display:flex; align-items:center; gap:.5em; font-size:.8em; font-weight:650; color:var(--tk-muted); text-transform:uppercase; letter-spacing:.07em; }
        .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(5.2em,1fr)); gap:8px; }
        .tile { display:flex; flex-direction:column; gap:.3em; padding:.6em .75em; border-radius:1em; background:var(--tk-glass); border:1px solid var(--tk-glass-b); min-width:0; }
        .tile.ok .sv { color:var(--tk-ok); } .tile.warn .sv { color:var(--tk-warn); } .tile.err .sv { color:var(--tk-err); }
        .tgs { display:grid; grid-template-columns:repeat(auto-fit,minmax(9em,1fr)); gap:8px; }
        .tg { display:flex; align-items:center; gap:.6em; padding:.6em .75em; border-radius:1em; background:var(--tk-glass); border:1px solid var(--tk-glass-b); min-width:0; }
        .tg ha-icon { --mdc-icon-size:1.4em; color:var(--tk-muted); }
        .tg .tt { display:flex; flex-direction:column; min-width:0; } .tg b { font-size:.84em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .tg small { font-size:.72em; color:var(--tk-muted); }
        .tg.on { border-color:var(--tk-sun); } .tg.on ha-icon { color:var(--tk-sun); } .tg.na { opacity:.45; cursor:default; }
        @media (prefers-reduced-motion: reduce) { .wave, .spin, .elem { animation:none; } }
      </style>
      <ha-card class="${dark ? "dark" : "light"}">
        <div class="head"><b><ha-icon icon="mdi:water-boiler"></ha-icon>${esc(c.title)}</b><span class="badge">${esc(stateTxt)}</span></div>
        <div class="panel">
          <div>${this._tank(charge, tone)}</div>
          <div class="side">${outdoor}${autonomy}</div>
        </div>
        ${energyBar}
        ${cycle}
        ${solar}
        ${controls}
      </ha-card>`;

    const root = this.shadowRoot;
    root.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", () => this._more(el.dataset.more)));
    root.querySelectorAll("[data-t]").forEach((el) => {
      const t = c.toggles[Number(el.dataset.t)];
      let timer, held = false;
      el.addEventListener("pointerdown", () => { held = false; timer = setTimeout(() => { held = true; this._more(t.entity); }, 550); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.addEventListener(ev, () => clearTimeout(timer)));
      el.addEventListener("click", () => {
        if (held || el.classList.contains("na")) return;
        const [d] = t.entity.split(".");
        if (d === "button" || d === "input_button") h.callService(d, "press", { entity_id: t.entity });
        else if (d === "script" || d === "scene") h.callService(d, "turn_on", { entity_id: t.entity });
        else h.callService("homeassistant", "toggle", { entity_id: t.entity });
      });
    });
  }
}

/* ---------- Éditeur visuel ---------- */
const LABELS = {
  title: "Titre", theme: "Thème",
  charge_entity: "Charge thermique (%)", energy_entity: "Énergie stockée (kWh)", max_energy: "Énergie de référence à 100 % (kWh, peut être dépassée ; 0 = sans barre)",
  top_entity: "Température haut", avg_entity: "Température moyenne", bottom_entity: "Température bas",
  autonomy_entity: "Autonomie (douches)", volume_entity: "Volume d'eau à 40 °C",
  charge_warn: "Charge « moyenne » en dessous de (%)", charge_alert: "Charge « faible » en dessous de (%)",
  cop_entity: "COP du dernier cycle", thermal_entity: "Énergie thermique du cycle", electric_entity: "Énergie électrique du cycle", duration_entity: "Durée du cycle",
  cop_good: "COP « bon » à partir de", cop_ok: "COP « correct » à partir de",
  router_entity: "Utilisation du routeur / triac (%)", hp_threshold: "Afficher le groupe extérieur au-dessus de (W)", resistor_threshold: "Afficher la résistance au-dessus de (%)", grid_entity: "Puissance réseau", pv_entity: "Puissance PV", hp_entity: "Puissance PAC", resistor_entity: "Puissance résistance",
  entity: "Entité", name: "Nom (facultatif)", icon: "Icône",
};
const ent = (name, domain) => ({ name, selector: { entity: domain ? { domain } : {} } });
const num = (name, min = 0, max = 100, step = 1) => ({ name, selector: { number: { min, max, step, mode: "box" } } });
const MAIN_SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "theme", selector: { select: { mode: "dropdown", options: [
    { value: "auto", label: "Automatique (thème de Home Assistant)" }, { value: "light", label: "Clair" }, { value: "dark", label: "Sombre" } ] } } },
  { type: "expandable", title: "Ballon", name: "", schema: [
    ent("charge_entity", "sensor"), ent("energy_entity", "sensor"), num("max_energy", 0, 100, 0.1),
    ent("top_entity", "sensor"), ent("avg_entity", "sensor"), ent("bottom_entity", "sensor"),
    ent("autonomy_entity", "sensor"), ent("volume_entity", "sensor"),
    { type: "grid", name: "", schema: [num("charge_warn"), num("charge_alert")] },
  ] },
  { type: "expandable", title: "Dernier cycle", name: "", schema: [
    ent("cop_entity"), ent("thermal_entity"), ent("electric_entity"), ent("duration_entity"),
    { type: "grid", name: "", schema: [num("cop_good", 0, 10, 0.1), num("cop_ok", 0, 10, 0.1)] },
  ] },
  { type: "expandable", title: "Routeur solaire", name: "", schema: [
    ent("router_entity", "sensor"), ent("grid_entity", "sensor"), ent("pv_entity", "sensor"), ent("hp_entity", "sensor"), ent("resistor_entity", "sensor"),
    { type: "grid", name: "", schema: [num("hp_threshold", 0, 5000, 1), num("resistor_threshold", 0, 100, 1)] },
  ] },
];
const TOGGLE_SCHEMA = [
  { name: "entity", selector: { entity: { domain: ["switch", "input_boolean", "automation", "light", "script"] } } },
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} } }] },
];

class HotWaterCardEditor extends HTMLElement {
  setConfig(config) {
    const next = { ...DEFAULTS, ...config, toggles: (config.toggles || []).map((t) => ({ ...t })) };
    const same = this._config && this._built && next.toggles.length === this._config.toggles.length;
    this._config = next;
    if (!same) return this._build();
    const forms = this.querySelectorAll("ha-form");
    forms[0].data = this._config;
    this._config.toggles.forEach((t, i) => { forms[i + 1].data = t; });
  }

  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll("ha-form").forEach((f) => (f.hass = hass));
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _build() {
    this._built = true;
    this.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `.bx{border:1px solid var(--divider-color);border-radius:12px;padding:10px;margin:12px 0}
      .bx .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:600}
      .bx button,.add{cursor:pointer;border:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;padding:6px 10px}
      .add{width:100%;margin:4px 0 12px}`;
    this.appendChild(style);

    const main = document.createElement("ha-form");
    main.hass = this._hass;
    main.data = this._config;
    main.computeLabel = (s) => LABELS[s.name] || s.name;
    main.schema = MAIN_SCHEMA;
    main.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value, toggles: this._config.toggles };
      this._emit();
    });
    this.appendChild(main);

    const h3 = document.createElement("h3");
    h3.textContent = "Pilotage (interrupteurs, automatisations…)";
    this.appendChild(h3);
    this._config.toggles.forEach((t, i) => {
      const box = document.createElement("div");
      box.className = "bx";
      box.innerHTML = `<div class="h"><span>Commande ${i + 1}</span><span><button data-up="${i}">↑</button> <button data-down="${i}">↓</button> <button data-del="${i}">✕</button></span></div>`;
      const f = document.createElement("ha-form");
      f.hass = this._hass;
      f.data = t;
      f.computeLabel = (s) => LABELS[s.name] || s.name;
      f.schema = TOGGLE_SCHEMA;
      f.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config.toggles[i] = { ...ev.detail.value };
        this._emit();
      });
      box.appendChild(f);
      this.appendChild(box);
    });
    const add = document.createElement("button");
    add.className = "add";
    add.textContent = "+ Ajouter une commande";
    add.addEventListener("click", () => { this._config.toggles.push({ entity: "" }); this._emit(); this._build(); });
    this.appendChild(add);

    this.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { this._config.toggles.splice(Number(b.dataset.del), 1); this._emit(); this._build(); }));
    this.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => this._move(Number(b.dataset.up), -1)));
    this.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => this._move(Number(b.dataset.down), 1)));
  }

  _move(i, d) {
    const j = i + d, a = this._config.toggles;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    this._emit();
    this._build();
  }
}

customElements.define("hot-water-card", HotWaterCard);
customElements.define("hot-water-card-editor", HotWaterCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "hot-water-card",
  name: "Hot Water Tank Card (FR)",
  description: "Ballon d'eau chaude : charge, températures, autonomie, COP du dernier cycle, routeur solaire et commandes.",
  preview: true,
});

console.info(
  `%c HOT-WATER-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#e5533d;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#e5533d;background:#fff;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px"
);
