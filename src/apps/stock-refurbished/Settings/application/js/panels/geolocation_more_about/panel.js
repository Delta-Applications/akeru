define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function geolocation_more_about_panel() {
    var _moreDetailsLink;

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {
            SettingsService.navigate('geolocation-privacy');
          }
        }, {
          name: 'Done',
          l10nId: 'done',
          priority: 3,
          method: function() {
            SettingsService.navigate('geolocation');
          }
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _moreDetailsLink = document.querySelector('.link-text');

        DeviceFeature.ready(() => {
          let geoDsc = document.getElementById('geolcation_more_description');
          if (DeviceFeature.getValue('wifi') !== 'true') {
            geoDsc.setAttribute('data-l10n-id',
              'geolocation-privacy-description-withoutwifi-1');
          } else {
            geoDsc.setAttribute('data-l10n-id',
              'geolocation-privacy-description-1');
          }
        });
      },

      onBeforeShow: function() {
        _initSoftKey();
        // @HACK Set default focus on the link
        _moreDetailsLink.classList.add('hasfocused');
      },

      onBeforeHide: function() {
      }
    });
  };
});
