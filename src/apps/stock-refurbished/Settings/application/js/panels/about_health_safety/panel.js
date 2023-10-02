define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function sourcecode_dialog_panel() {
    var _iframe;

    var languagePre = '';

    var _Key = {id:'health_safety', path:'resources/health_safety_information.html'}

    function onKeyDown(evt) {
      switch (evt.key) {
        case 'Enter':
        case 'Backspace':
          SettingsService.navigate('about-legal');
          evt.preventDefault();
          break;
      }
    }

    function _initIframe() {
      _iframe.focus();
      _iframe.contentDocument.removeEventListener('keydown',onKeyDown);
      _iframe.contentDocument.addEventListener('keydown',onKeyDown);
        var health = _iframe.contentDocument;
        navigator.customization.getValue("def.JrdElabel.sar.vf.head.value").then((result) => {
          dump("def.JrdElabel.sar.vf.head.value = " + result);
          health.getElementById("head").innerHTML = isNaN(result) ? 0 : result;
        });
        navigator.customization.getValue("def.JrdElabel.sar.vf.body.value").then((result) => {
          dump("def.JrdElabel.sar.vf.body.value  = " + result);
          health.getElementById("body").innerHTML = isNaN(result) ? 0 : result;
        });

        navigator.customization.getValue("def.JrdElabel.sar.vf.distance.value").then((result) => {
          dump("def.JrdElabel.sar.vf.distance.value = " + result);
          health.getElementById("distance").innerHTML = isNaN(result) ? 0 : result;
        });
    }


    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Ok',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {

      },

      onBeforeShow: function() {
        _initSoftKey();
        _iframe = document.getElementById(_Key.id);
        var req = navigator.mozSettings.createLock().get('language.current');
        req.onsuccess = function _onsuccess() {
          var language = req.result['language.current'];
          if((languagePre =='' || languagePre != language)) {
            languagePre = language;
            _iframe.onload = function() {
              _initIframe();
            };
            switch(language) {
              case 'es-US':
                var array = _Key.path.split('/');
                var path = array[array.length -1];
                _iframe.src = 'resources/' + path.substr(0,path.length - 5) + "_" + language + '.html';
                break;
              case 'en-US':
              default:
                 _iframe.src = _Key.path;
                 break;
            }
          }
        }
        window.addEventListener('panelready', _initIframe);
      },

      onBeforeHide: function() {
        SettingsSoftkey.hide();
        window.removeEventListener('panelready', _initIframe);
      }
    });
  };
});
