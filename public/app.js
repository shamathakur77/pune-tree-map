/* Zaadancha Naksha — झाडांचा नकाशा
   Pune Tree Census 2019, made explorable.
   Vanilla JS + Leaflet. No backend, no API keys, no cookies, no storage,
   no analytics. Every number on screen comes from public/data/*, which is
   built from the census by scripts/aggregate.py. Nothing is invented in JS. */

(function () {
  "use strict";

  var DATA = "data/";
  var PUNE = [18.5204, 73.8567];

  var MONTHS_MR = ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून",
                   "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"];
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"];

  var RAMP_LIGHT = ["#dcefd7", "#abd7a2", "#6fb869", "#3a9440", "#216c2e", "#114620"];
  var RAMP_DARK  = ["#1d4a1e", "#276227", "#33792f", "#46913b", "#6fb869", "#a5d69a"];

  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var RAMP = dark ? RAMP_DARK : RAMP_LIGHT;

  var S = {                     // everything loaded, nothing synthesised
    meta: null, species: null, wards: null, names: null, tileIndex: null,
    rare: null, giants: null,
    speciesByKey: {},
    tilesLoaded: {}, cellLayer: null, rareLayer: null, giantLayer: null,
    map: null, renderer: null,
    month: new Date().getMonth() + 1,
    treasureMode: "rare",
    wardSort: "count"
  };

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }

  function nf(n) {
    if (n === null || n === undefined) return "—";
    try { return Number(n).toLocaleString("en-IN"); }
    catch (e) { return String(n); }
  }
  function pct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(digits === undefined ? 1 : digits) + "%";
  }
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // Marathi name first, then English common name, then botanical. Never blank.
  function label(key) {
    var n = S.names[key];
    if (!n) return key;
    return n[0] || n[1] || n[2] || key;
  }
  function labelPair(key) {
    var n = S.names[key];
    if (!n) return { mr: key, en: "" };
    return { mr: n[0] || n[1] || n[2] || key, en: n[0] ? (n[1] || n[2] || "") : (n[2] || "") };
  }

  function getJSON(path) {
    return fetch(DATA + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }

  function fatal(msg) {
    var b = $("boot");
    if (b) b.remove();
    // Hide controls that would do nothing without data, rather than leaving
    // dead buttons and a legend with no scale on screen.
    var legend = $("legend");
    if (legend) legend.hidden = true;
    var tools = document.querySelector(".maptools");
    if (tools) tools.hidden = true;
    var d = document.createElement("div");
    d.className = "err";
    d.innerHTML = "<b>डेटा लोड होऊ शकला नाही.</b><br><span class='en'>Could not load the census data. " +
      "Nothing is shown rather than showing made-up numbers.</span><br><br><code>" + esc(msg) + "</code>";
    document.querySelector(".panels").prepend(d);
  }

  // ----------------------------------------------------------------- colour
  function cellColor(n, max) {
    if (!(n > 0)) return RAMP[0];
    var t = Math.log(n) / Math.log(Math.max(max, 2));
    var i = Math.floor(t * RAMP.length);
    return RAMP[Math.max(0, Math.min(RAMP.length - 1, i))];
  }

  // -------------------------------------------------------------------- map
  function initMap() {
    S.map = L.map("map", {
      center: PUNE, zoom: 12, minZoom: 10, maxZoom: 18,
      preferCanvas: true, zoomControl: true, attributionControl: true
    });
    S.renderer = L.canvas({ padding: 0.35 });

    var url = dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    L.tileLayer(url, {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(S.map);

    S.cellLayer = L.layerGroup().addTo(S.map);
    S.rareLayer = L.layerGroup();
    S.giantLayer = L.layerGroup();

    S.map.on("moveend zoomend", loadVisibleTiles);
    loadVisibleTiles();
  }

  function tileKeySet() {
    if (S._tkeys) return S._tkeys;
    var s = {};
    S.tileIndex.tiles.forEach(function (t) { s[t.t[0] + "_" + t.t[1]] = t; });
    S._tkeys = s;
    return s;
  }

  function loadVisibleTiles() {
    if (!S.tileIndex) return;
    var idx = tileKeySet();
    var b = S.map.getBounds().pad(0.2);
    var TD = S.tileIndex.tile_deg;
    var ti0 = Math.floor(b.getWest() / TD), ti1 = Math.floor(b.getEast() / TD);
    var tj0 = Math.floor(b.getSouth() / TD), tj1 = Math.floor(b.getNorth() / TD);

    for (var ti = ti0; ti <= ti1; ti++) {
      for (var tj = tj0; tj <= tj1; tj++) {
        var k = ti + "_" + tj;
        if (!idx[k] || S.tilesLoaded[k]) continue;
        S.tilesLoaded[k] = true;
        /* eslint-disable no-loop-func */
        (function (key) {
          getJSON("tiles/" + key + ".json")
            .then(drawTile)
            .catch(function (e) {
              S.tilesLoaded[key] = false;   // allow a retry on the next pan
              console.warn("tile " + key + " failed:", e.message);
            });
        })(k);
      }
    }
  }

  function drawTile(tile) {
    var CD = S.tileIndex.cell_deg, CPT = S.tileIndex.cells_per_tile;
    var max = S.tileIndex.max_cell_count;
    var ti = tile.t[0], tj = tile.t[1];

    tile.cells.forEach(function (c) {
      var ci = ti * CPT + c[0], cj = tj * CPT + c[1];
      var n = c[2], top = c[3] || [], healthy = c[4];
      var w = ci * CD, s = cj * CD;
      var rect = L.rectangle([[s, w], [s + CD, w + CD]], {
        renderer: S.renderer,
        stroke: false,
        fillColor: cellColor(n, max),
        fillOpacity: 0.72,
        interactive: true,
        bubblingMouseEvents: false
      });
      rect.on("click", function () { showCell(n, top, healthy, [s + CD / 2, w + CD / 2]); });
      S.cellLayer.addLayer(rect);
    });
  }

  function showCell(n, top, healthy, center) {
    var rows = top.map(function (t) {
      var lp = labelPair(t[0]);
      return "<li><div class='row'><span><span class='name'>" + esc(lp.mr) + "</span> " +
        "<span class='bot'>" + esc(lp.en) + "</span></span>" +
        "<span class='num'>" + nf(t[1]) + "</span></div></li>";
    }).join("");

    var html = "<h2>या भागात <span class='en'>In this ~500 m cell</span></h2>" +
      "<div class='stats'><div class='stat'><div class='n'>" + nf(n) + "</div>" +
      "<div class='l'>झाडे · trees</div></div>" +
      (healthy !== null && healthy !== undefined
        ? "<div class='stat'><div class='n'>" + healthy + "%</div><div class='l'>निरोगी · healthy</div></div>"
        : "") +
      "</div>" +
      (rows ? "<p class='hint'>मुख्य प्रजाती <span class='en'>Top species here</span></p><ul class='list'>" + rows + "</ul>"
            : "<p class='hint'>या चौकोनात प्रजातीची नोंद नाही. <span class='en'>No species recorded for this cell.</span></p>");

    $("cellinfo").innerHTML = html;
    selectTab("map");

    var popTop = top.map(function (t) {
      return "<tr><td>" + esc(label(t[0])) + "</td><td>" + nf(t[1]) + "</td></tr>";
    }).join("");

    L.popup({ closeButton: true, autoPan: true, maxWidth: 230, minWidth: 150 })
      .setLatLng(center)
      .setContent("<div class='popup'><h3>" + nf(n) + " झाडे <span class='en'>trees</span></h3>" +
        (popTop ? "<table>" + popTop + "</table>" : "") +
        (healthy !== null && healthy !== undefined
          ? "<div class='en' style='margin-top:5px'>" + healthy + "% निरोगी · healthy</div>" : "") +
        "</div>")
      .openOn(S.map);
  }

  // ------------------------------------------------------------- treasures
  function markerFor(f, kind) {
    var p = f.properties, c = f.geometry.coordinates;
    var m = L.circleMarker([c[1], c[0]], {
      renderer: S.renderer,
      radius: kind === "giant" ? Math.max(5, Math.min(11, (p.g || 100) / 90)) : 6,
      fillColor: kind === "rare" ? "#eda100" : (dark ? "#6da7ec" : "#2a78d6"),
      fillOpacity: 0.95,
      color: kind === "rare" ? (dark ? "#fff0c8" : "#6b4a00") : (dark ? "#cde2fb" : "#10396b"),
      weight: 2
    });
    m.bindPopup(treasurePopup(p, kind), { maxWidth: 280 });
    return m;
  }

  function treasurePopup(p, kind) {
    function tr(k, v) { return v ? "<tr><td>" + k + "</td><td>" + esc(v) + "</td></tr>" : ""; }
    return "<div class='popup'>" +
      "<h3>" + esc(p.l || p.c || p.b) + "</h3>" +
      "<div class='bot'>" + esc(p.b) + (p.c ? " · " + esc(p.c) : "") + "</div>" +
      "<table>" +
      tr("घेर · girth", p.g ? p.g + " cm" : "") +
      tr("उंची · height", p.h ? p.h + " m" : "") +
      tr("स्थिती · condition", p.cond) +
      tr("मालकी · owner", p.own) +
      tr("प्रभाग · ward", p.w) +
      "</table>" +
      "<div class='en' style='margin-top:6px'>" +
      (kind === "rare" ? "Flagged rare in the 2019 census." : "One of the 500 largest by girth.") +
      "</div></div>";
  }

  function ensureLayer(kind) {
    var file = kind === "rare" ? "rare_trees.geojson" : "giants.geojson";
    var store = kind === "rare" ? "rare" : "giants";
    var layer = kind === "rare" ? S.rareLayer : S.giantLayer;
    if (S[store]) return Promise.resolve(layer);
    return getJSON(file).then(function (fc) {
      S[store] = fc;
      fc.features.forEach(function (f) { layer.addLayer(markerFor(f, kind)); });
      if (S.treasureMode === kind) renderTreasures();
      return layer;
    });
  }

  function renderTreasures() {
    var kind = S.treasureMode;
    var fc = kind === "rare" ? S.rare : S.giants;
    var host = $("treasurelist");
    if (!fc) {
      host.innerHTML = "<p class='loading'>लोड होत आहे… <span class='en'>Loading…</span></p>";
      ensureLayer(kind).catch(function (e) {
        host.innerHTML = "<div class='err'>Could not load " + esc(kind) + ": " + esc(e.message) + "</div>";
      });
      return;
    }

    var head = "";
    if (kind === "rare") {
      head = "<div class='stats'><div class='stat'><div class='n'>" + nf(fc.total_rare_in_census) +
        "</div><div class='l'>दुर्मिळ नोंदी · flagged rare</div></div>" +
        "<div class='stat'><div class='n'>" + nf(fc.included) +
        "</div><div class='l'>नकाशावर · plotted</div></div></div>";
      if (fc.truncated) {
        head += "<p class='hint'>⚠ " + esc(fc.note) + "</p>";
      }
    } else {
      head = "<div class='stats'><div class='stat'><div class='n'>" + nf(fc.features.length) +
        "</div><div class='l'>महाकाय झाडे · giants</div></div>" +
        "<div class='stat'><div class='n'>" + nf(fc.features[0] ? fc.features[0].properties.g : null) +
        " cm</div><div class='l'>सर्वात मोठा घेर · largest girth</div></div></div>";
    }

    var items = fc.features.slice(0, 300).map(function (f, i) {
      var p = f.properties, c = f.geometry.coordinates;
      return "<li><button class='tr-jump' data-lat='" + c[1] + "' data-lon='" + c[0] + "' data-i='" + i +
        "' style='all:unset;display:block;width:100%;cursor:pointer'>" +
        "<div class='row'><span><span class='name'>" + esc(p.l || p.c || p.b) + "</span> " +
        "<span class='bot'>" + esc(p.b) + "</span></span>" +
        "<span class='num'>" + (p.g ? p.g + " cm" : "") + "</span></div>" +
        "<div class='meta'>" + esc(p.w || "") + (p.h ? " · " + p.h + " m" : "") +
        (p.cond ? " · " + esc(p.cond) : "") + "</div></button></li>";
    }).join("");

    host.innerHTML = head + "<ul class='list'>" + items + "</ul>" +
      (fc.features.length > 300 ? "<p class='hint'>यादीत पहिली ३०० दाखवली आहेत; बाकीची नकाशावर आहेत. " +
        "<span class='en'>List shows the first 300; the rest are on the map.</span></p>" : "");

    host.querySelectorAll(".tr-jump").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lat = parseFloat(btn.dataset.lat), lon = parseFloat(btn.dataset.lon);
        var layer = kind === "rare" ? S.rareLayer : S.giantLayer;
        if (!S.map.hasLayer(layer)) {
          S.map.addLayer(layer);
          setToggle(kind === "rare" ? "tg-rare" : "tg-giants", true);
          $(kind === "rare" ? "lg-rare" : "lg-giant").hidden = false;
        }
        S.map.setView([lat, lon], 17, { animate: true });
        selectTab("map");
      });
    });
  }

  // -------------------------------------------------------------- flowering
  function renderMonths() {
    var host = $("months");
    host.innerHTML = MONTHS_MR.map(function (m, i) {
      return "<button data-m='" + (i + 1) + "' aria-pressed='" + (S.month === i + 1) + "'>" +
        esc(m) + "</button>";
    }).join("");
    host.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        S.month = parseInt(b.dataset.m, 10);
        renderMonths();
        renderFlowering();
      });
    });
  }

  function renderFlowering() {
    var m = S.month;
    var hits = S.species.species.filter(function (s) { return s.fm && s.fm.indexOf(m) !== -1; });
    hits.sort(function (a, b) { return b.n - a.n; });

    var totalTrees = hits.reduce(function (a, s) { return a + s.n; }, 0);
    var head = "<div class='stats'>" +
      "<div class='stat'><div class='n'>" + nf(hits.length) + "</div><div class='l'>प्रजाती फुलतात · species in bloom</div></div>" +
      "<div class='stat'><div class='n'>" + nf(totalTrees) + "</div><div class='l'>झाडे · trees</div></div></div>" +
      "<p class='hint'>" + esc(MONTHS_MR[m - 1]) + " मध्ये फुलणाऱ्या प्रजाती. " +
      "<span class='en'>Species recorded as flowering in " + MONTHS_EN[m - 1] + ".</span></p>";

    if (!hits.length) {
      $("flowerlist").innerHTML = head +
        "<p class='hint'>या महिन्यासाठी नोंद नाही. <span class='en'>The census records no species flowering this month. " +
        "That is what the data says — it has not been filled in.</span></p>";
      return;
    }

    var items = hits.slice(0, 80).map(function (s) {
      return "<li><div class='row'><span>" +
        "<span class='name'>" + esc(s.l || s.c || s.b) + "</span> " +
        "<span class='tag " + esc(s.nat) + "'>" + natLabel(s.nat) + "</span>" +
        "<div class='bot'>" + esc(s.b) + (s.c ? " · " + esc(s.c) : "") + "</div>" +
        "</span><span class='num'>" + nf(s.n) + "</span></div>" +
        "<div class='meta'>" +
        (s.fm.length === 12 ? "वर्षभर · all year" : s.fm.map(function (x) { return MONTHS_MR[x - 1]; }).join(", ")) +
        (s.e ? " · " + esc(s.e) : "") + "</div></li>";
    }).join("");

    $("flowerlist").innerHTML = head + "<ul class='list'>" + items + "</ul>" +
      (hits.length > 80 ? "<p class='hint'>वरच्या ८० प्रजाती दाखवल्या. <span class='en'>Showing the 80 most common.</span></p>" : "");
  }

  function natLabel(n) {
    return n === "native" ? "देशी" : n === "non_native" ? "परदेशी" : "माहिती नाही";
  }

  // ------------------------------------------------------------------ wards
  function renderWards() {
    var ws = S.wards.wards.slice();
    if (S.wardSort === "native") {
      ws = ws.filter(function (w) { return w.native_pct !== null; });
      ws.sort(function (a, b) { return b.native_pct - a.native_pct; });
    } else {
      ws.sort(function (a, b) { return b.n - a.n; });
    }
    var maxN = ws.length ? Math.max.apply(null, ws.map(function (w) { return S.wardSort === "native" ? w.native_pct : w.n; })) : 1;

    $("wardnote").innerHTML = S.wardSort === "native"
      ? "देशी % = ओळखता आलेल्या प्रजातींपैकी देशी. <span class='en'>Native % is of the trees whose species we could classify — see the footer on how that list is made.</span>"
      : "प्रभागानुसार एकूण झाडे. <span class='en'>Total recorded trees per ward.</span>";

    $("wardlist").innerHTML = "<ul class='list'>" + ws.map(function (w, i) {
      var val = S.wardSort === "native" ? w.native_pct : w.n;
      var top = (w.top || []).slice(0, 5).map(function (t) { return esc(label(t.k)); }).join(" · ");
      return "<li><div class='row'><span><span class='name'>" + (i + 1) + ". " + esc(w.name) + "</span>" +
        "<div class='bot'>" + nf(w.n) + " झाडे" +
        (w.healthy_pct !== null ? " · " + pct(w.healthy_pct, 0) + " निरोगी" : "") + "</div></span>" +
        "<span class='num'>" + (S.wardSort === "native" ? pct(w.native_pct, 0) : nf(w.n)) + "</span></div>" +
        "<div class='bar'><i style='width:" + Math.max(2, (val / maxN) * 100).toFixed(1) + "%'></i></div>" +
        (top ? "<div class='meta'>" + top + "</div>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  // ------------------------------------------------------------------ facts
  function buildFacts() {
    var m = S.meta, sp = S.species.species, total = m.totals.rows;
    var nat = m.nativity;
    var natKnown = nat.native + nat.non_native;
    var top3 = sp.slice(0, 3);
    var top3n = top3.reduce(function (a, s) { return a + s.n; }, 0);
    var top3NonNative = top3.filter(function (s) { return s.nat === "non_native"; });
    var wardsByCount = S.wards.wards.slice().sort(function (a, b) { return b.n - a.n; });
    var wardsByNative = S.wards.wards.filter(function (w) { return w.native_pct !== null; })
      .sort(function (a, b) { return b.native_pct - a.native_pct; });
    var url = location.origin + location.pathname;

    var facts = [];

    facts.push({
      big: pct(100 * top3n / total, 0),
      // The Marathi line is generated from the number too, so it can never
      // contradict the figure beside it when the data changes.
      mr: "पुण्यातील " + pct(100 * top3n / total, 0) + " झाडे फक्त ३ प्रजातींची आहेत — " +
          top3.map(function (s) { return (s.l || s.c || s.b); }).join(", ") + ".",
      en: "Just 3 species — " + top3.map(function (s) { return (s.l || s.c || s.b); }).join(", ") +
          " — account for " + pct(100 * top3n / total, 0) + " of all " + nf(total) + " trees counted." +
          (top3NonNative.length ? " " + top3NonNative.length + " of those 3 (" +
            top3NonNative.map(function (s) { return s.b; }).join(", ") + ") are not native to India." : ""),
      share: "Pune's 2019 tree census counted " + nf(total) + " trees — and " +
        pct(100 * top3n / total, 0) + " of them are just 3 species (" +
        top3.map(function (s) { return s.b; }).join(", ") + ")." +
        (top3NonNative.length ? " " + top3NonNative.length + " of those 3 aren't native to India." : "")
    });

    var s1 = sp[0];
    facts.push({
      big: nf(s1.n),
      mr: (s1.l || s1.c || s1.b) + " — पुण्यातील सर्वात सामान्य झाड (" +
          pct(100 * s1.n / total, 1) + ").",
      en: s1.b + " (" + (s1.c || "—") + ") is Pune's most common tree: " + nf(s1.n) +
          " of them, " + pct(100 * s1.n / total, 1) + " of every tree in the city.",
      share: "Pune's most common tree is " + (s1.l ? s1.l + " / " : "") + s1.b +
        " — " + nf(s1.n) + " of them, " + pct(100 * s1.n / total, 1) + " of the whole city."
    });

    facts.push({
      big: natKnown ? pct(100 * nat.native / natKnown, 0) : "—",
      mr: natKnown
        ? "ओळखता आलेल्या झाडांपैकी " + pct(100 * nat.native / natKnown, 0) + " देशी आहेत."
        : "देशी प्रमाण सांगण्याइतकी माहिती नाही.",
      en: natKnown
        ? pct(100 * nat.native / natKnown, 0) + " of the trees we could classify are native to the Indian subcontinent; " +
          pct(100 * nat.non_native / natKnown, 0) + " are introduced. " + nf(nat.unknown) +
          " trees (" + pct(100 * nat.unknown / total, 0) + ") could not be classified and are counted separately, never guessed."
        : "Not enough species could be classified to state this honestly.",
      share: natKnown ? "Of Pune's classifiable trees, " + pct(100 * nat.native / natKnown, 0) +
        " are native to the subcontinent and " + pct(100 * nat.non_native / natKnown, 0) + " were introduced." : ""
    });

    var gw = wardsByCount[0];
    var nw = wardsByNative[0];
    facts.push({
      big: nf(gw.n),
      mr: gw.name + " — सर्वाधिक झाडे असलेला प्रभाग (" + nf(gw.n) + " झाडे).",
      en: gw.name + " has more recorded trees than any other ward: " + nf(gw.n) + "." +
          (nw ? " The most native ward is " + nw.name + " at " + pct(nw.native_pct, 0) + " native." : ""),
      share: "Pune's greenest ward by count is " + gw.name + " with " + nf(gw.n) + " trees." +
        (nw ? " Most-native ward: " + nw.name + " (" + pct(nw.native_pct, 0) + ")." : "")
    });

    facts.push({
      big: nf(m.totals.rare_flagged),
      mr: nf(m.totals.rare_flagged) + " झाडे दुर्मिळ म्हणून नोंदवली आहेत — म्हणजे शहरातील फक्त " +
          pct(100 * m.totals.rare_flagged / total, 3) + ". शोधायला जा!",
      en: nf(m.totals.rare_flagged) + " trees are flagged rare in the census — " +
          pct(100 * m.totals.rare_flagged / total, 3) + " of the city. " +
          "The 500 largest trees have girths up to " +
          (S.giants && S.giants.features[0] ? nf(S.giants.features[0].properties.g) + " cm" : "hundreds of cm") + ".",
      share: "Only " + nf(m.totals.rare_flagged) + " of Pune's " + nf(total) +
        " censused trees are flagged rare — that's " + pct(100 * m.totals.rare_flagged / total, 3) + ". Go find one."
    });

    var host = $("facts");
    host.innerHTML = facts.map(function (f, i) {
      return "<div class='fact'><div class='big'>" + esc(f.big) + "</div>" +
        "<p class='mr'>" + esc(f.mr) + "</p>" +
        "<p class='en'>" + esc(f.en) + "</p>" +
        "<div class='acts'><button class='primary' data-i='" + i + "' data-act='share'>शेअर करा · Share</button>" +
        "<button data-i='" + i + "' data-act='copy'>कॉपी करा · Copy</button></div></div>";
    }).join("");

    host.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = facts[parseInt(b.dataset.i, 10)];
        var text = f.share + "\n\nSource: PMC Tree Census 2019 via OpenCity. " +
          "Explore: " + url;
        if (b.dataset.act === "share" && navigator.share) {
          navigator.share({ title: "Zaadancha Naksha", text: text }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            var old = b.textContent;
            b.textContent = "✓ कॉपी झाले";
            setTimeout(function () { b.textContent = old; }, 1600);
          });
        }
      });
    });
  }

  // ------------------------------------------------------------- map panel
  function renderMapPanel() {
    var t = S.meta.totals, nat = S.meta.nativity;
    var natKnown = nat.native + nat.non_native;

    $("stats").innerHTML =
      "<div class='stat'><div class='n'>" + nf(t.rows) + "</div><div class='l'>एकूण झाडे · trees counted</div></div>" +
      "<div class='stat'><div class='n'>" + nf(t.species) + "</div><div class='l'>प्रजाती · species</div></div>" +
      "<div class='stat'><div class='n'>" + nf(t.wards) + "</div><div class='l'>प्रभाग · wards</div></div>" +
      "<div class='stat'><div class='n'>" + nf(t.rare_flagged) + "</div><div class='l'>दुर्मिळ · rare</div></div>";

    // Shares of the WHOLE census, so the three segments always sum to 100%.
    var pNative = 100 * nat.native / t.rows;
    var pIntro = 100 * nat.non_native / t.rows;
    var pUnk = 100 * nat.unknown / t.rows;
    var npOfKnown = natKnown ? 100 * nat.native / natKnown : null;
    var unkEdge = ";box-shadow:inset 0 0 0 1px var(--nat-unknown-edge)";

    $("natsplit").innerHTML =
      "<h2 style='margin-top:14px'>देशी की परदेशी? <span class='en'>Native or introduced?</span></h2>" +
      "<div class='segbar'>" +
        "<i style='width:" + pNative.toFixed(1) + "%;background:var(--nat-native)'></i>" +
        "<i style='width:" + pIntro.toFixed(1) + "%;background:var(--nat-intro)'></i>" +
        "<i style='width:" + pUnk.toFixed(1) + "%;background:var(--nat-unknown)" + unkEdge + "'></i>" +
      "</div>" +
      "<div class='seglegend'>" +
      "<span><i class='sw' style='background:var(--nat-native)'></i>देशी native " + pct(pNative, 0) + "</span>" +
      "<span><i class='sw' style='background:var(--nat-intro)'></i>परदेशी introduced " + pct(pIntro, 0) + "</span>" +
      "<span><i class='sw' style='background:var(--nat-unknown)" + unkEdge + "'></i>माहिती नाही unknown " + pct(pUnk, 0) + "</span>" +
      "</div>" +
      (npOfKnown !== null
        ? "<p class='hint' style='margin-top:6px'>ओळखता आलेल्या झाडांपैकी <b>" + pct(npOfKnown, 0) +
          "</b> देशी. <span class='en'>Of the trees that could be classified at all, " +
          pct(npOfKnown, 0) + " are native.</span></p>"
        : "") +
      "<p class='hint' style='margin-top:6px'>⚠ " + esc(S.meta.nativity.warning) + "</p>";

    $("footer").innerHTML =
      "<p><b>स्रोत · Source:</b> <a href='https://data.opencity.in/dataset/pune-tree-census-2019' " +
        "target='_blank' rel='noopener'>Pune Tree Census 2019 — Pune Municipal Corporation, via OpenCity</a>. " +
        "Census fieldwork August 2019. Aggregated " + esc(S.meta.built_utc) + " UTC from " +
        esc(S.meta.source.parts) + " CSV parts.</p>" +
      "<p>ही महापालिकेची अधिकृत सेवा नाही. <span class='en'>Not an official PMC service. " +
        "Trees planted or cut since 2019 are not reflected.</span></p>" +
      "<p>Sovereign by Source. No cookies, no analytics, no accounts, no data leaves your device.</p>" +
      "<p><a href='data/meta.json'>meta.json</a> — every caveat, every count, and the raw schema report.</p>";

    // Paint the legend ramp from the ramp actually in use, so the key can never
    // disagree with the map in dark mode.
    var ramp = document.querySelector(".legend .ramp");
    if (ramp) {
      ramp.innerHTML = RAMP.map(function (c) {
        return "<i style='background:" + c + "'></i>";
      }).join("");
    }
    $("lg-hi").textContent = nf(S.tileIndex.max_cell_count) + "+";
  }

  // ------------------------------------------------------------------- tabs
  function selectTab(name) {
    ["map", "flower", "treasure", "ward", "facts"].forEach(function (n) {
      var t = $("tab-" + n), p = $("p-" + n);
      var on = n === name;
      t.setAttribute("aria-selected", String(on));
      p.hidden = !on;
    });
    var panels = document.querySelector(".panels");
    if (panels) panels.scrollTop = 0;
  }

  function setToggle(id, on) { $(id).setAttribute("aria-pressed", String(on)); }

  function wireUI() {
    ["map", "flower", "treasure", "ward", "facts"].forEach(function (n) {
      $("tab-" + n).addEventListener("click", function () {
        selectTab(n);
        if (n === "treasure") renderTreasures();
      });
    });

    $("tg-grid").addEventListener("click", function () {
      var on = $("tg-grid").getAttribute("aria-pressed") !== "true";
      setToggle("tg-grid", on);
      if (on) S.map.addLayer(S.cellLayer); else S.map.removeLayer(S.cellLayer);
    });

    [["tg-rare", "rare", S.rareLayer, "lg-rare"],
     ["tg-giants", "giant", S.giantLayer, "lg-giant"]].forEach(function (cfg) {
      $(cfg[0]).addEventListener("click", function () {
        var on = $(cfg[0]).getAttribute("aria-pressed") !== "true";
        setToggle(cfg[0], on);
        $(cfg[3]).hidden = !on;
        if (!on) { S.map.removeLayer(cfg[2]); return; }
        ensureLayer(cfg[1]).then(function (layer) { S.map.addLayer(layer); })
          .catch(function (e) { console.error(e); setToggle(cfg[0], false); $(cfg[3]).hidden = true; });
      });
    });

    $("tr-rare").addEventListener("click", function () {
      S.treasureMode = "rare"; setToggle("tr-rare", true); setToggle("tr-giant", false); renderTreasures();
    });
    $("tr-giant").addEventListener("click", function () {
      S.treasureMode = "giant"; setToggle("tr-rare", false); setToggle("tr-giant", true); renderTreasures();
    });
    $("w-count").addEventListener("click", function () {
      S.wardSort = "count"; setToggle("w-count", true); setToggle("w-native", false); renderWards();
    });
    $("w-native").addEventListener("click", function () {
      S.wardSort = "native"; setToggle("w-count", false); setToggle("w-native", true); renderWards();
    });
  }

  // ------------------------------------------------------------------- boot
  Promise.all([
    getJSON("meta.json"),
    getJSON("species_index.json"),
    getJSON("ward_summary.json"),
    getJSON("species_names.json"),
    getJSON("tiles/index.json")
  ]).then(function (r) {
    S.meta = r[0]; S.species = r[1]; S.wards = r[2]; S.names = r[3]; S.tileIndex = r[4];
    S.species.species.forEach(function (s) { S.speciesByKey[s.k] = s; });

    var b = $("boot"); if (b) b.remove();

    initMap();
    wireUI();
    renderMapPanel();
    renderMonths();
    renderFlowering();
    renderWards();
    buildFacts();

    // warm the treasure layers in the background so the hunt feels instant
    ensureLayer("giant").then(buildFacts).catch(function () {});
    ensureLayer("rare").catch(function () {});
  }).catch(function (e) {
    fatal(e.message);
  });
})();
