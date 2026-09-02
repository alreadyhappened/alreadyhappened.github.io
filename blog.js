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

  /* ---- index: filter + search ---- */
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
    var filter = 'all';

    function apply() {
      var q = (search ? search.value : '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var ok = (filter === 'all' || row.dataset.category === filter) &&
                 (!q || row.dataset.search.indexOf(q) !== -1);
        row.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      years.forEach(function (y) {
        var any = y.querySelector('.card-row:not(.is-hidden)');
        y.classList.toggle('is-hidden', !any);
      });
      var filtering = filter !== 'all' || q;
      if (featured) featured.hidden = !!filtering;
      if (mostRead) mostRead.hidden = !!filtering;
      if (resultCount) resultCount.textContent = filtering ? shown + ' of ' + rows.length : '';
      if (empty) empty.hidden = shown !== 0;
      yearLinks.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        var y = document.getElementById(id);
        a.parentNode.style.display = (y && y.classList.contains('is-hidden')) ? 'none' : '';
      });
    }

    catLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        catLinks.forEach(function (b) { b.classList.remove('is-active'); });
        a.classList.add('is-active');
        filter = a.dataset.filter;
        apply();
        if (filter !== 'all') {
          var archive = document.getElementById('archive');
          if (archive && window.innerWidth > 900) archive.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (history.replaceState) history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + encodeURIComponent(filter));
      });
    });

    if (search) {
      search.addEventListener('input', apply);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; apply(); search.blur(); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== search && !/input|textarea/i.test(document.activeElement.tagName)) {
          e.preventDefault();
          search.focus();
        }
      });
    }

    // deep link: /blog.html#Philosophy
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      var match = catLinks.filter(function (a) { return a.dataset.filter === hash; })[0];
      if (match) {
        catLinks.forEach(function (b) { b.classList.remove('is-active'); });
        match.classList.add('is-active');
        filter = hash;
        apply();
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
