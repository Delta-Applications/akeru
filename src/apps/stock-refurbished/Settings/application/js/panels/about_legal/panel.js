/* global SettingsSoftkey */
/**
 * Used to show about legal panel
 */
define(['require','modules/settings_panel','shared/settings_listener'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function ctor_about_legal_panel() {
    let elements = null;
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
          method: function() {}
        }]
      };

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function updateLyfItem(value) {
      if (value) {
        elements.lyfCertificateItem.classList.remove('hidden');
        elements.lyfPrivacyItem.classList.remove('hidden');
      } else {
        elements.lyfCertificateItem.classList.add('hidden');
        elements.lyfPrivacyItem.classList.add('hidden');
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    return SettingsPanel({
      onInit: function (panel) {
        elements = {
          lyfCertificateItem: panel.querySelector('#lyf-certificate-item'),
          lyfPrivacyItem: panel.querySelector('#lyf-privacy-item')
        };
        //miaoyj modify for LIO-571:Show India SAR start
        navigator.customization.getValue("feature.jrdelabel.sar.on").then((result) => {
          dump("feature.jrdelabel.sar.on = " + result);
          var sar_result = (result == undefined) ? false : result;
          var healthLegal = panel.querySelector('#_health_Legal');
          if(sar_result){
            healthLegal.classList.remove('hidden');
          }else{
             healthLegal.classList.add('hidden');
          }
        });
        //miaoyj modify for LIO-571:Show India SAR end

      },
      onBeforeShow: function() {
        SettingsListener.observe('legal.lyf.show', false, updateLyfItem);
        _initSoftKey();
      },

      onBeforeHide: function() {
        SettingsListener.unobserve('legal.lyf.show', updateLyfItem);
      }
    });
  };
});
