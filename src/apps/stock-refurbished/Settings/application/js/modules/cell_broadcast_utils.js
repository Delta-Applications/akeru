/* global SettingsSoftkey, DUMP, Settings*/
define(['require','shared/settings_listener'],function(require) {
  

  let SettingsListener = require('shared/settings_listener');
  /** GSM or CDMA map table **/
  const NETWORK_TYPE_GSM = 'gsm';
  const NETWORK_TYPE_CDMA = 'cdma';
  const NETWORK_TYPE_UNKNOWN = 'unknown';
  const CB_CHANNEL_TYPE_CUSTOM = 'custom';
  const CB_CHANNEL_TYPE_PRESET = 'preset';
  /* TODO: GSM NETWORK TYPE */
  const RADIO_TECH_GPRS = 'gprs';
  const RADIO_TECH_EDGE = 'edge';
  const RADIO_TECH_UMTS = 'umts';
  const RADIO_TECH_HSDPA = 'hsdpa';
  const RADIO_TECH_HSUPA = 'hsupa';
  const RADIO_TECH_HSPA = 'hspa';
  const RADIO_TECH_LTE = 'lte';
  const RADIO_TECH_HSPAP = 'hspa+';
  const RADIO_TECH_TD_SCDMA = 'tdscdma';
  const RADIO_TECH_GSM = 'gsm';
  /* TODO: CDMA NETWORK TYPE */
  const RADIO_TECH_IS95A = 'is95a';
  const RADIO_TECH_IS95B = 'is95b';
  const RADIO_TECH_1xRTT = '1xrtt';
  const RADIO_TECH_EVDO_0 = 'evdo0';
  const RADIO_TECH_EVDO_A = 'evdoa';
  const RADIO_TECH_EVDO_B = 'evdob';
  const RADIO_TECH_EHRPD = 'ehrpd';

  let CBS_SERACHLIST_KEY = 'ril.cellbroadcast.searchlist';
  let CBS_PRESET_KEY = 'ril.cellbroadcast.preset.channelslist';
  let CBS_CUSTOM_KEY = 'ril.cellbroadcast.custom.channelslist';
  let curPanleId = '#cell-channels-config';

  let CellBroadcastUtilsHelper = (function ListFocusHelper() {
    let DEBUG = true;
    let FileName = '<!-- CBTAG:: cell_broadcast_utils.js -->';

    function debug() {
      if (DEBUG) {
        console.log('[' + FileName + '] ' + Array.slice(arguments).concat());
      } else if (window.DUMP) {
        DUMP('[' + FileName + '] ' + Array.slice(arguments).concat());
      }
    }

    function deepCopy(obj) {
      let newObjct = {};
      if (obj instanceof Array) {
        newObjct = [];
      }

      for (let key in obj) {
        let val = obj[key];
        newObjct[key] = typeof val === 'object' ? deepCopy(val) : val;
      }
      return newObjct;
    }

    function dispatchEvent(name, options) {
      let evt = new CustomEvent(name, options);
      window.dispatchEvent(evt);
    }

    function getCurSimlot() {
      let serviceId = window.DsdsSettings.getIccCardIndexForCallSettings();
      return serviceId;
    }

    /**
     * For example as the follow:
     * [{'gsm' : "1, 2, 4-6", 'cdma' : "1, 50, 99"}, {'cdma' : "3, 6, 8-9"}]
     */
    function observeDbState() {
      SettingsDBCache.observe(CBS_CUSTOM_KEY, [], handleSettingsDbChanged);
      SettingsDBCache.observe(CBS_PRESET_KEY, [], handleSettingsDbChanged);
    }

    function unObserveDbState() {
      SettingsDBCache.unObserve(CBS_CUSTOM_KEY, handleSettingsDbChanged);
      SettingsDBCache.unObserve(CBS_PRESET_KEY, handleSettingsDbChanged);
    }

    function handleSettingsDbChanged() {
      return new Promise((resolve) => {
        let lset = [{}, {}];
        getSettingsDbData().then((sResult) => {
          debug('handleSettingsDbChanged::sResult -> ' +
            JSON.stringify(sResult));
          if (!Array.isArray(sResult.allChannels)) {
            return;
          }

          Array.prototype.forEach.call((sResult.allChannels), (channel) => {
            let index = channel.simLots;
            if (channel.enabled) {
              if (channel.isGSM) {
                if (lset[index]['gsm']) {
                  lset[index]['gsm'] =
                    lset[index]['gsm'] + ',' + channel.channelId;
                } else {
                  lset[index]['gsm'] = channel.channelId;
                }
              } else {
                if (lset[index]['cdma']) {
                  lset[index]['cdma'] =
                    lset[index]['cdma'] + ',' + channel.channelId;
                } else {
                  lset[index]['cdma'] = channel.channelId;
                }
              }
            }
          });
          debug('handleSettingsDbChanged lset -> ' + JSON.stringify(lset));
          let cset = {};
          cset[CBS_SERACHLIST_KEY] = lset;
          SettingsListener.getSettingsLock().set(cset);
          resolve(lset);
        });
      });
    }

    function getSettingsDbData() {
      return new Promise((resolve) => {
        return SettingsDBCache.getSettings((result) => {
          let presetResult = deepCopy(result[CBS_PRESET_KEY]);
          let customResult = deepCopy(result[CBS_CUSTOM_KEY]);
          let channelsList = presetResult.concat(customResult);
          let returnResult = {
            allChannels: channelsList,
            preset: presetResult,
            custom: customResult
          };
          resolve(returnResult);
        });
      });
    }

    // compare both object
    function isSameValue(origin, target) {
      if (typeof target === 'object') {
        if (typeof origin !== 'object') {
          return false;
        }

        for (let key of Object.keys(target)) {
          if (!isSameValue(origin[key], target[key])) {
            return false;
          }
        }
        return true;
      } else {
        return origin === target;
      }
    }

    function updateCbChanelsSet(type, oChannel, nChannel, lset) {
      debug('updateCbChanelsSet::oChannel -> ' + JSON.stringify(oChannel));
      debug('updateCbChanelsSet::nChannel -> ' + JSON.stringify(nChannel));
      let updateSet = false;
      let isCustomCb = (oChannel.channelType === CB_CHANNEL_TYPE_CUSTOM);
      let isSameCb = (!isSameValue(oChannel, nChannel) &&
        oChannel.channelId === nChannel.channelId &&
        oChannel.channelType === nChannel.channelType);
      let include =
        includeExistedChannelInDB(oChannel, nChannel, lset);
      let allowUpdate = (isCustomCb && !include) ||
        (type === 'edit' && include && isSameCb);

      debug('updateCbChanelsSet::allowUpdate -> ' + allowUpdate);
      debug('updateCbChanelsSet::lset before -> ' + JSON.stringify(lset));
      let cIndex = Array.prototype.findIndex.call((lset), (els) => {
        return isSameValue(els, oChannel);
      });
      let vIndex = Array.prototype.findIndex.call((lset), (els) => {
        return isSameValue(els, nChannel);
      });

      debug('updateCbChanelsSet::cIndex -> ' + cIndex +
        ', vIndex -> ' + vIndex);
      if (cIndex !== -1 && allowUpdate) {
        updateSet = true;
        if (vIndex !== -1) {
          lset.splice(cIndex, 1);
        } else {
          lset.splice(cIndex, 1, nChannel);
        }
      }
      debug('updateCbChanelsSet::lset after-> ' + JSON.stringify(lset));
      return updateSet;
    }

    function includeExistedChannelInDB(oChannel, nChannel, set) {
      let include = Array.prototype.some.call((set), (channel) => {
        if (nChannel.channelId && nChannel.channelId.indexOf('-') > 0) {
          let limitRange = nChannel.channelId.split('-');
          let minBound = parseInt(limitRange[0]);
          let maxBound = parseInt(limitRange[1]);

          if (channel.channelId.indexOf('-') > 0) {
            let olimitRange = channel.channelId.split('-');
            let ominBound = parseInt(olimitRange[0]);
            let omaxBound = parseInt(olimitRange[1]);

            /* TODO: For Example: 3-6, 1-8 */
            let filter1 = (minBound <= ominBound && maxBound >= omaxBound &&
              (nChannel.channelId !== ominBound + '-' + omaxBound));
            /* TODO: For Example: 3-6, 1-5 */
            let filter2 = (minBound <= ominBound &&
              maxBound >= ominBound && maxBound <= omaxBound &&
              (nChannel.channelId !== minBound + '-' + omaxBound));
            /* TODO: For Example: 3-6, 5-8 */
            let filter3 = (minBound >= ominBound &&
              minBound <= omaxBound && maxBound >= omaxBound &&
              (nChannel.channelId !== ominBound + '-' + maxBound));
            /* TODO: For Example: 3-6, 4-5/3-6 */
            let filter4 = (ominBound <= minBound && omaxBound >= maxBound);

            return filter1 || filter2 || filter3 || filter4;
          } else {
            /* TODO: For Example: 5, 3-6 */
            let oChannelId = parseInt(channel.channelId);
            return (oChannelId >= minBound && oChannelId <= maxBound);
          }
        } else {
          if (channel.channelId.indexOf('-') > 0) {
            let olimitRange = channel.channelId.split('-');
            let ominBound = parseInt(olimitRange[0]);
            let omaxBound = parseInt(olimitRange[1]);

            let nChannelId = parseInt(nChannel.channelId);
            /* TODO: For Example: 3-6, 5 */
            return (nChannelId >= ominBound && nChannelId <= omaxBound);
          } else {
            /* TODO: For Example: 5, 5 */
            return nChannel.channelId === channel.channelId;
          }
        }
      });

      return include;
    }

    function isUpdateCbChannelsDB(key, type, nChannel, oChannel) {
      debug('isUpdateCbChannelsDB::nChannel.channelId -> ' + nChannel.channelId);
      return new Promise((resolve) => {
        getSettingsDbData().then((sResult) => {
          debug('isUpdateCbChannelsDB::sResult -> ' + JSON.stringify(sResult));
          if (!Array.isArray(sResult.allChannels)) {
            return;
          }

          let isContainCb = false, isUpdateCbDb = false;
          let aset = [].concat(sResult.allChannels);
          let cset = [].concat(sResult.custom);
          let pset = [].concat(sResult.preset);
          let iterations = Array.prototype.filter.call((aset), (channel) => {
            if (type === 'edit') {
              return (nChannel.simLots === channel.simLots &&
                !isSameValue(oChannel, channel));
            } else {
              return nChannel.simLots === channel.simLots;
            }
          });
          debug('iterations='+JSON.stringify(iterations));

          if (nChannel.channelId && nChannel.channelId.indexOf('-') > 0) {
            Array.prototype.forEach.call((iterations), (channel) => {
              let limitRange = nChannel.channelId.split('-');
              let minBound = parseInt(limitRange[0]);
              let maxBound = parseInt(limitRange[1]);
              let filter = channel.channelId !== nChannel.channelId;

              debug('isUpdateCbChannelsDB::[nChannel, channel] 1 -> [ ' +
                nChannel.channelId + ', '　+ channel.channelId + ' ]');

              if (channel.channelId.indexOf('-') > 0) {
                let olimitRange = channel.channelId.split('-');
                let ominBound = parseInt(olimitRange[0]);
                let omaxBound = parseInt(olimitRange[1]);

                /* TODO: For Example: 3-6, 1-8 */
                let filter1 = (minBound <= ominBound && maxBound >= omaxBound &&
                  (nChannel.channelId !== ominBound + '-' + omaxBound));
                /* TODO: For Example: 3-6, 1-5 */
                let filter2 = (minBound <= ominBound &&
                  maxBound >= ominBound && maxBound <= omaxBound &&
                  (nChannel.channelId !== minBound + '-' + omaxBound));
                /* TODO: For Example: 3-6, 5-8 */
                let filter3 = (minBound >= ominBound &&
                  minBound <= omaxBound && maxBound >= omaxBound &&
                  (nChannel.channelId !== ominBound + '-' + maxBound));
                /* TODO: For Example: 3-6, 4-5/3-6 */
                let filter4 = (ominBound <= minBound && omaxBound >= maxBound);
                let isSameCb = !isSameValue(channel, nChannel) &&
                  channel.channelId === nChannel.channelId ||
                  isSameValue(channel, nChannel);

                debug('isUpdateCbChannelsDB::filter -> [ ' + filter + ', ' +
                  filter1 + ', ' + filter2 + ', ' +
                  filter3 + ', ' + filter4 + ' ]');

                if (filter1 || filter2 || filter3 || filter4) {
                  if ('add' === type ||
                    ('edit' === type && isSameCb &&
                    !isSameValue(oChannel, nChannel))) {
                    isContainCb = true;
                  } else {
                    let change = updateCbChanelsSet(
                      type, channel, nChannel, iterations);
                    if (filter) {
                      isUpdateCbDb = true;
                    }
                    debug('isUpdateCbChannelsDB::change -> ' + change);
                    isContainCb = !change;
                  }
                }
              } else {
                let oldChannelId = parseInt(channel.channelId);
                /* TODO: For Example: 3, 1-5 */
                if (oldChannelId >= minBound && oldChannelId <= maxBound) {
                  let include =
                    includeExistedChannelInDB(channel, nChannel, iterations);
                  debug('isUpdateCbChannelsDB::include 1 -> ' + include);
                  if (include && 'add' === type) {
                    isContainCb = true;
                  } else {
                    let change =
                      updateCbChanelsSet(type, channel, nChannel, iterations);
                    if (filter) {
                      isUpdateCbDb = true;
                    }
                    debug('isUpdateCbChannelsDB::change 1 -> ' + change);
                    isContainCb = !change;
                  }
                }
              }
            });

            aset = pset.concat(cset);
            debug('isUpdateCbChannelsDB::isContainCb 1 -> ' + isContainCb);
            let returnResult = {
              preset: pset,
              custom: cset,
              channel: isContainCb ? oChannel : nChannel,
              allChannels: aset,
              allow: !isContainCb,
              update: isUpdateCbDb,
            };
            resolve(returnResult);
          } else {
            isContainCb = Array.prototype.some.call((iterations), (channel) => {
              debug('isUpdateCbChannelsDB::[nChannel, channel] 2 -> [ ' +
                nChannel.channelId + ', ' + channel.channelId + ' ]');
              let filter = !isSameValue(nChannel, channel) &&
                channel.channelId === nChannel.channelId;
              debug('isUpdateCbChannelsDB::filter 2 -> ' + filter);
              if (channel.channelId.indexOf('-') > 0) {
                let olimitRange = channel.channelId.split('-');
                let ominBound = parseInt(olimitRange[0]);
                let omaxBound = parseInt(olimitRange[1]);
                let nlimitBound = parseInt(nChannel.channelId);

                /*TODO: For Example: 1-5, 3*/
                if (nlimitBound >= ominBound && nlimitBound <= omaxBound) {
                  //reject('This channel has exist, must not add/edit it');
                  isContainCb = true;
                  resolve(true);
                } else if (filter) {
                  let change = updateCbChanelsSet(type,
                    channel, nChannel, iterations);
                  isContainCb = !change;
                }
              } else {
                if ((isSameValue(channel, nChannel) && 'add' === type) ||
                  (filter && 'add' === type) ||
                  (isSameValue(channel, nChannel) &&
                  !isSameValue(oChannel, nChannel) && 'edit' === type) ||
                  (filter && !isSameValue(oChannel, nChannel) &&
                  'edit' === type)) {
                  //reject('This channel has exist, must not add/edit it');
                  resolve(true);
                } else if (filter) {
                  let change =
                    updateCbChanelsSet(type, channel, nChannel, iterations);
                  debug('isUpdateCbChannelsDB::change 2 -> ' + change);
                  isContainCb = !change;
                }
              }
            });
            aset = pset.concat(cset);
            debug('isUpdateCbChannelsDB::isContainCb 2 -> ' + isContainCb);
            let returnResult = {
              preset: pset,
              custom: cset,
              channel: isContainCb ? oChannel : nChannel,
              allChannels: aset,
              allow: !isContainCb,
              update: isUpdateCbDb,

            };
            resolve(returnResult);
          }
        });
      });
    }

    /**
    * <li role="menuitem" class="none-select">
    *   <label class="pack-checkbox">
    *     <input type="checkbox"
    *     name="ril.cellbroadcast.enabled" disabled="true">
    *     <span data-l10n-id="">CB channel</span>
    *     <small data-l10n-args="" data-l10n-id="channel-id"
    *     class="menu-item-desc">50</small>
    *   </label>
    * </li>
    *
    * */

    function genChannelTemplate(itemData) {
      let liItem = document.createElement('li');
      let lableItem = document.createElement('label');
      let inputItem = document.createElement('input');
      let spanItem = document.createElement('span');
      let smallItem = document.createElement('small');

      liItem.setAttribute('role', 'menuitem');
      liItem.dataset.channelId = itemData.channelId;
      liItem.dataset.channelType = itemData.channelType;
      liItem.dataset.channelName = itemData.channelName;
      if (itemData.hasOwnProperty('disabled')) {
        if (itemData.disabled) {
          liItem.setAttribute('class', 'none-select');
          inputItem.setAttribute('disabled', 'true');
        }
      } else {
        itemData.disabled = false;
      }

      lableItem.setAttribute('class', 'pack-checkbox');
      lableItem.classList.add('full-string');
      inputItem.setAttribute('type', 'checkbox');
      if (!itemData.hasOwnProperty('enabled')) {
        itemData.enabled = true;
      }
      inputItem.checked = itemData.enabled;
      inputItem.setAttribute('checked', itemData.enabled);
      let channelName = itemData.channelName || 'CB channel';
      spanItem.textContent = channelName;
      smallItem.setAttribute('class', 'menu-item-desc');
      smallItem.setAttribute('style', 'width: 80%');
      smallItem.setAttribute('data-l10n-id', 'channel-id');
      smallItem.setAttribute('data-l10n-args', JSON.stringify({
        channelId: itemData.channelId
      }));

      lableItem.appendChild(inputItem);
      lableItem.appendChild(spanItem);
      lableItem.appendChild(smallItem);
      liItem.appendChild(lableItem);

      return liItem;
    }

    function checkGsm() {
      let nType = getNetworkType();
      return nType === NETWORK_TYPE_GSM;
    }

    function isGsm(radioTechnology) {
      return radioTechnology === RADIO_TECH_GPRS ||
        radioTechnology === RADIO_TECH_EDGE ||
        radioTechnology === RADIO_TECH_UMTS ||
        radioTechnology === RADIO_TECH_HSDPA ||
        radioTechnology === RADIO_TECH_HSUPA ||
        radioTechnology === RADIO_TECH_HSPA ||
        radioTechnology === RADIO_TECH_LTE ||
        radioTechnology === RADIO_TECH_HSPAP ||
        radioTechnology === RADIO_TECH_TD_SCDMA ||
        radioTechnology === RADIO_TECH_GSM;
    }

    function isCdma(radioTechnology) {
      return radioTechnology === RADIO_TECH_IS95A ||
        radioTechnology === RADIO_TECH_IS95B ||
        radioTechnology === RADIO_TECH_1xRTT ||
        radioTechnology === RADIO_TECH_EVDO_0 ||
        radioTechnology === RADIO_TECH_EVDO_A ||
        radioTechnology === RADIO_TECH_EVDO_B ||
        radioTechnology === RADIO_TECH_EHRPD;
    }

    function getNetworkType() {
      let serviceId = getCurSimlot();
      let mobileConnection = navigator.mozMobileConnections[serviceId];
      let networkType = mobileConnection.data.type;
      debug('getNetworkType::networkType -> ' + networkType);
      if (isGsm(networkType)) {
        return NETWORK_TYPE_GSM;
      } else if (isCdma(networkType)){
        return NETWORK_TYPE_CDMA;
      } else {
        return NETWORK_TYPE_UNKNOWN;
      }
    }

    function repairCbChanel(channel) {
      if (!channel) {
        return null;
      }

      let nType = getNetworkType();
      channel.isGSM = (nType === NETWORK_TYPE_GSM) ? true : false;
      let cbChannel = {};
      cbChannel.simLots =
        channel.hasOwnProperty('simLots') ? channel.simLots : getCurSimlot();
      cbChannel.channelType =
        channel.hasOwnProperty('channelType') ? channel.channelType : 'custom';
      cbChannel.channelId =
        channel.hasOwnProperty('channelId') ? channel.channelId : 0;
      cbChannel.channelName =
        channel.hasOwnProperty('channelName') ?
        channel.channelName : 'CB channel';
      cbChannel.isGSM =
        channel.hasOwnProperty('isGSM') ? channel.isGSM : true;
      cbChannel.enabled =
        channel.hasOwnProperty('enabled') ? channel.enabled : true;
      cbChannel.disabled =
        channel.hasOwnProperty('disabled') ? channel.disabled : false;

      return cbChannel;
    }

    function getChannelsList(key) {
      return new Promise((resolve) => {
        SettingsDBCache.getSettings((result) => {
          let results = deepCopy(result[key]);
          resolve(results);
        });
      });
    }

    function setChannelsList(key, type, oChannel, nChannel) {
      return new Promise((resolve) => {
        return isUpdateCbChannelsDB(key, type, nChannel, oChannel)
          .then((result) => {
          debug('setChannelsList::result -> ' + JSON.stringify(result));
          debug('setChannelsList::allow -> ' + result.allow);
          debug('setChannelsList::update -> ' + result.update);
          if (result.allow) {
            let CBS_TYPE = (key === CBS_PRESET_KEY) ?
              CB_CHANNEL_TYPE_PRESET : CB_CHANNEL_TYPE_CUSTOM;
            let matchChannelList = result[CBS_TYPE];
            let channelList = [].concat(matchChannelList);
            if (!result.update) {
              channelList.push(nChannel);
            } else if (!matchChannelList.length ||
              !matchChannelList.find((channel) => channel === result.channel)) {
              channelList = channelList.concat(result.channel);
            }

            let cset = {};
            cset[key] = channelList;
            SettingsListener.getSettingsLock().set(cset);
            resolve(result);
          } else {
            resolve(result);
          }
        });
      });
    }

    function modifyChannelsList(key, type, oChannel, nChannel) {
      return new Promise((resolve) => {
        return isUpdateCbChannelsDB(key, type, nChannel, oChannel)
          .then((result) => {
          debug('modifyChannelsList::result -> ' + JSON.stringify(result));
          debug('modifyChannelsList::allow -> ' + result.allow);
          debug('modifyChannelsList::update -> ' + result.update);
          if (result.allow) {
            let CBS_TYPE = (key === CBS_PRESET_KEY) ?
              CB_CHANNEL_TYPE_PRESET : CB_CHANNEL_TYPE_CUSTOM;
            let matchChannelList = result[CBS_TYPE];
            let channelList = [].concat(matchChannelList);
            if (!result.update) {
              Array.prototype.forEach.call((channelList),
                (curChannel, index) => {
                if (curChannel.channelId === oChannel.channelId) {
                  channelList.splice(index, 1, nChannel);
                }
              });
            }

            debug('modifyChannelsList::channelList -> ' +
              JSON.stringify(channelList));

            let cset = {};
            cset[key] = channelList;
            SettingsListener.getSettingsLock().set(cset);
            resolve(result);
          } else {
            resolve(result);
          }
        });
      });
    }

    function createAllChannelPanels(curPanleId, value) {
      return new Promise((resolve) => {
        getSettingsDbData().then((result) => {
          let channels = value ? value : result.allChannels;
          if (!channels.length) {
            return resolve(channels);
          }

          let fResult = Array.prototype.filter.call((channels), (channel) => {
            return channel.simLots === getCurSimlot();
          });

          if (!fResult.length) {
            return resolve(fResult);
          }

          Array.prototype.forEach.call((fResult), (channel, index) => {
            createChannelPanel(channel);
            if (index === fResult.length - 1) {
              return resolve(fResult);
            }
          });
        });
      });
    }

    function displayCbChannels(curPanleId, value) {
      return new Promise((resolve) => {
        clearChannelPanel(curPanleId);
        createAllChannelPanels(curPanleId, value).then((result) => {
          return resolve();
        });
      });
    }

    /**
     * {
     *   "simLots":0,
     *   "channelType":"custom",
     *   "channelId":"60",
     *   "channelName":"CB channel",
     *   "isGSM":true,
     *   "enabled":true,
     *   "disabled": false
     * }
    */
    function addChannelToCbList(type, oChannel, nChannel) {
      let cb_oChannel = repairCbChanel(oChannel);
      let cb_nChannel = repairCbChanel(nChannel);
      debug('addChannelToCbList::cb_oChannel -> ' +
        JSON.stringify(cb_oChannel));
      debug('addChannelToCbList::cb_nChannel -> ' +
        JSON.stringify(cb_nChannel));
      let CBS_KEY = cb_nChannel.channelType === CB_CHANNEL_TYPE_CUSTOM ?
        CBS_CUSTOM_KEY : CBS_PRESET_KEY;
      debug('addChannelToCbList::CBS_KEY -> ' + CBS_KEY);
      return setChannelsList(CBS_KEY, type, cb_oChannel, cb_nChannel);
    }

    function updateChannelToCbList(type, oChannel, nChannel) {
      debug('updateChannelToCbList::oChannel -> ' + JSON.stringify(oChannel));
      debug('updateChannelToCbList::nChannel -> ' + JSON.stringify(nChannel));
      let CBS_KEY = oChannel.channelType === CB_CHANNEL_TYPE_CUSTOM ?
        CBS_CUSTOM_KEY : CBS_PRESET_KEY;
      debug('updateChannelToCbList::CBS_KEY -> ' + CBS_KEY);
      return modifyChannelsList(CBS_KEY, type, oChannel, nChannel);
    }

    function delChannelFromCbList(channel) {
      debug('delChannelFromCbList::channel -> ' + JSON.stringify(channel));
      return new Promise((resolve) => {
        let CBS_KEY = channel.channelType === CB_CHANNEL_TYPE_CUSTOM ?
          CBS_CUSTOM_KEY : CBS_PRESET_KEY;
        debug('delChannelFromCbList::CBS_KEY -> ' + CBS_KEY);
        return getChannelsList(CBS_KEY).then((cbResult) => {
          Array.prototype.forEach.call((cbResult), (curChannel, index) => {
            if (curChannel.channelId === channel.channelId) {
              cbResult.splice(index, 1);
            }
          });
          debug('delChannelFromCbList::cbResult -> ' +
            JSON.stringify(cbResult));

          let cset = {};
          cset[CBS_KEY] = cbResult;
          SettingsListener.getSettingsLock().set(cset);
          resolve(cbResult);
        });
      });
    }

    function createChannelPanel(channel) {
      if (!channel) {
        return;
      }

      let root = document.querySelector('#cell-channels-config ul');
      let channelItem = genChannelTemplate(channel);
      let listFragment = document.createDocumentFragment();
      listFragment.appendChild(channelItem);
      root.appendChild(listFragment);
    }

    function clearChannelPanel(id) {
      let dom = document.querySelector(id + ' ul');
      let liNodes = document.querySelectorAll(id + ' ul li');
      Array.prototype.forEach.call((liNodes), (node) => {
        if (node) {
          dom.removeChild(node);
        }
      });
    }

    function editChannlePanel(oChannel, nChannel) {
      let parentNodeItem =
        document.querySelector(curPanleId + ' ul');
      let oldChildItem =
        document.querySelector(curPanleId +
        ' li[data-channel-id="' + oChannel.channelId + '"]');
      let newChildItem = genChannelTemplate(nChannel);
      newChildItem.querySelector('input').checked = oChannel.enabled;
      parentNodeItem.replaceChild(newChildItem, oldChildItem);
    }

    function saveChannelToDB(oChannel, nChannel) {
      return new Promise((resolve, reject) => {
        return addChannelToCbList('add', oChannel, nChannel).then((result) => {
          debug('saveChannelToDB allow -> ' + result.allow +
            ', update -> ' + result.update);
          if (result.allow) {
            if (result.update) {
              dispatchEvent('update-channel-config', {
                detail: {
                  focusChannel: result.channel
                }
              });
              resolve(result);
            } else {
              createChannelPanel(nChannel);
              let aset = [].concat(result.allChannels);
              let nset = [].concat(nChannel);
              aset = aset.concat(nset);
              resolve(aset);
            }
          } else {
            showToast('add-channel-failure');
            resolve();
          }
        });
      });
    }

    function modifyChannelFromDB(oChannel, nChannel) {
      nChannel = repairCbChanel(nChannel);
      debug('modifyChannelFromDB:: nChannel -> ' + JSON.stringify(nChannel));
      return new Promise((resolve, reject) => {
        updateChannelToCbList('edit', oChannel, nChannel).then((result) => {
          if (result.allow) {
            if (result.update) {
              dispatchEvent('update-channel-config', {
                detail: {
                  focusChannel: result.channel
                }
              });
              showToast('changessaved');
              resolve(result);
            } else {
              editChannlePanel(oChannel, nChannel);
              let aset = [].concat(result.allChannels);

              Array.prototype.forEach.call((aset), (channel, index) => {
                if (isSameValue(channel, oChannel)) {
                  aset.splice(index, 1, nChannel);
                }
              });
              showToast('changessaved');
              resolve(aset);
            }
          } else {
            showToast('edit-channel-failure');
            resolve();
          }
        });
      });
    }

    function findNeedFocusNode(navId) {
      let focusedNode = document.querySelector(curPanleId + ' li.focus');
      if (!focusedNode) {
        return;
      }
      let currentNavId = focusedNode.getAttribute('data-nav-id');
      if (!navId) {
        let previousNavId = focusedNode.style.getPropertyValue('--nav-up');
        let nextNavId = focusedNode.style.getPropertyValue('--nav-down');
        navId = currentNavId > nextNavId ? previousNavId : nextNavId;
      }
      debug('findNeedFocusNode::navId -> ' + navId);

      let liNodes = document.querySelectorAll(curPanleId + ' ul > li');
      let needFocusNode = null;
      if (liNodes) {
        for (let i = 0, len = liNodes.length; i < len; i++) {
          debug('findNeedFocusNode::liNodes['+i+'] -> ' +
            liNodes[i].getAttribute('data-nav-id'));
          if (liNodes[i].getAttribute('data-nav-id') === navId) {
            needFocusNode = liNodes[i];
            break;
          }
        }
      }
      return needFocusNode;
    }

    function removeChannelFromDB(curChannel) {
      return new Promise((resolve) => {
        let dom = document.querySelector(curPanleId + ' ul');
        let node = document.querySelector(curPanleId + ' li.focus');
        debug('removeChannelFromDB::curChannel -> ' +
          JSON.stringify(curChannel));
        let nextFocusNode = findNeedFocusNode();
        debug('removeChannelFromDB::nextFocusNode -> ' +
          JSON.stringify(nextFocusNode));

        if (node) {
          dom.removeChild(node);
        }

        dispatchEvent('panelready', {
          detail: {
            current: '#cell-channels-config',
            needFocused: nextFocusNode
          }
        });

        return delChannelFromCbList(curChannel).then((channel) => {
          resolve(channel);
        });
      });
    }

    return {
      observe: observeDbState,
      unObserve: unObserveDbState,
      copy: deepCopy,
      checkGsm: checkGsm,
      curSimlot: getCurSimlot,
      getChannels: getChannelsList,
      setChannels: setChannelsList,
      showCbChannels: displayCbChannels,
      addChannel: createChannelPanel,
      clearChannel: clearChannelPanel,
      saveChannel: saveChannelToDB,
      editChannel: modifyChannelFromDB,
      deleteChannel: removeChannelFromDB
    };
  })();
  return CellBroadcastUtilsHelper;
});
