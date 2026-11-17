/* Runs before first paint. Decides which world the visitor is in.
   - A stored or ?world= choice wins.
   - With no choice, the home page (data-gate) shows the threshold.
   - With no choice on an essay, open in the world the essay belongs to (data-default-world).
   - With no choice anywhere else, follow the visitor's daylight: natural by day, artificial by night. */
(function () {
  var d = document.documentElement, q = new URLSearchParams(location.search), w = q.get('world'), s = null;
  try { if (q.has('threshold')) localStorage.removeItem('world'); else s = localStorage.getItem('world'); } catch (e) {}
  var c = (w === 'natural' || w === 'artificial') ? w : s;
  if (c !== 'natural' && c !== 'artificial') {
    if (d.hasAttribute('data-gate')) { d.dataset.state = 'threshold'; d.dataset.world = 'natural'; return; }
    var dflt = d.getAttribute('data-default-world');
    if (dflt === 'natural' || dflt === 'artificial') c = dflt;      // an essay's own world
    else { var h = new Date().getHours(); c = (h >= 7 && h < 19) ? 'natural' : 'artificial'; }
  }
  d.dataset.world = c; d.dataset.state = 'chosen';
})();
