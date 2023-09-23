

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
      window.HTML_CACHE_VERSION = '1.2';
      this._launchContext = window.localStorage.getItem(this._CACHE_CONTEXT_KEY) || '';
      if (this._launchContext.length > 0) {
        let cacheList = this._launchContext.split('@');
        let language = cacheList[0];
        let version = cacheList[1];
        let dir = cacheList[2];
        if (language === navigator.language &&
          version === window.HTML_CACHE_VERSION &&
          dir === document.documentElement.dir) {
          if (this._launchContext.indexOf('li') !== -1) {
            this.hide();
          }

          const softKeyObj = JSON.parse(cacheList[3]);
          document.getElementById('software-keys-left').textContent = softKeyObj.left;
          document.getElementById('software-keys-center').textContent = softKeyObj.center;
          document.getElementById('software-keys-right').textContent = softKeyObj.right;

          let cacheContent = cacheList[4];
          this._readCache(cacheContent);
        }
      } else {
        var overSoftkeyPanel = document.getElementById('over-softkeyPanel');
        if (overSoftkeyPanel !== null) {
          overSoftkeyPanel.setAttribute('style', 'display:none !important');
        }
      }
      setTimeout(() => {
        this.loadRealPanel();
      }, 300);
      window.performance.mark('visuallyLoaded');
    },

    loadRealPanel: function() {
      initHtml();
      LazyLoader.load([
        'http://shared.localhost/js/helper/softkey/softkey_panel.js',
        'http://shared.localhost/js/helper/option_menu/option_menu_helper.js',
        'js/menu_params.js',
        'http://shared.localhost/js/session/lib_session.js',
        'http://shared.localhost/js/session/task_scheduler.js',
        'http://shared.localhost/js/session/settings/settings_observer.js',
        'js/debug_helper.js'
      ]).then(() => {
        const servicesArray = [
          'settingsService'
        ];
        window.libSession.initService(servicesArray).then(() => {
          SettingsObserver.init();
          DebugHelper.init();
          var scriptNode = document.createElement('script');
          scriptNode.setAttribute('data-main', 'js/startup.js');
          scriptNode.src = 'js/alameda.js';
          document.head.appendChild(scriptNode);
          LazyLoader.load([
            'js/settings_app.js',
            'http://shared.localhost/js/helper/date_time/date_time_helper.js',
            'http://shared.localhost/js/utils/components/component_utils.js',
            'http://shared.localhost/js/helper/option_menu/option_menu.js',
            'http://shared.localhost/js/utils/storage/async_storage.js',
            'http://shared.localhost/js/utils/common/template.js',
            'js/navigation_manager.js',
            'js/navigation_map.js',
            'js/constants.js',
            'js/utils.js'
          ]);
        });
      });

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
      this.setCache(document.getElementById('alarms'));
      setTimeout(() => {
        var overSoftkeyPanel = document.getElementById('over-softkeyPanel');
        if (overSoftkeyPanel !== null) {
          overSoftkeyPanel.setAttribute('style', 'display:none !important');
        }
      }, 1000);
    },

    setCache: function(element) {
      var alarmsList = [];
      let cache_context = '' + navigator.language + '@' +
        window.HTML_CACHE_VERSION + '@' +
        document.documentElement.dir + '@';
      if (element.childElementCount >= 1) {
        var count = element.childElementCount > 3 ? 3 : element.childElementCount;
        for (var i = 0; i < count; i++) {
          var childrenElement = element.children[i];
          let alarmid = element.children[i].id;
          alarmid = alarmid.replace('alarm', 'cacheAlarm');
          var className = childrenElement.className;
          if (i === 0) {
            className = 'focus' + className;
          } else {
            className = className.replace('focus', '');
          }
          let inputDom = childrenElement.querySelector('.input-enable');
          let ischecked = inputDom.getAttribute('checked');
          if (ischecked === 'false') {
            inputDom.removeAttribute('checked');
          }
          alarmsList.push(`<li class=" ${ className } " id = "${ alarmid }" >`);
          alarmsList.push(childrenElement.innerHTML + '</li>');
        }
      }

      const softKeyString = {};
      softKeyString.left = window.api.l10n.get('kai-new-alarm');
      if (alarmsList.length > 0) {
        if (element.children[0].querySelector('input').checked) {
          softKeyString.center = window.api.l10n.get('turnOff');
        } else {
          softKeyString.center = window.api.l10n.get('turnOn');
        }
        softKeyString.right = window.api.l10n.get('kai-options');
      } else {
        softKeyString.right = window.api.l10n.get('kai-settings');
      }
      cache_context += JSON.stringify(softKeyString) + '@';

      let alarm = window.api.l10n.get('alarm');
      let timer = window.api.l10n.get('timer');
      let stopwatch = window.api.l10n.get('stopwatch');
      cache_context += '<div id="over-header" class="view-header regular-header clock-header">' +
        document.querySelector('h1[data-l10n-id="kai-clock-title"]').outerHTML
          .replace(/data-l10n-id=".*?"|id=.*?(?=\s|>)/ig, '') + '</div>';
      let tabContext = `<li role="presentation">
                          <a id="alarm-tab" class="h3"
                            aria-controls="alarm-panel"
                            aria-selected="true" role="tab"
                            href="#alarm-panel" data-l10n-id="alarm">${alarm}</a>
                        </li>
                        <li role="presentation">
                          <a id="timer-tab" class="h3"
                            aria-controls="timer-panel"
                            aria-selected="false" role="tab"
                            href="#timer-panel" data-l10n-id="timer">${timer}</a>
                        </li>
                        <li role="presentation">
                          <a id="stopwatch-tab" class="h3"
                            aria-controls="stopwatch-panel"
                            aria-selected="false" role="tab"
                            href="#stopwatch-panel"
                            data-l10n-id="stopwatch">${stopwatch}
                          </a>
                        </li>`
      cache_context += `<ul id="over-tablist" class="custom-tablist skin-light bottom">
                          ${tabContext}
                        </ul>`;

      if (alarmsList.length > 0) {
        var alarms_context = alarmsList.join('')
          .replace(/id=".*?"|id=.*?(?=\s|>)/ig, '')
          .replace(/style=".*?"|style=.*?(?=\s|>)/ig, '')
          .replace(/data-nav-/ig, '')
          .replace(/data-/ig, '')
          .replace(/alarm-cell/ig, '');
        cache_context += '<ul id="over-alarms">' + alarms_context + '</ul>';
      } else {
        cache_context += `<div id="over-panel" class="no-alarms-message p-pri">
          <div class="no-alarms-body">${window.api.l10n.get('no-alarms-body')}</div>
          <div>${window.api.l10n.get('press-new')}</div>
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

function $(id) {
  return document.getElementById(id);
}

function initHtml(){
  enable($('views'));
  enable($('clock-tabs'));
}

function enable(h){
  h.innerHTML = h.innerHTML.replace(/(<!--)|(-->)/g, '');
}
