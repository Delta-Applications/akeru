
/* exported Format */


/**
 * format.js: simple formatters and string utilities.
 */

var Format = {

  /**
   * Pads a string to the number of characters specified.
   * @param {String} input value to add padding to.
   * @param {Integer} len length to pad to.
   * @param {String} padWith char to pad with (defaults to " ").
   */
  padLeft: function(input, len, padWith) {
    padWith = padWith || ' ';

    var pad = len - (input + '').length;
    while (--pad > -1) {
      input = padWith + input;
    }
    return input;
  }
};

define("shared/format", function(){});


/* exported ClientIdCustomizer */

(function(exports) {

  // Provider name which is supported for OEM client id.
  const CUSTOMIZED_PROVIDER_NAME = 'google';

  // Google customized client configuration key.
  const GOOGLE_CLIENT_ID_KEY = 'google.client_id';
  // The value to search for client id.
  const CLIENT_REGEXP = 'client=';
  // Runtime value
  var googleClientId = null;

  // Flag to control debug toggle state.
  var DEBUG = false;

  function debug(msg) {
    if (DEBUG) {
      console.log('--> ClientIdCustomizer(): ' + msg);
    }
  }

  /**
   * A parser to customize google search client id according to
   * the settings key 'google.client_id' given or not.
   */
  function ClientIdCustomizer() {
    this.getGoogleClientId();
  }

  ClientIdCustomizer.prototype = {

    /**
     * Fetch client id which is customized and configured in common settings.
     */
    getGoogleClientId: function() {
      navigator.mozSettings.createLock().get(GOOGLE_CLIENT_ID_KEY)
      .then(result => {
        var customizedId = result[GOOGLE_CLIENT_ID_KEY];
        if (customizedId && (customizedId !== '')) {
          googleClientId = customizedId;
          debug('customized google client id to be = ' + googleClientId);
        }
      });
    },

    /**
     * Replace client by settings configuration.
     * If there is no configuration, return it directly.
     */
    parse: function(searchUrl) {
      if (!googleClientId) {
        // Early return since no customized request.
        return searchUrl;
      }

      if (searchUrl.indexOf(CUSTOMIZED_PROVIDER_NAME) < 0) {
        // Early return since the url is not contained provider name 'google'.
        return searchUrl;
      }

      if (searchUrl.indexOf(CLIENT_REGEXP) < 0) {
        // Early return since the url is not contained 'client' id.
        return searchUrl;
      }

      let newUrl = searchUrl.slice(0,
        searchUrl.indexOf(CLIENT_REGEXP) + CLIENT_REGEXP.length) +
        googleClientId;
      
      debug('newUrl = ' + newUrl);

      return newUrl;
    }
  };

  exports.ClientIdCustomizer = new ClientIdCustomizer();

}(window));

define("shared/clientId_customizer", function(){});



/* exported SearchProvider */
/* globals LazyLoader */
/* globals SettingsListener */
/* globals Format */
/* globals ClientIdCustomizer */

