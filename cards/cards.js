/* Virtual soccer card collection.
   Paste an eBay link, get the card. Nothing else on the page. */
(function () {
  "use strict";

  var deck = document.getElementById("deck");
  var addBtn = document.getElementById("add");
  var sheet = document.getElementById("sheet");
  var form = document.getElementById("add-form");
  var input = document.getElementById("url-input");
  var pulse = document.getElementById("pulse");

  var slides = [];       /* { el, stage, card, data, lift } */
  var active = 0;
  var busy = false;

  /* ------------------------------------------------------------ storage -- */

  var DB = "soccer-cards";
  var STORE = "cards";
  var db = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("no idb"));
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function wrap(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  var store = {
    all: function () {
      if (db) return wrap(tx("readonly").getAll());
      return Promise.resolve(JSON.parse(localStorage.getItem(DB) || "[]"));
    },
    put: function (card) {
      if (db) return wrap(tx("readwrite").put(card));
      return store.all().then(function (list) {
        list = list.filter(function (c) { return c.id !== card.id; }).concat(card);
        localStorage.setItem(DB, JSON.stringify(list));
      });
    },
    remove: function (id) {
      if (db) return wrap(tx("readwrite").delete(id));
      return store.all().then(function (list) {
        localStorage.setItem(DB, JSON.stringify(list.filter(function (c) { return c.id !== id; })));
      });
    }
  };

  /* -------------------------------------------------------- fetching -- */

  var PROXIES = [
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
    function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u); },
    function (u) { return "https://r.jina.ai/" + u; }
  ];

  function timedFetch(url, ms) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var opts = ctl ? { signal: ctl.signal } : {};
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 16000);
    return fetch(url, opts).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }

  function variants(url) {
    var list = [url];
    var id = url.match(/\/itm\/(\d{11,14})/);
    if (id) {
      var host = url.match(/https?:\/\/([\w.-]+)/)[1];
      list.push("https://" + host.replace(/^www\./, "m.") + "/itm/" + id[1]);
    }
    return list;
  }

  function fetchPage(url) {
    var urls = variants(url);
    var pairs = [];
    for (var u = 0; u < urls.length; u++) {
      for (var p = 0; p < PROXIES.length; p++) pairs.push([PROXIES[p], urls[u]]);
    }
    var i = 0;
    function next() {
      if (i >= pairs.length) return Promise.resolve(null);
      var pair = pairs[i++];
      var via = pair[0](pair[1]);
      return timedFetch(via).then(function (r) {
        if (!r.ok) return next();
        return r.text().then(function (t) {
          if (!t || t.length < 400) return next();
          /* a bot wall has no picture in it — try the next way in */
          if (/ebay\./i.test(pair[1]) && !/i\.ebayimg\.com|og:image/i.test(t)) return next();
          return t;
        });
      }).catch(next);
    }
    return next();
  }

  function fetchImage(src) {
    var makers = [function (u) { return u; }].concat(PROXIES);
    var i = 0;
    function next() {
      if (i >= makers.length) return Promise.resolve(null);
      var via = makers[i++](src);
      return timedFetch(via, 20000).then(function (r) {
        if (!r.ok) return next();
        return r.blob().then(function (b) {
          if (!/^image\//.test(b.type) || b.size < 900 || b.size > 8e6) return next();
          return toDataUrl(b);
        });
      }).catch(next);
    }
    return next();
  }

  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  /* Keep stored art sharp but not enormous. */
  function shrink(dataUrl, max) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w <= max && h <= max) return resolve(dataUrl);
        var s = max / Math.max(w, h);
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * s);
        cv.height = Math.round(h * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        try { resolve(cv.toDataURL("image/jpeg", 0.9)); }
        catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  /* --------------------------------------------------------- parsing -- */

  function bigger(src) {
    if (!src) return src;
    return src
      .replace(/\/s-l\d+(\.[a-z]+)/i, "/s-l1600$1")
      .replace(/^http:/, "https:");
  }

  function firstMatch(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  }

  var SPEC_KEYS = {
    "player": "player", "player/athlete": "player", "player name": "player", "athlete": "player",
    "season": "year", "year": "year", "year manufactured": "year",
    "set": "set", "card set": "set", "insert set": "set",
    "team": "team", "club": "team",
    "card number": "number", "card no": "number",
    "parallel/variety": "parallel", "variety": "parallel", "features": "features",
    "grade": "grade", "professional grader": "grader", "grader": "grader",
    "manufacturer": "brand", "card manufacturer": "brand", "brand": "brand",
    "league": "league", "autographed": "autographed", "sport": "sport"
  };

  function parseListing(text, url) {
    var out = { url: url };
    var isHtml = /<html|<meta|<!doctype/i.test(text);

    if (isHtml) {
      var doc = new DOMParser().parseFromString(text, "text/html");
      var meta = function (name) {
        var el = doc.querySelector('meta[property="' + name + '"]') ||
                 doc.querySelector('meta[name="' + name + '"]');
        return el ? (el.getAttribute("content") || "").trim() : "";
      };

      out.image = bigger(meta("og:image") || meta("twitter:image"));
      out.title = (meta("og:title") || doc.title || "").replace(/\s*[|\-–]\s*eBay.*$/i, "").trim();

      /* structured data */
      var nodes = doc.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < nodes.length; i++) {
        try {
          var data = JSON.parse(nodes[i].textContent);
          var list = Array.isArray(data) ? data : (data["@graph"] || [data]);
          for (var j = 0; j < list.length; j++) {
            var node = list[j];
            if (!node || node["@type"] !== "Product") continue;
            if (node.name) out.title = out.title || String(node.name).trim();
            if (node.image) out.image = out.image || bigger([].concat(node.image)[0]);
            if (node.brand) out.brand = node.brand.name || node.brand;
            var offer = [].concat(node.offers || [])[0];
            if (offer) {
              if (offer.price) out.price = parseFloat(String(offer.price).replace(/,/g, ""));
              if (offer.priceCurrency) out.currency = offer.priceCurrency;
              if (offer.seller && offer.seller.name) out.seller = offer.seller.name;
            }
          }
        } catch (e) { /* malformed block, skip */ }
      }

      /* item specifics */
      var rows = doc.querySelectorAll(".ux-labels-values");
      for (var r = 0; r < rows.length; r++) {
        var labelEl = rows[r].querySelector(".ux-labels-values__labels");
        var valueEl = rows[r].querySelector(".ux-labels-values__values");
        if (!labelEl || !valueEl) continue;
        var key = labelEl.textContent.replace(/\s+/g, " ").replace(/:$/, "").trim().toLowerCase();
        var val = valueEl.textContent.replace(/\s+/g, " ").trim();
        if (SPEC_KEYS[key] && val) out[SPEC_KEYS[key]] = val;
      }
    } else {
      /* plain-text rendering (r.jina.ai) */
      var img = text.match(/https?:\/\/i\.ebayimg\.com\/[^\s")\]]+/) ||
                text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp))/i);
      if (img) out.image = bigger(img[1] || img[0]);
      out.title = firstMatch(text, [/^Title:\s*(.+)$/m, /^#\s+(.+)$/m])
        .replace(/\s*[|\-–]\s*eBay.*$/i, "");
    }

    if (!out.price) {
      var p = firstMatch(text, [
        /"price"\s*:\s*"?([\d,]+\.?\d*)"?/,
        /itemprop="price"[^>]*content="([\d,]+\.?\d*)"/,
        /(?:£|US\s?\$|\$|€)\s?([\d,]+\.\d{2})/
      ]);
      if (p) out.price = parseFloat(p.replace(/,/g, ""));
    }
    if (!out.currency) {
      out.currency = firstMatch(text, [/"priceCurrency"\s*:\s*"([A-Z]{3})"/]) ||
        (/£/.test(text) ? "GBP" : /€/.test(text) ? "EUR" : "USD");
    }

    if (!out.image) {
      var loose = text.match(/https?:\/\/i\.ebayimg\.com\/[^\s"'\\)\]]+/);
      if (loose) out.image = bigger(loose[0]);
    }

    return out.image ? out : null;
  }

  /* ---------------------------------------------------------- adding -- */

  function normalise(raw) {
    var url = raw.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
      if (!/^[\w.-]+\.[a-z]{2,}/i.test(url)) return null;
      url = "https://" + url;
    }
    var id = url.match(/(?:itm\/|item=|iid=|\/i\/)(\d{11,14})/);
    if (id) {
      var host = url.match(/https?:\/\/([\w.-]*ebay\.[\w.]+)/i);
      host = host ? host[1].replace(/^m\./i, "www.") : "www.ebay.com";
      return "https://" + host + "/itm/" + id[1];
    }
    return url;
  }

  function looksLikeImage(url) {
    return /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(url) || /i\.ebayimg\.com/.test(url);
  }

  function tier(card) {
    var grade = parseFloat(card.grade);
    var price = Number(card.price) || 0;
    if (price >= 250 || grade === 10) return 3;
    if (price >= 75 || grade >= 9) return 2;
    if (price >= 20) return 1;
    return 0;
  }

  var TIERS = [
    { holo: 0.13, sparkle: 0, glare: 0.24 },
    { holo: 0.24, sparkle: 0.05, glare: 0.28 },
    { holo: 0.36, sparkle: 0.13, glare: 0.34 },
    { holo: 0.46, sparkle: 0.21, glare: 0.4 }
  ];

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function addFromLink(raw) {
    var url = normalise(raw);
    if (!url) return Promise.reject(new Error("bad link"));

    if (looksLikeImage(url)) {
      return fetchImage(url)
        .then(function (data) { return data || url; })
        .then(function (src) { return save({ image: src, url: "" }); });
    }

    return fetchPage(url).then(function (text) {
      if (!text) throw new Error("unreachable");
      var info = parseListing(text, url);
      if (!info) throw new Error("no card found");
      return fetchImage(info.image).then(function (data) {
        if (data) return shrink(data, 1100);
        return info.image;
      }).then(function (src) {
        info.image = src;
        return save(info);
      });
    });
  }

  function addFromFile(file) {
    return toDataUrl(file)
      .then(function (d) { return shrink(d, 1100); })
      .then(function (src) { return save({ image: src, url: "" }); });
  }

  function save(info) {
    var card = {
      id: makeId(),
      url: info.url || "",
      image: info.image,
      title: info.title || "",
      player: info.player || "",
      year: info.year || "",
      set: info.set || "",
      team: info.team || "",
      number: info.number || "",
      parallel: info.parallel || "",
      grade: info.grade || "",
      grader: info.grader || "",
      brand: info.brand || "",
      league: info.league || "",
      price: info.price || 0,
      currency: info.currency || "",
      seller: info.seller || "",
      addedAt: Date.now()
    };
    return store.put(card).then(function () {
      mount(card, true);
      return card;
    });
  }

  /* --------------------------------------------------------- drawing -- */

  function div(cls) {
    var el = document.createElement("div");
    el.className = cls;
    return el;
  }

  function mount(card, isNew) {
    var slide = div("slide");
    var stage = div("stage");
    var node = div("card");
    var face = div("face");

    var art = new Image();
    art.className = "art";
    art.alt = "";
    art.decoding = "async";
    art.draggable = false;
    art.src = card.image;

    var t = TIERS[tier(card)];
    node.style.setProperty("--holo", t.holo);
    node.style.setProperty("--sparkle", t.sparkle);
    node.style.setProperty("--glare", t.glare);

    face.appendChild(art);
    face.appendChild(div("holo"));
    face.appendChild(div("sparkle"));
    face.appendChild(div("glare"));
    face.appendChild(div("bevel"));
    node.appendChild(face);
    stage.appendChild(node);
    stage.appendChild(div("shadow"));
    slide.appendChild(stage);
    if (isNew) {
      slide.classList.add("is-new");
      setTimeout(function () { slide.classList.remove("is-new"); }, 700);
    }
    deck.appendChild(slide);

    var entry = { el: slide, stage: stage, card: node, data: card, lift: 0 };
    slides.push(entry);
    if (isNew) {
      layout();
      requestAnimationFrame(function () { goTo(slides.length - 1); });
    }
    return entry;
  }

  function remove(entry) {
    var i = slides.indexOf(entry);
    if (i < 0) return;
    slides.splice(i, 1);
    entry.card.classList.add("is-leaving");
    store.remove(entry.data.id);
    setTimeout(function () {
      entry.el.remove();
      layout();
      goTo(Math.min(i, slides.length - 1));
    }, 480);
  }

  /* ------------------------------------------------------- the rail -- */

  var queued = false;

  function layout() {
    queued = false;
    if (!slides.length) return;

    var gap = parseFloat(getComputedStyle(deck).columnGap || 0) || 0;
    var mid = deck.scrollLeft + deck.clientWidth / 2;
    var reads = [];
    var nearest = 0;
    var best = Infinity;

    for (var i = 0; i < slides.length; i++) {
      var el = slides[i].el;
      var span = el.offsetWidth + gap;
      var d = (el.offsetLeft + el.offsetWidth / 2 - mid) / span;
      var clamped = Math.max(-3.2, Math.min(3.2, d));
      reads.push(clamped);
      if (Math.abs(clamped) < best) { best = Math.abs(clamped); nearest = i; }
    }

    for (var j = 0; j < slides.length; j++) {
      var s = slides[j];
      var c = reads[j];
      var a = Math.abs(c);

      s.stage.style.transform =
        "translateX(" + (-c * 8) + "%) " +
        "translateY(" + s.lift + "px) " +
        "translateZ(" + (-a * 165) + "px) " +
        "rotateY(" + (-c * 33) + "deg) " +
        "scale(" + (1 - Math.min(a, 3) * 0.035) + ")";
      s.card.style.opacity = String(Math.max(0.2, 1 - a * 0.19));
      s.stage.style.setProperty("--shadow-s", String(Math.max(0.5, 1 - a * 0.22)));
      s.el.style.zIndex = String(200 - Math.round(a * 20));

      var isActive = a < 0.5;
      if (isActive !== s.el.classList.contains("is-active")) {
        s.el.classList.toggle("is-active", isActive);
        if (!isActive) rest(s);
      }
    }
    active = nearest;
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(layout);
    }
  }

  function goTo(i) {
    if (!slides.length) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    var el = slides[i].el;
    deck.scrollTo({
      left: el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2,
      behavior: "smooth"
    });
  }

  deck.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { schedule(); goTo(active); });

  /* mouse wheels scroll sideways; trackpads keep their own horizontal feel */
  var wheelIdle;
  deck.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault();
    deck.classList.add("is-dragging");
    deck.scrollLeft += e.deltaY * 1.15;
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(function () {
      deck.classList.remove("is-dragging");
      goTo(active);
    }, 130);
  }, { passive: false });

  document.addEventListener("keydown", function (e) {
    if (!sheet.hidden) {
      if (e.key === "Escape") closeSheet();
      return;
    }
    if (e.key === "ArrowRight") { goTo(active + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { goTo(active - 1); e.preventDefault(); }
    else if (e.key === "Home") { goTo(0); e.preventDefault(); }
    else if (e.key === "End") { goTo(slides.length - 1); e.preventDefault(); }
    else if (e.key === "Backspace" || e.key === "Delete") {
      if (slides[active]) remove(slides[active]);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === "+") {
      openSheet();
      e.preventDefault();
    }
  });

  /* ---------------------------------------------------- tilt and touch -- */

  var lastMove = 0;

  function tiltTo(entry, x, y) {
    var box = entry.el.getBoundingClientRect();
    var px = (x - box.left) / box.width;
    var py = (y - box.top) / box.height;
    entry.tx = Math.max(-1, Math.min(1, (px - 0.5) * 2));
    entry.ty = Math.max(-1, Math.min(1, (py - 0.5) * -2));
    entry.stage.style.setProperty("--tx", entry.tx.toFixed(3));
    entry.stage.style.setProperty("--ty", entry.ty.toFixed(3));
    entry.stage.style.setProperty("--mag", Math.min(1,
      Math.sqrt(entry.tx * entry.tx + entry.ty * entry.ty)).toFixed(3));
    entry.card.style.setProperty("--px", (px * 100).toFixed(1) + "%");
    entry.card.style.setProperty("--py", (py * 100).toFixed(1) + "%");
  }

  function rest(entry) {
    entry.tx = 0;
    entry.ty = 0;
    entry.stage.style.setProperty("--tx", "0");
    entry.stage.style.setProperty("--ty", "0");
    entry.stage.style.setProperty("--mag", "0");
    entry.card.style.setProperty("--px", "50%");
    entry.card.style.setProperty("--py", "50%");
  }

  deck.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || drag) return;
    lastMove = performance.now();
    var el = e.target.closest ? e.target.closest(".slide") : null;
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].el === el && slides[i].el.classList.contains("is-active")) {
        tiltTo(slides[i], e.clientX, e.clientY);
      } else if (slides[i].tx) {
        rest(slides[i]);
      }
    }
  });

  deck.addEventListener("pointerleave", function () {
    slides.forEach(rest);
  });

  /* the centred card breathes when nobody is touching it */
  (function sway() {
    requestAnimationFrame(sway);
    if (performance.now() - lastMove < 1800 || drag) return;
    var s = slides[active];
    if (!s || !s.el.classList.contains("is-active")) return;
    var t = performance.now() / 1000;
    var sx = Math.sin(t * 0.55) * 0.16;
    var sy = Math.sin(t * 0.41 + 1.2) * 0.11;
    s.stage.style.setProperty("--tx", sx.toFixed(3));
    s.stage.style.setProperty("--ty", sy.toFixed(3));
    s.stage.style.setProperty("--mag", Math.min(1, Math.sqrt(sx * sx + sy * sy) * 2.6).toFixed(3));
    s.card.style.setProperty("--px", (50 + Math.sin(t * 0.55) * 22).toFixed(1) + "%");
    s.card.style.setProperty("--py", (50 - Math.sin(t * 0.41 + 1.2) * 18).toFixed(1) + "%");
  })();

  /* drag sideways to scroll, drag the centred card up to let it go */
  var drag = null;

  deck.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    var el = e.target.closest ? e.target.closest(".slide") : null;
    var entry = null;
    for (var i = 0; i < slides.length; i++) if (slides[i].el === el) entry = slides[i];
    drag = {
      x: e.clientX,
      y: e.clientY,
      scroll: deck.scrollLeft,
      entry: entry,
      mode: "idle",
      id: e.pointerId,
      hold: 0
    };
    lastMove = performance.now();

    /* on a touchscreen, holding the centred card picks it up */
    if (e.pointerType === "touch" && entry && entry.el.classList.contains("is-active")) {
      drag.hold = setTimeout(function () {
        if (drag && drag.mode === "idle") {
          drag.mode = "lift";
          drag.entry.lift = -14;
          schedule();
        }
      }, 520);
    }
  });

  window.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;

    if (drag.mode === "idle") {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      clearTimeout(drag.hold);
      var liftable = drag.entry && drag.entry.el.classList.contains("is-active");
      drag.mode = (liftable && dy < 0 && Math.abs(dy) > Math.abs(dx)) ? "lift" : "pan";
      if (drag.mode === "pan") deck.classList.add("is-dragging");
      deck.setPointerCapture && deck.setPointerCapture(e.pointerId);
    }

    if (drag.mode === "pan") {
      deck.scrollLeft = drag.scroll - dx;
    } else {
      drag.entry.lift = Math.min(-14, dy);
      tiltTo(drag.entry, e.clientX, e.clientY);
      schedule();
    }
  });

  window.addEventListener("pointerup", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    clearTimeout(d.hold);
    drag = null;

    if (d.mode === "pan") {
      deck.classList.remove("is-dragging");
      goTo(nearestIndex());
    } else if (d.mode === "lift") {
      if (d.entry.lift < -Math.min(240, window.innerHeight * 0.28)) {
        remove(d.entry);
      } else {
        springBack(d.entry);
      }
    } else if (d.entry) {
      var i = slides.indexOf(d.entry);
      if (i !== active) goTo(i);
      else if (d.entry.data.url) window.open(d.entry.data.url, "_blank", "noopener");
    }
  });

  window.addEventListener("pointercancel", function () {
    if (!drag) return;
    clearTimeout(drag.hold);
    if (drag.mode === "lift") springBack(drag.entry);
    if (drag.mode === "pan") deck.classList.remove("is-dragging");
    drag = null;
  });

  function springBack(entry) {
    var from = entry.lift;
    var start = performance.now();
    (function step(now) {
      var k = Math.min(1, ((now || performance.now()) - start) / 380);
      var e = 1 - Math.pow(1 - k, 3);
      entry.lift = from * (1 - e);
      schedule();
      if (k < 1) requestAnimationFrame(step);
    })();
  }

  function nearestIndex() {
    var mid = deck.scrollLeft + deck.clientWidth / 2;
    var best = 0, dist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var c = slides[i].el.offsetLeft + slides[i].el.offsetWidth / 2;
      if (Math.abs(c - mid) < dist) { dist = Math.abs(c - mid); best = i; }
    }
    return best;
  }

  /* ----------------------------------------------------------- the plus -- */

  function openSheet(prefill) {
    sheet.hidden = false;
    addBtn.classList.add("is-open");
    input.value = prefill || "";
    setTimeout(function () { input.focus(); }, 30);
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.add("is-closing");
    addBtn.classList.remove("is-open");
    setTimeout(function () {
      sheet.hidden = true;
      sheet.classList.remove("is-closing");
      input.value = "";
      setBusy(false);
    }, 170);
  }

  function setBusy(on) {
    busy = on;
    pulse.hidden = !on;
    input.readOnly = on;
  }

  function reject() {
    setBusy(false);
    var box = form;
    box.classList.remove("is-wrong");
    void box.offsetWidth;
    box.classList.add("is-wrong");
    input.select();
  }

  addBtn.addEventListener("click", function () {
    if (sheet.hidden) openSheet(); else closeSheet();
  });

  sheet.addEventListener("pointerdown", function (e) {
    if (e.target === sheet) closeSheet();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var value = input.value.trim();
    if (!value) return closeSheet();
    setBusy(true);
    addFromLink(value).then(function () {
      closeSheet();
    }).catch(function () {
      reject();
    });
  });

  /* an image pasted or dropped straight in becomes a card too */
  input.addEventListener("paste", function (e) {
    var items = (e.clipboardData || {}).items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
        e.preventDefault();
        setBusy(true);
        addFromFile(items[i].getAsFile()).then(closeSheet).catch(reject);
        return;
      }
    }
  });

  ["dragover", "drop"].forEach(function (type) {
    window.addEventListener(type, function (e) {
      e.preventDefault();
      if (type !== "drop") return;
      var dt = e.dataTransfer;
      if (!dt) return;
      if (dt.files && dt.files.length && /^image\//.test(dt.files[0].type)) {
        addFromFile(dt.files[0]);
        return;
      }
      var text = dt.getData("text/uri-list") || dt.getData("text/plain");
      if (text) {
        openSheet(text.trim());
        setBusy(true);
        addFromLink(text.trim()).then(closeSheet).catch(reject);
      }
    });
  });

  /* ------------------------------------------------------------- start -- */

  function shared() {
    var q = new URLSearchParams(location.search);
    var raw = q.get("url") || q.get("text") || q.get("title") || "";
    var m = raw.match(/https?:\/\/\S+/);
    if (!m) return null;
    history.replaceState(null, "", location.pathname);
    return m[0];
  }

  openDb().then(function (d) { db = d; }).catch(function () { db = null; })
    .then(function () { return store.all(); })
    .then(function (list) {
      (list || []).sort(function (a, b) { return a.addedAt - b.addedAt; })
        .forEach(function (c) { mount(c, false); });
      layout();
      if (slides.length) goTo(slides.length - 1);

      var link = shared();
      if (link) {
        openSheet(link);
        setBusy(true);
        addFromLink(link).then(closeSheet).catch(reject);
      } else if (!slides.length) {
        openSheet();
      }
    });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/cards/sw.js").catch(function () {});
  }
})();
