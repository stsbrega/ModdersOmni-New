(function(window) {
  // For local dev, let the Angular proxy handle /api → localhost:8000
  // Production build regenerates this file at deploy time to point at the
  // deployed API URL. Do not commit edits made for local E2E runs.
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  window.__env = {
    API_URL: isLocal ? "/api" : "https://api.moddersomni.com/api"
  };
})(window);
