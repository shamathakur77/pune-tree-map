/* ==========================================================================
   झाडांचा नकाशा · Zaadancha Naksha
   Pune Tree Census 2019, made explorable.

   Vanilla JS + Leaflet. No backend, no API keys, no cookies, no storage,
   no analytics. Every number on screen comes from public/data/*, built from
   the census by scripts/aggregate.py. Nothing is invented here.
   ========================================================================== */

(function () {
  "use strict";

  var DATA = "data/";
  var PUNE = [18.5204, 73.8567];

  var MR_MONTH = ["जानेवारी","फेब्रुवारी","मार्च","एप्रिल","मे","जून",
                  "जुलै","ऑगस्ट","सप्टेंबर","ऑक्टोबर","नोव्हेंबर","डिसेंबर"];
  var EN_MONTH = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  var RAMP_DARK  = ["#1D4A1E","#276227","#33792F","#46913B","#6FB869","#A5D69A"];
  var RAMP_LIGHT = ["#DCEFD7","#ABD7A2","#6FB869","#3A9440","#216C2E","#114620"];

  var BASE_DARK  = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
  var BASE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
  var LABELS     = "https://{s}.basemaps.cartocdn.com/{v}_only_labels/{z}/{x}/{y}{r}.png";

  var S = {
    meta:null, species:null, wards:null, names:null, tileIndex:null,
    rare:null, giants:null,
    tilesLoaded:{}, cellLayer:null, rareLayer:null, giantLayer:null,
    map:null, renderer:null, base:null, labels:null,
    month:new Date().getMonth() + 1,
    treasureMode:"rare",
    wardSort:"count",
    tab:"map",
    theme:"dark",
    snap:"half"
  };

  // ------------------------------------------------------------- helpers --
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function nf(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    try { return Number(n).toLocaleString("en-IN"); } catch (e) { return String(n); }
  }
  function pct(n, d) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(d === undefined ? 1 : d) + "%";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  /* Marathi/local name first, then English common, then botanical. */
  function nameOf(key) {
    var n = S.names[key];
    if (!n) return key;
    return n[0] || n[1] || n[2] || key;
  }
  function sciOf(key) {
    var n = S.names[key];
    return n ? (n[2] || "") : "";
  }
  function getJSON(path) {
    return fetch(DATA + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }
  function ramp() { return S.theme === "dark" ? RAMP_DARK : RAMP_LIGHT; }

  // ---------------------------------------------------------------- theme --
  /* Session-only, deliberately: nothing is written to storage, so the promise
     in the footer stays literally true. Defaults to the OS setting. */
  function applyTheme(t) {
    S.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0A0D0A" : "#F6F4EC");
    if (S.base) {
      S.base.setUrl(t === "dark" ? BASE_DARK : BASE_LIGHT);
      S.labels.setUrl(LABELS.replace("{v}", t === "dark" ? "dark" : "light"));
    }
    if (S.cellLayer) repaintCells();
    paintRamp();
  }
  function paintRamp() {
    var r = $("ramp");
    if (r) r.innerHTML = ramp().map(function (c) {
      return "<i style='background:" + c + "'></i>";
    }).join("");
  }

  // ---------------------------------------------------------------- sheet --
  var SNAPS = ["peek", "half", "full"];
  var TOP_RESERVE = 168;   // must match the sheet height in styles.css
  function sheetGeom() {
    var vh = window.innerHeight;
    var h = vh - TOP_RESERVE;
    return {
      vh: vh, h: h,
      peek: Math.max(0, h - 132),
      half: Math.max(0, h - 0.52 * vh),
      full: 0
    };
  }
  function setSnap(name, animate) {
    if (window.matchMedia("(min-width: 860px)").matches) return;
    S.snap = name;
    var g = sheetGeom();
    var sheet = $("sheet");
    if (animate === false) sheet.classList.add("dragging");
    sheet.style.setProperty("--sheet-y", g[name] + "px");
    document.documentElement.style.setProperty("--peek", "132px");
    if (animate === false) requestAnimationFrame(function () { sheet.classList.remove("dragging"); });
    sheet.classList.toggle("at-peek", name === "peek");
    $("legend").hidden = name !== "peek";
    $("peekline").style.display = name === "peek" ? "flex" : "none";
  }
  function wireSheet() {
    var sheet = $("sheet"), grab = $("grab");
    var startY = 0, startTop = 0, dragging = false, moved = 0, t0 = 0;

    function currentTop() {
      var v = getComputedStyle(sheet).getPropertyValue("--sheet-y").trim();
      return parseFloat(v) || 0;
    }
    function down(e) {
      if (window.matchMedia("(min-width: 860px)").matches) return;
      dragging = true; moved = 0; t0 = Date.now();
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      startTop = currentTop();
      sheet.classList.add("dragging");
      if (e.pointerId != null && grab.setPointerCapture) {
        try { grab.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      var g = sheetGeom();
      moved = y - startY;
      var top = Math.max(g.full, Math.min(g.peek, startTop + moved));
      sheet.style.setProperty("--sheet-y", top + "px");
      e.preventDefault();
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove("dragging");
      var g = sheetGeom(), top = currentTop();
      var fast = Math.abs(moved) > 40 && (Date.now() - t0) < 320;
      if (fast) {
        var i = SNAPS.indexOf(S.snap);
        setSnap(SNAPS[Math.max(0, Math.min(2, i + (moved > 0 ? -1 : 1)))]);
        return;
      }
      var best = "half", bd = Infinity;
      SNAPS.forEach(function (n) {
        var d = Math.abs(g[n] - top);
        if (d < bd) { bd = d; best = n; }
      });
      setSnap(best);
    }

    grab.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    grab.addEventListener("click", function () {
      if (Math.abs(moved) > 6) return;
      setSnap(S.snap === "peek" ? "half" : S.snap === "half" ? "full" : "peek");
    });
    grab.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); grab.click(); }
    });
    window.addEventListener("resize", function () { setSnap(S.snap, false); });
  }

  // ------------------------------------------------------------------ map --
  function initMap() {
    S.map = L.map("map", {
      center: PUNE, zoom: 12, minZoom: 10, maxZoom: 18,
      preferCanvas: true, zoomControl: false, attributionControl: true
    });
    S.renderer = L.canvas({ padding: 0.4 });

    S.base = L.tileLayer(S.theme === "dark" ? BASE_DARK : BASE_LIGHT, {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(S.map);

    S.cellLayer = L.layerGroup().addTo(S.map);
    S.rareLayer = L.layerGroup();
    S.giantLayer = L.layerGroup();

    // place labels ride above the density grid so streets stay readable
    S.labels = L.tileLayer(LABELS.replace("{v}", S.theme === "dark" ? "dark" : "light"), {
      maxZoom: 19, subdomains: "abcd", opacity: .85, pane: "shadowPane"
    }).addTo(S.map);

    S.map.on("moveend zoomend", loadVisibleTiles);
    loadVisibleTiles();
  }

  function cellColor(n, max) {
    var R = ramp();
    if (!(n > 0)) return R[0];
    var t = Math.log(n) / Math.log(Math.max(max, 2));
    return R[Math.max(0, Math.min(R.length - 1, Math.floor(t * R.length)))];
  }

  var CELLS = [];   // {rect, n}
  function repaintCells() {
    var max = S.tileIndex.max_cell_count;
    CELLS.forEach(function (c) {
      c.rect.setStyle({ fillColor: cellColor(c.n, max) });
    });
  }

  function tileKeySet() {
    if (S._tk) return S._tk;
    var s = {};
    S.tileIndex.tiles.forEach(function (t) { s[t.t[0] + "_" + t.t[1]] = t; });
    S._tk = s;
    return s;
  }

  function loadVisibleTiles() {
    if (!S.tileIndex) return;
    var idx = tileKeySet();
    var b = S.map.getBounds().pad(0.25);
    var TD = S.tileIndex.tile_deg;
    var i0 = Math.floor(b.getWest()/TD), i1 = Math.floor(b.getEast()/TD);
    var j0 = Math.floor(b.getSouth()/TD), j1 = Math.floor(b.getNorth()/TD);
    for (var i = i0; i <= i1; i++) {
      for (var j = j0; j <= j1; j++) {
        var k = i + "_" + j;
        if (!idx[k] || S.tilesLoaded[k]) continue;
        S.tilesLoaded[k] = true;
        (function (key) {
          getJSON("tiles/" + key + ".json").then(drawTile).catch(function (e) {
            S.tilesLoaded[key] = false;      // retry on the next pan
            console.warn("tile " + key + ":", e.message);
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
      var ci = ti*CPT + c[0], cj = tj*CPT + c[1];
      var n = c[2], top = c[3] || [], healthy = c[4];
      var w = ci*CD, s = cj*CD;
      var rect = L.rectangle([[s, w], [s+CD, w+CD]], {
        renderer: S.renderer, stroke: false,
        fillColor: cellColor(n, max), fillOpacity: .62,
        interactive: true, bubblingMouseEvents: false
      });
      rect.on("click", function () { showCell(n, top, healthy, [s+CD/2, w+CD/2]); });
      S.cellLayer.addLayer(rect);
      CELLS.push({ rect: rect, n: n });
    });
  }

  function showCell(n, top, healthy, center) {
    var rows = top.map(function (t) {
      return "<tr><td>" + esc(nameOf(t[0])) + "</td><td>" + nf(t[1]) + "</td></tr>";
    }).join("");

    L.popup({ closeButton: true, autoPan: true, maxWidth: 250, minWidth: 180, offset: [0, -4] })
      .setLatLng(center)
      .setContent(
        "<div class='pop'><div class='pt'>" + nf(n) + " झाडं</div>" +
        "<div class='ps'>~500 m &times; 500 m</div>" +
        (rows ? "<table>" + rows + "</table>" : "<div class='ps'>प्रजातीची नोंद नाही</div>") +
        (healthy != null ? "<table><tr><td>निरोगी</td><td>" + healthy + "%</td></tr></table>" : "") +
        "</div>")
      .openOn(S.map);

    var host = $("cellinfo");
    host.innerHTML =
      "<p class='eyebrow'>Selected cell</p>" +
      "<div class='card flush'><ul class='rows'>" +
      "<li><span class='grow'><span class='nm'>या भागात</span>" +
      "<div class='sci'>~500 m grid cell</div></span>" +
      "<span class='val'>" + nf(n) + "<small>झाडं</small></span></li>" +
      top.map(function (t, i) {
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(nameOf(t[0])) + "</span>" +
          "<div class='sci'>" + esc(sciOf(t[0])) + "</div></span>" +
          "<span class='val'>" + nf(t[1]) + "</span></li>";
      }).join("") + "</ul></div>";
    selectTab("map");
    if (S.snap === "peek") setSnap("half");
  }

  // ------------------------------------------------------------ treasures --
  function marker(f, kind) {
    var p = f.properties, c = f.geometry.coordinates;
    return L.circleMarker([c[1], c[0]], {
      renderer: S.renderer,
      radius: kind === "giant" ? Math.max(5, Math.min(12, (p.g || 100)/95)) : 5.5,
      fillColor: kind === "rare" ? "#F0B23C" : "#6FA8E8",
      fillOpacity: .95,
      color: S.theme === "dark" ? "rgba(10,13,10,.9)" : "rgba(255,255,255,.95)",
      weight: 1.5
    }).bindPopup(treasurePopup(p, kind), { maxWidth: 280 });
  }

  function treasurePopup(p, kind) {
    function tr(k, v) { return v ? "<tr><td>" + k + "</td><td>" + esc(v) + "</td></tr>" : ""; }
    return "<div class='pop'>" +
      "<div class='pt'>" + esc(p.l || p.c || p.b) + "</div>" +
      "<div class='ps'>" + esc(p.b) + "</div><table>" +
      tr("घेर", p.g ? p.g + " cm" : "") +
      tr("उंची", p.h ? p.h + " m" : "") +
      tr("स्थिती", p.cond) + tr("मालकी", p.own) + tr("प्रभाग", p.w) +
      "</table><div class='ps' style='margin:8px 0 0'>" +
      (kind === "rare" ? "Flagged rare in the 2019 census" : "One of the 500 largest by girth") +
      "</div></div>";
  }

  function ensureLayer(kind) {
    var file = kind === "rare" ? "rare_trees.geojson" : "giants.geojson";
    var store = kind === "rare" ? "rare" : "giants";
    var layer = kind === "rare" ? S.rareLayer : S.giantLayer;
    if (S[store]) return Promise.resolve(layer);
    return getJSON(file).then(function (fc) {
      S[store] = fc;
      fc.features.forEach(function (f) { layer.addLayer(marker(f, kind)); });
      if (S.tab === "treasure" && S.treasureMode === kind) renderTreasures();
      return layer;
    });
  }

  function dayIndex(len) {
    var d = new Date();
    var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    return len ? (doy * 7919) % len : 0;
  }

  function renderTreasures() {
    var kind = S.treasureMode;
    var fc = kind === "rare" ? S.rare : S.giants;
    var host = $("treasurelist");
    if (!fc) {
      host.innerHTML = "<div class='card'><div class='sub' style='margin:0'>लोड होत आहे…</div></div>";
      ensureLayer(kind).catch(function (e) {
        host.innerHTML = "<div class='err'>Could not load " + esc(kind) + ".<code>" + esc(e.message) + "</code></div>";
      });
      return;
    }

    var pick = fc.features[dayIndex(fc.features.length)];
    var pp = pick.properties;
    var html =
      "<div class='treasure " + (kind === "giant" ? "giant" : "") + "'>" +
        "<div class='tk'>आजचा खजिना · today's find</div>" +
        "<div class='tn'>" + esc(pp.l || pp.c || pp.b) + "</div>" +
        "<div class='ts'>" + esc(pp.b) + "</div>" +
        "<div class='tstat'>" +
          "<div><div class='v'>" + (pp.g ? nf(pp.g) : "—") + "</div><div class='k'>घेर cm</div></div>" +
          "<div><div class='v'>" + (pp.h ? pp.h : "—") + "</div><div class='k'>उंची m</div></div>" +
          "<div><div class='v' style='font-size:.95rem;font-weight:600'>" + esc(pp.w || "—") + "</div><div class='k'>प्रभाग</div></div>" +
        "</div>" +
        "<div class='acts'><button class='btn primary' id='goto-today'>नकाशावर दाखवा</button></div>" +
      "</div>";

    if (kind === "rare") {
      html += "<div class='metrics'>" +
        "<div class='metric'><div class='v'>" + nf(fc.total_rare_in_census) + "</div><div class='k'>दुर्मिळ नोंदी</div></div>" +
        "<div class='metric'><div class='v'>" + nf(fc.included) + "</div><div class='k'>नकाशावर</div></div>" +
        "<div class='metric'><div class='v'>" + pct(100*fc.total_rare_in_census/S.meta.totals.rows, 2) + "</div><div class='k'>शहराचा वाटा</div></div>" +
        "</div>";
      if (fc.truncated) html += "<div class='card' style='font-size:.8rem;color:var(--txt-2)'>⚠ " + esc(fc.note) + "</div>";
    } else {
      html += "<div class='metrics'>" +
        "<div class='metric'><div class='v'>" + nf(fc.features.length) + "</div><div class='k'>महाकाय झाडं</div></div>" +
        "<div class='metric'><div class='v'>" + nf(fc.features[0] && fc.features[0].properties.g) + "</div><div class='k'>सर्वात मोठा घेर cm</div></div>" +
        "<div class='metric'><div class='v'>" + nf(fc.features[fc.features.length-1].properties.g) + "</div><div class='k'>५००वा घेर cm</div></div>" +
        "</div>";
    }

    html += "<div class='card flush'><ul class='rows'>" +
      fc.features.slice(0, 200).map(function (f, i) {
        var p = f.properties, c = f.geometry.coordinates;
        return "<li><button class='row' data-lat='" + c[1] + "' data-lon='" + c[0] + "'>" +
          "<span class='rank'>" + (i+1) + "</span>" +
          "<span class='grow'><span class='nm'>" + esc(p.l || p.c || p.b) + "</span>" +
          "<div class='sci'>" + esc(p.w || "") + (p.h ? " · " + p.h + " m" : "") + "</div></span>" +
          "<span class='val'>" + (p.g ? nf(p.g) : "—") + "<small>cm घेर</small></span></button></li>";
      }).join("") + "</ul></div>" +
      (fc.features.length > 200
        ? "<p class='sub' style='margin:12px 0 0'>यादीत पहिली २०० दाखवली आहेत; बाकीची नकाशावर आहेत.</p>" : "");

    host.innerHTML = html;

    var today = $("goto-today");
    if (today) today.addEventListener("click", function () {
      flyTo(pick.geometry.coordinates[1], pick.geometry.coordinates[0], kind);
    });
    host.querySelectorAll("button.row").forEach(function (b) {
      b.addEventListener("click", function () {
        flyTo(parseFloat(b.dataset.lat), parseFloat(b.dataset.lon), kind);
      });
    });
  }

  function flyTo(lat, lon, kind) {
    var layer = kind === "rare" ? S.rareLayer : S.giantLayer;
    var id = kind === "rare" ? "tg-rare" : "tg-giants";
    if (!S.map.hasLayer(layer)) {
      S.map.addLayer(layer);
      $(id).setAttribute("aria-pressed", "true");
    }
    setSnap("peek");
    S.map.setView([lat, lon], 17, { animate: true });
  }

  // -------------------------------------------------------------- flowering --
  function renderMonths() {
    var now = new Date().getMonth() + 1;
    $("months").innerHTML = MR_MONTH.map(function (m, i) {
      return "<button data-m='" + (i+1) + "' data-now='" + (now === i+1 ? 1 : 0) + "' " +
        "aria-pressed='" + (S.month === i+1) + "'>" + esc(m) +
        "<span class='n'>" + EN_MONTH[i].slice(0,3) + "</span></button>";
    }).join("");
    $("months").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        S.month = parseInt(b.dataset.m, 10);
        renderMonths(); renderFlowering();
      });
    });
    centreMonth();
  }

  /* Only works once the panel is actually visible, so it is called again
     when the Flowering tab is opened — not just when the chips are built. */
  function centreMonth() {
    var host = $("months");
    if (!host || host.offsetParent === null) return;
    var on = host.querySelector('[aria-pressed="true"]');
    if (!on) return;
    host.scrollLeft = on.offsetLeft - (host.clientWidth - on.offsetWidth) / 2;
  }

  function natTag(n) {
    return "<span class='tag " + esc(n) + "'>" +
      (n === "native" ? "देशी" : n === "non_native" ? "परदेशी" : "माहीत नाही") + "</span>";
  }

  function renderFlowering() {
    var m = S.month;
    var hits = S.species.species.filter(function (s) { return s.fm && s.fm.indexOf(m) !== -1; });
    hits.sort(function (a, b) { return b.n - a.n; });
    var trees = hits.reduce(function (a, s) { return a + s.n; }, 0);
    var share = S.meta.totals.rows ? 100*trees/S.meta.totals.rows : 0;

    if (!hits.length) {
      $("flowerlist").innerHTML =
        "<div class='card'><div class='nm'>" + esc(MR_MONTH[m-1]) + " मध्ये नोंद नाही</div>" +
        "<p class='sub' style='margin:6px 0 0'>The census records no species flowering this month. " +
        "That is what the data says — it has not been filled in.</p></div>";
      return;
    }

    $("flowerlist").innerHTML =
      "<div class='hero' style='padding-top:0'>" +
        "<div class='big num'>" + nf(hits.length) + "</div>" +
        "<div class='cap'>प्रजाती " + esc(MR_MONTH[m-1]) + "मध्ये फुलतात</div>" +
      "</div>" +
      "<div class='metrics'>" +
        "<div class='metric'><div class='v'>" + nf(trees) + "</div><div class='k'>झाडं</div></div>" +
        "<div class='metric'><div class='v'>" + pct(share, 0) + "</div><div class='k'>शहराचा वाटा</div></div>" +
        "<div class='metric'><div class='v'>" + nf(S.species.count) + "</div><div class='k'>एकूण प्रजाती</div></div>" +
      "</div>" +
      "<div class='card flush'><ul class='rows'>" +
      hits.slice(0, 60).map(function (s, i) {
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(s.l || s.c || s.b) + "</span> " + natTag(s.nat) +
          "<div class='sci'>" + esc(s.b) + "</div></span>" +
          "<span class='val'>" + nf(s.n) + "<small>" + esc(s.e || "") + "</small></span></li>";
      }).join("") + "</ul></div>" +
      (hits.length > 60 ? "<p class='sub' style='margin:12px 0 0'>सर्वाधिक आढळणाऱ्या ६० प्रजाती दाखवल्या आहेत.</p>" : "");
  }

  // ------------------------------------------------------------------ wards --
  function renderWards() {
    var ws = S.wards.wards.slice();
    if (S.wardSort === "native") {
      ws = ws.filter(function (w) { return w.native_pct !== null; });
      ws.sort(function (a, b) { return b.native_pct - a.native_pct; });
      $("wardnote").textContent = "देशी % = ओळखता आलेल्या प्रजातींपैकी देशी झाडांचं प्रमाण.";
    } else {
      ws.sort(function (a, b) { return b.n - a.n; });
      $("wardnote").textContent = "प्रभागानुसार नोंदवलेली एकूण झाडं.";
    }
    var maxV = ws.length ? (S.wardSort === "native" ? ws[0].native_pct : ws[0].n) : 1;

    $("wardlist").innerHTML = "<div class='card flush'><ul class='rows'>" +
      ws.map(function (w, i) {
        var v = S.wardSort === "native" ? w.native_pct : w.n;
        var top = (w.top || []).slice(0, 3).map(function (t) { return esc(nameOf(t.k)); }).join(" · ");
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(w.name) + "</span>" +
          "<div class='sci' style='font-style:normal'>" + top + "</div>" +
          "<div class='meter'><i style='width:" + Math.max(2, (v/maxV)*100).toFixed(1) + "%'></i></div>" +
          "</span><span class='val'>" +
          (S.wardSort === "native" ? pct(w.native_pct, 0) : nf(w.n)) +
          "<small>" + (S.wardSort === "native" ? nf(w.n) + " झाडं" : pct(w.healthy_pct, 0) + " निरोगी") +
          "</small></span></li>";
      }).join("") + "</ul></div>";
  }

  // ------------------------------------------------------------------ facts --
  function buildFacts() {
    var m = S.meta, sp = S.species.species, total = m.totals.rows, nat = m.nativity;
    var known = nat.native + nat.non_native;
    var t3 = sp.slice(0, 3), t3n = t3.reduce(function (a, s) { return a + s.n; }, 0);
    var t3names = t3.map(function (s) { return s.l || s.c || s.b; }).join(", ");
    var t3intro = t3.filter(function (s) { return s.nat === "non_native"; }).length;
    var t3unk = t3.filter(function (s) { return s.nat === "unknown"; }).length;
    var s1 = sp[0];
    var byCount = S.wards.wards.slice().sort(function (a,b) { return b.n - a.n; });
    var byNative = S.wards.wards.filter(function (w) { return w.native_pct !== null; })
                     .sort(function (a,b) { return b.native_pct - a.native_pct; });
    var url = location.origin + location.pathname;
    var F = [];

    // 1 — concentration
    var originLine = t3intro + " of those three are introduced";
    if (t3unk) originLine += ", and " + t3unk + " could not be classified from our origin list";
    F.push({
      n: pct(100*t3n/total, 0),
      mr: "तीन प्रजाती. जवळपास निम्मं पुणं.",
      en: t3names + " together are " + pct(100*t3n/total, 0) + " of all " +
          nf(total) + " trees PMC counted. " + originLine + ".",
      share: "Three species are " + pct(100*t3n/total, 0) + " of every tree in Pune (" +
             t3.map(function (s) { return s.b; }).join(", ") + ")."
    });

    // 2 — the commonest tree
    F.push({
      n: nf(s1.n),
      mr: (s1.l || s1.c || s1.b) + " — पुण्यात सर्वात जास्त आढळणारं झाड.",
      en: s1.b + " accounts for " + pct(100*s1.n/total, 1) +
          " of the city on its own — roughly one in every " +
          Math.round(total/s1.n) + " trees.",
      share: "Pune's most common tree is " + (s1.l ? s1.l + " / " : "") + s1.b +
             " — " + nf(s1.n) + " of them, " + pct(100*s1.n/total, 1) + " of the city."
    });

    // 3 — nativity
    if (known) {
      var np = 100*nat.native/known;
      F.push({
        n: pct(np, 0),
        mr: "ओळखता आलेल्या झाडांपैकी एवढीच देशी.",
        en: pct(np, 0) + " of classifiable trees are native to the subcontinent; " +
            pct(100 - np, 0) + " were introduced. A further " + nf(nat.unknown) +
            " trees (" + pct(100*nat.unknown/total, 0) +
            ") could not be classified and are never guessed at.",
        share: "Only " + pct(np, 0) + " of Pune's classifiable trees are native to the subcontinent."
      });
    }

    // 4 — wards
    var gw = byCount[0], nw = byNative[0];
    F.push({
      n: nf(gw.n),
      mr: gw.name + " — सर्वाधिक झाडं असलेला प्रभाग.",
      en: gw.name + " has more recorded trees than any other ward." +
          (nw ? " The most native ward is " + nw.name + ", at " + pct(nw.native_pct, 0) + "." : ""),
      share: "Pune's greenest ward by count is " + gw.name + " — " + nf(gw.n) + " trees." +
             (nw ? " Most native: " + nw.name + " (" + pct(nw.native_pct, 0) + ")." : "")
    });

    // 5 — the average tree
    F.push({
      n: (m.totals.avg_girth_cm != null ? m.totals.avg_girth_cm + " cm" : "—"),
      mr: "पुण्यातलं सरासरी झाड — बारीक आणि तरुण.",
      en: "The average censused tree is " + m.totals.avg_girth_cm + " cm around and " +
          m.totals.avg_height_m + " m tall. Meanwhile " + nf(m.totals.rare_flagged) +
          " trees are flagged rare — " + pct(100*m.totals.rare_flagged/total, 2) + " of the city.",
      share: "Pune's average tree is just " + m.totals.avg_girth_cm + " cm in girth and " +
             m.totals.avg_height_m + " m tall. The canopy is young and thin."
    });

    $("facts").innerHTML = F.map(function (f, i) {
      return "<article class='fact'>" +
        "<div class='fnum'>" + esc(f.n) + "</div>" +
        "<p class='fmr'>" + esc(f.mr) + "</p>" +
        "<p class='fen'>" + esc(f.en) + "</p>" +
        "<div class='acts'>" +
          "<button class='btn primary' data-i='" + i + "' data-a='share'>शेअर करा</button>" +
          "<button class='btn' data-i='" + i + "' data-a='copy'>कॉपी</button>" +
        "</div></article>";
    }).join("");

    $("facts").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = F[+b.dataset.i];
        var text = f.share + "\n\nSource: PMC Tree Census 2019 via OpenCity.\n" + url;
        if (b.dataset.a === "share" && navigator.share) {
          navigator.share({ title: "झाडांचा नकाशा", text: text }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            var o = b.textContent; b.textContent = "✓ कॉपी झालं";
            setTimeout(function () { b.textContent = o; }, 1600);
          });
        }
      });
    });
  }

  // -------------------------------------------------------------- map panel --
  function renderMapPanel() {
    var t = S.meta.totals, nat = S.meta.nativity;
    var known = nat.native + nat.non_native;

    $("peekline").innerHTML = "<b class='num'>" + nf(t.rows) + "</b> झाडं · वर ओढा";

    $("hero").innerHTML =
      "<p class='eyebrow'>PMC Tree Census 2019</p>" +
      "<div class='big num'>" + nf(t.rows) + "</div>" +
      "<div class='cap'>पुण्यात मोजलेली झाडं</div>" +
      "<div class='metrics' style='margin-top:18px;margin-bottom:0'>" +
        "<div class='metric'><div class='v num'>" + nf(t.species) + "</div><div class='k'>प्रजाती</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(t.wards) + "</div><div class='k'>प्रभाग</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(t.rare_flagged) + "</div><div class='k'>दुर्मिळ</div></div>" +
      "</div>";

    var pN = 100*nat.native/t.rows, pI = 100*nat.non_native/t.rows, pU = 100*nat.unknown/t.rows;
    $("natsplit").innerHTML =
      "<p class='eyebrow' style='margin-top:24px'>Origin</p>" +
      "<h3 class='h' style='font-size:1.1rem'>देशी की परदेशी?</h3>" +
      "<div class='seg'>" +
        "<i style='width:" + pN.toFixed(1) + "%;background:var(--nat)'></i>" +
        "<i style='width:" + pI.toFixed(1) + "%;background:var(--intro)'></i>" +
        "<i style='width:" + pU.toFixed(1) + "%;background:var(--unk);box-shadow:inset 0 0 0 1px var(--unk-e)'></i>" +
      "</div>" +
      "<div class='segkey'>" +
        "<span><i class='sw' style='background:var(--nat)'></i>देशी <b>" + pct(pN,0) + "</b></span>" +
        "<span><i class='sw' style='background:var(--intro)'></i>परदेशी <b>" + pct(pI,0) + "</b></span>" +
        "<span><i class='sw' style='background:var(--unk);box-shadow:inset 0 0 0 1px var(--unk-e)'></i>माहीत नाही <b>" + pct(pU,0) + "</b></span>" +
      "</div>" +
      (known ? "<p class='sub' style='margin:14px 0 0'>ओळखता आलेल्या झाडांपैकी <b style='color:var(--txt)'>" +
        pct(100*nat.native/known, 0) + "</b> देशी आहेत.</p>" : "") +
      "<div class='card' style='margin-top:12px;font-size:.78rem;color:var(--txt-2)'>⚠ " +
        esc(nat.warning) + "</div>";

    $("foot").innerHTML =
      "<p><b style='color:var(--txt-2)'>स्रोत</b> · <a href='https://data.opencity.in/dataset/pune-tree-census-2019' target='_blank' rel='noopener'>" +
        "Pune Tree Census 2019 — Pune Municipal Corporation, via OpenCity</a>. " +
        "Fieldwork August 2019. Aggregated " + esc((S.meta.built_utc||"").slice(0,10)) +
        " from " + esc(S.meta.source.parts) + " CSV parts.</p>" +
      "<p>ही महापालिकेची अधिकृत सेवा नाही. Trees planted or cut since 2019 are not reflected.</p>" +
      "<p>No cookies. No storage. No analytics. No accounts. Nothing about you leaves your device.</p>" +
      "<p class='sig'>Sovereign by Source · <a href='data/meta.json'>meta.json</a> — every caveat and count.</p>";

    $("lg-hi").textContent = nf(S.tileIndex.max_cell_count);
  }

  // ------------------------------------------------------------------ tabs --
  var TABS = ["map","flower","treasure","ward","facts"];
  function selectTab(name) {
    S.tab = name;
    TABS.forEach(function (n) {
      $("tab-" + n).setAttribute("aria-selected", String(n === name));
      $("p-" + n).hidden = n !== name;
    });
    $("panels").scrollTop = 0;
  }

  function wireUI() {
    TABS.forEach(function (n) {
      $("tab-" + n).addEventListener("click", function () {
        selectTab(n);
        if (S.snap === "peek") setSnap("half");
        if (n === "treasure") renderTreasures();
        if (n === "flower") centreMonth();
      });
    });

    $("honest").addEventListener("click", function () {
      var b = $("honest");
      b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") === "true" ? "false" : "true");
    });

    $("theme").addEventListener("click", function () {
      applyTheme(S.theme === "dark" ? "light" : "dark");
    });

    $("tg-grid").addEventListener("click", function () {
      var on = $("tg-grid").getAttribute("aria-pressed") !== "true";
      $("tg-grid").setAttribute("aria-pressed", String(on));
      if (on) S.map.addLayer(S.cellLayer); else S.map.removeLayer(S.cellLayer);
    });

    [["tg-rare","rare",function(){return S.rareLayer;}],
     ["tg-giants","giant",function(){return S.giantLayer;}]].forEach(function (c) {
      $(c[0]).addEventListener("click", function () {
        var on = $(c[0]).getAttribute("aria-pressed") !== "true";
        $(c[0]).setAttribute("aria-pressed", String(on));
        if (!on) { S.map.removeLayer(c[2]()); return; }
        ensureLayer(c[1]).then(function (l) { S.map.addLayer(l); })
          .catch(function (e) { console.error(e); $(c[0]).setAttribute("aria-pressed","false"); });
      });
    });

    $("tr-rare").addEventListener("click", function () {
      S.treasureMode = "rare";
      $("tr-rare").setAttribute("aria-pressed","true");
      $("tr-giant").setAttribute("aria-pressed","false");
      renderTreasures();
    });
    $("tr-giant").addEventListener("click", function () {
      S.treasureMode = "giant";
      $("tr-rare").setAttribute("aria-pressed","false");
      $("tr-giant").setAttribute("aria-pressed","true");
      renderTreasures();
    });
    $("w-count").addEventListener("click", function () {
      S.wardSort = "count";
      $("w-count").setAttribute("aria-pressed","true");
      $("w-native").setAttribute("aria-pressed","false");
      renderWards();
    });
    $("w-native").addEventListener("click", function () {
      S.wardSort = "native";
      $("w-count").setAttribute("aria-pressed","false");
      $("w-native").setAttribute("aria-pressed","true");
      renderWards();
    });
  }

  function fatal(msg) {
    $("boot").classList.add("gone");
    document.querySelector(".legend").hidden = true;
    document.querySelector(".toolstack").style.display = "none";
    selectTab("map");
    setSnap("full");
    $("hero").innerHTML = "";
    $("cellinfo").innerHTML =
      "<div class='err'><b>माहिती लोड होऊ शकली नाही.</b><br>" +
      "Could not load the census data. Nothing is shown rather than showing " +
      "made-up numbers.<code>" + esc(msg) + "</code></div>";
  }

  // ------------------------------------------------------------------ boot --
  applyTheme(window.matchMedia &&
             window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

  Promise.all([
    getJSON("meta.json"), getJSON("species_index.json"), getJSON("ward_summary.json"),
    getJSON("species_names.json"), getJSON("tiles/index.json")
  ]).then(function (r) {
    S.meta = r[0]; S.species = r[1]; S.wards = r[2]; S.names = r[3]; S.tileIndex = r[4];

    initMap();
    wireSheet();
    wireUI();
    setSnap("half", false);
    renderMapPanel();
    renderMonths();
    renderFlowering();
    renderWards();
    buildFacts();
    paintRamp();

    $("boot").classList.add("gone");
    setTimeout(function () { var b = $("boot"); if (b) b.remove(); }, 500);

    ensureLayer("giant").catch(function () {});
    ensureLayer("rare").catch(function () {});
  }).catch(function (e) { fatal(e.message); });
})();
