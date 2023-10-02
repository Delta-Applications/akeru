/* global SettingsSoftkey */
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function about_licensing_panel() {
    var _iframe;
    var _fromFxa = false;
    var previousLanguage = null;
    var currentLanguage = null;
    var url = 'https://www.kaiostech.com/legal-terms/';

    function _initIframe() {
      _iframe.focus();
    }

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'openUrl',
          l10nId: 'open-url',
          priority: 2,
          method: function() {}
        }]
      };

      if (_fromFxa) {
        var param = {
          name: 'accept',
          l10nId: 'fxa-accept',
          priority: 3,
          method: function() {
            //Handled in keyDownHandler
          }
        };

        softkeyParams.items.push(param);
      }

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function checkCurrentLanguage() {
      var req = navigator.mozSettings.createLock().get('language.current');
      req.onsuccess = function() {
        currentLanguage = req.result['language.current'];
        if (previousLanguage !== currentLanguage) {
          getLicense();
          previousLanguage = currentLanguage;
        }
      };
    }

    function keyDownHandler(evt) {
      switch (evt.key) {
        case 'Enter':
          window.open(url, 'popup');
        case 'Backspace':
          SettingsService.navigate('about-legal');
          evt.preventDefault();
          break;
        case 'SoftRight':
          if (_fromFxa) {
            FxAccountsIACHelper.createAccount((result) => {
              // Success
              SettingsService.navigate('fxa');
              if (result && result.success) {
                showToast('fxa-account-created');
              }
            }, ()=> {});
          }
      }
    }

    function isExistFile(testURL, callback) {
      let xmlHttp = new XMLHttpRequest();

      xmlHttp.onreadystatechange = () => {
        if (xmlHttp.readyState === 4) {
          if (xmlHttp.status === 200) {
            //file at URL exist
            callback(true);
          } else {
            callback(false);
          }
        }
      };

      xmlHttp.open("GET", testURL);
      try {
        xmlHttp.send();
      } catch(e) {
        callback(false);
      }
    }

    function getLicense() {
      let req = navigator.mozSettings.createLock().get('language.current');
      req.onsuccess = () => {
        let lang = req.result['language.current'];
        let licensePath = 'shared/locales/kaios_license/kaios_license.' + lang + '.html';
        let defaultLicensePath = 'shared/locales/kaios_license/kaios_license.en-US.html';

        isExistFile(licensePath, (isExist) => {
          _iframe.src = isExist ? licensePath : defaultLicensePath;
          _iframe.onload = () => {
            _iframe.contentDocument.body.setAttribute('style','word-wrap : break-word !important');
            _iframe.contentDocument.addEventListener('keydown', keyDownHandler);
          }
        });
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        _iframe = document.getElementById('os-license');
        checkCurrentLanguage();
      },

      onBeforeShow: function() {
        // panelready is not triggerred when recovering from
        // open url. Call _init to show soft key
        _initSoftKey();
        window.addEventListener('panelready', _initIframe);
        _iframe.contentDocument.addEventListener('keydown', keyDownHandler);
        _iframe.contentDocument.dir = window.document.dir;
        checkCurrentLanguage();
      },

      onBeforeHide: function() {
        window.removeEventListener('panelready', _initIframe);
        _iframe.contentDocument.removeEventListener('keydown', keyDownHandler);
      }
    });
  };
});