(function(exports) {

  // When the "search_providers_input.json" file is edited, both this
  // and PROVIDERS_VERSION in app/search/test/marionette/lib/search.js
  // should be bumped so existing clients reload the updated data
  var VERSION = 3;

  // Cache for current provider configuration
  var SEARCH_CACHE_KEY = 'search.cache';
  // The users current provider selection
  var SEARCH_PROVIDER_KEY = 'search.provider';

  // File containing the provider configurations for all partners
  var DEFAULT_PROVIDERS_URL = '/shared/js/search_providers.json';

  // Store the users current provider selection
  var provider = null;

  // Store the list of available providers
  var providers = {};
  var defaultEngine = null;

  // Notify a client when provider configuration changes
  var updatedFun;

  // Allow consumers to wait for data to be initialised
  var readyPromise;
  var resolver;

  function extend(dest, source) {
    for (var k in source) {
      if (source.hasOwnProperty(k)) {
        var value = source[k];
        if (dest.hasOwnProperty(k) &&
            typeof dest[k] === 'object' &&
            typeof value === 'object') {
          extend(dest[k], value);
        } else {
          dest[k] = value;
        }
      }
    }
    return dest;
  }

  function resolveUrl(urlConf) {
    var params = Object.keys(urlConf.params).map(function(k) {
      return k + '=' + urlConf.params[k];
    }).join('&');
    return urlConf.url + (params ? '?' + params : '');
  }

  // We havent got valid cached data so load the json configuration
  // file and pick the configuration based on the current
  // partner code
  function loadProviderConfig() {
    LazyLoader.getJSON(DEFAULT_PROVIDERS_URL).then(result => {

      var conns = navigator.mozMobileConnections || [];
      var mccs = Array.prototype.slice.call(conns).map(function(conn) {
        if (conn.voice && conn.voice.network) {
          return Format.padLeft(conn.voice.network.mcc, 3, '0') + '-' +
            Format.padLeft(conn.voice.network.mnc, 3, '0');
        }
      });
      var engines = SearchProvider.pickEngines(result, mccs,
                                               result.partner_code || null,
                                               navigator.language);
      defaultEngine = engines.defaultEngine;
      providers = engines.providers;

      // Cache for future lookups
      var cache = {};
      cache[SEARCH_CACHE_KEY] = {};
      cache[SEARCH_CACHE_KEY].defaultEngine = defaultEngine;
      cache[SEARCH_CACHE_KEY].providers = providers;
      cache[SEARCH_CACHE_KEY].version = VERSION;
      navigator.mozSettings.createLock().set(cache);

      providersLoaded();
    });
  }

  // Once the providers are loaded, find the users current provider
  // selection
  function providersLoaded() {
    SettingsListener.observe(SEARCH_PROVIDER_KEY, false, value => {
      if (value === false || !(value in providers)) {
        provider = defaultEngine;
      } else {
        provider = value;
      }

      if (resolver && isReady()) {
        resolver();
        resolver = null;
      }

      if (updatedFun) {
        updatedFun();
      }
    });
  }

  function isReady() {
    return provider !== null && Object.keys(providers).length;
  }

  var SearchProvider = function(key) {
    if (!provider || !(key in providers[provider])) {
      return false;
    }
    return providers[provider][key];
  };

  SearchProvider.providerUpdated = function(cb) {
    updatedFun = cb;
  };

  SearchProvider.setProvider = function(value) {
    if (!(value in providers)) {
      return false;
    }
    var setting = {};
    setting[SEARCH_PROVIDER_KEY] = value;
    navigator.mozSettings.createLock().set(setting);
  };

  SearchProvider.selected = function() {
    return provider;
  };

  SearchProvider.providers = function() {
    return providers;
  };

  SearchProvider.pickEngines = function(config, sims, partnerCode, locale) {

    config = JSON.parse(JSON.stringify(config));

    var engine = config.defaultEngines;
    var usersConfig = {defaultEngine: null, providers: {}};

    if (partnerCode in config.partnerConfig &&
        locale in config.partnerConfig[partnerCode]) {
      engine = config.partnerConfig[partnerCode][locale];
    }

    sims.forEach(function(sim) {
      if (sim in config.simConfigs && locale in config.simConfigs[sim]) {
        engine = config.simConfigs[sim][locale];
      }
    });

    usersConfig.defaultEngine = engine.defaultEngine;
    Object.keys(engine.providers).forEach(function (provider) {
      var obj = config.search_providers[provider];

      if (locale in config.locales && provider in config.locales[locale]) {
        obj = extend(obj, config.locales[locale][provider]);
      }

      obj = extend(obj, engine.providers[provider]);

      usersConfig.providers[provider] = {
        'title': obj.title,
        'searchUrl': ClientIdCustomizer.parse(resolveUrl(obj.search)),
        'suggestUrl': resolveUrl(obj.suggest)
      };
    });

    return usersConfig;
  };


  SearchProvider.ready = function() {

    if (readyPromise) {
      return readyPromise;
    }

    // Attempt to load cached provider configuration
    var req = navigator.mozSettings.createLock().get(SEARCH_CACHE_KEY);
    req.onsuccess = function() {
      // Do a version check so if the data has updated since it
      // was cached, reload it
      if (SEARCH_CACHE_KEY in req.result &&
          req.result[SEARCH_CACHE_KEY].version === VERSION) {
        defaultEngine = req.result[SEARCH_CACHE_KEY].defaultEngine;
        providers = req.result[SEARCH_CACHE_KEY].providers;
        providersLoaded();
      } else {
        // There was no cache or it failed the version check, reload
        // from file
        loadProviderConfig();
      }
    };

    readyPromise = new Promise(resolve => {
      resolver = resolve;
    });

    return readyPromise;
  };

  exports.SearchProvider = SearchProvider;

})(window);

