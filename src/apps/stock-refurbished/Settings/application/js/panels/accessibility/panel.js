/**
 * The accessibility panel
 */
define(['require','modules/settings_panel','shared/settings_listener','panels/accessibility/slider_handler'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');
  var SliderHandler = require('panels/accessibility/slider_handler');

  return function ctor_accessibilityPanel() {
    var listElements = document.querySelectorAll('#accessibility li');
    var elements = {};
    var CAPTIONS_KEY = 'accessibility.captions';
    var SCREENREADER_KEY = 'accessibility.screenreader';
    var VOLUME_BALANCE_KEY = 'accessibility.volume_balance';
    var VOLUME_BALANCE_STRING =
      ['L5', 'L4', 'L3', 'L2', 'L1', '0', 'R1', 'R2', 'R3', 'R4', 'R5'];

    function _initSoftKey() {
      var params = {
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
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _updateCaptionsStatus(enabled) {
      var l10nId = enabled ? 'on' : 'off';
      elements.captionsDesc.setAttribute('data-l10n-id', l10nId);
    }

    function _updateReadoutStatus(enabled) {
      var l10nId = enabled ? 'on' : 'off';
      elements.readoutModeDesc.setAttribute('data-l10n-id', l10nId);
    }

    function _updateVolumeBalanceStatus(value) {
      var convertValue = value / 10;
      elements.volumebalanceDesc.setAttribute('data-l10n-id',
        'balance-' + VOLUME_BALANCE_STRING[convertValue]);
    }

    function _updateRttStatus(enabled) {
      var l10nId = enabled ? 'on' : 'off';
      elements.rttDesc.setAttribute('data-l10n-id', l10nId);
    }

    return SettingsPanel({
      onInit: function accessibilityPanel_onInit(panel) {
        elements = {
          captionsDesc: panel.querySelector('.captions small'),
          readOutMode: panel.querySelector('.readout-mode').parentNode,
          readoutModeDesc: panel.querySelector('.readout-mode small'),
          rttDesc: panel.querySelector('#rtt-desc'),
          volumeBalance: panel.querySelector('.slider-container'),
          volumebalanceDesc: panel.querySelector('.slider-container span.level'),
          volumebalanceContainer: panel.querySelector('.slider-container')
        };

        var volumebalance = SliderHandler();
        volumebalance.init(elements.volumebalanceContainer);
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('lowMemory') !== 'true' &&
            DeviceFeature.getValue('readout') === 'true') {
            elements.readOutMode.classList.remove('hidden');
          }
          if (DeviceFeature.getValue('rtt') === 'true') {
            let rttHeader = panel.querySelector('#rtt-header');
            let rttItem = panel.querySelector('#rtt-item');
            rttHeader.hidden = false;
            rttItem.hidden = false;
          }
        });

       //lijun add for LIO_786 hide TTY and HAC for LEO start
       let itemtty = panel.querySelector('li#tty');
       if (itemtty) {
           console.log(" accessibility...tty item.hidden>>>");
           itemtty.hidden = true;
       }

       let itemhac = panel.querySelector('li#hac.accessibility-hac');
       if (itemhac) {
           console.log(" accessibility...hac item.hidden>>>");
            itemhac.hidden = true;
       }
      //lijun add for LIO_786 hide TTY and HAC for LEO end
      
        elements.volumeBalance.onfocus = () => {
          elements.volumebalanceDesc.setAttribute('aria-live', 'assertive');
        };
        elements.volumeBalance.onblur = () => {
          elements.volumebalanceDesc.removeAttribute('aria-live');
        }
      },

      onBeforeShow: function(panel) {
        _initSoftKey();
        ListFocusHelper.updateSoftkey(panel);
        ListFocusHelper.addEventListener(listElements);
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements);
      },

      onShow: function() {
        SettingsListener.observe(CAPTIONS_KEY, false, _updateCaptionsStatus);

        SettingsListener.observe(SCREENREADER_KEY, false, _updateReadoutStatus);

        SettingsListener.observe(VOLUME_BALANCE_KEY, 50, _updateVolumeBalanceStatus);
        SettingsListener.observe('ril.rtt.enabled', false, _updateRttStatus);
      },

      onHide: function() {
        SettingsListener.unobserve(CAPTIONS_KEY, _updateCaptionsStatus);

        SettingsListener.unobserve(SCREENREADER_KEY, _updateReadoutStatus);

        SettingsListener.unobserve(VOLUME_BALANCE_KEY, _updateVolumeBalanceStatus);
        SettingsListener.unobserve('ril.rtt.enabled', _updateRttStatus);
      }
    });
  };
});
