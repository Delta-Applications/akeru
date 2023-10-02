
define('modules/navigator/mozApps',[],function() {
  
  return window.navigator.mozApps;
});

define('modules/navigator/mozPermissionSettings',[],function() {
  
  return window.navigator.mozPermissionSettings;
});

/**
 * Handle app_notices_list panel's functionality.
 *
 * @module NoticeList
 */
define('panels/app_notices_list/app_notices_list',['require','modules/settings_service','shared/manifest_helper','modules/apps_cache','modules/navigator/mozApps','modules/navigator/mozPermissionSettings'],function(require) {
  

  var SettingsService = require('modules/settings_service');
  var ManifestHelper = require('shared/manifest_helper');
  var AppsCache = require('modules/apps_cache');
  var mozApps = require('modules/navigator/mozApps');
  var mozPerms = require('modules/navigator/mozPermissionSettings');

  var NoticeList = function nl() {
    this._listRoot = null;
    this._apps = null;
    this._enabled = false;
    this._navigationInfo = [];
    this._focused = null;
  };

  NoticeList.prototype = {
    /**
     * initialization
     *
     * @memberOf NoticeList
     * @param {HTMLElement} listRoot
     * @access public
     */
    init: function nl_init(listRoot) {
      this._listRoot = listRoot;

      this._boundOnAppChoose = this._onAppChoose.bind(this);
      this._boundOnApplicationInstall = this._onApplicationInstall.bind(this);
      this._boundOnApplicationUninstall =
        this._onApplicationUninstall.bind(this);
    },

    set enabled(value) {
      if (value !== this._enabled) {
        this._enabled = value;
        if (this._enabled) {
          this._bindEvents();
        } else {
          this._unbindEvents();
        }
      }
    },

    _bindEvents: function nl__bindEvents() {
      this._listRoot.addEventListener('click', this._boundOnAppChoose);
      AppsCache.addEventListener('oninstall', this._boundOnApplicationInstall);
      AppsCache.addEventListener('onuninstall',
        this._boundOnApplicationUninstall);
    },

    _unbindEvents: function nl__unbindEvents() {
      this._listRoot.removeEventListener('click', this._boundOnAppChoose);
      AppsCache.removeEventListener('oninstall',
        this._boundOnApplicationInstall);
      AppsCache.removeEventListener('onuninstall',
        this._boundOnApplicationUninstall);
    },

    /**
     * Refresh the app list when we enter into panel.
     *
     * @memberOf NoticeList
     * @access public
     * @return {Promise}
     */
    refresh: function pl_refresh() {
      this._apps = [];
      return this.loadApps();
    },

    /**
     * Go to app_notices_detail panel when user select an app.
     *
     * @memberOf NoticeList
     * @param {Event} evt
     * @access public
     */
    _onAppChoose: function nl__onAppChoose(evt) {
      if (evt.target.dataset && evt.target.dataset.appIndex) {
        SettingsService.navigate('app-notices-details', {
          app: this._apps[evt.target.dataset.appIndex]
        });
      }
    },

    /**
     * When new application is installed, we push the app to list, sort them and
     * rerender the app list.
     *
     * @memberOf NoticeList
     * @param {Event} evt
     * @access public
     */
    _onApplicationInstall: function nl__onApplicationInstall(evt) {
      var app = evt.application;
      this._apps.push(app);
      this._sortApps();
      this.renderList();
    },

    /**
     * When application is uninstalled, we remove it from list and rerender the
     * app list.
     *
     * @memberOf NoticeList
     * @param {Event} evt
     * @access public
     */
    _onApplicationUninstall: function nl__onApplicationUninstall(evt) {
      var app;
      var appIndex;
      this._apps.some(function findApp(anApp, index) {
        if (anApp.origin === evt.application.origin) {
          app = anApp;
          appIndex = index;
          return true;
        }
        return false;
      });

      if (!app) {
        return;
      }
      SettingsService.navigate('app-notices');
      this._apps.splice(appIndex, 1);
      this.renderList();
    },

    /**
     * Sort the applist by the name of its manifest.
     *
     * @memberOf NoticeList
     * @access private
     */
    _sortApps: function nl__sortApps() {
      this._apps.sort(function alphabeticalSort(app, otherApp) {
        var manifest = new ManifestHelper(app.manifest ?
          app.manifest : app.updateManifest);
        var otherManifest = new ManifestHelper(otherApp.manifest ?
          otherApp.manifest : otherApp.updateManifest);
        return manifest.name > otherManifest.name;
      });
    },

    /**
     * Genrate UI template of app item.
     *
     * @memberOf NoticeList
     * @access private
     * @param {Object} itemData
     * @return {HTMLDivElement}
     */
    _genAppItemTemplate: function nl__genAppItemTemplate(itemData) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      var span = document.createElement('span');
      span.textContent = itemData.name;
      link.dataset.appIndex = itemData.index;
      link.href = '#';
      link.classList.add('menu-item');
      link.appendChild(span);
      item.appendChild(link);
      return item;
    },

    /**
     * Genrate UI template of app item.
     *
     * @memberOf NoticeList
     * @access public
     */
    renderList: function nl_renderList() {
      DeviceFeature.ready(() => {
        this._listRoot.innerHTML = '';
        let listFragment = document.createDocumentFragment();
        let isLowMemoryDevice = DeviceFeature.getValue('lowMemory');
        this._apps.forEach(function appIterator(app, index) {
          let manifest = new ManifestHelper(app.manifest ?
            app.manifest : app.updateManifest);
          let name = manifest.short_name || manifest.name;
          let li = this._genAppItemTemplate({
            name: name,
            index: index
          });

          if ((name === 'E-Mail' || name === 'Calendar') &&
            (isLowMemoryDevice === 'true')) {
            return;
          }
          listFragment.appendChild(li);
        }.bind(this));
        this._listRoot.appendChild(listFragment);
      });
    },

    /**
     * Identify the notice whether is explict or not.
     *
     * @memberOf NoticeList
     * @access private
     * @return {Bool}
     */
    _isExplicitPerm: function nl_isExplicitPerm(perm) {
      return mozPerms.isExplicit(perm, this._currentApp.manifestURL,
                                 this._currentApp.origin, false);
    },

    /**
     * Filter explicit apps from moz apps, sort them, and render to screen.
     *
     * @memberOf NoticeList
     * @access public
     * @return {Promise}
     */
    loadApps: function nl_loadApps() {
      var self = this;
      return AppsCache.apps().then(function(apps) {
        self._loadApps(apps);
      }).then(() => {
        // refresh the current panel focus
        window.dispatchEvent(new CustomEvent('refresh'));
      });
    },

    /**
     * Iterate internal apps and render them on UI.
     *
     * @memberOf NoticeList
     * @param {Object[]} apps
     * @access private
     */
    _loadApps: function nl__loadApps(apps) {
      apps.forEach(function(app) {
        var manifest = app.manifest ? app.manifest : app.updateManifest;

        var permInfo = mozPerms.get('desktop-notification',
          app.manifestURL, app.origin, false);

        if (manifest.name === 'System' ||
          manifest.role === 'invisible' ||
          app.role == 'invisible') {
          return;
        }
        if (permInfo != 'unknown') {
          this._apps.push(app);
        }
      }.bind(this));

      this._sortApps();
      this.renderList();
    }
  };

  return function ctor_notice_list() {
    return new NoticeList();
  };
});

/* global SettingsSoftkey */

define('panels/app_notices_list/panel',['require','modules/settings_panel','panels/app_notices_list/app_notices_list'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var NoticeList =
    require('panels/app_notices_list/app_notices_list');

  return function ctor_app_notices_list_panel() {
    var elements = {};
    var noticeListModule = new NoticeList();
    var previousLanguage = null;
    var currentLanguage = null;

    function updateSoftKey() {
      var params = {
        menuClassName: 'menu-button',
        header: { l10nId:'message' },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2
        }]
      };
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function checkCurrentLanguage() {
      var req = navigator.mozSettings.createLock().get('language.current');
      req.onsuccess = function() {
        currentLanguage = req.result['language.current'];
        if (previousLanguage !== currentLanguage) {
          noticeListModule.refresh();
          previousLanguage = currentLanguage;
        }
      };
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          list: panel.querySelector('.app-list')
        };
        noticeListModule.init(elements.list);
        checkCurrentLanguage();
      },

      onBeforeShow: function() {
        noticeListModule.enabled = true;
        checkCurrentLanguage();
        updateSoftKey();
      },

      onBeforeHide: function() {
        noticeListModule.enabled = false;
      }
    });
  };
});