define("shared/search_provider", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.SearchProvider;
    };
}(this)));



define('panels/search/search',['require','shared/format','shared/clientId_customizer','shared/search_provider'],function(require) {

  require('shared/format');
  require('shared/clientId_customizer');
  var SearchProvider = require('shared/search_provider');

  function Search() {
    this._searchEngineSelect = null;
  }

  Search.prototype.init = function(searchEngineSelect) {
    this._searchEngineSelect = searchEngineSelect;
    SearchProvider.ready().then(() => {
      this.drawProviders();
      // Listen for updates as the providers may be updated
      // within the search app
      SearchProvider.providerUpdated(this.drawProviders.bind(this));
    });
  };

  /**
   * Generate <options> for the search engine <select> element.
   *
   * @this
   */
  Search.prototype.drawProviders = function() {

    if (!this._searchEngineSelect) {
      return;
    }

    this._searchEngineSelect.innerHTML = '';

    var selectFragment = document.createDocumentFragment();
    var optionNode = document.createElement('option');
    //LIO-708 AMX requirements @benyi begin
    var skuid='';
    skuid = navigator.engmodeExtension.getPropertyValue('ro.boot.skuid');
    if(skuid === '62GMX' || skuid === '62HMX'){
      var providers = {
        "google":{
          "title":"Google",
          "searchUrl":"https://www.google.com/search?q={searchTerms}&client=kaios-only",
          "suggestUrl":"https://www.google.com/complete/search?q={searchTerms}&client=firefox"
        }
      } 
    } else {
      var providers = SearchProvider.providers();
    }
    // var providers = SearchProvider.providers();
    //LIO-708 AMX requirements @benyi end
    Object.keys(providers).forEach(function(provider) {
      var option = optionNode.cloneNode();
      option.value = provider;
      option.text = providers[provider].title;
      if (provider === SearchProvider.selected()) {
        option.selected = true;
      }
      selectFragment.appendChild(option);
    });

    this._searchEngineSelect.appendChild(selectFragment);
  };

  return function() {
    return new Search();
  };
});

/**
 * SearchSettings provides the settings interface for search (i.e. default
 * search engine)
 */
define('panels/search/panel',['require','modules/settings_panel','panels/search/search'],function(require) {
  

  let SettingsPanel = require('modules/settings_panel');
  let Search = require('panels/search/search');
  let search = null;

  function onInit(panel) {
    let searchEngineSelect = panel.querySelector('[name="search.provider"]');
    let searchSuggestionSelect =
      panel.querySelector('[name="search.suggestions.enabled"]');
    search = Search();
    search.init(searchEngineSelect);
    SettingsListener.observe('search.suggestions.enabled', true, value => {
      searchSuggestionSelect.hidden = false;
    });
    initSoftKey();
  }

  function initSoftKey() {
    let softkeyParams = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      }]
    };
    SettingsSoftkey.init(softkeyParams);
    SettingsSoftkey.show();
  }

  function handleKeyDown(e) {
    switch (e.key) {
      case "Accept":
      case "Enter":
        let focusedElement = document.querySelector("#search .focus");
        if (focusedElement !== null) {
          let select = document.querySelector("#search .focus select");
          select.focus();
        }
        break;
    }
  }

  return function() {
    // SettingsPanel is not a constructor. Not even a little bit.
    return SettingsPanel({
      onBeforeShow: function() {
        window.addEventListener("keydown", handleKeyDown);
      },
      onBeforeHide: function() {
        window.removeEventListener('keydown', handleKeyDown);
      },
      onInit: onInit
    });
  };
});
