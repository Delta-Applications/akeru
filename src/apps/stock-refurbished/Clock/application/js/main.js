

(function(exports) {
  /**
   * @class AppStarter
   * @returns {AppStarter}
   */
  function AppStarter() {
    this._launchContext = '';
  }

  AppStarter.prototype = {
    _CACHE_CONTEXT_KEY: 'cache_context',
    _readCache: function(context) {
      document.getElementById('over-cache-context').innerHTML = context;
    },

    /**
     * Load alameda and the required modules defined in main.js.
     *
     * @access private
     * @memberOf AppStarter.prototype
     */
    load: function() {
      window.HTML_CACHE_VERSION = '1.1';
      window.addEventListener('largetextenabledchanged', function() {
        document.body.classList.toggle('large-text', navigator.largeTextEnabled);
      });
      document.body.classList.toggle('large-text', navigator.largeTextEnabled);
      this._launchContext = window.localStorage.getItem(this._CACHE_CONTEXT_KEY) || '';
      let cacheLength = this._launchContext.length;
      let langIndex = this._launchContext.indexOf('$');
      let versionIndex = this._launchContext.indexOf('@');
      let language = this._launchContext.substring(0, langIndex);
      let version = this._launchContext.substring(langIndex + 1, versionIndex);
      if (cacheLength > 0 &&
        language === navigator.language &&
        version === window.HTML_CACHE_VERSION) {
        if (this._launchContext.indexOf('li') !== -1) {
          this.hide();
        }
        let cacheContent = this._launchContext.substring(versionIndex + 1, cacheLength);
        this._readCache(cacheContent);
      }

      setTimeout(() => {
        var scriptNode = document.createElement('script');
        scriptNode.setAttribute('data-main', 'js/startup.js');
        scriptNode.src = 'js/alameda.js';
        document.head.appendChild(scriptNode);

        LazyLoader.load([
          'shared/js/date_time_helper.js',
          'shared/js/component_utils.js',
          'shared/elements/config.js',
          'js/settings_app.js'
        ]);
      }, 100);

      window.performance.mark('visuallyLoaded');
    },

    hide: function() {
      document.getElementById('over-panel').classList.add('hide');
    },

    getElementAndHide: function(ids) {
      if (!Array.isArray(ids)) {
        ids = [ids];
      }
      for (var i = 0; i < ids.length; i++) {
        var element = document.getElementById(ids[i]);
        if (element !== null) {
          element.classList.add('hide');
        }
      }
    },

    hideRootPanel: function() {
      document.getElementById('root-panel').classList.remove('zindex2');
      this.getElementAndHide(['over-header', 'over-tablist', 'over-alarms']);

      setTimeout(() => {
        this.setCache(document.getElementById('alarms'));

        var overSoftkeyPanel = document.getElementById('over-softkeyPanel');
        if (overSoftkeyPanel !== null) {
          overSoftkeyPanel.setAttribute('style', 'display:none !important');
        }
      }, 1000);
    },

    setCache: function(element) {
      var alarmsList = [];
      let cache_context = '' + navigator.language + '$' + window.HTML_CACHE_VERSION + '@';
      var cskText = navigator.mozL10n.get('turnOff');
      if (element.childElementCount >= 1) {
        var count = element.childElementCount > 3 ? 3 : element.childElementCount;
        for (var i = 0; i < count; i++) {
          var childrenElement = element.children[i];
          var className = childrenElement.className;
          if (i === 0) {
            className = 'focus' + className;
            if (className.indexOf('check') === -1) {
              cskText = navigator.mozL10n.get('turnOn');
            }
          } else {
            className = className.replace('focus', '');
          }
          alarmsList.push('<li class="' + className + '">');
          alarmsList.push(childrenElement.innerHTML + '</li>');
        }
      }
      cache_context += '<div id="over-header" class="view-header regular-header clock-header">' +
        document.querySelector('h1[data-l10n-id="kai-clock-title"]').outerHTML
          .replace(/data-l10n-id=".*?"|id=.*?(?=\s|>)/ig, '') + '</div>';

      cache_context += '<ul id="over-tablist" class="custom-tablist skin-light bottom">' +
                        document.getElementById('clock-tabs').innerHTML +
                       '</ul>';

      if (alarmsList.length > 0) {
        var alarms_context = alarmsList.join('')
          .replace(/id=".*?"|id=.*?(?=\s|>)/ig, '')
          .replace(/style=".*?"|style=.*?(?=\s|>)/ig, '')
          .replace(/data-nav-/ig, '')
          .replace(/data-/ig, '')
          .replace(/alarm-cell/ig, '');
        cache_context += '<ul id="over-alarms">' + alarms_context + '</ul>';

        var softKeyPanelHtml = document.getElementById('softkeyPanel').outerHTML;
        cache_context += softKeyPanelHtml.replace('Turn On', cskText)
                                         .replace('Turn Off', cskText)
                                         .replace(/id=\"softkeyPanel\"/ig, 'id="over-softkeyPanel"');
      } else {
        cache_context += document.getElementById('softkeyPanel').outerHTML
          .replace(/id=\"softkeyPanel\"/ig, 'id="over-softkeyPanel"');

        cache_context += `<div id="over-panel" class="no-alarms-message p-pri">
          <div class="no-alarms-body">${navigator.mozL10n.get('no-alarms-body')}</div>
          <div>${navigator.mozL10n.get('press-new')}</div>
        </div>`
      }
      window.localStorage.setItem(this._CACHE_CONTEXT_KEY, cache_context);
    }
  }

  exports.AppStarter = function() {
    return new AppStarter();
  };
}(window));

var appStarter = AppStarter();
appStarter.load();
