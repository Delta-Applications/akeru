
/*
 * SimUIModel is a helper to help us map real card status
 * into needed virtual status, and SimCardManager will
 * be responsible for reflecting these virtual status
 * into real UI.
 *
 * @module SimUIModel
 */
define('panels/simcard_manager/sim_ui_model',['require'],function(require) {
  

  var SimUIModel = function(cardIndex) {
    this._cardIndex = cardIndex;

    /*
     * We have following states and would try to reflect them on
     * related UI. Take `locked` state for example, it doesn't mean
     * that this SIM is locked (we have to access icc.cardState
     * to make sure the SIM is locked), instead, it means that
     * SimCardManager has to show a small `locker` icon on the screen.
     *
     * The reason why we need this Model is because UX needs different
     * look and feel based on different cardState, in this way, I
     * think this would be better to use separate propeties to reflect
     * each UI on the screen so that we can change them easily.
     */
    this._enabled = false;
    this._absent = false;
    this._locked = false;
    this._defaultName = {
      id: 'sim-with-index',
      args: {
        index: this._cardIndex + 1
      }
    };
    this._name = this._defaultName;
    this._operator = null;
  };

  SimUIModel.prototype = {
    /**
     * We can get useful information stored in SimUIModel like
     * enabled, absent ... etc
     *
     * @memberOf SimUIModel
     * @access public
     * @return {Object} information about current SimUIModel
     */
    getInfo: function() {
      var keys = [
        'enabled', 'absent', 'locked',
        'name', 'operator'
      ];

      var info = {};
      keys.forEach(function(key) {
        info[key] = this['_' + key];
      }.bind(this));

      return info;
    },

    /**
     * With this method, you can update states on current SimUIModel.
     *
     * @memberOf SimUIModel
     * @access public
     * @param {String} key
     * @param {Object} options
     */
    setState: function(key, options) {
      switch (key) {
        case 'nosim':
          this._enabled = false;
          this._absent = true;
          this._locked = false;
          this._operator = {
            id: 'noSimCard'
          };
          this._name = this._defaultName;
          break;

        case 'locked':
          this._enabled = false;
          this._absent = false;
          this._locked = true;
          this._operator = {
            id: 'sim-pin-locked'
          };
          this._name = this._defaultName;
          break;

        case 'blocked':
          this._enabled = true;
          this._absent = true;
          this._locked = false;
          this._operator = null;
          this._name = {
            id: 'noSimCard'
          };
          break;

        case 'normal':
          this._enabled = true;
          this._absent = false;
          this._locked = false;
          if (options.operator) {
            this._operator = {
              text: options.operator
            };
            var fullName = {
              id: 'sim-with-index-and-carrier',
              args: {
                carrier: options.operator,
                index: this._cardIndex + 1
              }
            };
            this._name = fullName;
          } else {
            this._operator = {
              id: 'no-operator'
            };
            this._name = this._defaultName;
          }
          break;
      }
    }
  };

  return function ctor_simUIModel(cardIndex) {
    return new SimUIModel(cardIndex);
  };
});

/**
 * SimCardManager is responsible for
 *   1. handling simcard UI
 *   2. handling simcard virtual status (please refer SimUIModel class)
 *   3. handling related mozSettings (please refer SimSettingsHelper class)
 *
 * @module SimCardManager
 */
/* global ConfirmDialogHelper */

