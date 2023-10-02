define(['require','modules/settings_panel','modules/settings_service','modules/cell_broadcast_utils'],function(require) {
  
  let SettingsPanel = require('modules/settings_panel');
  let SettingsService = require('modules/settings_service');
  let UtilsHelper = require('modules/cell_broadcast_utils');

  return function ctor_cell_channel_detail_panel() {
    let elements = {};
    let cbMode = null;
    let cbChannel = {};
    let simLots = UtilsHelper.curSimlot();
    let isGsm = UtilsHelper.checkGsm();
    let submitable = false;
    let skipUpdate = false;

    function initSoftkey(submitable) {
        let softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            method: function() {
              SettingsService.navigate('cell-channels-config', {
                type: cbMode,
                channel: cbChannel
              });
            }
          }]
        };

        let saveItem = {
          name: 'Save',
          l10nId: 'save',
          priority: 3,
          method: function() {
            let channelName = elements.channelTitleInput.value ?
              elements.channelTitleInput.value : 'CB channel';
            let channelIndex = elements.channelIndexInput.value;
            let enabled = cbMode === 'edit' ? cbChannel.enabled : true;
            let nChannel = {
              'simLots': simLots,
              'channelType': 'custom',
              'channelName': channelName,
              'channelId': channelIndex,
              'enabled': enabled
            };
            if (channelIndex) {
              if (cbMode === 'edit') {
                UtilsHelper.editChannel(cbChannel, nChannel).then((result) => {
                  SettingsService.navigate('cell-channels-config', {
                    type: 'edit',
                    value: result,
                    channel: result ? nChannel : cbChannel
                  });
                });
              } else if (cbMode === 'add') {
                UtilsHelper.saveChannel(null, nChannel).then((result) => {
                  SettingsService.navigate('cell-channels-config', {
                    type: 'add',
                    value: result,
                    channel: result ? nChannel : cbChannel
                  });
                });
              }
            }
          }
        };

        if (submitable) {
          softkeyParams.items.push(saveItem);
        }
        Array.prototype.sort.call(softkeyParams.items, (item1, item2) => {
          return item1.priority - item2.priority;
        });

        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      }

      function keydownHandler(evt) {
        switch (evt.key) {
          case 'ArrowUp':
          case 'ArrowDown':
          case 'Enter':
            let input = document.querySelector('li.focus input');
            if (input) {
              let cursorPos = input.value.length;
              input.focus();
              input.setSelectionRange(cursorPos, cursorPos);
            }
            break;
          default:
            break;
        }
      }

      function checkChannelInputs() {
        let reg = /(^\d+[-]\d+$|^\d+$)/gi;
        let regExp = new RegExp(reg);
        let titleEle = elements.channelTitleInput;
        let inputEle = elements.channelIndexInput;
        let iParams = inputEle.value;
        let tParams = titleEle.value;
        let matchRegExp = regExp.test(iParams);

        if (iParams === '' && tParams === '') {
          submitable = false;
        } else {
          if (matchRegExp) {
            if (iParams.indexOf('-') > 0) {
              let limitRange = iParams.split('-');
              let minBound = parseInt(limitRange[0]);
              let maxBound = parseInt(limitRange[1]);
              if (minBound < maxBound) {
                let minMatch = (0 <= minBound && minBound < 65536);
                let maxMatch = (0 <= maxBound && maxBound < 65536);
                if (minMatch && maxMatch) {
                  submitable = true;
                } else {
                  submitable = false;
                }
              } else {
                submitable = false;
              }
            } else {
              let inputValue = parseInt(iParams);
              if (0 <= inputValue && inputValue < 65536) {
                submitable = true;
              } else {
                submitable = false;
              }
            }
          } else {
            submitable = false;
          }
        }

        if (!submitable) { // input:invalid:focus
          inputEle.style.boxShadow = 'inset 0 -0.1rem 0 #820000';
          inputEle.style.borderBottomColor = '#820000';
          inputEle.style.color = '#b90000';
        } else {
          inputEle.style.boxShadow = '';
          inputEle.style.borderBottomColor = '';
          inputEle.style.color = '';
        }

        initSoftkey(submitable);
      }

    function addFocus(evt) {
      let inputItem = evt.target.querySelector('input');
      if (inputItem) {
        inputItem.focus();
      } 
    }

    function visibilityChange() {
      if (document.hidden) {
        skipUpdate = true;
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          header: panel.querySelector('gaia-header h1'),
          channelTitleInput: panel.querySelector('.channel-title'),
          channelIndexInput: panel.querySelector('.channel-index')
        };
      },

      onBeforeShow: function(panel, options) {
        if (!skipUpdate) {
          cbMode = options.type;
          if (cbMode === 'add' ) {
            elements.header.setAttribute('data-l10n-id', 'add-cell-channel');
            cbChannel = options.channel;
            cbChannel.simLots = simLots;
            cbChannel.isGSM = isGsm;
            elements.channelTitleInput.value = 'CB channel';
            elements.channelIndexInput.value = '';
            submitable = false;
          }

          if (cbMode === 'edit') {
            elements.header.setAttribute('data-l10n-id', 'edit-cell-channel');
            cbChannel = options.channel;
            cbChannel.simLots = simLots;
            cbChannel.isGSM = isGsm;
            elements.channelTitleInput.value = cbChannel.channelName;
            elements.channelIndexInput.value = cbChannel.channelId;
            submitable = true;
          }
        
          initSoftkey(submitable);
        }

        window.addEventListener('keydown', keydownHandler);
        elements.channelTitleInput.parentNode.addEventListener('focus',
          addFocus);
        elements.channelIndexInput.parentNode.addEventListener('focus',
          addFocus);
        elements.channelTitleInput.addEventListener('input',
          checkChannelInputs);
        elements.channelIndexInput.addEventListener('input',
          checkChannelInputs);
        checkChannelInputs();
        document.addEventListener('visibilitychange', visibilityChange);
      },
      onShow: function(panel) {
        if (!skipUpdate) {
          let liNodes = panel.querySelectorAll('li.focus');
          Array.prototype.forEach.call(liNodes, (liNode) => {
            liNode.classList.remove('focus');
          });
          let cursorPos = elements.channelTitleInput.value.length;
          elements.channelTitleInput.focus();
          elements.channelTitleInput.setSelectionRange(cursorPos, cursorPos);
          elements.channelTitleInput.parentNode.classList.add('focus');
        } else {
          skipUpdate = false;
        }
      },
      onBeforeHide: function() {
        window.removeEventListener('keydown', keydownHandler);
        elements.channelIndexInput.removeEventListener('input',
          checkChannelInputs);
        elements.channelTitleInput.removeEventListener('input',
          checkChannelInputs);
        document.removeEventListener('visibilitychange', visibilityChange);
      }
    });
  };
});
