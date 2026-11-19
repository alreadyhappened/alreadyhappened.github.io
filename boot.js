/* Runs before first paint. Decides which world the visitor is in.
   - The home page (data-gate) always opens on the threshold, unless ?world= asks for a side.
   - Elsewhere a stored or ?world= choice wins.
   - With no choice on an essay, open in the world the essay belongs to (data-default-world).
   - With no choice anywhere else, follow the visitor's daylight: human by day, artificial by night. */
(function () {
  var d = document.documentElement, q = new URLSearchParams(location.search), w = q.get('world'), s = null;
  try { if (q.has('threshold')) localStorage.removeItem('world'); else s = localStorage.getItem('world'); } catch (e) {}
  var c = (w === 'natural' || w === 'artificial') ? w : (d.hasAttribute('data-gate') ? null : s);
  if (c !== 'natural' && c !== 'artificial') {
    if (d.hasAttribute('data-gate')) {
      d.dataset.state = 'threshold'; d.dataset.world = 'natural';
      // The threshold locks scrolling, so it must always open at the top: never restore an old scroll
      // position (a reload halfway down the beliefs would otherwise leave the page stuck there).
      try { history.scrollRestoration = 'manual'; } catch (e) {}
      var top = function () { window.scrollTo(0, 0); };
      top(); addEventListener('DOMContentLoaded', top); addEventListener('load', top); addEventListener('pageshow', top);
      return;
    }
    var dflt = d.getAttribute('data-default-world');
    if (dflt === 'natural' || dflt === 'artificial') c = dflt;      // an essay's own world
    else { var h = new Date().getHours(); c = (h >= 7 && h < 19) ? 'natural' : 'artificial'; }
  }
  d.dataset.world = c; d.dataset.state = 'chosen';
})();
