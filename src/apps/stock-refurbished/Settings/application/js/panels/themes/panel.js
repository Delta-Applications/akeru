define('modules/navigator/mozApps', [], function () {

    return window.navigator.mozApps;
});

/**
 * Handle themes panel's functionality.
 *
 * @module themes
 */
define('panels/themes/themes', ['require', 'modules/settings_service', 'shared/manifest_helper', 'modules/apps_cache', 'modules/navigator/mozApps'], function (require) {

    console.log("required!")
    var SettingsService = require('modules/settings_service');
    var ManifestHelper = require('shared/manifest_helper');
    var AppsCache = require('modules/apps_cache');
    var mozApps = require('modules/navigator/mozApps');

    var themes = function pl() {
        this._listRoot = null;
        this._apps = null;
        this._oldApps = null;
        this._enabled = false;
        this._navigationInfo = [];
        this._focused = null;
    };


    function getSystemSetting(key, successCb, errorCb) {
        var e = navigator.mozSettings.createLock().get(key);
        e.onsuccess = function () {
            successCb(e.result[key]);
        };
        e.onerror = errorCb;
    }

    function setSystemSetting(key, value, successCb, errorCb) {
        var setting = {};
        setting[key] = value;
        var e = navigator.mozSettings.createLock().set(setting);
        e.onsuccess = successCb;
        e.onerror = errorCb;
    }
    themes.prototype = {
        /**
         * initialization
         *
         * @memberOf themes
         * @param {HTMLElement} listRoot
         * @access public
         */
        init: function pl_init(listRoot) {
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

        _bindEvents: function pl__bindEvents() {
            this._listRoot.addEventListener('click', this._boundOnAppChoose);
            AppsCache.addEventListener('oninstall', this._boundOnApplicationInstall);
            AppsCache.addEventListener('onuninstall',
                this._boundOnApplicationUninstall);
        },

        _unbindEvents: function pl__unbindEvents() {
            this._listRoot.removeEventListener('click', this._boundOnAppChoose);
            AppsCache.removeEventListener('oninstall',
                this._boundOnApplicationInstall);
            AppsCache.removeEventListener('onuninstall',
                this._boundOnApplicationUninstall);
        },

        /**
         * Refresh the app list when we enter into panel.
         *
         * @memberOf themes
         * @access public
         * @return {Promise}
         */
        refresh: function pl_refresh() {
            var self = this;
            this._apps = [];
            return this.loadApps();
        },

        /**
         * Go to app_permissions_detail panel when user select an app.
         *
         * @memberOf themes
         * @param {Event} evt
         * @access public
         */
        _onAppChoose: function pl__onAppChoose(evt) {
            if (evt.target.dataset && evt.target.dataset.appIndex) {
                var app = this._apps[evt.target.dataset.appIndex]
                const manifestURL = app.manifestURL,
                    key = "homescreen.manifestURL",
                    name = app.manifest.name;
                getSystemSetting(
                    key,
                    (a) => {
                        if (a == manifestURL) {}
                        else {
                            setSystemSetting(
                                key,
                                manifestURL,
                                () => {
                                    showToast("changessaved");
                                },
                                (a) => alert(a)
                            );
                        }
                    },
                    (a) => alert(a)
                );
                this.refresh();
                this.renderList();
            }
        },

        /**
         * When new application is installed, we push the app to list, sort them and
         * rerender the app list.
         *
         * @memberOf themes
         * @param {Event} evt
         * @access public
         */
        _onApplicationInstall: function pl__onApplicationInstall(evt) {
            var app = evt.application;
            this._apps.push(app);
            this._sortApps();
            this.renderList();
        },

        /**
         * When application is uninstalled, we remove it from list and rerender the
         * app list.
         *
         * @memberOf themes
         * @param {Event} evt
         * @access public
         */
        _onApplicationUninstall: function pl__onApplicationUninstall(evt) {
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
            SettingsService.navigate('appPermissions');
            this._apps.splice(appIndex, 1);
            this.renderList();
        },

        /**
         * Sort the applist by the name of its manifest.
         *
         * @memberOf themes
         * @access private
         */
        _sortApps: function pl__sortApps() {
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
         * @memberOf themes
         * @access private
         * @param {Object} itemData
         * @return {HTMLDivElement}
         */
        _genAppItemTemplate: function pl__genAppItemTemplate(itemData) {
            /*
            <li tabindex="0" style="--nav-left: 136; --nav-right: 136; --nav-up: 135; --nav-down: 133;" data-nav-id="136" role="menuitem" class="internetSharing-enabled focus">
          <label class="menu-item pack-radio-large my_radio">
            <img src="../style/images/default.png"><input name="multifunction-enabled" value="internetSharing" type="radio">
            <span data-l10n-id="internetSharing">Condivisione Internet</span>
          </label>
        </li>
            */
            var icon = document.createElement('img');
            var item = document.createElement('li');
            var link = document.createElement('label');
            var span = document.createElement('span');
            var radio = document.createElement('input');
            span.textContent = itemData.name;
            icon.src = itemData.iconSrc;
            link.dataset.appIndex = itemData.index;
            link.href = '#';
            link.classList.add('menu-item');
            link.classList.add('pack-radio-large');
            link.classList.add('my_radio');
            radio.name = 'multifunction-enabled';
            radio.type = 'radio';

            getSystemSetting("homescreen.manifestURL", (a) => {
                radio.checked = a == itemData.manifestURL
            }, (a) => {});
                

            link.appendChild(icon);
            link.appendChild(radio);
            link.appendChild(span);
            item.appendChild(link);
            return item;
        },

        /**
         * Genrate UI template of app item.
         *
         * @memberOf themes
         * @access public
         */
        renderList: function pl_renderList() {
            this._listRoot.innerHTML = '';
            var listFragment = document.createDocumentFragment();
            var index = 0;
            this._apps.forEach(function appIterator(app, index) {
                var manifest = new ManifestHelper(app.manifest ?
                    app.manifest : app.updateManifest);
                var li = this._genAppItemTemplate({
                    name: manifest.short_name || manifest.name,
                    index: index,
                    iconSrc: this._getBestIconURL(app, manifest.icons),
                    manifestURL: app.manifestURL
                });
                index++;
                listFragment.appendChild(li);
            }.bind(this));
            this._listRoot.appendChild(listFragment);
        },



        /**
         * Filter explicit apps from moz apps, sort them, and render to screen.
         *
         * @memberOf themes
         * @access public
         * @return {Promise}
         */
        loadApps: function pl_loadApps() {
            var self = this;
            return AppsCache.apps().then(function (apps) {
                self._loadApps(apps);
            }).then(() => {
                window.dispatchEvent(new CustomEvent('refresh'));
            });
        },

        /**
         * Iterate internal apps and render them on UI.
         *
         * @memberOf themes
         * @param {Object[]} apps
         * @access private
         */
        _loadApps: function pl__loadApps(apps) {
            apps.forEach(function (app) {
                var manifest = app.manifest ? app.manifest : app.updateManifest;
                if (manifest.role === 'system' ||
                    manifest.role === 'invisible' ||
                    app.role === 'invisible') {
                    return;
                }

                this._currentApp = app;
                    var display = null;

                    display = manifest.role == "theme"

                    if (display) {
                        this._apps.push(app);
                    }

                
            }.bind(this));

            this._sortApps();
            if (JSON.stringify(this._oldApps) === JSON.stringify(this._apps)) {
                return;
            } else {
                this._oldApps = [];
                for (var i = 0; i < this._apps.length; i++) {
                    this._oldApps.push(this._apps[i]);
                }
            }
            this.renderList();
        },

        /**
         * Get icon URL.
         *
         * @memberOf themes
         * @param {Object} app
         * @param {Object} icons
         * @access private
         */
        _getBestIconURL: function pl__getBestIconURL(app, icons) {
            if (!icons || !Object.keys(icons).length) {
                return '../style/images/default.png';
            }

            // The preferred size is 30 by the default. If we use HDPI device, we may
            // use the image larger than 30 * 1.5 = 45 pixels.
            var preferredIconSize = 30 * (window.devicePixelRatio || 1);
            var preferredSize = Number.MAX_VALUE;
            var max = 0;

            for (var size in icons) {
                size = parseInt(size, 10);
                if (size > max) {
                    max = size;
                }

                if (size >= preferredIconSize && size < preferredSize) {
                    preferredSize = size;
                }
            }
            // If there is an icon matching the preferred size, we return the result,
            // if there isn't, we will return the maximum available size.
            if (preferredSize === Number.MAX_VALUE) {
                preferredSize = max;
            }

            var url = icons[preferredSize];

            if (url) {
                return !(/^(http|https|data):/.test(url)) ? app.origin + url : url;
            } else {
                return '../style/images/default.png';
            }
        }
    };

    return function ctor_themes() {
        return new themes();
    };
});

/* global SettingsSoftkey */

define('panels/themes/panel', ['require', 'modules/settings_panel', 'panels/themes/themes'], function (require) {


    var SettingsPanel = require('modules/settings_panel');
    var themes =
        require('panels/themes/themes');

    return function ctor_themes_panel() {
        // We use this flag to identify permissions_table.json has been loaded or
        // not.
        var permissionsTableHasBeenLoaded = false;
        var elements = {};
        var themesModule = themes();
        var previousLanguage = null;
        var currentLanguage = null;

        function updateSKs() {
            var params = {
                menuClassName: 'menu-button',
                header: {
                    l10nId: 'message'
                },
                items: [{
                    name: 'Select',
                    l10nId: 'select',
                    priority: 2
                }]
            };
            SettingsSoftkey.init(params);
            SettingsSoftkey.show();
        }

        return SettingsPanel({
            onInit: function (panel) {
                console.log("wowie!!");
                elements = {
                    list: panel.querySelector('.app-list')
                };
                themesModule.init(elements.list);
            },

            onBeforeShow: function () {
                themesModule.refresh();
                themesModule.enabled = true;
                updateSKs();
            },

            onBeforeHide: function () {
                themesModule.enabled = false;
            }
        });
    };
});