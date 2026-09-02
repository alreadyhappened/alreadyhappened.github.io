/* Already Happened — sidebar navigation, search, reading progress, lightbox. */
(function () {
  'use strict';

  var body = document.body;
  var sidebarBody = document.getElementById('sidebar-body');
  var menuToggle = document.querySelector('.menu-toggle');

  /* ---- mobile menu ---- */
  if (menuToggle && sidebarBody) {
    menuToggle.addEventListener('click', function () {
      var open = sidebarBody.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    sidebarBody.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.getAttribute('href') && a.getAttribute('href').charAt(0) === '#') {
        sidebarBody.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- index: category filter + full-text search ---- */
  if (body.classList.contains('page-index')) {
    var search = document.getElementById('search');
    var catLinks = Array.prototype.slice.call(document.querySelectorAll('#cat-nav a'));
    var rows = Array.prototype.slice.call(document.querySelectorAll('.card-row'));
    var years = Array.prototype.slice.call(document.querySelectorAll('.year'));
    var resultCount = document.getElementById('result-count');
    var empty = document.getElementById('empty');
    var yearLinks = Array.prototype.slice.call(document.querySelectorAll('#year-nav a'));
    var featured = document.querySelector('.featured');
    var mostRead = document.querySelector('.most-read');
    var archive = document.getElementById('archive');
    var resultsBox = document.getElementById('search-results');
    var resultsList = document.getElementById('search-list');
    var searchCount = document.getElementById('search-count');
    var filter = 'all';
    var index = null, indexLoading = null;

    function esc(str) {
      return String(str).replace(/[&<>"]/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
      });
    }
    function fold(str) {
      return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'");
    }
    function terms(q) {
      return fold(q).split(/[^a-z0-9']+/).filter(function (t) { return t.length > 1; });
    }
    function loadIndex() {
      if (index) return Promise.resolve(index);
      if (!indexLoading) {
        indexLoading = fetch('/blog/search.json').then(function (r) { return r.json(); }).then(function (data) {
          index = data.map(function (d) {
            return { d: d, title: fold(d.t), sub: fold(d.s || ''), body: fold(d.b || '') };
          });
          return index;
        });
      }
      return indexLoading;
    }
    function count(hay, needle) {
      var n = 0, i = 0;
      while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
      return n;
    }
    function highlight(text, ts) {
      var out = esc(text);
      ts.forEach(function (t) {
        out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
      });
      return out;
    }
    function snippet(entry, ts) {
      var body = entry.d.b || '';
      var folded = entry.body;
      var pos = -1;
      for (var i = 0; i < ts.length && pos === -1; i++) pos = folded.indexOf(ts[i]);
      if (pos === -1) return '';
      var start = Math.max(0, pos - 90);
      var end = Math.min(body.length, pos + 150);
      if (start > 0) start = body.lastIndexOf(' ', start) + 1;
      if (end < body.length) end = body.indexOf(' ', end); if (end === -1) end = body.length;
      var text = body.slice(start, end);
      return (start > 0 ? '…' : '') + highlight(text, ts) + (end < body.length ? '…' : '');
    }
    function score(entry, ts) {
      var total = 0, all = true;
      ts.forEach(function (t) {
        var inTitle = count(entry.title, t), inSub = count(entry.sub, t), inBody = count(entry.body, t);
        if (!inTitle && !inSub && !inBody) all = false;
        total += inTitle * 12 + inSub * 6 + Math.log(1 + inBody) * 4;
      });
      return all ? total : 0;
    }
    function renderResults(hits, ts) {
      resultsList.innerHTML = hits.map(function (h) {
        var d = h.entry.d;
        return '<a class="card card-row" href="/blog/' + esc(d.f) + '.html">' +
          '<span class="card-media">' + (d.i ? '<img src="' + esc(d.i) + '" alt="" loading="lazy">' : '') + '</span>' +
          '<span class="card-body">' +
            '<span class="eyebrow">' + esc(d.c) + '</span>' +
            '<span class="card-title">' + highlight(d.t, ts) + '</span>' +
            '<span class="snippet">' + snippet(h.entry, ts) + '</span>' +
            '<span class="card-meta">' + esc(d.d) + '</span>' +
          '</span></a>';
      }).join('');
    }

    function applyFilterOnly() {
      var shown = 0;
      rows.forEach(function (row) {
        var ok = filter === 'all' || row.dataset.category === filter;
        row.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      years.forEach(function (y) {
        y.classList.toggle('is-hidden', !y.querySelector('.card-row:not(.is-hidden)'));
      });
      var filtering = filter !== 'all';
      if (featured) featured.hidden = filtering;
      if (mostRead) mostRead.hidden = filtering;
      if (resultCount) resultCount.textContent = filtering ? shown + ' of ' + rows.length : '';
      if (empty) empty.hidden = shown !== 0;
      yearLinks.forEach(function (a) {
        var y = document.getElementById(a.getAttribute('href').slice(1));
        a.parentNode.style.display = (y && y.classList.contains('is-hidden')) ? 'none' : '';
      });
      if (resultsBox) resultsBox.hidden = true;
      if (archive) archive.hidden = false;
    }

    var lastQuery = '';
    function applySearch() {
      var q = (search ? search.value : '').trim();
      lastQuery = q;
      var ts = terms(q);
      if (!ts.length) { applyFilterOnly(); return; }
      loadIndex().then(function (idx) {
        if (lastQuery !== q) return;
        var hits = [];
        idx.forEach(function (entry) {
          if (filter !== 'all' && entry.d.c !== filter) return;
          var sc = score(entry, ts);
          if (sc > 0) hits.push({ entry: entry, score: sc });
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        renderResults(hits, ts);
        if (searchCount) searchCount.textContent = hits.length + (hits.length === 1 ? ' essay' : ' essays');
        if (featured) featured.hidden = true;
        if (mostRead) mostRead.hidden = true;
        if (archive) archive.hidden = true;
        if (resultsBox) resultsBox.hidden = false;
        if (empty) empty.hidden = true;
      });
    }

    catLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        catLinks.forEach(function (b) { b.classList.remove('is-active'); });
        a.classList.add('is-active');
        filter = a.dataset.filter;
        applySearch();
        if (filter !== 'all' && archive && !archive.hidden && window.innerWidth > 900) {
          archive.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (history.replaceState) history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + encodeURIComponent(filter));
      });
    });

    if (search) {
      var timer;
      search.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(applySearch, 120);
      });
      search.addEventListener('focus', function () { loadIndex(); });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; applySearch(); search.blur(); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== search && !/input|textarea/i.test(document.activeElement.tagName)) {
          e.preventDefault();
          search.focus();
        }
      });
    }

    // deep link: /blog.html?q=moloch
    var qParam = new URLSearchParams(location.search).get('q');
    if (qParam && search) { search.value = qParam; applySearch(); }

    // deep link: /blog.html#Philosophy
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      var match = catLinks.filter(function (a) { return a.dataset.filter === hash; })[0];
      if (match) {
        catLinks.forEach(function (b) { b.classList.remove('is-active'); });
        match.classList.add('is-active');
        filter = hash;
        applyFilterOnly();
      }
    }
  }

  /* ---- essay: progress, scrollspy, keyboard, lightbox ---- */
  if (body.classList.contains('page-post')) {
    var bar = document.querySelector('.progress span');
    var progressText = document.getElementById('progress-text');
    var essay = document.getElementById('essay-body');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('#toc a'));
    var headings = tocLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var ticking = false;

    function update() {
      ticking = false;
      if (!essay) return;
      var rect = essay.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var height = rect.height;
      var viewport = window.innerHeight;
      var pct = (window.scrollY + viewport * 0.6 - top) / height;
      pct = Math.max(0, Math.min(1, pct));
      if (bar) bar.style.width = (pct * 100).toFixed(1) + '%';
      if (progressText) progressText.textContent = Math.round(pct * 100) + '% read';

      if (headings.length) {
        var current = -1;
        for (var i = 0; i < headings.length; i++) {
          if (headings[i] && headings[i].getBoundingClientRect().top <= viewport * 0.3) current = i;
        }
        tocLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === current); });
        if (current >= 0) {
          var active = tocLinks[current];
          var sidebar = document.getElementById('sidebar');
          if (sidebar && window.innerWidth > 900) {
            var ar = active.getBoundingClientRect();
            var sr = sidebar.getBoundingClientRect();
            if (ar.top < sr.top + 80 || ar.bottom > sr.bottom - 80) {
              sidebar.scrollTo({ top: active.offsetTop - sidebar.clientHeight / 2, behavior: 'smooth' });
            }
          }
        }
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowLeft') { var p = document.querySelector('a[rel="prev"]'); if (p) location.href = p.href; }
      if (e.key === 'ArrowRight') { var n = document.querySelector('a[rel="next"]'); if (n) location.href = n.href; }
    });
  }

  /* ---- lightbox (any page with figure links) ---- */
  var lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    function close() { lightbox.hidden = true; lbImg.src = ''; body.style.overflow = ''; }
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a.figure-link');
      if (!link) return;
      var img = link.querySelector('img');
      if (!img) return;
      e.preventDefault();
      lbImg.src = link.getAttribute('href') || img.currentSrc || img.src;
      lbImg.alt = img.alt || '';
      lightbox.hidden = false;
      body.style.overflow = 'hidden';
    });
    lightbox.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lightbox.hidden) close(); });
  }
})();
