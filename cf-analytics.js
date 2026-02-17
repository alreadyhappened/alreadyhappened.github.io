(function () {
  var token = "__CLOUDFLARE_WEB_ANALYTICS_TOKEN__";

  // Set your real token above. Keep placeholder to disable tracking until ready.
  if (!token || token.indexOf("__CLOUDFLARE_WEB_ANALYTICS_TOKEN__") !== -1) return;

  var script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: token }));
  document.head.appendChild(script);
})();
