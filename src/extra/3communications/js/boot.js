(() => {
  const HTML_CACHE_VERSION = '1.0.1';
  const cache = getValideCache();
  if (cache) {
    let snapshot = document.getElementById('snapshot');
    snapshot.innerHTML = cache;
  }

  // Add mark
  window.performance.mark('visuallyLoaded');

  function getValideCache() {
    const snapshotCache = window.localStorage.getItem('snapshot');
    if (snapshotCache) {
      const index = snapshotCache.indexOf(':');
      const value = snapshotCache.substring(0, index).split(',');
      if (HTML_CACHE_VERSION === value[0] && navigator.language === value[1]) {
        return snapshotCache.substring(index + 1);
      } else {
        window.localStorage.setItem('snapshot', null);
      }
    }
    return null;
  }

})();
