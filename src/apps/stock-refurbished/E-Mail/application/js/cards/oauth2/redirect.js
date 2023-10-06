

let Redirect = function Redirect() {

  let init = function init() {
    let url = window.location.href;
    let result = {
      type: 'oauth2Complete',
      data: {}
    };
    let search = url.split('?')[1] || '';

    if (search.length > 0) {
      let elements = search.split('&');

      elements.forEach((p) => {
        let values = p.split('=');
        result.data[decodeURIComponent(values[0])] =
            decodeURIComponent(values[1]);
      });

      window.opener.postMessage(result, window.location.origin);
    }

    navigator.mozApps.getSelf().onsuccess = (event) => {
      let app = event.target.result;
      // Each app has two cookie jars, one for the app and one for browsing
      // contexts. This call just clears the browsing context.
      if (app) {
        app.clearBrowserData();
      }
    };

    window.close();
  };

  return {
    'init': init
  };

}();

Redirect.init();
