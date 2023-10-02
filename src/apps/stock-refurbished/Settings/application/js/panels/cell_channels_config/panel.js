define(['require','modules/settings_panel','modules/settings_service','modules/cell_broadcast_utils'],function(require) {
  
  let SettingsPanel = require('modules/settings_panel');
  let SettingsService = require('modules/settings_service');
  let UtilsHelper = require('modules/cell_broadcast_utils');

  return function ctor_cell_channels_config_panel() {
    const CBS_CUSTOM_KEY = 'ril.cellbroadcast.custom.channelslist';
    let curPanleId = '#cell-channels-config';
    let listElements = null;
    let elements = {};
    let skipUpdate = false;

    let aSoftkeyParams = {
      menuClassName: 'menu-button',
      header: { l10nId: 'options' },
      items: [
        {
          name: 'Add channel',
          l10nId: 'add-channel',
          priority: 1,
          method: function () {
            let channelItem = getCurrentChannel();
            SettingsService.navigate('cell-channel-detail', {
              type: 'add',
              channel: channelItem
            });
          }
        }
      ]
    };

    let cSoftkeyParams = {
      menuClassName: 'menu-button',
      header: { l10nId: 'options' },
      items: [
        {
          name: 'Edit channel',
          l10nId: 'edit-channel',
          priority: 5,
          method: function () {
            let channelItem = getCurrentChannel();
            SettingsService.navigate('cell-channel-detail', {
              type: 'edit',
              channel: channelItem
            });
          }
        },
        {
          name: 'Delete channel',
          l10nId: 'delete-channel',
          priority: 6,
          method: function () {
            showConfirmDialog();
          }
        }
      ]
    };

    let deselectSoftkeyParams = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'options'
      },
      items: [{
        name: 'Deselect',
        l10nId: 'deselect',
        priority: 2,
        method: function() {}
      }]
    };
    let selectSoftkeyParams = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'options'
      },
      items: [{
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: function () {}
      }]
    };

    function showConfirmDialog() {
      let dialogConfig = {
        title: {id: 'cell-channels-delete', args: {}},
        body: {id: 'cell-channels-confirm', args: {}},
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Delete',
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            let channelItem = getCurrentChannel();
            UtilsHelper.deleteChannel(channelItem).then((channel) => {
              updateSoftkey();
            });
          }
        }
      };

      let dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function getCurrentChannel() {
      let focusedElement =
        document.querySelector(curPanleId + ' li.focus');
      let channelItem = {};
      if (focusedElement) {
        let input = focusedElement.querySelector('input');
        channelItem = {
          channelType: 'custom',
          channelName: focusedElement.dataset.channelName,
          channelId: focusedElement.dataset.channelId,
          enabled: input.checked,
          disabled: false
        };
      }
      return channelItem;
    }

    function dispalyEmptyContainer(display) {
      let lists = document.querySelectorAll(curPanleId +' li');
      if (display !== undefined) {
        elements.emptyListNode.hidden = !display;
      } else {
        if (!lists.length) {
          elements.emptyListNode.hidden = false;
        } else {
          elements.emptyListNode.hidden = true;
        }
      }
    }

    function genNewSoftkeyParams(softkeyParams, newSoftkey) {
      let newSoftkeyParams = UtilsHelper.copy(softkeyParams);
      if (!newSoftkey.items) {
        return softkeyParams;
      }

      newSoftkeyParams.items =
        newSoftkeyParams.items.concat(newSoftkey.items);
      Array.prototype.sort.call(newSoftkeyParams.items, (item1, item2) => {
        return item1.priority - item2.priority;
      });

      return newSoftkeyParams;
    }

    function updateSoftkey() {
      dispalyEmptyContainer();

      let focusedElement =
        document.querySelector(curPanleId + ' li.focus');
      let channelType =
        focusedElement && focusedElement.dataset.channelType;
      if (focusedElement && focusedElement.classList &&
        focusedElement.classList.contains('none-select')) {
        SettingsSoftkey.init(aSoftkeyParams);
        SettingsSoftkey.show();
        return;
      }

      let softkeyParams = UtilsHelper.copy(aSoftkeyParams);
      switch (channelType) {
        case 'custom':
          softkeyParams.items =
            softkeyParams.items.concat(cSoftkeyParams.items);
          break;
        case 'preset':
          break;
        default:
          break;
      }

      if (focusedElement) {
        if (focusedElement.querySelector('input') &&
          focusedElement.querySelector('input').checked) {
          SettingsSoftkey.init(
            genNewSoftkeyParams(softkeyParams, deselectSoftkeyParams));
        } else {
          SettingsSoftkey.init(
            genNewSoftkeyParams(softkeyParams, selectSoftkeyParams));
        }
      } else {
        SettingsSoftkey.init(softkeyParams);
      }
      SettingsSoftkey.show();
    }

    function visibilityChange() {
      if (document.hidden) {
        skipUpdate = true;
      }
    }

    function getFocusedNode(curChannel) {
      if (!curChannel) {
        return null;
      }
      let liNodes = document.querySelectorAll(curPanleId + ' ul > li');
      let needFocusNode = null;
      if (liNodes) {
        for (let i = 0, len = liNodes.length; i < len; i++) {
          if (liNodes[i].dataset.channelId === curChannel.channelId &&
            liNodes[i].dataset.channelType === curChannel.channelType) {
            needFocusNode = liNodes[i];
            break;
          }
        }
      }
      return needFocusNode;
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          emptyListNode: panel.querySelector('#empty-list')
        };
      },

      onBeforeShow: function(panel, options) {
        if (!skipUpdate) {
          let value = null;
          if (options && options.type) {
            value = options.value;
          }
          UtilsHelper.showCbChannels(curPanleId, value).then(() => {
            listElements = panel.querySelectorAll('li');
            ListFocusHelper.addEventListener(listElements, updateSoftkey);
            ListFocusHelper.updateSoftkey(panel);
            updateSoftkey();

            const checkBoxList = panel.querySelectorAll('input');
            checkBoxList.forEach((checkbox) => {
              checkbox.addEventListener('change', (evt) => {
                const { target } = evt;
                const { channelId } = target.parentNode.parentNode.dataset;
                updateSoftkey();
                UtilsHelper.getChannels(CBS_CUSTOM_KEY).then((cbResult) => {
                  Array.prototype.forEach.call(cbResult, (curChannel, index) => {
                    if (curChannel.channelId === channelId) {
                      cbResult[index].enabled = target.checked;
                    }
                  });
                  let cset = {};
                  cset[CBS_CUSTOM_KEY] = cbResult;
                  SettingsListener.getSettingsLock().set(cset);
                });
              });
            });
          });
        } else {
          skipUpdate = false;
        }

        document.addEventListener('visibilitychange', visibilityChange);
        UtilsHelper.observe();
      },

      onShow: function(panel, options) {
        let channel = null;
        if (options && options.type) {
          channel = options.channel;
        }
        let focusNode = getFocusedNode(channel);
        if (focusNode) {
          let focusedElement = panel.querySelector('.focus');
          if (focusedElement) {
            focusedElement.classList.remove('focus');
          }
          focusNode.classList.add('focus');
          NavigationMap.scrollToElement(focusNode, false);
        }
      },

      onBeforeHide: function() {
        listElements = document.querySelectorAll('li');
        ListFocusHelper.removeEventListener(listElements, updateSoftkey);
        document.removeEventListener('visibilitychange', visibilityChange);
        UtilsHelper.unObserve();
      }
    });
  };
});