define('panels/simcard_manager/simcard_manager',['require','shared/template','shared/sim_settings_helper','shared/airplane_mode_helper','shared/mobile_operator','panels/simcard_manager/sim_ui_model','shared/simslot_manager'],function(require) {
  

  var l10n = window.navigator.mozL10n;
  var Template = require('shared/template');
  var SimSettingsHelper = require('shared/sim_settings_helper');
  var AirplaneModeHelper = require('shared/airplane_mode_helper');
  var MobileOperator = require('shared/mobile_operator');
  var SimUIModel = require('panels/simcard_manager/sim_ui_model');

  //BDC zhangwp 20190416 add for IMS default configurations. begin
  var SIMSlotManager = require('shared/simslot_manager');
  //BDC zhangwp 20190416 add for IMS default configurations. end

  var SimCardManager = function(elements) {
    // we store all SimUIModel instances into this array
    this._elements = elements;
    this._simcards = [];
    this._isAirplaneMode = false;
    this._simItemTemplate = new Template(this._elements.simCardTmpl);
  };

  SimCardManager.prototype = {
    /**
     * Initiazlization
     *
     * @memberOf SimCardManager
     * @access public
     */
    init: function scm_init() {
      // `handleEvent` is used to handle these sim related changes
      this._elements.outgoingCallSelect.addEventListener('change', this);
      this._elements.outgoingMessagesSelect.addEventListener('change', this);

      // XXX because we handle `onchange` event differently in value selector,
      // in order to show confirm dialog after users changing value, the better
      // way right now is to check values when `onblur` event triggered.
      this._addOutgoingDataSelectEvent();
      this._addVoiceChangeEventOnConns();
      this._addCardStateChangeEventOnIccs();
      this._addLocalizedChangeEventOnIccs();

      // SMS app will directly change this value if users are going to
      // donwload specific sms from differnt simcard, so we have to
      // make sure our UI will reflect the right value at the moment.
      SimSettingsHelper.observe('outgoingData',
        this._outgoingDataChangeEvent.bind(this));

      // because in fugu, airplaneMode will not change cardState
      // but we still have to make UI consistent. In this way,
      // when airplaneMode is on in fugu, we have to mimic the nosim
      // situation in single sim.
      this._addAirplaneModeChangeEvent();

      this._isAirplaneMode =
        AirplaneModeHelper.getStatus() === 'enabled' ? true : false;

      // init UI
      this._initSimCardsInfo();
      this._initSimCardManagerUI();
    },

    /**
     * We will initialize SimUIModel and store them into our internal
     * variables.
     *
     * @memberOf SimCardManager
     * @access public
     */
    _initSimCardsInfo: function scm__initSimCardsInfo() {
      var conns = window.navigator.mozMobileConnections;
      for (var cardIndex = 0; cardIndex < conns.length; cardIndex++) {
        var conn = conns[cardIndex];
        var iccId = conn.iccId;
        var simcard = SimUIModel(cardIndex);
        this._simcards.push(simcard);
        this._updateCardState(cardIndex, iccId);
      }
    },

    /**
     * Handle incoming events
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Event} evt
     */
    handleEvent: function scm_handlEvent(evt) {
      var cardIndex = evt.target.value;

      // it means users is seleting '--' options
      // when _simcards are all disabled
      // cardIndex is a string value, while SimSettingsHelper.EMPTY_OPTION_VALUE
      // is a number, so this can not use `===` to map.
      if (cardIndex == SimSettingsHelper.EMPTY_OPTION_VALUE) {
        return;
      }

      switch (evt.target) {
        case this._elements.outgoingCallSelect:
          // reset the remember card iccId if user choose `always ask`
          // cardIndex is a string value,
          // while SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE
          // is a number, so this can not use `===` to map.
          if (cardIndex == SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE) {
            SimSettingsHelper._setToSettingsDB(
              'ril.telephony.defaultServiceId.iccId', null);
            SimSettingsHelper._setToSettingsDB(
              'ril.voicemail.defaultServiceId.iccId', null);
          }

          SimSettingsHelper.setServiceOnCard('outgoingCall', cardIndex);
          break;

        case this._elements.outgoingMessagesSelect:
          // reset the remember card iccId if user choose `always ask`
          // cardIndex is a string value,
          // while SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE
          // is a number, so this can not use `===` to map.
          if (cardIndex == SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE) {
            SimSettingsHelper._setToSettingsDB(
              'ril.sms.defaultServiceId.iccId', null);
            SimSettingsHelper._setToSettingsDB(
              'ril.mms.defaultServiceId.iccId', null);
          }

          SimSettingsHelper.setServiceOnCard('outgoingMessages', cardIndex)
          break;
      }
    },

    /**
     * Handle mozSettings change event for `outgoing data` key
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     */
    _outgoingDataChangeEvent: function scm__outgoingDataChangeEvent(cardIndex) {
      this._elements.outgoingDataSelect.value = cardIndex;
    },

    //BDC zhangwp 20190416 add for IMS default configurations. begin
    _updateIMSConfig: function scm__updateIMSConfig(cardIndex) {
      console.log('simcard_manager updateIMSConfig cardIndex: ' + cardIndex);

      let matchInfo = {
        "clientId": "0"
      };
      matchInfo.clientId = cardIndex;


      Promise.all([navigator.customization.getValueForCarrier(matchInfo, 'fih.volte.default.enable.bool'),
                  navigator.customization.getValueForCarrier(matchInfo, 'fih.vowifi.default.enable.bool'),
                  navigator.customization.getValueForCarrier(matchInfo, 'fih.volte.editable.bool'),
                  navigator.customization.getValueForCarrier(matchInfo, 'fih.vowifi.editable.bool')]).then(function(values) {
        let volteDefaultOn = JSON.stringify(values[0]) === 'true' ? true : false;
        let vowifiDefaultOn = JSON.stringify(values[1]) === 'true' ? true : false;
        let volteEditable = JSON.stringify(values[2]) === 'true' ? true : false;
        let vowifiEditable = JSON.stringify(values[3]) === 'true' ? true : false;
        console.log('simcard_manager updateIMSConfig : volteDefaultOn: ' + volteDefaultOn + ' vowifiDefaultOn: ' + vowifiDefaultOn + ' volteEditable: ' + volteEditable + ' vowifiEditable: ' + vowifiEditable);

        let sim = SIMSlotManager.getSlots()[cardIndex];
        let mccmnc = '';
        if (sim && sim.simCard != undefined && sim.simCard.iccInfo != undefined) {
          mccmnc = sim.simCard.iccInfo.mcc + "" + sim.simCard.iccInfo.mnc;
          navigator.mozSettings.createLock().set({'fih.cust.previous.primary.mccmnc': mccmnc})
          console.log('simcard_manager updateIMSConfig set primary to ' + mccmnc);
        }

        //[BTS-1960] BDC zhangwp 20190617 add for remove VoWiFi settings for SIM2. begin
        if(cardIndex == 1) {
          console.log('simcard_manager updateIMSConfig remove VoWiFi settings for SIM2');
          vowifiDefaultOn = false;
          vowifiEditable = false;
        }
        //[BTS-1960] BDC zhangwp 20190617 add for remove VoWiFi settings for SIM2. end

        if(volteDefaultOn === true && vowifiDefaultOn === true) {
          dump('simcard_manager updateIMSConfig: volte&vowifi menu show & toggle on');
          SettingsListener.getSettingsLock().set({
            'ril.ims.enabled': true
          });
          //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. begin
          //[BTS-2987] BDC zhangwp 20200306 add for DTAG
          if(mccmnc === '50503'
              || mccmnc === '26201'
              || mccmnc === '20201'
              //[LIO-1549] BDC zhangwp 20200915 add for Claro Colombia preferred mode. begin
              || mccmnc === '732101'
              //[LIO-1549] BDC zhangwp 20200915 add for Claro Colombia preferred mode. end
              //[LIO-1821] BDC zhangwp 20201022 add for Claro Guatemala Default IMS (VoWifi) mode. begin
              || mccmnc === '70401'
              //[LIO-1821] BDC zhangwp 20201022 add for Claro Guatemala Default IMS (VoWifi) mode. end
              //[LIO-384] BDC yuxin add for [MR][EURO][17_0276] VoWiFi Call Preferences dynamically set for Home and Roaming scenarios for DT affiliates
              || mccmnc === '23203' || mccmnc === '20416' || mccmnc === '20420' || mccmnc === '21630'
              //[LIO-395] BDC yuxin add for [MR][GAMEA][17_0158]Wifi preferred should not be selectable to end user
              || mccmnc === '28602'
            ) {
            dump('simcard_manager updateIMSConfig : special Carrier set call mode to cellular-preferred');
            SettingsListener.getSettingsLock().set({
              'ril.ims.preferredProfile': 'cellular-preferred'
            });
          } else {
            SettingsListener.getSettingsLock().set({
              'ril.ims.preferredProfile': 'wifi-preferred'
            });
          }
          //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. end
        } else if(volteDefaultOn === true && vowifiDefaultOn === false) {
          dump('simcard_manager updateIMSConfig: Volte toggle on & VoWiFi toggle off');
          SettingsListener.getSettingsLock().set({
            'ril.ims.enabled': true
          });
          SettingsListener.getSettingsLock().set({
            'ril.ims.preferredProfile': 'cellular-only'
          });
        } else if(volteDefaultOn === false && vowifiDefaultOn === true) {
          dump('simcard_manager updateIMSConfig: Volte toggle off & VoWiFi toggle on');
          SettingsListener.getSettingsLock().set({
            'ril.ims.enabled': true
          });
          SettingsListener.getSettingsLock().set({
            'ril.ims.preferredProfile': 'wifi-only'
          });
        } else {
          dump('simcard_manager updateIMSConfig: IMS set to disable');
          SettingsListener.getSettingsLock().set({
            'ril.ims.enabled': false
          });
        }

        if(volteEditable === false && vowifiEditable === false) {
          dump('simcard_manager updateIMSConfig : IMS menu hide');
          SettingsListener.getSettingsLock().set({
            'volte_vowifi_settings.show': false
          });
        } else {
          dump('simcard_manager updateIMSConfig : IMS menu show');
          SettingsListener.getSettingsLock().set({
            'volte_vowifi_settings.show': true
          });
        }
      });
    },
    //BDC zhangwp 20190416 add for IMS default configurations. end

    /**
     * Handle change event for `outgoing data` select
     *
     * @memberOf SimCardManager
     * @access private
     */
    _addOutgoingDataSelectEvent: function scm__addOutgoingDataSelectEvent() {
      var outgoingDataSelect = this._elements.outgoingDataSelect;
      outgoingDataSelect.addEventListener('change', (evt) => {
        var that = this;
        var lastChangeValue = outgoingDataSelect.value;
        function onCancel() {
          dialog.destroy();
          outgoingDataSelect.blur();
          SimSettingsHelper.getCardIndexFrom('outgoingData', (cardIndex) => {
            that._updateSelectOptionUI('outgoingData', cardIndex,
              that._elements.outgoingDataSelect);
          });
        }

        function onContinue() {
          dialog.destroy();
          outgoingDataSelect.blur();
          outgoingDataSelect.value = lastChangeValue;
          var newCardIndex = outgoingDataSelect.value;
          SimSettingsHelper.setServiceOnCard('outgoingData', newCardIndex);
          var conn = navigator.mozMobileConnections[newCardIndex]
          var iccId = conn && conn.iccId
          if (iccId) {
            SimSettingsHelper._setToSettingsDB(
              'ril.data.defaultServiceId.iccId', iccId);
          }

          //BDC zhangwp 20190416 add for IMS default configurations. begin
          console.log('simcard_manager updateIMSConfig after outgoingData set to: ' + newCardIndex);
          that._updateIMSConfig(newCardIndex);
          //BDC zhangwp 20190416 add for IMS default configurations. end
        }

        var dialogConfig = {
          title: {
            id: 'confirmation',
            args: {}
          },
          body: {
            id: 'change-outgoing-data-confirm',
            args: {}
          },
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {
              onCancel();
            }
          },
          confirm: {
            name: 'Continue',
            l10nId: 'continue',
            priority: 3,
            callback: () => {
              onContinue();
              this._elements.outgoingDataSelect.disabled = true;
              this._elements.dataContainer.setAttribute('aria-disabled', true);
              this._elements.dataContainer.classList.add('none-select');
              setTimeout(() => {
                this._elements.outgoingDataSelect.disabled = false;
                this._elements.dataContainer.setAttribute('aria-disabled', false);
                this._elements.dataContainer.classList.remove('none-select');
                SettingsSoftkey.show();
              }, 10000);
            }
          },

          backcallback: () => {
            onCancel();
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      });
    },

    /**
     * Get count of current simcards
     *
     * @memberOf SimCardManager
     * @access private
     * @return {Number} count of simcards
     */
    _getSimCardsCount: function scm__getSimCardsCount() {
      return this._simcards.length;
    },

    /**
     * Get information of simcard
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     * @return {Object} information stored in SimUIModel
     */
    _getSimCardInfo: function scm__getSimCardInfo(cardIndex) {
      return this._simcards[cardIndex].getInfo();
    },

    /**
     * Get simcard
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     * @return {SimUIModel}
     */
    _getSimCard: function scm__getSimCard(cardIndex) {
      return this._simcards[cardIndex];
    },

    /**
     * Iterate stored instances of SimUIModel and update each Sim UI
     *
     * @memberOf SimCardManager
     * @access private
     */
    _updateSimCardsUI: function scm__updateSimCardsUI() {
      this._simcards.forEach(function(simcard, cardIndex) {
        this._updateSimCardUI(cardIndex);
      }.bind(this));
    },

    /**
     * We would use specified instance of SimUIModel based on passing cardIndex
     * to render related UI on SimCardManager.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     */
    _updateSimCardUI: function scm__updateSimCardUI(cardIndex) {
      var simcardInfo = this._getSimCardInfo(cardIndex);
      var selectors = ['name', 'operator'];

      var cardSelector = '.sim-card-' + cardIndex;

      var cardDom =
        this._elements.simCardContainer.querySelector(cardSelector);

      // reflect cardState on UI
      cardDom.classList.toggle('absent', simcardInfo.absent);
      cardDom.classList.toggle('locked', simcardInfo.locked);
      cardDom.classList.toggle('enabled', simcardInfo.enabled);
      if (cardDom.classList.toggle('enabled', simcardInfo.enabled)) {
        cardDom.classList.remove('none-select');
        cardDom.setAttribute('aria-disabled', false);
      } else {
        cardDom.classList.add('none-select');
        cardDom.setAttribute('aria-disabled', true);
      }
      // relflect wordings on UI
      selectors.forEach((selector) => {
        // will generate ".sim-card-0 .sim-card-name" for example
        var targetSelector = cardSelector + ' .sim-card-' + selector;
        var element =
          this._elements.simCardContainer.querySelector(targetSelector);
        var l10nObj = simcardInfo[selector];

        if (selector === 'name') {
          if (l10nObj.id && l10nObj.args) {
            // Do not display the carrier name in the header field
            l10n.setAttributes(element, 'sim-with-index', l10nObj.args);
          }
          return;
        }

        var conn = navigator.mozMobileConnections[cardIndex];
        var iccManager = navigator.mozIccManager;
        var icc = iccManager.getIccById(conn.iccId);

        if (!icc) {
          element.textContent = '';
          element.setAttribute('data-l10n-id', _getCardDesription('absent'));
          return;
        }

        if (conn.radioState === 'enabled') {
          element.textContent = '';
          element.removeAttribute('data-l10n-id');
        } else {
          element.setAttribute('data-l10n-id', _getCardDesription('null'));
          return;
        }

        var cardState = icc.cardState;
        if (cardState !== 'ready') {
          element.setAttribute('data-l10n-id',
            _getCardDesription(cardState || 'null'));
          return;
        }

        var _settings = window.navigator.mozSettings;
        _settings.createLock().get('custom.simcards.name').then((result) => {
          var customedSimName = result['custom.simcards.name'];
          if (customedSimName && customedSimName[conn.iccId]) {
            element.textContent = customedSimName[conn.iccId];
          } else {
            var operatorInfo = MobileOperator.userFacingInfo(conn);
            if (operatorInfo.operator) {
              element.textContent = operatorInfo.operator;
            }
          }
        });
      });

      cardDom.setAttribute('id', 'sim-card-'+cardIndex );
      var hrefItem = cardDom.querySelector('a');
      if (simcardInfo.enabled) {
        hrefItem.setAttribute('href', '#simcard-name');
      } else {
        hrefItem.removeAttribute('href');
      }
    },

    /**
     * Initialize SimCardManager UIs which includes
     * SimCardsUI, selectOptionsUI, simSecurityUI
     *
     * @memberOf SimCardManager
     * @access private
     */
    _initSimCardManagerUI: function scm__initSimCardManagerUI() {
      this._initSimCardsUI();
      this._updateSelectOptionsUI();

      // we only inject basic DOM from templates before
      // , so we have to map UI to its info
      this._updateSimCardsUI();
      this._updateSimSettingsUI();
    },

    /**
     * Initialize SimCardsUI
     *
     * @memberOf SimCardManager
     * @access private
     */
    _initSimCardsUI: function scm__initSimCardsUI() {
      var simItemHTMLs = [];

      // inject new childs
      this._simcards.forEach(function(simcard, index) {
        simItemHTMLs.push(
          this._simItemTemplate.interpolate({
          'sim-index': index.toString()
          })
        );
      }.bind(this));

      this._elements.simCardContainer.innerHTML = simItemHTMLs.join('');
    },

    /**
     * Update the UI of the sim settings section
     *
     * @memberOf SimCardManager
     * @access private
     */
    _updateSimSettingsUI: function scm__updateSimSettingsUI() {
      var firstCardInfo = this._simcards[0].getInfo();
      var secondCardInfo = this._simcards[1].getInfo();
      var hidden = firstCardInfo.absent && secondCardInfo.absent ||
        this._isAirplaneMode;

      // if we don't have any card available right now
      // or if we are in airplane mode
      this._elements.simSettingsHeader.hidden = hidden;
      this._elements.simSettingsList.hidden = hidden;
    },

    /**
     * Update SelectOptions UI
     *
     * @memberOf SimCardManager
     * @access private
     */
    _updateSelectOptionsUI: function scm__updateSelectOptionsUI() {
      let conns = window.navigator.mozMobileConnections;
      let iccManager = window.navigator.mozIccManager;
      let iccCard1 = iccManager.getIccById(conns[0].iccId);
      let iccCard2 = iccManager.getIccById(conns[1].iccId);
      let cardState1 = iccCard1 && iccCard1.cardState;
      let cardState2 = iccCard2 && iccCard2.cardState;
      let isReady = ((cardState1 === 'ready' && cardState2 === 'ready') || false);
      let p1 = getSetting('limit.ril.data.defaultServiceId');
      let p2 = getSetting('carrier.sim.match.result');
      Promise.all([p1, p2]).then((values) => {
        let isLimit = values[0];
        let matchResult = values[1];
        if (isReady) {
          if (isLimit && matchResult &&
            !(matchResult[0] && matchResult[1])) {
            this._disableDataItem(true);
          } else {
            this._disableDataItem(false);
          }
        } else {
          this._disableDataItem(true);
        }
        this._disableOtherItems(!isReady);
      });

      SimSettingsHelper.getCardIndexFrom('outgoingCall',
        function(cardIndex) {
          this._updateSelectOptionUI('outgoingCall', cardIndex,
            this._elements.outgoingCallSelect);
      }.bind(this));

      SimSettingsHelper.getCardIndexFrom('outgoingMessages',
        function(cardIndex) {
          this._updateSelectOptionUI('outgoingMessages', cardIndex,
            this._elements.outgoingMessagesSelect);
      }.bind(this));

      SimSettingsHelper.getCardIndexFrom('outgoingData',
        function(cardIndex) {
          this._updateSelectOptionUI('outgoingData', cardIndex,
            this._elements.outgoingDataSelect);
      }.bind(this));
    },

    _disableDataItem: function(enabled) {
      if (!(enabled === false &&
        !this._elements.outgoingCallSelect.disabled &&
        this._elements.outgoingDataSelect.disabled)) {
        this._elements.outgoingDataSelect.disabled = enabled;
        this._elements.dataContainer.setAttribute('aria-disabled', enabled);
        if (enabled) {
          this._elements.dataContainer.classList.add('none-select');
        } else {
          this._elements.dataContainer.classList.remove('none-select');
        }
      }
    },

    _disableOtherItems: function(enabled) {
      this._elements.outgoingCallSelect.disabled = enabled;
      this._elements.callsContainer.setAttribute('aria-disabled',
        enabled);

      this._elements.outgoingMessagesSelect.disabled = enabled;
      this._elements.messagesContainer.setAttribute('aria-disabled',
        enabled);
      if (enabled) {
        this._elements.callsContainer.classList.add('none-select');
        this._elements.messagesContainer.classList.add('none-select');
      } else {
        this._elements.callsContainer.classList.remove('none-select');
        this._elements.messagesContainer.classList.remove('none-select');
      }
    },

    /**
     * Update SelectOption UI
     *
     * @memberOf SimCardManager
     * @access private
     * @param {String} storageKey
     * @param {Number} selectedCardIndex
     * @param {HTMLElement} selectedDOM
     */
    _updateSelectOptionUI: function scm__updateSelectOptionUI(
      storageKey, selectedCardIndex, selectDOM) {
        // We have to remove old options first
        while (selectDOM.firstChild) {
          selectDOM.removeChild(selectDOM.firstChild);
        }

        // then insert the new ones
        this._simcards.forEach((simcard, index) => {
          var simcardInfo = simcard.getInfo();
          var option = document.createElement('option');
          option.value = index;

          if (simcardInfo.absent) {
            option.value = SimSettingsHelper.EMPTY_OPTION_VALUE;
            option.text = SimSettingsHelper.EMPTY_OPTION_TEXT;
          } else {
            if (simcardInfo.name.id) {
              l10n.setAttributes(option,
                simcardInfo.name.id, simcardInfo.name.args);
            } else {
              option.text = simcardInfo.name.text;
            }
          }

          if (index === selectedCardIndex) {
            option.selected = true;
          }
          selectDOM.add(option);
        });

        // we will add `always ask` option these two select
        if (storageKey === 'outgoingCall' ||
          storageKey === 'outgoingMessages') {
            var option = document.createElement('option');
            option.value = SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE;
            option.setAttribute('data-l10n-id', 'sim-manager-always-ask');

            if (SimSettingsHelper.ALWAYS_ASK_OPTION_VALUE ===
              selectedCardIndex) {
                option.selected = true;
            }
            selectDOM.add(option);
        }
    },

    /**
     * Check whether current cardState is locked or not.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {String} cardState
     * @return {Boolean}
     */
    _isSimCardLocked: function scm__isSimCardLocked(cardState) {
      var lockedState = [
        'pinRequired',
        'pukRequired',
        'networkLocked',
        'serviceProviderLocked',
        'corporateLocked',
        'network1Locked',
        'network2Locked',
        'hrpdNetworkLocked',
        'ruimCorporateLocked',
        'ruimServiceProviderLocked'
      ];

      // make sure the card is in locked mode or not
      return lockedState.indexOf(cardState) !== -1;
    },

    /**
     * Check whether current cardState is blocked or not.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {String} cardState
     * @return {Boolean}
     */
    _isSimCardBlocked: function scm__isSimCardBlocked(cardState) {
      var uselessState = [
        'permanentBlocked'
      ];
      return uselessState.indexOf(cardState) !== -1;
    },

    /**
     * If voidechange happened on any conn, we would upate its cardState and
     * reflect the change on UI.
     *
     * @memberOf SimCardManager
     * @access private
     */
    _addVoiceChangeEventOnConns: function scm__addVoiceChangeEventOnConns() {
      var conns = window.navigator.mozMobileConnections;
      for (var i = 0; i < conns.length; i++) {
        var iccId = conns[i].iccId;
        conns[i].addEventListener('voicechange',
          this._updateCardStateWithUI.bind(this, i, iccId));
      }
    },

    /**
     * Iterate conns to add changeEvent
     *
     * @memberOf SimCardManager
     * @access private
     */
    _addCardStateChangeEventOnIccs:
      function scm__addCardStateChangeEventOnIccs() {
        var conns = window.navigator.mozMobileConnections;
        var iccManager = window.navigator.mozIccManager;
        for (var i = 0; i < conns.length; i++) {
          var iccId = conns[i].iccId;
          var icc = iccManager.getIccById(iccId);
          if (icc) {
            this._addChangeEventOnIccByIccId(iccId);
          }
        }
    },

    /**
     * When localized event happened, we would update each cardState and its
     * UI.
     *
     * @memberOf SimCardManager
     * @access private
     */
    _addLocalizedChangeEventOnIccs:
      function scm__addLocalizedChangeEventOnIccs() {
        var conns = window.navigator.mozMobileConnections;
        window.addEventListener('localized', function() {
          for (var i = 0; i < conns.length; i++) {
            var iccId = conns[i].iccId;
            this._updateCardStateWithUI(i, iccId);
          }
        }.bind(this));
    },

    /**
     * Add change event on each icc and would update UI if possible.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {String} iccId
     */
    _addChangeEventOnIccByIccId:
      function scm__addChangeEventOnIccByIccId(iccId) {
        var self = this;
        var icc = window.navigator.mozIccManager.getIccById(iccId);
        if (icc) {
          icc.addEventListener('cardstatechange', function() {
            var cardIndex = self._getCardIndexByIccId(iccId);
            self._updateCardStateWithUI(cardIndex, iccId);

            // If we make PUK locked for more than 10 times,
            // we sould get `permanentBlocked` state, in this way
            // we have to update select/options
            if (self._isSimCardBlocked(icc.cardState)) {
              self._updateSelectOptionsUI();
            }
          });
        }
    },

    /**
     * If the state of APM is changed, we will update states and update all
     * related UIs.
     *
     * @memberOf SimCardManager
     * @access private
     */
    _addAirplaneModeChangeEvent: function scm__addAirplaneModeChangeEvent() {
      var self = this;
      AirplaneModeHelper.addEventListener('statechange', function(state) {
        // we only want to handle these two states
        if (state === 'enabled' || state === 'disabled') {
          var enabled = (state === 'enabled') ? true : false;
          self._isAirplaneMode = enabled;
          self._updateCardsState();
          self._updateSimCardsUI();
          self._updateSimSettingsUI();
        }
      });
    },

    /**
     * Iterate conns to call updateCardState on each conn.
     *
     * @memberOf SimCardManager
     * @access private
     */
    _updateCardsState: function scm__updateCardsState() {
      var conns = window.navigator.mozMobileConnections;
      for (var cardIndex = 0; cardIndex < conns.length; cardIndex++) {
        var iccId = conns[cardIndex].iccId;
        this._updateCardState(cardIndex, iccId);
      }
    },

    /**
     * we will use specified conn to update its state on our internal simcards
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     * @param {String} iccId
     */
    _updateCardState: function scm__updateCardState(cardIndex, iccId) {
      var iccManager = window.navigator.mozIccManager;
      var conn = window.navigator.mozMobileConnections[cardIndex];
      var simcard = this._simcards[cardIndex];

      if (!iccId || this._isAirplaneMode) {
        simcard.setState('nosim');
      } else {
        // else if we can get mobileConnection,
        // we have to check locked / enabled state
        var icc = iccManager.getIccById(iccId);
        var cardState = icc.cardState;
        var operatorInfo = MobileOperator.userFacingInfo(conn);

        if (this._isSimCardLocked(cardState)) {
          simcard.setState('locked');
        } else if (this._isSimCardBlocked(cardState)) {
          simcard.setState('blocked');
        } else {
          // TODO:
          // we have to call Gecko API here to make sure the
          // simcard is enabled / disabled
          simcard.setState('normal', {
            operator: operatorInfo.operator
          });
        }
      }
    },

    /**
     * Sometimes, we have to update state and UI at the same time, so this is
     * a handy function to use.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {Number} cardIndex
     * @return {String} iccId
     */
    _updateCardStateWithUI:
      function scm__updateCardStateWithUI(cardIndex, iccId) {
        this._updateCardState(cardIndex, iccId);
        this._updateSimCardUI(cardIndex);
        this._updateSimSettingsUI();
    },

    /**
     * This method would help us find out the index of passed in iccId.
     *
     * @memberOf SimCardManager
     * @access private
     * @param {String} iccId
     * @return {Number} cardIndex
     */
    _getCardIndexByIccId: function scm__getCardIndexByIccId(iccId) {
      var conns = window.navigator.mozMobileConnections;
      var cardIndex;
      for (var i = 0; i < conns.length; i++) {
        if (conns[i].iccId == iccId) {
          cardIndex = i;
        }
      }
      return cardIndex;
    }
  };

  return SimCardManager;
});

/* global SettingsSoftkey */

define('panels/simcard_manager/panel',['require','modules/settings_panel','panels/simcard_manager/simcard_manager'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SimCardManager = require('panels/simcard_manager/simcard_manager');
  var simcardManager;
  function _updateSelectOptionsUI() {
    simcardManager._updateSelectOptionsUI();
  }

  return function ctor_sim_manager_panel() {
    var isDialogShow = false;
    var listElements;
    let skipUpdate = false;

    function _initSoftkey() {
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
    }

    function _outgoingDataHandleKeyDown(evt) {
      if (evt.key === 'Enter' && isDialogShow) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    }

    function _handleConfirmDlgEvents(evt) {
      switch (evt.type) {
        case 'gaia-confirm-open':
          isDialogShow = true;
          break;
        case 'gaia-confirm-close':
          isDialogShow = false;
          break;
      }
    }

    function _sim1EventListenerHandler() {
      DsdsSettings.setIccCardIndexForCellAndDataSettings(0);
    }

    function _sim2EventListenerHandler() {
      DsdsSettings.setIccCardIndexForCellAndDataSettings(1);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        skipUpdate = true;
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        simcardManager = new SimCardManager({
          simCardContainer: panel.querySelector('.sim-card-container'),
          simCardTmpl: panel.querySelector('.sim-card-tmpl'),
          simSettingsHeader:
            panel.querySelector('.sim-manager-settings-header'),
          simSettingsList: panel.querySelector('.sim-manager-select-list'),
          callsContainer: document.getElementById('outgoing-calls-container'),
          outgoingCallSelect:
            panel.querySelector('.sim-manager-outgoing-call-select'),
          messagesContainer:
            document.getElementById('outgoing-messages-container'),
          outgoingMessagesSelect:
            panel.querySelector('.sim-manager-outgoing-messages-select'),
          dataContainer: document.getElementById('outgoing-data-container'),
          outgoingDataSelect:
            panel.querySelector('.sim-manager-outgoing-data-select'),
        });
        simcardManager.init();

        this.sim1Selector = document.getElementById('sim-card-0');
        this.sim2Selector = document.getElementById('sim-card-1');
        this.href1Element = this.sim1Selector.querySelector('a');
        this.href2Element = this.sim2Selector.querySelector('a');
      },

      onBeforeShow: function(panel) {
        var conns = window.navigator.mozMobileConnections;
        for (var i = 0; i < conns.length; i++) {
          conns[i].addEventListener('voicechange', _updateSelectOptionsUI);
          conns[i].addEventListener('datachange', _updateSelectOptionsUI);
        }
        window.addEventListener('gaia-confirm-open', _handleConfirmDlgEvents);
        window.addEventListener('gaia-confirm-close', _handleConfirmDlgEvents);
        simcardManager._elements.dataContainer
          .addEventListener('keydown', _outgoingDataHandleKeyDown);

        this.href1Element.addEventListener('click', _sim1EventListenerHandler);
        this.href2Element.addEventListener('click', _sim2EventListenerHandler);

        if (!skipUpdate) {
          simcardManager._updateSelectOptionsUI();
          simcardManager._updateCardsState();
          simcardManager._updateSimCardsUI();
          simcardManager._updateSimSettingsUI();
          _initSoftkey();
        } else {
          skipUpdate = false;
        }

        ListFocusHelper.updateSoftkey(panel);
        listElements = document.querySelectorAll('#sim-manager li');
        ListFocusHelper.addEventListener(listElements);
        document.addEventListener('visibilitychange', onVisibilityChange);
      },

      onBeforeHide: function() {
        var conns = window.navigator.mozMobileConnections;
        for (var i = 0; i < conns.length; i++) {
          conns[i].removeEventListener('voicechange', _updateSelectOptionsUI);
          conns[i].removeEventListener('datachange', _updateSelectOptionsUI);
        }
        window.removeEventListener('gaia-confirm-open', _handleConfirmDlgEvents);
        window.removeEventListener('gaia-confirm-close', _handleConfirmDlgEvents);
        simcardManager._elements.dataContainer
          .removeEventListener('keydown', _outgoingDataHandleKeyDown);

        this.href1Element.removeEventListener('click', _sim1EventListenerHandler);
        this.href2Element.removeEventListener('click', _sim2EventListenerHandler);

        ListFocusHelper.removeEventListener(listElements);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    });
  };
});
