
/**
 * Handle support panel functionality with SIM and without SIM
 *
 * @module developer/developer
 */
define('panels/developer/developer',['require','modules/dialog_service','modules/apps_cache','shared/screen_layout'],function(require) {
  

  var DialogService = require('modules/dialog_service');
  var AppsCache = require('modules/apps_cache');
  var ScreenLayout = require('shared/screen_layout');

  /**
   * @alias module:developer/developer
   * @class Developer
   * @returns {Developer}
   */
  var Developer = function() {
    this._elements = null;
  };

  Developer.prototype = {
    /**
     * Initialization.
     *
     * @access public
     * @memberOf Developer.prototype
     * @param  {HTMLElement} elements
     */
    init: function d_init(elements) {
      this._elements = elements;

      this._elements.ftuLauncher.addEventListener('click', this._launchFTU);

      // hide software home button whenever the device has no hardware
      // home button
      if (!ScreenLayout.getCurrentLayout('hardwareHomeButton')) {
        this._elements.softwareHomeButton.style.display = 'none';
        // always set homegesture enabled on tablet, so hide the setting
        if (!ScreenLayout.getCurrentLayout('tiny')) {
          this._elements.homegesture.style.display = 'none';
        }
      }
    },

    /**
     * launch FTU app.
     *
     * @access private
     * @memberOf Developer.prototype
     */
    _launchFTU: function d__launchFTU() {
      var key = 'ftu.manifestURL';
      var req = navigator.mozSettings.createLock().get(key);
      req.onsuccess = function ftuManifest() {
        var ftuManifestURL = req.result[key];

        // fallback if no settings present
        if (!ftuManifestURL) {
          ftuManifestURL = document.location.protocol +
            '//ftu.gaiamobile.org' +
            (location.port ? (':' + location.port) : '') +
            '/manifest.webapp';
        }

        var ftuApp = null;
        AppsCache.apps().then(function(apps) {
          for (var i = 0; i < apps.length && ftuApp === null; i++) {
            var app = apps[i];
            if (app.manifestURL === ftuManifestURL) {
              ftuApp = app;
            }
          }

          if (ftuApp) {
            ftuApp.launch();
          } else {
            DialogService.alert('no-ftu', {title: 'no-ftu'});
          }
        });
      };
    }
  };

  return function ctor_developer_panel() {
    return new Developer();
  };
});

/**
 * Used to show Device/developer panel
 */
define('panels/developer/panel',['require','modules/settings_panel','panels/developer/developer'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var Developer = require('panels/developer/developer');

  return function ctor_developer_panel() {
    var developer = Developer();

    function developerHandleKeyDown(e){
      switch(e.key){
        case "Accept":
        case "Enter":
          var focusedElement = document.querySelector("#developer .focus");
          if (focusedElement.id === "remote-debugging") {
            var select = document.querySelector("#developer .focus select");
            select.focus();
          }
          break;
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        var elements = {
          ftuLauncher: panel.querySelector('.ftuLauncher'),
          softwareHomeButton: panel.querySelector('.software-home-button'),
          homegesture: panel.querySelector('.homegesture')
        };
        developer.init(elements);
        this.devToolHeader = panel.querySelector('#develope-tools-header');
        this.devToolWifi = panel.querySelector('#dev-tool-wifi');
        this.devToolHud = panel.querySelector('#dev-tool-hud');
        this.devToolPsu = panel.querySelector('#dev-tool-psu');
        this.graphicsSettingsHeader = panel.querySelector('#graphics-settings-header');
        this.graphicsSettings = panel.querySelector('#graphics-settings');
        this.winMngSettingsHeader = panel.querySelector('#win-mng-settings-header');
        this.winMngSettings = panel.querySelector('#win-mng-settings');
        this.debugSettingsHeader = panel.querySelector('#debug-settings-header');
        this.debugSettings = panel.querySelector('#debug-settings');
      },

      onBeforeShow: function() {
        window.addEventListener("keydown", developerHandleKeyDown);
        DeviceFeature.ready(() => {
          settings.createLock().get('developer.menu.more')
          .then((result) => {
            let val = !result['developer.menu.more'];
            this.devToolHeader.hidden = val;
            this.devToolWifi.hidden = val;
            this.devToolHud.hidden = val;
            this.devToolPsu.hidden = val;
            this.graphicsSettingsHeader.hidden = val;
            this.graphicsSettings.hidden = val;
            this.winMngSettingsHeader.hidden = val;
            this.winMngSettings.hidden = val;
            this.debugSettingsHeader.hidden = val;
            this.debugSettings.hidden = val;
          });
          /*if (DeviceFeature.getValue('buildType') === 'user') {
           
          }*/
        });
      },

      onBeforeHide: function() {
        window.removeEventListener("keydown", developerHandleKeyDown);
      }
    });
  };
});
