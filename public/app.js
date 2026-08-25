/* ==========================================================================
   झाडांचा नकाशा · Zaadancha Naksha
   Pune Tree Census 2019, made explorable. Marathi and English.

   Vanilla JS + Leaflet. No backend, no API keys, no cookies, no storage,
   no analytics. Every number on screen comes from public/data/*, built from
   the census by scripts/aggregate.py. Nothing is invented here.
   ========================================================================== */

(function () {
  "use strict";

  var DATA = "data/";
  var PUNE = [18.5204, 73.8567];
  var RARE_MIN_ZOOM = 14;   // 12,000 gold dots at city zoom hides the city

  // ------------------------------------------------------------- strings ---
  var T = {
    brand:        ["झाडांचा नकाशा", "Zaadancha Naksha"],
    honestShort:  ["<b>PMC वृक्ष गणना · ऑगस्ट २०१९</b> — अधिकृत सेवा नाही",
                   "<b>PMC Tree Census · August 2019</b> — not an official service"],
    honestMore:   ["२०१९ नंतर लावलेली किंवा तोडलेली झाडं इथे दिसणार नाहीत. OpenCity मार्फत मिळालेली खुली माहिती. ही पुणे महानगरपालिकेची अधिकृत सेवा नाही.",
                   "Trees planted or cut since 2019 are not reflected. Open data via OpenCity. This is not an official Pune Municipal Corporation service."],
    grid:         ["ग्रिड", "Grid"],
    rare:         ["दुर्मिळ", "Rare"],
    giant:        ["महाकाय", "Giants"],
    density:      ["झाडांची घनता", "Trees per cell"],
    low:          ["कमी", "low"],
    tabMap:       ["नकाशा", "Map"],
    /* English labels are kept short so all five tabs fit a 390 px phone
       without the rail needing to scroll. */
    tabFlower:    ["फुलं", "Bloom"],
    tabTreasure:  ["खजिना", "Treasure"],
    tabWard:      ["प्रभाग", "Wards"],
    tabFacts:     ["तथ्यं", "Facts"],
    dragUp:       ["झाडं · वर ओढा", "trees · drag up"],
    censusEyebrow:["PMC TREE CENSUS 2019", "PMC TREE CENSUS 2019"],
    counted:      ["पुण्यात मोजलेली झाडं", "trees counted in Pune"],
    species:      ["प्रजाती", "species"],
    wards:        ["प्रभाग", "wards"],
    rareShort:    ["दुर्मिळ", "rare"],
    origin:       ["ORIGIN", "ORIGIN"],
    originH:      ["देशी की परदेशी?", "Native or introduced?"],
    native:       ["देशी", "native"],
    introduced:   ["परदेशी", "introduced"],
    unknown:      ["माहीत नाही", "unknown"],
    ofClassified: ["ओळखता आलेल्या झाडांपैकी <b>{p}</b> देशी आहेत.",
                   "Of the trees that could be classified at all, <b>{p}</b> are native."],
    selectedCell: ["निवडलेला भाग", "Selected cell"],
    hereTrees:    ["या भागात", "In this cell"],
    cellSize:     ["~500 मी ग्रिड", "~500 m grid cell"],
    trees:        ["झाडं", "trees"],
    healthy:      ["निरोगी", "healthy"],
    noSpecies:    ["प्रजातीची नोंद नाही", "no species recorded"],
    flEyebrow:    ["PHULANCHA MAHINA", "WHAT'S IN BLOOM"],
    flH:          ["फुलांचा महिना", "Flowering month"],
    flSub:        ["महिना निवडा — त्या महिन्यात पुण्यात काय फुलतं ते बघा.",
                   "Pick a month to see what flowers in Pune then."],
    bloomCap:     ["प्रजाती {m}मध्ये फुलतात", "species flower in {m}"],
    cityShare:    ["शहराचा वाटा", "of the city"],
    totalSpecies: ["एकूण प्रजाती", "species total"],
    noBloom:      ["{m} मध्ये नोंद नाही", "Nothing recorded for {m}"],
    noBloomSub:   ["या महिन्यात कोणतीही प्रजाती फुलत असल्याची नोंद गणनेत नाही. आकडे तसेच दाखवले आहेत — भरून काढलेले नाहीत.",
                   "The census records no species flowering this month. That is what the data says — it has not been filled in."],
    showingTop:   ["सर्वाधिक आढळणाऱ्या {n} प्रजाती दाखवल्या आहेत.", "Showing the {n} most common."],
    trEyebrow:    ["TREASURE HUNT", "TREASURE HUNT"],
    trH:          ["खजिन्याचा शोध", "Treasure hunt"],
    trSub:        ["यादीतल्या झाडावर टॅप करा — नकाशा तिथे जाईल.",
                   "Tap any tree and the map flies to it."],
    todaysFind:   ["आजचा खजिना · TODAY'S FIND", "TODAY'S FIND"],
    girth:        ["घेर", "girth"],
    height:       ["उंची", "height"],
    ward:         ["प्रभाग", "ward"],
    condition:    ["स्थिती", "condition"],
    owner:        ["मालकी", "owner"],
    showOnMap:    ["नकाशावर दाखवा", "Show me on the map"],
    flaggedRare:  ["दुर्मिळ नोंदी", "flagged rare"],
    plotted:      ["नकाशावर", "plotted"],
    giantsN:      ["महाकाय झाडं", "giant trees"],
    largestGirth: ["सर्वात मोठा घेर", "largest girth"],
    smallestOf:   ["५००वा घेर", "500th girth"],
    showingFirst: ["यादीत पहिली {n} दाखवली आहेत; बाकीची नकाशावर आहेत.",
                   "Showing the first {n}; the rest are on the map."],
    rareZoomHint: ["दुर्मिळ झाडं बघण्यासाठी झूम करा", "Zoom in to see the rare trees"],
    wdEyebrow:    ["WARD LEADERBOARD", "WARD LEADERBOARD"],
    wdH:          ["प्रभाग क्रमवारी", "Ward leaderboard"],
    byCount:      ["झाडांची संख्या", "By count"],
    byNative:     ["देशी %", "Native %"],
    noteCount:    ["प्रभागानुसार नोंदवलेली एकूण झाडं.", "Total recorded trees per ward."],
    noteNative:   ["देशी % = ओळखता आलेल्या प्रजातींपैकी देशी झाडांचं प्रमाण.",
                   "Native % is of the trees whose species could be classified."],
    faEyebrow:    ["SHAREABLE", "SHAREABLE"],
    faH:          ["शेअर करण्यासारखं", "Worth sharing"],
    faSub:        ["प्रत्येक कार्ड थेट आकड्यांमधून तयार होतं — हाताने लिहिलेलं नाही.",
                   "Every card is generated from the numbers, not written by hand."],
    share:        ["शेअर करा", "Share"],
    copy:         ["कॉपी", "Copy"],
    copied:       ["✓ कॉपी झालं", "✓ Copied"],
    tabAct:       ["कृती", "Act"],

    polEyebrow:   ["श्वसन · हवेतील परागकण", "POLLEN & BREATHING"],
    polH:         ["या महिन्यात हवेत काय?", "What is in the air this month?"],
    polCount:     ["प्रजाती या महिन्यात फुलतात आणि भारतीय ॲलर्जी संशोधनात नोंदल्या आहेत.",
                   "species flowering this month appear in the Indian aeroallergen literature."],
    polNone:      ["या महिन्यात फुलणारी एकही प्रजाती त्या यादीत नाही.",
                   "No species flowering this month appears on that list."],
    polSeason:    ["वर्षभराचा आलेख", "Across the year"],
    polShowy:     ["गुलमोहर, बहावा, टॅबेबुया — सर्वात दिसणारी फुलं, पण यादीत नाहीत. जी झाडं सर्वात सुंदर फुलतात तीच नाक वाहायला लावतात असं नाही.",
                   "Gulmohar, Bahava and Tabebuia are the showiest flowers in Pune and none is on the list. The tree that looks most dramatic in bloom is often not the one behind a streaming nose."],
    polWarnT:     ["हे परागकणांचं मोजमाप नाही.", "This is not a pollen measurement."],
    polWarn:      ["पुण्यासाठी थेट परागकण मोजणीचा खुला स्रोत उपलब्ध नाही. इथे एवढंच सांगितलं आहे: गणनेनुसार या महिन्यात कोणत्या प्रजाती फुलतात, आणि त्यांपैकी कोणत्या भारतीय ॲलर्जी संशोधनात नोंदल्या आहेत. आजच्या हवेत काय आहे हे यावरून कळत नाही, ते हवामान, वारा आणि पावसावर अवलंबून असतं. हा वैद्यकीय सल्ला नाही. यादीत नसलेली झाडं सुरक्षित ठरत नाहीत, फक्त यादीत नाहीत एवढंच.",
                   "Pune has no live open pollen-count feed. All this shows is which species the census records as flowering this month, and which of those appear in the published Indian aeroallergen literature. It cannot tell you what is in the air today, which depends on weather, wind and rain. It is not medical advice. Species absent from the list are not marked safe, only not listed."],
    polListN:     ["यादीत प्रजाती", "on the list"],
    polSource:    ["यादीचा स्रोत", "List source"],

    acEyebrow:    ["CIVIC ACTION", "CIVIC ACTION"],
    acH:          ["प्रभागासाठी कृती", "Act on your ward"],
    acSub:        ["२०१९ चा आकडा हा तुमचा आधार आहे. महापालिकेला विचारा की तेव्हापासून काय बदललं.",
                   "The 2019 count is your baseline. Use it to ask PMC what has changed since."],
    acPick:       ["प्रभाग निवडा", "Choose your ward"],
    acBaseline:   ["२०१९ चा आधार", "2019 BASELINE"],
    acRtiT:       ["माहिती अधिकार अर्ज", "RTI application"],
    acRtiD:       ["कॉपी करा, नाव आणि पत्ता भरा, आणि पुणे महानगरपालिकेच्या जन माहिती अधिकाऱ्यांकडे द्या.",
                   "Copy it, fill in your name and address, and submit it to the Public Information Officer, Pune Municipal Corporation."],
    acLetT:       ["प्रभाग कार्यालयाला पत्र", "Letter to your ward office"],
    acLetD:       ["ईमेल करा किंवा छापून द्या. स्वतःच्या शब्दांत एक ओळ जोडा, तीच सर्वात महत्त्वाची.",
                   "Email it or print it. Add one line in your own words. That line matters more than the rest."],
    acHowT:       ["माहिती अधिकार कसा दाखल करायचा", "How to file an RTI"],
    acHow1:       ["अर्ज पुणे महानगरपालिकेच्या जन माहिती अधिकाऱ्यांच्या नावे लिहा.",
                   "Address the application to the Public Information Officer, Pune Municipal Corporation."],
    acHow2:       ["फी १० रुपये. दारिद्र्यरेषेखालील अर्जदारांना फी नाही, कार्डाची प्रत जोडा.",
                   "The fee is Rs 10. Applicants below the poverty line pay nothing, on production of a BPL card copy."],
    acHow3:       ["उत्तर ३० दिवसांत यायला हवं.", "They must respond within 30 days."],
    acHow4:       ["उत्तर न आल्यास किंवा असमाधानकारक असल्यास ३० दिवसांत कलम १९(१) खाली पहिलं अपील करा.",
                   "If they do not reply, or the reply is unsatisfactory, file a first appeal within 30 days under section 19(1)."],
    acHow5:       ["महाराष्ट्रातील सर्व महापालिका केंद्रीय ऑनलाइन पोर्टलवर नाहीत, त्यामुळे थेट महापालिकेकडे देणं खात्रीचं.",
                   "Maharashtra municipal corporations are not all integrated with the central online RTI portal, so filing directly with PMC is the reliable route."],
    acDisc:       ["हा नमुना आहे, कायदेशीर सल्ला नाही. फी भरण्यापूर्वी महापालिकेची सध्याची पद्धत आणि पत्ता तपासा.",
                   "This is a template, not legal advice. Check PMC's current procedure and address before paying a fee or submitting."],
    acCopyRti:    ["अर्ज कॉपी करा", "Copy RTI text"],
    acCopyLet:    ["पत्र कॉपी करा", "Copy letter"],
    madeBy:       ["MADE BY", "MADE BY"],
    madeName:     ["शमा ठाकूर", "Shama Thakur"],
    madeLine:     ["डेटा अ‍ॅनालिस्ट · नाशिक ते स्टॉकहोम. हा नकाशा फुकट आहे आणि फुकटच राहील.",
                   "Data analyst, Nashik to Stockholm. This map is free and always will be."],
    sourceLbl:    ["स्रोत", "Source"],
    notOfficial:  ["ही पुणे महानगरपालिकेची अधिकृत सेवा नाही. २०१९ नंतरची झाडं इथे नाहीत.",
                   "Not an official PMC service. Trees planted or cut since 2019 are not reflected."],
    privacy:      ["कुकीज नाहीत. स्टोरेज नाही. अ‍ॅनालिटिक्स नाही. तुमची कोणतीही माहिती इथून बाहेर जात नाही.",
                   "No cookies. No storage. No analytics. Nothing about you leaves your device."],
    everyCaveat:  ["— प्रत्येक आकडा आणि इशारा", "— every count and caveat"],
    loadFail:     ["माहिती लोड होऊ शकली नाही.", "Could not load the census data."],
    loadFailSub:  ["चुकीचे आकडे दाखवण्यापेक्षा काहीच न दाखवणं बरं.",
                   "Nothing is shown rather than showing made-up numbers."]
  };

  var MONTHS = [
    ["जानेवारी","January"],["फेब्रुवारी","February"],["मार्च","March"],["एप्रिल","April"],
    ["मे","May"],["जून","June"],["जुलै","July"],["ऑगस्ट","August"],
    ["सप्टेंबर","September"],["ऑक्टोबर","October"],["नोव्हेंबर","November"],["डिसेंबर","December"]
  ];
  var MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* Shama's own links — the single place to edit them.
     Portfolio and LinkedIn confirmed by her directly; the rest are built
     from her handles. Ko-fi and Gumroad are deliberately absent until she
     supplies the real URLs — a guessed payment link is worse than none. */
  var LINKS = [
    { label: "Portfolio",        url: "https://www.shamathakur.dev/",              key: true },
    { label: "Frequency Studio", url: "https://frequencystudio.vercel.app/",       key: true },
    { label: "Substack",         url: "https://shamathakur.substack.com" },
    { label: "Medium",           url: "https://medium.com/@shamathakur77" },
    { label: "LinkedIn",         url: "https://www.linkedin.com/in/shamathakur-ai/" },
    { label: "Instagram",        url: "https://instagram.com/shama_thakur77" },
    { label: "Pinterest",        url: "https://pinterest.com/thkrshama" }
  ];

  var RAMP_DARK  = ["#1D4A1E","#276227","#33792F","#46913B","#6FB869","#A5D69A"];
  var RAMP_LIGHT = ["#DCEFD7","#ABD7A2","#6FB869","#3A9440","#216C2E","#114620"];
  var BASE_DARK  = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
  var BASE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
  var LABELS     = "https://{s}.basemaps.cartocdn.com/{v}_only_labels/{z}/{x}/{y}{r}.png";

  var S = {
    meta:null, species:null, wards:null, names:null, tileIndex:null,
    rare:null, giants:null, pollen:null, pollenSet:null,
    tilesLoaded:{}, cellLayer:null, rareLayer:null, giantLayer:null,
    map:null, renderer:null, base:null, labels:null,
    month:new Date().getMonth() + 1,
    treasureMode:"rare", wardSort:"count", tab:"map",
    theme:"dark", lang:0, snap:"half",
    rareWanted:false
  };

  // ------------------------------------------------------------- helpers ---
  function $(id) { return document.getElementById(id); }
  function t(k, vars) {
    var s = (T[k] || [])[S.lang];
    if (s == null) s = (T[k] || [])[1] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split("{" + v + "}").join(vars[v]); });
    return s;
  }
  function mon(i) { return MONTHS[i][S.lang]; }
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
  /* In Marathi the local name leads; in English the common name leads.
     Whichever is missing falls through to the botanical name. */
  function nameOf(key) {
    var n = S.names[key];
    if (!n) return key;
    return S.lang === 0 ? (n[0] || n[1] || n[2] || key) : (n[1] || n[0] || n[2] || key);
  }
  function sciOf(key) { var n = S.names[key]; return n ? (n[2] || "") : ""; }
  function spName(s) {
    return S.lang === 0 ? (s.l || s.c || s.b) : (s.c || s.l || s.b);
  }
  function propName(p) {
    return S.lang === 0 ? (p.l || p.c || p.b) : (p.c || p.l || p.b);
  }
  function getJSON(path) {
    return fetch(DATA + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }
  function ramp() { return S.theme === "dark" ? RAMP_DARK : RAMP_LIGHT; }

  // --------------------------------------------------------------- theme ---
  function applyTheme(th) {
    S.theme = th;
    document.documentElement.setAttribute("data-theme", th);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", th === "dark" ? "#0A0D0A" : "#F6F4EC");
    if (S.base) {
      S.base.setUrl(th === "dark" ? BASE_DARK : BASE_LIGHT);
      S.labels.setUrl(LABELS.replace("{v}", th === "dark" ? "dark" : "light"));
    }
    if (S.cellLayer) repaintCells();
    repaintMarkers();
    paintRamp();
  }
  function paintRamp() {
    var r = $("ramp");
    if (r) r.innerHTML = ramp().map(function (c) { return "<i style='background:" + c + "'></i>"; }).join("");
  }

  // ------------------------------------------------------------ language ---
  function applyLang(i) {
    S.lang = i;
    document.documentElement.lang = i === 0 ? "mr" : "en";
    $("lang").textContent = i === 0 ? "EN" : "मराठी";
    $("lang").setAttribute("aria-label", i === 0 ? "Switch to English" : "मराठीत बदला");
    paintStatic();
    if (S.meta) {
      renderMapPanel(); renderMonths(); renderFlowering();
      renderWards(); buildFacts(); renderTreasures();
      renderPollen(); buildWardPicker(); renderAct();
    }
  }

  function paintStatic() {
    $("brandName").textContent = t("brand");
    $("honestShort").innerHTML = t("honestShort");
    $("honestMore").textContent = t("honestMore");
    $("tg-grid").querySelector("span").textContent   = t("grid");
    $("tg-rare").querySelector("span").textContent   = t("rare");
    $("tg-giants").querySelector("span").textContent = t("giant");
    $("legendTitle").textContent = t("density");
    $("lg-lo").textContent = t("low");
    $("tab-map").textContent      = t("tabMap");
    $("tab-flower").textContent   = t("tabFlower");
    $("tab-treasure").textContent = t("tabTreasure");
    $("tab-ward").textContent     = t("tabWard");
    $("tab-facts").textContent    = t("tabFacts");
    $("tab-act").textContent      = t("tabAct");
    $("ac-eyebrow").textContent = t("acEyebrow");
    $("ac-h").textContent       = t("acH");
    $("ac-sub").textContent     = t("acSub");
    $("ac-pick").textContent    = t("acPick");
    $("fl-eyebrow").textContent = t("flEyebrow");
    $("fl-h").textContent       = t("flH");
    $("fl-sub").textContent     = t("flSub");
    $("tr-eyebrow").textContent = t("trEyebrow");
    $("tr-h").textContent       = t("trH");
    $("tr-sub").textContent     = t("trSub");
    $("tr-rare").textContent    = t("rare");
    $("tr-giant").textContent   = t("giant");
    $("wd-eyebrow").textContent = t("wdEyebrow");
    $("wd-h").textContent       = t("wdH");
    $("w-count").textContent    = t("byCount");
    $("w-native").textContent   = t("byNative");
    $("fa-eyebrow").textContent = t("faEyebrow");
    $("fa-h").textContent       = t("faH");
    $("fa-sub").textContent     = t("faSub");
    $("zoomhint").textContent   = t("rareZoomHint");
  }

  // ---------------------------------------------------------------- sheet ---
  var SNAPS = ["peek","half","full"];
  var TOP_RESERVE = 168;
  function sheetGeom() {
    var vh = window.innerHeight, h = vh - TOP_RESERVE;
    return { vh:vh, h:h, peek:Math.max(0, h - 132), half:Math.max(0, h - 0.52*vh), full:0 };
  }
  function setSnap(name, animate) {
    if (window.matchMedia("(min-width: 860px)").matches) return;
    S.snap = name;
    var g = sheetGeom(), sheet = $("sheet");
    if (animate === false) sheet.classList.add("dragging");
    sheet.style.setProperty("--sheet-y", g[name] + "px");
    document.documentElement.style.setProperty("--peek", "132px");
    if (animate === false) requestAnimationFrame(function () { sheet.classList.remove("dragging"); });
    sheet.classList.toggle("at-peek", name === "peek");
    $("legend").hidden = name !== "peek";
    $("peekline").style.display = name === "peek" ? "flex" : "none";
    updateZoomHint();
  }
  function wireSheet() {
    var sheet = $("sheet"), grab = $("grab");
    var startY = 0, startTop = 0, dragging = false, moved = 0, t0 = 0;
    function currentTop() {
      return parseFloat(getComputedStyle(sheet).getPropertyValue("--sheet-y")) || 0;
    }
    grab.addEventListener("pointerdown", function (e) {
      if (window.matchMedia("(min-width: 860px)").matches) return;
      dragging = true; moved = 0; t0 = Date.now();
      startY = e.clientY; startTop = currentTop();
      sheet.classList.add("dragging");
      try { grab.setPointerCapture(e.pointerId); } catch (_) {}
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var g = sheetGeom();
      moved = e.clientY - startY;
      sheet.style.setProperty("--sheet-y", Math.max(g.full, Math.min(g.peek, startTop + moved)) + "px");
      e.preventDefault();
    }, { passive: false });
    function up() {
      if (!dragging) return;
      dragging = false; sheet.classList.remove("dragging");
      var g = sheetGeom(), top = currentTop();
      if (Math.abs(moved) > 40 && (Date.now() - t0) < 320) {
        var i = SNAPS.indexOf(S.snap);
        setSnap(SNAPS[Math.max(0, Math.min(2, i + (moved > 0 ? -1 : 1)))]);
        return;
      }
      var best = "half", bd = Infinity;
      SNAPS.forEach(function (n) { var d = Math.abs(g[n] - top); if (d < bd) { bd = d; best = n; } });
      setSnap(best);
    }
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

  // ------------------------------------------------------------------ map ---
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
    S.labels = L.tileLayer(LABELS.replace("{v}", S.theme === "dark" ? "dark" : "light"), {
      maxZoom: 19, subdomains: "abcd", opacity: .9, pane: "shadowPane"
    }).addTo(S.map);
    S.map.on("moveend zoomend", function () { loadVisibleTiles(); syncRareZoom(); });
    loadVisibleTiles();
  }

  /* 12,000 gold dots at city zoom is a gold blob, not a map. The rare layer
     is only drawn once you are close enough for individual trees to mean
     something; the list stays available at every zoom. */
  function syncRareZoom() {
    if (!S.rareWanted) return;
    var close = S.map.getZoom() >= RARE_MIN_ZOOM;
    if (close && !S.map.hasLayer(S.rareLayer)) S.map.addLayer(S.rareLayer);
    if (!close && S.map.hasLayer(S.rareLayer)) S.map.removeLayer(S.rareLayer);
    updateZoomHint();
  }
  function updateZoomHint() {
    var show = S.rareWanted && S.map && S.map.getZoom() < RARE_MIN_ZOOM && S.snap === "peek";
    $("zoomhint").hidden = !show;
  }

  function cellColor(n, max) {
    var R = ramp();
    if (!(n > 0)) return R[0];
    var x = Math.log(n) / Math.log(Math.max(max, 2));
    return R[Math.max(0, Math.min(R.length - 1, Math.floor(x * R.length)))];
  }
  var CELLS = [], MARKERS = [];
  function repaintCells() {
    var max = S.tileIndex.max_cell_count;
    CELLS.forEach(function (c) { c.rect.setStyle({ fillColor: cellColor(c.n, max) }); });
  }
  function repaintMarkers() {
    var edge = S.theme === "dark" ? "rgba(10,13,10,.9)" : "rgba(255,255,255,.95)";
    MARKERS.forEach(function (m) { m.setStyle({ color: edge }); });
  }

  function tileKeySet() {
    if (S._tk) return S._tk;
    var s = {};
    S.tileIndex.tiles.forEach(function (x) { s[x.t[0] + "_" + x.t[1]] = x; });
    S._tk = s; return s;
  }
  function loadVisibleTiles() {
    if (!S.tileIndex) return;
    var idx = tileKeySet(), b = S.map.getBounds().pad(0.25), TD = S.tileIndex.tile_deg;
    for (var i = Math.floor(b.getWest()/TD); i <= Math.floor(b.getEast()/TD); i++) {
      for (var j = Math.floor(b.getSouth()/TD); j <= Math.floor(b.getNorth()/TD); j++) {
        var k = i + "_" + j;
        if (!idx[k] || S.tilesLoaded[k]) continue;
        S.tilesLoaded[k] = true;
        (function (key) {
          getJSON("tiles/" + key + ".json").then(drawTile).catch(function (e) {
            S.tilesLoaded[key] = false;
            console.warn("tile " + key + ":", e.message);
          });
        })(k);
      }
    }
  }
  function drawTile(tile) {
    var CD = S.tileIndex.cell_deg, CPT = S.tileIndex.cells_per_tile;
    var max = S.tileIndex.max_cell_count, ti = tile.t[0], tj = tile.t[1];
    tile.cells.forEach(function (c) {
      var ci = ti*CPT + c[0], cj = tj*CPT + c[1];
      var n = c[2], top = c[3] || [], healthy = c[4], w = ci*CD, s = cj*CD;
      var rect = L.rectangle([[s, w], [s+CD, w+CD]], {
        renderer: S.renderer, stroke: false,
        fillColor: cellColor(n, max), fillOpacity: .55,
        interactive: true, bubblingMouseEvents: false
      });
      rect.on("click", function () { showCell(n, top, healthy, [s+CD/2, w+CD/2]); });
      S.cellLayer.addLayer(rect);
      CELLS.push({ rect: rect, n: n });
    });
  }

  function showCell(n, top, healthy, centre) {
    L.popup({ closeButton:true, autoPan:true, maxWidth:250, minWidth:180, offset:[0,-4] })
      .setLatLng(centre)
      .setContent(
        "<div class='pop'><div class='pt'>" + nf(n) + " " + t("trees") + "</div>" +
        "<div class='ps'>" + t("cellSize") + "</div>" +
        (top.length
          ? "<table>" + top.map(function (x) {
              return "<tr><td>" + esc(nameOf(x[0])) + "</td><td>" + nf(x[1]) + "</td></tr>";
            }).join("") + "</table>"
          : "<div class='ps'>" + t("noSpecies") + "</div>") +
        (healthy != null
          ? "<table><tr><td>" + t("healthy") + "</td><td>" + healthy + "%</td></tr></table>" : "") +
        "</div>")
      .openOn(S.map);

    $("cellinfo").innerHTML =
      "<p class='eyebrow'>" + t("selectedCell") + "</p>" +
      "<div class='card flush'><ul class='rows'>" +
      "<li><span class='grow'><span class='nm'>" + t("hereTrees") + "</span>" +
      "<div class='sci' style='font-style:normal'>" + t("cellSize") + "</div></span>" +
      "<span class='val'>" + nf(n) + "<small>" + t("trees") + "</small></span></li>" +
      top.map(function (x, i) {
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(nameOf(x[0])) + "</span>" +
          "<div class='sci'>" + esc(sciOf(x[0])) + "</div></span>" +
          "<span class='val'>" + nf(x[1]) + "</span></li>";
      }).join("") + "</ul></div>";
    selectTab("map");
    if (S.snap === "peek") setSnap("half");
  }

  // ------------------------------------------------------------ treasures ---
  function marker(f, kind) {
    var p = f.properties, c = f.geometry.coordinates;
    var m = L.circleMarker([c[1], c[0]], {
      renderer: S.renderer,
      radius: kind === "giant" ? Math.max(5, Math.min(12, (p.g || 100)/95)) : 5,
      fillColor: kind === "rare" ? "#F0B23C" : "#6FA8E8",
      fillOpacity: .95,
      color: S.theme === "dark" ? "rgba(10,13,10,.9)" : "rgba(255,255,255,.95)",
      weight: 1.5
    });
    m.bindPopup(function () { return treasurePopup(p, kind); }, { maxWidth: 280 });
    MARKERS.push(m);
    return m;
  }
  function treasurePopup(p, kind) {
    function tr(k, v) { return v ? "<tr><td>" + k + "</td><td>" + esc(v) + "</td></tr>" : ""; }
    return "<div class='pop'><div class='pt'>" + esc(propName(p)) + "</div>" +
      "<div class='ps'>" + esc(p.b) + "</div><table>" +
      tr(t("girth"), p.g ? p.g + " cm" : "") + tr(t("height"), p.h ? p.h + " m" : "") +
      tr(t("condition"), p.cond) + tr(t("owner"), p.own) + tr(t("ward"), p.w) +
      "</table></div>";
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
    if (S.tab !== "treasure" && !S[S.treasureMode === "rare" ? "rare" : "giants"]) return;
    var kind = S.treasureMode, fc = kind === "rare" ? S.rare : S.giants, host = $("treasurelist");
    if (!host) return;
    if (!fc) {
      host.innerHTML = "<div class='card'><div class='sub' style='margin:0'>…</div></div>";
      ensureLayer(kind).catch(function (e) {
        host.innerHTML = "<div class='err'><b>" + t("loadFail") + "</b><code>" + esc(e.message) + "</code></div>";
      });
      return;
    }
    var pick = fc.features[dayIndex(fc.features.length)], pp = pick.properties;
    var html =
      "<div class='treasure " + (kind === "giant" ? "giant" : "") + "'>" +
        "<div class='tk'>" + t("todaysFind") + "</div>" +
        "<div class='tn'>" + esc(propName(pp)) + "</div>" +
        "<div class='ts'>" + esc(pp.b) + "</div><div class='tstat'>" +
          "<div><div class='v'>" + (pp.g ? nf(pp.g) : "—") + "</div><div class='k'>" + t("girth") + " cm</div></div>" +
          "<div><div class='v'>" + (pp.h || "—") + "</div><div class='k'>" + t("height") + " m</div></div>" +
          "<div><div class='v' style='font-size:.95rem;font-weight:600'>" + esc(pp.w || "—") + "</div><div class='k'>" + t("ward") + "</div></div>" +
        "</div><div class='acts'><button class='btn primary' id='goto-today'>" + t("showOnMap") + "</button></div>" +
      "</div>";

    if (kind === "rare") {
      html += "<div class='metrics'>" +
        "<div class='metric'><div class='v'>" + nf(fc.total_rare_in_census) + "</div><div class='k'>" + t("flaggedRare") + "</div></div>" +
        "<div class='metric'><div class='v'>" + nf(fc.included) + "</div><div class='k'>" + t("plotted") + "</div></div>" +
        "<div class='metric'><div class='v'>" + pct(100*fc.total_rare_in_census/S.meta.totals.rows, 2) + "</div><div class='k'>" + t("cityShare") + "</div></div>" +
        "</div>";
      if (fc.truncated) html += "<div class='card' style='font-size:.8rem;color:var(--txt-2)'>⚠ " + esc(fc.note) + "</div>";
    } else {
      var last = fc.features[fc.features.length - 1].properties.g;
      html += "<div class='metrics'>" +
        "<div class='metric'><div class='v'>" + nf(fc.features.length) + "</div><div class='k'>" + t("giantsN") + "</div></div>" +
        "<div class='metric'><div class='v'>" + nf(fc.features[0].properties.g) + "</div><div class='k'>" + t("largestGirth") + " cm</div></div>" +
        "<div class='metric'><div class='v'>" + nf(last) + "</div><div class='k'>" + t("smallestOf") + " cm</div></div>" +
        "</div>";
    }

    html += "<div class='card flush'><ul class='rows'>" +
      fc.features.slice(0, 200).map(function (f, i) {
        var p = f.properties, c = f.geometry.coordinates;
        return "<li><button class='row' data-lat='" + c[1] + "' data-lon='" + c[0] + "'>" +
          "<span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(propName(p)) + "</span>" +
          "<div class='sci'>" + esc(p.w || "") + (p.h ? " · " + p.h + " m" : "") + "</div></span>" +
          "<span class='val'>" + (p.g ? nf(p.g) : "—") + "<small>cm " + t("girth") + "</small></span></button></li>";
      }).join("") + "</ul></div>" +
      (fc.features.length > 200 ? "<p class='sub' style='margin:12px 0 0'>" + t("showingFirst", {n:200}) + "</p>" : "");

    host.innerHTML = html;
    var g = $("goto-today");
    if (g) g.addEventListener("click", function () {
      flyTo(pick.geometry.coordinates[1], pick.geometry.coordinates[0], kind);
    });
    host.querySelectorAll("button.row").forEach(function (b) {
      b.addEventListener("click", function () {
        flyTo(parseFloat(b.dataset.lat), parseFloat(b.dataset.lon), kind);
      });
    });
  }

  function flyTo(lat, lon, kind) {
    if (kind === "rare") {
      S.rareWanted = true;
      $("tg-rare").setAttribute("aria-pressed", "true");
    } else if (!S.map.hasLayer(S.giantLayer)) {
      S.map.addLayer(S.giantLayer);
      $("tg-giants").setAttribute("aria-pressed", "true");
    }
    setSnap("peek");
    S.map.setView([lat, lon], 17, { animate: true });
    syncRareZoom();
  }

  // ------------------------------------------------------------- flowering --
  function renderMonths() {
    var now = new Date().getMonth() + 1;
    $("months").innerHTML = MONTHS.map(function (m, i) {
      return "<button data-m='" + (i+1) + "' data-now='" + (now === i+1 ? 1 : 0) + "' " +
        "aria-pressed='" + (S.month === i+1) + "'>" + esc(m[S.lang]) +
        "<span class='n'>" + MON_SHORT[i] + "</span></button>";
    }).join("");
    $("months").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        S.month = parseInt(b.dataset.m, 10); renderMonths(); renderFlowering();
      });
    });
    centreMonth();
  }
  function centreMonth() {
    var host = $("months");
    if (!host || host.offsetParent === null) return;
    var on = host.querySelector('[aria-pressed="true"]');
    if (on) host.scrollLeft = on.offsetLeft - (host.clientWidth - on.offsetWidth) / 2;
  }
  function natTag(n) {
    return "<span class='tag " + esc(n) + "'>" +
      (n === "native" ? t("native") : n === "non_native" ? t("introduced") : t("unknown")) + "</span>";
  }
  function renderFlowering() {
    var m = S.month;
    var hits = S.species.species.filter(function (s) { return s.fm && s.fm.indexOf(m) !== -1; });
    hits.sort(function (a, b) { return b.n - a.n; });
    var trees = hits.reduce(function (a, s) { return a + s.n; }, 0);

    if (!hits.length) {
      $("flowerlist").innerHTML =
        "<div class='card'><div class='nm'>" + t("noBloom", {m: mon(m-1)}) + "</div>" +
        "<p class='sub' style='margin:6px 0 0'>" + t("noBloomSub") + "</p></div>";
      return;
    }
    $("flowerlist").innerHTML =
      "<div class='hero' style='padding-top:0'>" +
        "<div class='big num'>" + nf(hits.length) + "</div>" +
        "<div class='cap'>" + t("bloomCap", {m: mon(m-1)}) + "</div></div>" +
      "<div class='metrics'>" +
        "<div class='metric'><div class='v num'>" + nf(trees) + "</div><div class='k'>" + t("trees") + "</div></div>" +
        "<div class='metric'><div class='v num'>" + pct(100*trees/S.meta.totals.rows, 0) + "</div><div class='k'>" + t("cityShare") + "</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(S.species.count) + "</div><div class='k'>" + t("totalSpecies") + "</div></div>" +
      "</div><div class='card flush'><ul class='rows'>" +
      hits.slice(0, 60).map(function (s, i) {
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(spName(s)) + "</span> " + natTag(s.nat) +
          "<div class='sci'>" + esc(s.b) + "</div></span>" +
          "<span class='val'>" + nf(s.n) + "<small>" + esc(s.e || "") + "</small></span></li>";
      }).join("") + "</ul></div>" +
      (hits.length > 60 ? "<p class='sub' style='margin:12px 0 0'>" + t("showingTop", {n:60}) + "</p>" : "");
    renderPollen();
  }

  // ------------------------------------------------------------------ wards --
  function renderWards() {
    var ws = S.wards.wards.slice();
    if (S.wardSort === "native") {
      ws = ws.filter(function (w) { return w.native_pct !== null; });
      ws.sort(function (a, b) { return b.native_pct - a.native_pct; });
      $("wardnote").textContent = t("noteNative");
    } else {
      ws.sort(function (a, b) { return b.n - a.n; });
      $("wardnote").textContent = t("noteCount");
    }
    var maxV = ws.length ? (S.wardSort === "native" ? ws[0].native_pct : ws[0].n) : 1;
    $("wardlist").innerHTML = "<div class='card flush'><ul class='rows'>" +
      ws.map(function (w, i) {
        var v = S.wardSort === "native" ? w.native_pct : w.n;
        var top = (w.top || []).slice(0, 3).map(function (x) { return esc(nameOf(x.k)); }).join(" · ");
        return "<li><span class='rank'>" + (i+1) + "</span><span class='grow'>" +
          "<span class='nm'>" + esc(w.name) + "</span>" +
          "<div class='sci' style='font-style:normal'>" + top + "</div>" +
          "<div class='meter'><i style='width:" + Math.max(2, (v/maxV)*100).toFixed(1) + "%'></i></div></span>" +
          "<span class='val'>" + (S.wardSort === "native" ? pct(w.native_pct, 0) : nf(w.n)) +
          "<small>" + (S.wardSort === "native" ? nf(w.n) + " " + t("trees") : pct(w.healthy_pct, 0) + " " + t("healthy")) +
          "</small></span></li>";
      }).join("") + "</ul></div>";
  }

  // ------------------------------------------------------------------ facts --
  function buildFacts() {
    var m = S.meta, sp = S.species.species, total = m.totals.rows, nat = m.nativity;
    var known = nat.native + nat.non_native;
    var t3 = sp.slice(0,3), t3n = t3.reduce(function (a,s) { return a+s.n; }, 0);
    var t3names = t3.map(spName).join(", ");
    var t3intro = t3.filter(function (s) { return s.nat === "non_native"; }).length;
    var t3unk = t3.filter(function (s) { return s.nat === "unknown"; }).length;
    var s1 = sp[0];
    var byCount = S.wards.wards.slice().sort(function (a,b) { return b.n-a.n; });
    var byNat = S.wards.wards.filter(function (w) { return w.native_pct !== null; })
                  .sort(function (a,b) { return b.native_pct-a.native_pct; });
    var url = location.origin + location.pathname;
    var F = [];

    var origin = t3intro + (S.lang === 0 ? " परदेशी आहेत" : " of those three are introduced");
    if (t3unk) origin += (S.lang === 0
      ? ", आणि " + t3unk + " ची ओळख आमच्या यादीतून पटली नाही"
      : ", and " + t3unk + " could not be classified from our origin list");

    F.push({
      n: pct(100*t3n/total, 0),
      head: S.lang === 0 ? "तीन प्रजाती. जवळपास निम्मं पुणं."
                         : "Three species. Almost half of Pune.",
      body: S.lang === 0
        ? t3names + " मिळून पुण्यातल्या " + nf(total) + " झाडांपैकी " + pct(100*t3n/total,0) + " आहेत. " + origin + "."
        : t3names + " together are " + pct(100*t3n/total,0) + " of all " + nf(total) + " trees PMC counted. " + origin + ".",
      share: "Three species are " + pct(100*t3n/total,0) + " of every tree in Pune (" +
             t3.map(function (s) { return s.b; }).join(", ") + ")."
    });

    F.push({
      n: nf(s1.n),
      head: spName(s1) + (S.lang === 0 ? " — पुण्यात सर्वात जास्त आढळणारं झाड."
                                       : " — Pune's most common tree."),
      body: S.lang === 0
        ? s1.b + " एकटं शहराच्या " + pct(100*s1.n/total,1) + " आहे — म्हणजे दर " + Math.round(total/s1.n) + " झाडांमागे एक."
        : s1.b + " accounts for " + pct(100*s1.n/total,1) + " of the city on its own — roughly one in every " + Math.round(total/s1.n) + " trees.",
      share: "Pune's most common tree is " + (s1.l ? s1.l + " / " : "") + s1.b + " — " +
             nf(s1.n) + " of them, " + pct(100*s1.n/total,1) + " of the city."
    });

    if (known) {
      var np = 100*nat.native/known;
      F.push({
        n: pct(np, 0),
        head: S.lang === 0 ? "ओळखता आलेल्या झाडांपैकी एवढीच देशी."
                           : "Only this much of the classifiable canopy is native.",
        body: S.lang === 0
          ? "ओळखता आलेल्या झाडांपैकी " + pct(np,0) + " भारतीय उपखंडातली आहेत; " + pct(100-np,0) +
            " बाहेरून आणलेली. आणखी " + nf(nat.unknown) + " झाडांची (" + pct(100*nat.unknown/total,0) +
            ") ओळख पटली नाही — त्यांचा अंदाज बांधलेला नाही."
          : pct(np,0) + " of classifiable trees are native to the subcontinent; " + pct(100-np,0) +
            " were introduced. A further " + nf(nat.unknown) + " trees (" + pct(100*nat.unknown/total,0) +
            ") could not be classified and are never guessed at.",
        share: "Only " + pct(np,0) + " of Pune's classifiable trees are native to the subcontinent."
      });
    }

    var gw = byCount[0], nw = byNat[0];
    F.push({
      n: nf(gw.n),
      head: gw.name + (S.lang === 0 ? " — सर्वाधिक झाडं असलेला प्रभाग." : " — the ward with the most trees."),
      body: (S.lang === 0
        ? gw.name + " मध्ये इतर कोणत्याही प्रभागापेक्षा जास्त झाडं नोंदवली आहेत."
        : gw.name + " has more recorded trees than any other ward.") +
        (nw ? (S.lang === 0
          ? " सर्वात जास्त देशी झाडं " + nw.name + " मध्ये — " + pct(nw.native_pct,0) + "."
          : " The most native ward is " + nw.name + ", at " + pct(nw.native_pct,0) + ".") : ""),
      share: "Pune's greenest ward by count is " + gw.name + " — " + nf(gw.n) + " trees." +
             (nw ? " Most native: " + nw.name + " (" + pct(nw.native_pct,0) + ")." : "")
    });

    F.push({
      n: (m.totals.avg_girth_cm != null ? m.totals.avg_girth_cm + " cm" : "—"),
      head: S.lang === 0 ? "पुण्यातलं सरासरी झाड — बारीक आणि तरुण."
                         : "Pune's average tree is thin and young.",
      body: S.lang === 0
        ? "सरासरी झाडाचा घेर " + m.totals.avg_girth_cm + " सेमी आणि उंची " + m.totals.avg_height_m +
          " मीटर. त्याच वेळी " + nf(m.totals.rare_flagged) + " झाडं दुर्मिळ म्हणून नोंदवली आहेत — शहराच्या " +
          pct(100*m.totals.rare_flagged/total,2) + "."
        : "The average censused tree is " + m.totals.avg_girth_cm + " cm around and " +
          m.totals.avg_height_m + " m tall. Meanwhile " + nf(m.totals.rare_flagged) +
          " trees are flagged rare — " + pct(100*m.totals.rare_flagged/total,2) + " of the city.",
      share: "Pune's average tree is just " + m.totals.avg_girth_cm + " cm in girth and " +
             m.totals.avg_height_m + " m tall. The canopy is young and thin."
    });

    $("facts").innerHTML = F.map(function (f, i) {
      return "<article class='fact'><div class='fnum'>" + esc(f.n) + "</div>" +
        "<p class='fmr'>" + esc(f.head) + "</p><p class='fen'>" + esc(f.body) + "</p>" +
        "<div class='acts'><button class='btn primary' data-i='" + i + "' data-a='share'>" + t("share") + "</button>" +
        "<button class='btn' data-i='" + i + "' data-a='copy'>" + t("copy") + "</button></div></article>";
    }).join("");

    $("facts").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = F[+b.dataset.i];
        var text = f.share + "\n\nSource: PMC Tree Census 2019 via OpenCity.\n" + url;
        if (b.dataset.a === "share" && navigator.share) {
          navigator.share({ title: t("brand"), text: text }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            var o = b.textContent; b.textContent = t("copied");
            setTimeout(function () { b.textContent = o; }, 1600);
          });
        }
      });
    });
  }

  // -------------------------------------------------------------- map panel --
  function renderMapPanel() {
    var tt = S.meta.totals, nat = S.meta.nativity, known = nat.native + nat.non_native;
    $("peekline").innerHTML = "<b class='num'>" + nf(tt.rows) + "</b> " + t("dragUp");

    $("hero").innerHTML =
      "<p class='eyebrow'>" + t("censusEyebrow") + "</p>" +
      "<div class='big num'>" + nf(tt.rows) + "</div>" +
      "<div class='cap'>" + t("counted") + "</div>" +
      "<div class='metrics' style='margin-top:18px;margin-bottom:0'>" +
        "<div class='metric'><div class='v num'>" + nf(tt.species) + "</div><div class='k'>" + t("species") + "</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(tt.wards) + "</div><div class='k'>" + t("wards") + "</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(tt.rare_flagged) + "</div><div class='k'>" + t("rareShort") + "</div></div>" +
      "</div>";

    var pN = 100*nat.native/tt.rows, pI = 100*nat.non_native/tt.rows, pU = 100*nat.unknown/tt.rows;
    $("natsplit").innerHTML =
      "<p class='eyebrow' style='margin-top:24px'>" + t("origin") + "</p>" +
      "<h3 class='h' style='font-size:1.1rem'>" + t("originH") + "</h3>" +
      "<div class='seg'>" +
        "<i style='width:" + pN.toFixed(1) + "%;background:var(--nat)'></i>" +
        "<i style='width:" + pI.toFixed(1) + "%;background:var(--intro)'></i>" +
        "<i style='width:" + pU.toFixed(1) + "%;background:var(--unk);box-shadow:inset 0 0 0 1px var(--unk-e)'></i>" +
      "</div><div class='segkey'>" +
        "<span><i class='sw' style='background:var(--nat)'></i>" + t("native") + " <b>" + pct(pN,0) + "</b></span>" +
        "<span><i class='sw' style='background:var(--intro)'></i>" + t("introduced") + " <b>" + pct(pI,0) + "</b></span>" +
        "<span><i class='sw' style='background:var(--unk);box-shadow:inset 0 0 0 1px var(--unk-e)'></i>" + t("unknown") + " <b>" + pct(pU,0) + "</b></span>" +
      "</div>" +
      (known ? "<p class='sub' style='margin:14px 0 0'>" +
        t("ofClassified", {p: pct(100*nat.native/known, 0)}) + "</p>" : "") +
      "<div class='card' style='margin-top:12px;font-size:.78rem;color:var(--txt-2)'>⚠ " + esc(nat.warning) + "</div>";

    $("credits").innerHTML =
      "<div class='made'><div class='mk'>" + t("madeBy") + "</div>" +
      "<div class='mn'>" + t("madeName") + "</div>" +
      "<p class='mr2'>" + t("madeLine") + "</p><div class='links'>" +
      LINKS.map(function (l) {
        return "<a href='" + esc(l.url) + "' target='_blank' rel='noopener'" +
          (l.key ? " class='key'" : "") + ">" + esc(l.label) + "</a>";
      }).join("") + "</div></div>";

    $("foot").innerHTML =
      "<p><b style='color:var(--txt-2)'>" + t("sourceLbl") + "</b> · " +
        "<a href='https://data.opencity.in/dataset/pune-tree-census-2019' target='_blank' rel='noopener'>" +
        "Pune Tree Census 2019 — Pune Municipal Corporation, via OpenCity</a>. " +
        "Fieldwork August 2019 · " + esc((S.meta.built_utc||"").slice(0,10)) +
        " · " + esc(S.meta.source.parts) + " CSV parts.</p>" +
      "<p>" + t("notOfficial") + "</p>" +
      "<p>" + t("privacy") + "</p>" +
      "<p class='sig'>Sovereign by Source · <a href='data/meta.json'>meta.json</a> " + t("everyCaveat") + "</p>";

    $("lg-hi").textContent = nf(S.tileIndex.max_cell_count);
  }


  // ------------------------------------------- pollen / respiratory season --
  /* Match a census botanical string against the curated list. Census names
     carry authorities ("Prosopis juliflora (Sw.)Dc."), so compare on genus +
     species only. A species not on the list is NOT marked safe; it is simply
     absent from the published list this site cites. */
  function isAeroallergen(botanical) {
    if (!S.pollenSet) return false;
    var k = String(botanical || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (S.pollenSet[k]) return true;
    var bits = k.replace("var.", " ").replace("subsp.", " ").split(" ");
    return bits.length >= 2 && !!S.pollenSet[bits[0] + " " + bits[1]];
  }

  function allergenSpeciesFor(month) {
    return S.species.species.filter(function (sp) {
      return sp.fm && sp.fm.indexOf(month) !== -1 && isAeroallergen(sp.b);
    }).sort(function (a, b) { return b.n - a.n; });
  }

  function renderPollen() {
    var host = $("pollen");
    if (!host) return;
    if (!S.pollen || !S.species) { host.innerHTML = ""; return; }

    var hits = allergenSpeciesFor(S.month);
    var trees = hits.reduce(function (a, sp) { return a + sp.n; }, 0);
    var share = S.meta.totals.rows ? 100 * trees / S.meta.totals.rows : 0;

    // season shape: listed species flowering in each month of the year
    var byMonth = [], maxM = 0;
    for (var m = 1; m <= 12; m++) {
      var c = allergenSpeciesFor(m).length;
      byMonth.push(c);
      if (c > maxM) maxM = c;
    }
    var bars = byMonth.map(function (c, i) {
      var h = maxM ? Math.max(3, Math.round((c / maxM) * 100)) : 3;
      var on = (i + 1) === S.month;
      return "<button class='pbar" + (on ? " on" : "") + "' data-m='" + (i + 1) + "' " +
        "title='" + esc(mon(i)) + ": " + c + "'>" +
        "<i style='height:" + h + "%'></i><span>" + MON_SHORT[i].charAt(0) + "</span></button>";
    }).join("");

    var notable = (S.pollen.notable || {});
    var rows = hits.slice(0, 12).map(function (sp) {
      var k = String(sp.b).toLowerCase().split(" ").slice(0, 2).join(" ");
      var note = notable[k];
      return "<li><span class='grow'><span class='nm'>" + esc(spName(sp)) + "</span>" +
        "<div class='sci'>" + esc(sp.b) + "</div>" +
        (note ? "<div class='pnote'>" + esc(note) + "</div>" : "") +
        "</span><span class='val'>" + nf(sp.n) + "</span></li>";
    }).join("");

    host.innerHTML =
      "<p class='eyebrow' style='margin-top:30px'>" + t("polEyebrow") + "</p>" +
      "<h3 class='h' style='font-size:1.14rem'>" + t("polH") + "</h3>" +
      (hits.length
        ? "<div class='hero' style='padding:10px 0 18px'>" +
            "<div class='big num' style='font-size:clamp(2.2rem,11vw,3rem)'>" + nf(hits.length) + "</div>" +
            "<div class='cap' style='font-size:.92rem'>" + t("polCount") + "</div>" +
          "</div>" +
          "<div class='metrics'>" +
            "<div class='metric'><div class='v num'>" + nf(trees) + "</div><div class='k'>" + t("trees") + "</div></div>" +
            "<div class='metric'><div class='v num'>" + pct(share, share < 1 ? 2 : 0) + "</div><div class='k'>" + t("cityShare") + "</div></div>" +
            "<div class='metric'><div class='v num'>" + nf(S.pollen.documented_aeroallergen.length) + "</div><div class='k'>" + t("polListN") + "</div></div>" +
          "</div>" +
          "<div class='card flush'><ul class='rows'>" + rows + "</ul></div>"
        : "<div class='card'><div class='nm'>" + t("polNone") + "</div></div>") +
      "<p class='eyebrow' style='margin-top:22px'>" + t("polSeason") + "</p>" +
      "<div class='pchart'>" + bars + "</div>" +
      "<div class='card' style='font-size:.82rem;color:var(--txt-2);margin-top:14px'>" +
        esc(t("polShowy")) + "</div>" +
      "<div class='warncard'><b>⚠ " + esc(t("polWarnT")) + "</b><p>" + esc(t("polWarn")) + "</p>" +
        "<p style='margin-top:8px'><a href='" + esc(S.pollen.source.url) + "' target='_blank' rel='noopener'>" +
        esc(S.pollen.source.title) + "</a><br><span style='color:var(--txt-3)'>" +
        esc(S.pollen.source.journal) + "</span></p></div>";

    host.querySelectorAll(".pbar").forEach(function (b) {
      b.addEventListener("click", function () {
        S.month = parseInt(b.dataset.m, 10);
        renderMonths(); renderFlowering();
      });
    });
  }

  // ------------------------------------------------------ civic action / RTI --
  function buildWardPicker() {
    var sel = $("wardpick");
    if (!sel || !S.wards) return;
    var ws = S.wards.wards.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    sel.innerHTML = ws.map(function (w) {
      return "<option value='" + esc(w.k) + "'>" + esc(w.name) + "</option>";
    }).join("");
    if (!sel._wired) {
      sel.addEventListener("change", renderAct);
      sel._wired = true;
    }
  }

  function currentWard() {
    var sel = $("wardpick");
    if (!sel || !S.wards) return null;
    var k = sel.value;
    for (var i = 0; i < S.wards.wards.length; i++) {
      if (S.wards.wards[i].k === k) return S.wards.wards[i];
    }
    return S.wards.wards[0];
  }

  function rtiText(w) {
    var top = (w.top || []).slice(0, 3).map(function (x) { return sciOf(x.k) || x.k; }).join(", ");
    var today = new Date().toISOString().slice(0, 10);
    if (S.lang === 0) {
      return [
        "प्रति,",
        "जन माहिती अधिकारी",
        "पुणे महानगरपालिका, पुणे",
        "",
        "विषय: माहिती अधिकार अधिनियम २००५ अंतर्गत माहिती मिळणेबाबत — प्रभाग " + w.name,
        "",
        "महोदय,",
        "",
        "पुणे महानगरपालिकेच्या २०१९ च्या वृक्ष गणनेनुसार प्रभाग " + w.name + " मध्ये " +
          nf(w.n) + " झाडांची नोंद आहे (स्रोत: PMC वृक्ष गणना २०१९, OpenCity मार्फत प्रसिद्ध).",
        "या आधारावर खालील माहिती मिळावी ही विनंती:",
        "",
        "१. आज रोजी प्रभाग " + w.name + " मध्ये महापालिकेच्या नोंदीनुसार किती झाडं आहेत? ही नोंद शेवटची कधी अद्ययावत करण्यात आली?",
        "",
        "२. महाराष्ट्र (नागरी क्षेत्रे) वृक्ष संरक्षण व संवर्धन अधिनियम १९७५ अंतर्गत, १ ऑगस्ट २०१९ ते " + today +
          " या कालावधीत प्रभाग " + w.name + " मध्ये वृक्षतोडीच्या किती परवानग्या देण्यात आल्या? वर्षनिहाय आकडेवारी द्यावी.",
        "",
        "३. या परवानग्यांखाली किती झाडं तोडण्यास मान्यता होती, आणि अट म्हणून किती पर्यायी झाडं लावणे बंधनकारक होते?",
        "",
        "४. त्यापैकी प्रत्यक्षात किती पर्यायी झाडं लावण्यात आली, कोणत्या ठिकाणी, आणि शेवटच्या पाहणीत त्यातील किती जिवंत आढळली?",
        "",
        "५. ज्या वृक्ष प्राधिकरण बैठकांमध्ये या परवानग्या मंजूर झाल्या, त्यांच्या इतिवृत्ताच्या प्रती द्याव्यात.",
        "",
        "६. २०१९ नंतर नवीन वृक्ष गणना प्रस्तावित आहे किंवा सुरू आहे का? असल्यास मंजुरी आदेश व कालमर्यादा द्यावी.",
        "",
        "माहिती लेखी स्वरूपात मिळावी. विहित शुल्क सोबत जोडले आहे.",
        "",
        "आपला विश्वासू,",
        "नाव: ____________________",
        "पत्ता: ____________________",
        "दिनांक: " + today,
        "",
        "(संदर्भ नकाशा: punetreemap.vercel.app)"
      ].join("\n");
    }
    return [
      "To,",
      "The Public Information Officer",
      "Pune Municipal Corporation, Pune",
      "",
      "Subject: Application under the Right to Information Act, 2005 — trees in " + w.name + " ward",
      "",
      "Sir / Madam,",
      "",
      "As per the Pune Municipal Corporation Tree Census of 2019, " + w.name + " ward has " +
        nf(w.n) + " recorded trees" + (top ? ", the most common being " + top : "") +
        " (source: PMC Tree Census 2019, published via OpenCity).",
      "Using that as a baseline, I request the following information:",
      "",
      "1. How many trees are currently recorded by the Corporation in " + w.name + " ward, and on what date was that record last updated?",
      "",
      "2. Under the Maharashtra (Urban Areas) Protection and Preservation of Trees Act, 1975, how many tree felling permissions were granted in " +
        w.name + " ward between 1 August 2019 and " + today + "? Please provide year-wise figures.",
      "",
      "3. How many trees were permitted to be felled under those permissions, and how many compensatory trees were required as a condition of them?",
      "",
      "4. Of those, how many compensatory trees were actually planted, at what locations, and how many were found alive at the most recent survey?",
      "",
      "5. Please provide copies of the minutes of the Tree Authority meetings at which those permissions were granted.",
      "",
      "6. Is a new tree census planned or under way after 2019? If yes, please provide the sanction order and the timeline.",
      "",
      "I request this information in writing. The prescribed fee is enclosed.",
      "",
      "Yours faithfully,",
      "Name: ____________________",
      "Address: ____________________",
      "Date: " + today,
      "",
      "(Reference map: punetreemap.vercel.app)"
    ].join("\n");
  }

  function letterText(w) {
    var natLine = w.native_pct !== null
      ? (S.lang === 0
          ? "ओळखता आलेल्या झाडांपैकी " + pct(w.native_pct, 0) + " देशी आहेत."
          : "Of the trees that could be classified, " + pct(w.native_pct, 0) + " are native to the subcontinent.")
      : "";
    if (S.lang === 0) {
      return [
        "विषय: प्रभाग " + w.name + " मधील वृक्षसंपदेबाबत",
        "",
        "महोदय / महोदया,",
        "",
        "मी प्रभाग " + w.name + " मधील रहिवासी आहे.",
        "",
        "पुणे महानगरपालिकेच्या २०१९ च्या वृक्ष गणनेनुसार आपल्या प्रभागात " + nf(w.n) +
          " झाडांची नोंद होती. " + natLine,
        "ही गणना सहा वर्षं जुनी आहे आणि त्यानंतरची कोणतीही अद्ययावत आकडेवारी जाहीरपणे उपलब्ध नाही.",
        "",
        "माझी विनंती अशी:",
        "१. २०१९ नंतर या प्रभागात किती झाडं तोडली गेली आणि किती लावली गेली, याची आकडेवारी जाहीर करावी.",
        "२. पर्यायी वृक्षारोपणाच्या अटींची पूर्तता झाली का, याची माहिती द्यावी.",
        "३. नवीन वृक्ष गणनेचं नियोजन असल्यास त्याची कालमर्यादा जाहीर करावी.",
        "",
        "[इथे स्वतःच्या शब्दांत एक ओळ लिहा — तुमच्या रस्त्यावर काय बदललं, कोणतं झाड गेलं.]",
        "",
        "धन्यवाद,",
        "नाव: ____________________",
        "पत्ता: ____________________",
        "",
        "संदर्भ: PMC वृक्ष गणना २०१९, OpenCity मार्फत · punetreemap.vercel.app"
      ].join("\n");
    }
    return [
      "Subject: Tree cover in " + w.name + " ward",
      "",
      "Dear Sir / Madam,",
      "",
      "I am a resident of " + w.name + " ward.",
      "",
      "According to the Pune Municipal Corporation Tree Census of 2019, this ward had " +
        nf(w.n) + " recorded trees. " + natLine,
      "That census is now six years old, and no updated figure has been published since.",
      "",
      "I would like to request:",
      "1. Publication of how many trees have been felled and how many planted in this ward since 2019.",
      "2. Information on whether the compensatory planting conditions attached to felling permissions were met.",
      "3. The timeline for a new tree census, if one is planned.",
      "",
      "[Add one line here in your own words. What changed on your street, which tree went.]",
      "",
      "Thank you,",
      "Name: ____________________",
      "Address: ____________________",
      "",
      "Source: PMC Tree Census 2019 via OpenCity · punetreemap.vercel.app"
    ].join("\n");
  }

  function copyBtn(id, label) {
    return "<button class='btn primary' id='" + id + "'>" + esc(label) + "</button>";
  }
  function wireCopy(id, getText) {
    var b = $(id);
    if (!b) return;
    b.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(getText()).then(function () {
        var o = b.textContent; b.textContent = t("copied");
        setTimeout(function () { b.textContent = o; }, 1800);
      });
    });
  }

  function renderAct() {
    if (!S.wards) return;
    var w = currentWard();
    if (!w) return;
    var top = (w.top || []).slice(0, 3).map(function (x) { return esc(nameOf(x.k)); }).join(" · ");

    $("actbrief").innerHTML =
      "<p class='eyebrow' style='margin-top:18px'>" + t("acBaseline") + "</p>" +
      "<div class='hero' style='padding:6px 0 18px'>" +
        "<div class='big num'>" + nf(w.n) + "</div>" +
        "<div class='cap'>" + esc(w.name) + " · " + t("trees") + "</div>" +
      "</div>" +
      "<div class='metrics'>" +
        "<div class='metric'><div class='v num'>" +
          (w.native_pct !== null ? pct(w.native_pct, 0) : "—") + "</div><div class='k'>" + t("native") + "</div></div>" +
        "<div class='metric'><div class='v num'>" +
          (w.healthy_pct !== null ? pct(w.healthy_pct, 0) : "—") + "</div><div class='k'>" + t("healthy") + "</div></div>" +
        "<div class='metric'><div class='v num'>" + nf(w.unknown_nativity) + "</div><div class='k'>" + t("unknown") + "</div></div>" +
      "</div>" +
      (top ? "<div class='card' style='font-size:.84rem;color:var(--txt-2)'>" + top + "</div>" : "");

    $("actdocs").innerHTML =
      "<div class='doc'><div class='doct'>" + t("acRtiT") + "</div>" +
        "<p class='sub' style='margin:6px 0 12px'>" + t("acRtiD") + "</p>" +
        "<pre class='docbody' id='rtibody'>" + esc(rtiText(w)) + "</pre>" +
        "<div class='acts'>" + copyBtn("cp-rti", t("acCopyRti")) + "</div></div>" +
      "<div class='doc'><div class='doct'>" + t("acLetT") + "</div>" +
        "<p class='sub' style='margin:6px 0 12px'>" + t("acLetD") + "</p>" +
        "<pre class='docbody' id='letbody'>" + esc(letterText(w)) + "</pre>" +
        "<div class='acts'>" + copyBtn("cp-let", t("acCopyLet")) + "</div></div>";

    $("acthow").innerHTML =
      "<p class='eyebrow' style='margin-top:26px'>" + t("acHowT") + "</p>" +
      "<div class='card flush'><ul class='rows'>" +
      ["acHow1","acHow2","acHow3","acHow4","acHow5"].map(function (k, i) {
        return "<li><span class='rank'>" + (i + 1) + "</span><span class='grow'>" +
          "<span style='font-size:.86rem'>" + esc(t(k)) + "</span></span></li>";
      }).join("") + "</ul></div>" +
      "<div class='warncard'><b>⚠</b><p>" + esc(t("acDisc")) + "</p></div>";

    wireCopy("cp-rti", function () { return rtiText(currentWard()); });
    wireCopy("cp-let", function () { return letterText(currentWard()); });
  }

  // ------------------------------------------------------------------ tabs --
  var TABS = ["map","flower","treasure","ward","facts","act"];
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
        if (n === "act") renderAct();
      });
    });
    $("honest").addEventListener("click", function () {
      var b = $("honest");
      b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") === "true" ? "false" : "true");
    });
    $("theme").addEventListener("click", function () { applyTheme(S.theme === "dark" ? "light" : "dark"); });
    $("lang").addEventListener("click", function () { applyLang(S.lang === 0 ? 1 : 0); });

    $("tg-grid").addEventListener("click", function () {
      var on = $("tg-grid").getAttribute("aria-pressed") !== "true";
      $("tg-grid").setAttribute("aria-pressed", String(on));
      if (on) S.map.addLayer(S.cellLayer); else S.map.removeLayer(S.cellLayer);
    });
    $("tg-rare").addEventListener("click", function () {
      S.rareWanted = $("tg-rare").getAttribute("aria-pressed") !== "true";
      $("tg-rare").setAttribute("aria-pressed", String(S.rareWanted));
      if (!S.rareWanted) { S.map.removeLayer(S.rareLayer); updateZoomHint(); return; }
      ensureLayer("rare").then(syncRareZoom).catch(function (e) {
        console.error(e); S.rareWanted = false; $("tg-rare").setAttribute("aria-pressed","false");
      });
    });
    $("tg-giants").addEventListener("click", function () {
      var on = $("tg-giants").getAttribute("aria-pressed") !== "true";
      $("tg-giants").setAttribute("aria-pressed", String(on));
      if (!on) { S.map.removeLayer(S.giantLayer); return; }
      ensureLayer("giant").then(function (l) { S.map.addLayer(l); })
        .catch(function (e) { console.error(e); $("tg-giants").setAttribute("aria-pressed","false"); });
    });

    $("tr-rare").addEventListener("click", function () {
      S.treasureMode = "rare";
      $("tr-rare").setAttribute("aria-pressed","true"); $("tr-giant").setAttribute("aria-pressed","false");
      renderTreasures();
    });
    $("tr-giant").addEventListener("click", function () {
      S.treasureMode = "giant";
      $("tr-rare").setAttribute("aria-pressed","false"); $("tr-giant").setAttribute("aria-pressed","true");
      renderTreasures();
    });
    $("w-count").addEventListener("click", function () {
      S.wardSort = "count";
      $("w-count").setAttribute("aria-pressed","true"); $("w-native").setAttribute("aria-pressed","false");
      renderWards();
    });
    $("w-native").addEventListener("click", function () {
      S.wardSort = "native";
      $("w-count").setAttribute("aria-pressed","false"); $("w-native").setAttribute("aria-pressed","true");
      renderWards();
    });
  }

  function fatal(msg) {
    $("boot").classList.add("gone");
    $("legend").hidden = true;
    document.querySelector(".toolstack").style.display = "none";
    selectTab("map"); setSnap("full");
    $("hero").innerHTML = "";
    $("cellinfo").innerHTML = "<div class='err'><b>" + t("loadFail") + "</b><br>" +
      t("loadFailSub") + "<code>" + esc(msg) + "</code></div>";
  }

  // ------------------------------------------------------------------ boot --
  applyTheme(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyLang(0);

  Promise.all([
    getJSON("meta.json"), getJSON("species_index.json"), getJSON("ward_summary.json"),
    getJSON("species_names.json"), getJSON("tiles/index.json")
  ]).then(function (r) {
    S.meta = r[0]; S.species = r[1]; S.wards = r[2]; S.names = r[3]; S.tileIndex = r[4];
    initMap(); wireSheet(); wireUI(); setSnap("half", false);
    renderMapPanel(); renderMonths(); renderWards(); buildFacts(); paintRamp();
    buildWardPicker(); renderAct();
    /* The aeroallergen reference is optional. If it fails, the Bloom tab
       simply omits the pollen section rather than the page breaking. */
    fetch("pollen.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        S.pollen = j;
        S.pollenSet = {};
        (j.documented_aeroallergen || []).forEach(function (n) { S.pollenSet[n] = 1; });
        renderPollen();
      })
      .catch(function () {});
    renderFlowering();
    $("boot").classList.add("gone");
    setTimeout(function () { var b = $("boot"); if (b) b.remove(); }, 500);
    idlePrewarm();
  }).catch(function (e) { fatal(e.message); });

  /* The rare and giant files are the heaviest part of the payload and most
     visitors never open them. Warm them only when the browser is idle, and
     not at all on a metered or slow connection — they still load on demand
     the moment someone taps Treasures or a layer pill. */
  function idlePrewarm() {
    var c = navigator.connection || {};
    if (c.saveData) return;
    if (/(^|[^0-9])2g$/i.test(c.effectiveType || "")) return;
    var run = function () {
      ensureLayer("giant").catch(function () {});
      ensureLayer("rare").catch(function () {});
    };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 3000);
  }
})();
