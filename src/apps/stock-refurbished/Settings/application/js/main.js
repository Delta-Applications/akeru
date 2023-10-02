
require.config({
  baseUrl: '/js',
  paths: {
    'modules': 'modules',
    'panels': 'panels',
    'shared': '../shared/js'
  },
  shim: {
    'settings': {
      exports: 'Settings'
    },
    'dsds_settings': {
      exports: 'DsdsSettings'
    },
    'simcard_lock': {
      exports: 'SimPinLock'
    },
    'simcard_dialog': {
      exports: 'SimPinDialog'
    },
    'shared/apn_helper': {
      exports: 'ApnHelper'
    },
    'shared/async_storage': {
      exports: 'asyncStorage'
    },
    'shared/icc_helper': {
      exports: 'IccHelper'
    },
    'shared/keypad_helper': {
      exports: 'KeypadHelper'
    },
    'shared/language_list': {
      exports: 'LanguageList'
    },
    'shared/search_provider': {
      exports: 'SearchProvider'
    },
    'shared/manifest_helper': {
      exports: 'ManifestHelper'
    },
    'shared/screen_layout': {
      exports: 'ScreenLayout'
    },
    'shared/settings_url': {
      exports: 'SettingsURL'
    },
    'shared/omadrm/fl': {
      exports: 'ForwardLock'
    },
    'shared/settings_listener': {
      exports: 'SettingsListener'
    },
    'shared/toaster': {
      exports: 'Toaster'
    },
    'shared/template': {
      exports: 'Template'
    },
    'shared/sim_settings_helper': {
      exports: 'SimSettingsHelper'
    },
    'shared/settings_helper': {
      exports: 'SettingsHelper'
    },
    'shared/tz_select': {
      exports: 'tzSelect',
      deps: ['shared/icc_helper']
    },
    'shared/wifi_helper': {
      exports: 'WifiHelper'
    },
    'shared/bluetooth_helper': {
      exports: 'BluetoothHelper'
    },
    'shared/simslot': {
      exports: 'SIMSlot'
    },
    'shared/simslot_manager': {
      exports: 'SIMSlotManager',
      deps: ['shared/simslot']
    },
    'shared/mobile_operator': {
      exports: 'MobileOperator'
    },
    'utils': {
      exports: ''
    },
    'shared/device_storage/enumerate_all': {
      exports: 'enumerateAll'
    },
    'shared/airplane_mode_helper': {
      exports: 'AirplaneModeHelper'
    },
  },
  modules: [
    {
      name: 'main'
    },
    {
      name: 'modules/apn/apn_settings_manager',
      exclude: [
        'main',
        'modules/async_storage',
        'modules/mvvm/observable',
        'modules/apn/apn_const'
      ]
    },
    {
      name: 'modules/dialog_service',
      exclude: ['main']
    },
    {
      name: 'panels/root/panel',
      exclude: [
        'main',
        'panels/root/low_priority_items',
        'modules/apps_cache',
      ]
    },
    {
      name: 'panels/root/low_priority_items',
      exclude: [
        'main',
        'modules/app_storage',
        'modules/battery',
        'modules/wifi_context'
      ]
    },
    {
      name: 'panels/languages/panel',
      exclude: [
        'main',
        'modules/date_time'
      ]
    },
    {
      name: 'panels/frame/panel',
      exclude: ['main']
    },
    {
      name: 'panels/feedback_send/panel',
      exclude: ['main']
    },
    {
      name: 'panels/feedback_choose/panel',
      exclude: ['main']
    },
    {
      name: 'panels/app_permissions_detail/panel',
      exclude: [
        'main',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/app_permissions_list/panel',
      exclude: [
        'main',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/app_notices_detail/panel',
      exclude: ['main']
    },
    {
      name: 'panels/app_notices_list/panel',
      exclude: [
        'main',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/screen_lock/panel',
      exclude: ['main']
    },
    {
      name: 'panels/screen_lock_passcode/panel',
      exclude: [
        'main',
        'modules/settings_utils'
      ]
    },
    {
      name: 'panels/display/panel',
      exclude: [
        'main',
        'modules/mvvm/observable'
      ]
    },
    {
      name: 'panels/homescreens/panel',
      exclude:  [
        'main',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/input_methods/panel',
      exclude: [
        'main',
        'shared/keypad_helper'
      ]
    },
    {
      name: 'panels/input_languages_selection/panel',
      exclude: [
        'main'
      ]
    },
    {
      name: 'panels/app_storage/panel',
      exclude: [
        'main',
        'modules/app_storage',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/wifi/panel',
      exclude: [
        'main',
        'modules/dialog_service'
      ]
    },
    {
      name: 'panels/wifi_auth/panel',
      exclude: ['main']
    },
    {
      name: 'panels/wifi_enter_certificate_nickname/panel',
      exclude: ['main']
    },
    {
      name: 'panels/wifi_join_hidden/panel',
      exclude: ['main']
    },
    {
      name: 'panels/wifi_manage_certificates/panel',
      exclude: [
        'main',
        'modules/settings_utils'
      ]
    },
    {
      name: 'panels/wifi_manage_networks/panel',
      exclude: [
        'main',
        'modules/dialog_service'
      ]
    },
    {
      name: 'panels/wifi_select_certificate_file/panel',
      exclude: [
        'main',
        'modules/settings_utils'
      ]
    },
    {
      name: 'panels/wifi_status/panel',
      exclude: ['main']
    },
    {
      name: 'panels/wifi_wps/panel',
      exclude: ['main']
    },
    {
      name: 'panels/date_time/panel',
      exclude: [
        'main',
        'modules/mvvm/observable',
        'modules/date_time'
      ]
    },
    {
      name: 'panels/browsing_privacy/panel',
      exclude: ['main']
    },
    {
      name: 'panels/search/panel',
      exclude: ['main']
    },
    {
      name: 'panels/sound/panel',
      exclude: ['main']
    },
   
    {
      name: 'panels/simcard_manager/panel',
      exclude: ['main']
    },
    {
      name: 'panels/hotspot/panel',
      exclude: [
        'main',
        'modules/mvvm/observable',
        'modules/dialog_service'
      ]
    },
    {
      name: 'panels/hotspot_wifi_settings/panel',
      exclude: [
        'main',
        'modules/mvvm/observable'
      ]
    },
    {
      name: 'panels/about/panel',
      exclude: [
        'main'
      ]
    },
    {
      name: 'panels/about_more_info/panel',
      exclude: [
        'main',
        'modules/bluetooth/bluetooth'
      ]
    },
    {
      name: 'panels/developer/panel',
      exclude: [
        'main',
        'modules/dialog_service',
        'modules/apps_cache'
      ]
    },
    {
      name: 'panels/developer_hud/panel',
      exclude: ['main']
    },
    {
      name: 'panels/call_barring/panel',
      exclude: [
        'main',
        'modules/mvvm/observable'
      ]
    },
    {
      name: 'panels/call_barring_passcode_change/panel',
      exclude: ['main']
    }
  ]
});

define("config/require", function(){});

/**
 * PageTransitions provides transition functions used when navigating panels.
 *
 * @module PageTransitions
 */
define('modules/page_transitions',[],function() {
  

  var _sendPanelReady = function _send_panel_ready(oldPanelHash, newPanelHash) {
    var detail = {
      previous: oldPanelHash,
      current: newPanelHash
    };
    var event = new CustomEvent('panelready', {detail: detail});
    if(newPanelHash != '#apn-list') {
      window.dispatchEvent(event);
    }
  };

  return {
    /**
     * Typically used with phone size device layouts.
     *
     * @alias module:PageTransitions#oneColumn
     * @param {String} oldPanel
     * @param {String} newPanel
     * @param {Function} callback
     */
    oneColumn: function pt_one_column(oldPanel, newPanel, callback) {
      if (oldPanel === newPanel) {
        callback();
        return;
      }

      // switch previous/current classes
      if (oldPanel) {
        oldPanel.className = newPanel.className ? '' : 'previous';
      }
      if (newPanel.className === 'current') {
        _sendPanelReady(oldPanel && '#' + oldPanel.id, '#' + newPanel.id);

        if (callback) {
          callback();
        }
        return;
      }

      newPanel.className = 'current';

      /**
       * Most browsers now scroll content into view taking CSS transforms into
       * account.  That's not what we want when moving between <section>s,
       * because the being-moved-to section is offscreen when we navigate to its
       * #hash.  The transitions assume the viewport is always at document 0,0.
       * So add a hack here to make that assumption true again.
       * https://bugzilla.mozilla.org/show_bug.cgi?id=803170
       */
      if ((window.scrollX !== 0) || (window.scrollY !== 0)) {
        window.scrollTo(0, 0);
      }

      window.setTimeout(() => {
        if (oldPanel) {
          _sendPanelReady('#' + oldPanel.id, '#' + newPanel.id);
          if (oldPanel.className === 'current') {
            return;
          }
        } else {
          _sendPanelReady(null, '#' + newPanel.id);
        }
        if (callback) {
          callback();
        }
      }, 100);
    },

    /**
     * Typically used with tablet size device layouts.
     *
     * @alias module:PageTransitions#twoColumn
     * @param {String} oldPanel
     * @param {String} newPanel
     * @param {Function} callback
     */
    twoColumn: function pt_two_column(oldPanel, newPanel, callback) {
      if (oldPanel === newPanel) {
        callback();
        return;
      }

      if (oldPanel) {
        oldPanel.className = newPanel.className ? '' : 'previous';
        newPanel.className = 'current';
        _sendPanelReady('#' + oldPanel.id, '#' + newPanel.id);
      } else {
        newPanel.className = 'current';
        _sendPanelReady(null, '#' + newPanel.id);
      }

      if (callback) {
        callback();
      }
    }
  };
});

/**
 * Panel is the basic element for navigation. Which defines Six basic
 * functions: show, hide, beforeShow, beforeHide, init, and uninit for
 * navigation. These functions are called by `SettingsService` during the
 * navigation.
 * Internal functions onShow, onHide, onBeforeShow, onBeforeHide, onInit,
 * and onUninit are called respectively in the basic functions.
 *
 * @module Panel
 */
define('modules/panel',[],function() {
  

  var _emptyFunc = function panel_emptyFunc() {};

  /**
   * @alias module:Panel
   * @param {Object} options
   *                 Options are used to override the internal functions.
   * @returns {Panel}
   */
  var Panel = function ctor_panel(options) {
    var _initialized = false;

    options = options || {};
    options.onInit = options.onInit || _emptyFunc;
    options.onUninit = options.onUninit || _emptyFunc;
    options.onShow = options.onShow || _emptyFunc;
    options.onHide = options.onHide || _emptyFunc;
    options.onBeforeShow = options.onBeforeShow || _emptyFunc;
    options.onBeforeHide = options.onBeforeHide || _emptyFunc;

    return {
      /**
       * Get a value that indicates whether the panel has been initialized.
       *
       * @alias module:Panel#initialized
       * @return {Boolean}
       */
      get initialized() {
        return _initialized;
      },

      /**
       * Called at the first time when the beforeShow function is called.
       *
       * @alias module:Panel#init
       * @param {HTMLElement} panel
       * @param {Object} initOptions
       */
      init: function(panel, initOptions) {
        if (_initialized) {
          return;
        }
        _initialized = true;

        return options.onInit(panel, initOptions);
      },

      /**
       * Called when cleanup.
       *
       * @alias module:Panel#uninit
       */
      uninit: function() {
        if (!_initialized) {
          return;
        }
        _initialized = false;

        options.onUninit();
      },

      /**
       * Called when the panel is navigated into the viewport.
       *
       * @alias module:Panel#show
       * @param {HTMLElement} panel
       * @param {Object} showOptions
       */
      show: function(panel, showOptions) {
        // Initialize at the first call to show if necessary.
        return Promise.resolve(this.init(panel, showOptions)).then(function() {
          return options.onShow(panel, showOptions);
        });
      },

      /**
       * Called when the panel is navigated out of the viewport.
       *
       * @alias module:Panel#hide
       */
      hide: function() {
        return options.onHide();
      },

      /**
       * Called when the panel is about to be navigated to into the viewport.
       *
       * @alias module:Panel#beforeShow
       * @param {HTMLElement} panel
       * @param {Object} beforeShowOptions
       */
      beforeShow: function(panel, beforeShowOptions) {
        // Initialize at the first call to beforeShow.
        return Promise.resolve(this.init(panel, beforeShowOptions)).then(
          function() {
            return options.onBeforeShow(panel, beforeShowOptions);
        });
      },

      /**
       * Called when the panel is about to be navigated out of the viewport.
       *
       * @alias module:Panel#beforeHide
       * @param {HTMLElement} panel
       * @param {Object} beforeShowOptions
       */
      beforeHide: function() {
        return options.onBeforeHide();
      }
    };
  };
  return Panel;
});

/* global openLink, openDialog, DsdsSettings */
/**
 * PanelUtils is a singleton that defines panel related utility functions.
 *
 * @module PanelUtils
 */
define('modules/panel_utils',['require','settings','shared/toaster','shared/settings_listener'],function(require) {
  

  var Settings = require('settings');
  var Toaster = require('shared/toaster');
  var SettingsListener = require('shared/settings_listener');

  var _settings = navigator.mozSettings;

  /**
   * Opens the dialog of a specified id.
   *
   * @param {String} dialogID
   *                 The id of the dialog element.
   */
  var _openDialog = function pu_openDialog(dialogID) {
    var dialog = document.getElementById(dialogID);
    var fields = Array.prototype.slice.call(
      dialog.querySelectorAll('[data-setting]:not([data-ignore])'));

    var updateInput = function(lock, input) {
      var key = input.dataset.setting;
      var request = lock.get(key);

      request.onsuccess = function() {
        switch (input.type) {
          case 'radio':
            input.checked = (input.value == request.result[key]);
            break;
          case 'checkbox':
            input.checked = request.result[key] || false;
            break;
          case 'select-one':
            input.value = request.result[key] || '';
            break;
          default:
            input.value = request.result[key] || '';
            break;
        }
      };
    };

    /**
     * In Settings dialog boxes, we don't want the input fields to be preset
     * by Settings.init() and we don't want them to set the related settings
     * without any user validation.
     *
     * So instead of assigning a `name' attribute to these inputs, a
     * `data-setting' attribute is used and the input values are set
     * explicitely when the dialog is shown.  If the dialog is validated
     * (submit), their values are stored into B2G settings.
     *
     * XXX warning:
     * this only supports text/password/radio/select/radio input types.
     */

    // initialize all setting fields in the dialog box
    // XXX for fields being added by lazily loaded script,
    // it would have to initialize the fields again themselves.
    function reset() {
      if (_settings) {
        var lock = _settings.createLock();
        fields.forEach(updateInput.bind(null, lock));
      }
    }

    // validate all settings in the dialog box
    function submit() {
      if (_settings) {
        // Update the fields node list to include dynamically added fields
        fields = Array.prototype.slice.call(
          dialog.querySelectorAll('[data-setting]:not([data-ignore])'));
        var cset = {}, key;
        var lock = _settings.createLock();

        fields.forEach(function(input) {
          key = input.dataset.setting;
          switch (input.type) {
            case 'radio':
              if (input.checked) {
                cset[key] = input.value;
              }
              break;
            case 'checkbox':
              cset[key] = input.checked;
              break;
            default:
              cset[key] = input.value;
              break;
          }
        });
        lock.set(cset);
      }
    }

    reset(); // preset all fields before opening the dialog
    openDialog(dialogID, submit);
  };

  return {
    /**
     * The function parses all links in the panel and adds corresponding
     * handlers.
     * There are three types of links:
     * - a[href^="http"]: External link
     * - a[href^="tel"]: External link
     * - [data-href]: Generic dialog link and settings-specific dialog link
     *
     * @alias module:PanelUtils#activate
     * @param {HTMLElement} panel
     *                      The root element of the panel.
     */
    activate: function pu_activate(panel) {
      // activate all scripts
      var scripts = panel.getElementsByTagName('script');
      var scripts_src = Array.prototype.map.call(scripts, function(script) {
        return script.getAttribute('src');
      });
      LazyLoader.load(scripts_src);

      var _onclick = function() {
        if (!this.dataset.href) {
          this.dataset.href = this.href;
          this.href = '#';
        }
        var href = this.dataset.href;
        if (!href.startsWith('#')) { // external link
          openLink(href);
        } else if (!href.endsWith('Settings')) { // generic dialog
          openDialog(href.substr(1));
        } else { // Settings-specific dialog box
          _openDialog(href.substr(1));
        }
        return false;
      };

      // activate all links
      var rule = 'a[href^="http"], a[href^="tel"], [data-href]';
      var links = panel.querySelectorAll(rule);
      var i, count;

      for (i = 0, count = links.length; i < count; i++) {
        if (links[i].tagName !== 'GAIA-HEADER') {
          links[i].onclick = _onclick;
        }
      }

      // Setup back listener
      var backHeader = panel.querySelector('gaia-header[action="back"]');
      var href = backHeader && backHeader.dataset.href;
      if (backHeader && href) {
        backHeader.addEventListener('action', function() {
          Settings.currentPanel = this.dataset.href;
        });
      }
    },

    updateItemByValue: function updateItemByValue(element, value) {
      if (typeof value === 'undefined' || value === '') {
        element.hidden = true;
      }
    },

    /**
     * The function presets elements with the settings values.
     * The supported formats are:
     * - An input element with a "name" attribute and its value is a settings
     *   key.
     * - A select element with a "name" attribute and its value is a settings
     *   key.
     * - A span element with a "data-name" attribute and its value is a settings
     *   key.
     *
     * @alias module:PanelUtils#preset
     * @param {HTMLElement} panel
     *                      The root element of the panel.
     */
    preset: function pu_preset(panel) {
      SettingsDBCache.getSettings(function(result) {
        panel = panel || document;

        // preset all checkboxes
        var rule = 'input[type="checkbox"]:not([data-ignore])';
        var checkboxes = panel.querySelectorAll(rule);
        var i, count, key;
        for (i = 0, count = checkboxes.length; i < count; i++) {
          key = checkboxes[i].name;
          if (key && result[key] !== undefined) {
            checkboxes[i].checked = !!result[key];
          }
        }

        // remove initial class so the swich animation will apply
        // on these toggles if user interact with it.
        setTimeout(function() {
          for (i = 0, count = checkboxes.length; i < count; i++) {
            if (checkboxes[i].classList.contains('initial')) {
              checkboxes[i].classList.remove('initial');
            }
          }
        }, 0);

        // preset all radio buttons
        rule = 'input[type="radio"]:not([data-ignore])';
        var radios = panel.querySelectorAll(rule);
        for (i = 0, count = radios.length; i < count; i++) {
          key = radios[i].name;
          if (key && result[key] !== undefined) {
            radios[i].checked = (result[key] === radios[i].value);
          }
        }

        // preset all text inputs
        rule = 'input[type="text"]:not([data-ignore])';
        var texts = panel.querySelectorAll(rule);
        for (i = 0, count = texts.length; i < count; i++) {
          key = texts[i].name;
          if (key && result[key] !== undefined) {
            texts[i].value = result[key];
          }
        }

        // preset all range inputs
        rule = 'input[type="range"]:not([data-ignore])';
        var ranges = panel.querySelectorAll(rule);
        for (i = 0, count = ranges.length; i < count; i++) {
          key = ranges[i].name;
          if (key && result[key] !== undefined) {
            ranges[i].value = parseFloat(result[key]);
          }
        }

        // preset all select
        var selects = panel.querySelectorAll('select');
        for (i = 0, count = selects.length; i < count; i++) {
          var select = selects[i];
          key = select.name;
          if (key && result[key] !== undefined) {
            var value = result[key];
            if (Array.isArray(value)) {
              let serviceId =
                window.DsdsSettings.getIccCardIndexForCallSettings();
              var dsds_option = 'option[value="' + value[serviceId] + '"]';
              var dsds_selectOption = select.querySelector(dsds_option);
              if (dsds_selectOption) {
                dsds_selectOption.selected = true;
              }
            } else {
              var option = 'option[value="' + value + '"]';
              var selectOption = select.querySelector(option);
              if (selectOption) {
                selectOption.selected = true;
              }
            }
          }
        }

        // preset all span with data-name fields
        rule = '[data-name]:not([data-ignore])';
        var spanFields = panel.querySelectorAll(rule);
        for (i = 0, count = spanFields.length; i < count; i++) {
          key = spanFields[i].dataset.name;

          // XXX intentionally checking for the string 'undefined',
          // see bug 880617
          if (key && result[key] && result[key] != 'undefined') {
            // check whether this setting comes from a select option
            // (it may be in a different panel, so query the whole document)
            rule = '[data-setting="' + key + '"] ' +
              '[value="' + result[key] + '"]';
            var option_span = document.querySelector(rule);
            if (option_span) {
              spanFields[i].setAttribute('data-l10n-id',
                option_span.getAttribute('data-l10n-id'));
            } else {
              spanFields[i].removeAttribute('data-l10n-id');
              spanFields[i].textContent = result[key];
            }
          } else { // result[key] is undefined
            var _ = navigator.mozL10n.get;
            switch (key) {
              //XXX bug 816899 will also provide 'deviceinfo.software' from
              // Gecko which is {os name + os version}
              case 'deviceinfo.software':
                navigator.mozL10n.setAttributes(spanFields[i],
                  'deviceInfo_software',
                  { brandShortName: _('brandShortName'),
                    os: result['deviceinfo.os'] });
                break;

              //XXX workaround request from bug 808892 comment 22
              //  hide this field if it's undefined/empty.
              case 'deviceinfo.firmware_revision':
                this.updateItemByValue(spanFields[i].parentNode,
                  result['deviceinfo.firmware_revision']);
                break;
              case 'deviceinfo.software_tag':
                this.updateItemByValue(spanFields[i].parentNode,
                  result['deviceinfo.software_tag']);
                break;
              case 'deviceinfo.base_version':
                this.updateItemByValue(spanFields[i].parentNode,
                  result['deviceinfo.base_version']);
                break;

              case 'deviceinfo.mac':
                spanFields[i].setAttribute('data-l10n-id', 'macUnavailable');
                break;
            }
          }
        }

        // unhide items according to preferences.
        rule = '[data-show-name]:not([data-ignore])';
        var hiddenItems = panel.querySelectorAll(rule);
        for (i = 0; i < hiddenItems.length; i++) {
          key = hiddenItems[i].dataset.showName;
          hiddenItems[i].hidden = !result[key];
        }
      }.bind(this));
    },

    /**
     * When a link element is clicked, the function navigates the app to the
     * panel of the id specified by the "href" attribute of the element.
     *
     * @alias module:PanelUtils#onLinkClick
     * @param {Event} event
     */
    onLinkClick: function pu_onLinkClick(event) {
      var target = event.target;
      var href;

      if (target.classList.contains('icon-back')) {
        href = target.parentNode.getAttribute('href');
      } else {
        var nodeName = target.nodeName.toLowerCase();
        if (nodeName != 'a') {
          return;
        }
        href = target.getAttribute('href');
      }
      // skips the following case:
      // 1. no href, which is not panel
      // 2. href is not a hash which is not a panel
      // 3. href equals # which is translated with loadPanel function, they are
      //    external links.
      if (!href || !href.startsWith('#') || href === '#') {
        return;
      }

      Settings.currentPanel = href;
      event.preventDefault();
    },

    /**
     * Respond to settings changes.
     * The supported formats are:
     * - An input element with a "name" attribute and its value is a settings
     *   key.
     * - A select element with a "name" attribute and its value is a settings
     *   key.
     * - A span element with a "data-name" attribute and its value is a settings
     *   key.
     * - Elements with a "data-show-name" attribute. It hides the element when
     *   the value is false and vice versa.
     *
     * @alias module:PanelUtils#onSettingsChange
     * @param {HTMLElement} panel
     * @param {Event} event
     */
    onSettingsChange: function pu_onSettingsChange(panel, event) {
      var key = event.settingName;
      var value = event.settingValue;
      var i, count;

      // update <span> values when the corresponding setting is changed
      var rule = '[data-name="' + key + '"]:not([data-ignore])';
      var spanField = panel.querySelector(rule);
      if (spanField) {
        // check whether this setting comes from a select option
        var options = panel.querySelector('select[data-setting="' + key + '"]');
        if (options) {
          // iterate option matching
          for (i = 0, count = options.length; i < count; i++) {
            if (options[i] && options[i].value === value) {
              spanField.dataset.l10nId = options[i].dataset.l10nId;
              spanField.textContent = options[i].textContent;
            }
          }
        } else {
          spanField.textContent = value;
        }
      }

      // hide or unhide items
      rule = '[data-show-name="' + key + '"]:not([data-ignore])';
      var items = document.querySelectorAll(rule);
      for (i = 0; i < items.length; i++) {
        items[i].hidden = !value;
      }

      // update <input> values when the corresponding setting is changed
      rule = 'input[name="' + key + '"]:not([data-ignore])';
      var input = panel.querySelector(rule);
      if (!input) {
        return;
      }

      switch (input.type) {
        case 'checkbox':
        case 'switch':
          if (input.checked == value) {
            return;
          }
          input.checked = value;
          break;
        case 'range':
          if (input.value == value) {
            return;
          }
          input.value = value;
          break;
        case 'select':
          for (i = 0, count = input.options.length; i < count; i++) {
            if (input.options[i].value == value) {
              input.options[i].selected = true;
              break;
            }
          }
          break;
      }
    },

    /**
     * Respond to settings changes.
     * The supported formats are:
     * - An input element with a "name" attribute and its value is a settings
     *   key.
     * - A select element with a "name" attribute and its value is a settings
     *   key.
     * - A span element with a "data-name" attribute and its value is a settings
     *   key.
     * - Elements with a "data-show-name" attribute. It hides the element when
     *   the value is false and vice versa.
     *
     * @alias module:PanelUtils#onInputChange
     * @param {HTMLElement} panel
     * @param {Event} event
     */
    onInputChange: function pu_onInputChange(event) {
      var input = event.target;
      var type = input.type;
      var key = input.key || input.name;
      var relkey = input.dataset.relatedkey || null;

      //XXX should we check data-ignore here?
      if (!key || !_settings || event.type != 'change') {
        return;
      }

      // Not touching <input> with data-setting attribute here
      // because they would have to be committed with a explicit "submit"
      // of their own dialog.
      if (input.dataset.setting) {
        return;
      }

      if (key === 'sync-canlendar' ||
        key === 'sync-contacts' ||
        key === 'sync-email') {
        input.checked = !input.checked;
        return;
      }

      var value;
      switch (type) {
        case 'checkbox':
        case 'switch':
          value = input.checked; // boolean
          if (relkey) {
            var relInput =
              document.querySelector('input[name="' + relkey + '"]');
            let relItem = relInput.parentNode.parentNode;
            relInput.checked = value;
            relInput.disabled = !value;
            if (value) {
              relItem.classList.remove('none-select');
              relItem.removeAttribute('aria-disabled');
            } else {
              relItem.setAttribute('aria-disabled', true);
              relItem.classList.add('none-select');
            }
            var relSet = {};
            relSet[relkey] = value;
            SettingsListener.getSettingsLock().set(relSet);
          }
          break;
        case 'range':
          // Bug 906296:
          //   We parseFloat() once to be able to round to 1 digit, then
          //   we parseFloat() again to make sure to store a Number and
          //   not a String, otherwise this will make Gecko unable to
          //   apply new settings.
          value = parseFloat(parseFloat(input.value).toFixed(1)); // float
          break;
        case 'select-one':
        case 'radio':
        case 'text':
        case 'password':
          value = input.value; // default as text
          if (input.dataset.valueType === 'integer') { // integer
            value = parseInt(value);
          }
          break;
      }

      var request = SettingsListener.getSettingsLock().get(key);
      request.onsuccess = (() => {
        var cset = {};
        var keyResult = request.result[key];
        if (input.key) {
          keyResult[input.name] = value;
          cset[key] = keyResult;
        } else if (typeof value === 'string' &&
          input.getAttribute('data-value-type') === 'boolean') {
          if (Array.isArray(keyResult)) {
            let serviceId = window.DsdsSettings.getIccCardIndexForCallSettings();
            var enabled = (value === 'true') || false;
            keyResult[serviceId] = !enabled;
            cset[key] = keyResult;
          } else {
            cset[key] = (value === 'true') || false;
          }
        } else {
          cset[key] = value;
        }
        SettingsListener.getSettingsLock().set(cset);
      });
    }
  };
});

/**
 * SettingsPanel extends Panel with basic settings services. It presets the UI
 * elements based on the values in mozSettings and add listeners responding to
 * mozSettings changes in onReady. In onInit it parses the panel element for
 * activating links. It also removes listeners in onDone so that we can avoid
 * unwanted UI updates when the panel is outside of the viewport.
 *
 * @module SettingsPanel
 */
define('modules/settings_panel',['require','modules/panel','modules/panel_utils'],function(require) {
    

    var Panel = require('modules/panel');
    var PanelUtils = require('modules/panel_utils');

    var _emptyFunc = function panel_emptyFunc() {};

    /**
     * @alias module:SettingsPanel
     * @param {Object} options
     *                 Options are used to override the internal functions of
     *                 Panel.
     * @returns {SettingsPanel}
     */
    var SettingsPanel = function ctor_SettingsPanel(options) {
      /**
       * The root element of the panel.
       *
       * @type {HTMLElement}
       */
      var _panel = null;

      /**
       * The handler is called when settings change.
       *
       * @param {Event} event
       */
      var _settingsChangeHandler = function(event) {
        PanelUtils.onSettingsChange(_panel, event);
      };

      /**
       * Add listeners to make the panel be able to respond to setting changes
       * and user interactions.
       *
       * @param {HTMLElement} panel
       */
      var _addListeners = function panel_addListeners(panel) {
        if (!panel) {
          return;
        }

        SettingsDBCache.addEventListener('settingsChange',
          _settingsChangeHandler);
        panel.addEventListener('change', PanelUtils.onInputChange);
        panel.addEventListener('click', PanelUtils.onLinkClick);
      };

      /**
       * Remove all listeners.
       *
       * @param {HTMLElement} panel
       */
      var _removeListeners = function panel_removeListeners(panel) {
        if (!panel) {
          return;
        }

        SettingsDBCache.removeEventListener('settingsChange',
          _settingsChangeHandler);
        panel.removeEventListener('change', PanelUtils.onInputChange);
        panel.removeEventListener('click', PanelUtils.onLinkClick);
      };

      options = options || {};
      options.onInit = options.onInit || _emptyFunc;
      options.onUninit = options.onUninit || _emptyFunc;
      options.onShow = options.onShow || _emptyFunc;
      options.onHide = options.onHide || _emptyFunc;
      options.onBeforeShow = options.onBeforeShow || _emptyFunc;
      options.onBeforeHide = options.onBeforeHide || _emptyFunc;

      return Panel({
        onInit: function(panel, initOptions) {
          if (!panel) {
            return;
          }

          _panel = panel;
          PanelUtils.activate(panel);

          return options.onInit(panel, initOptions);
        },
        onUninit: function() {
          _removeListeners(_panel);
          _panel = null;
          options.onUninit();
        },
        onShow: function(panel, showOptions) {
          return options.onShow(panel, showOptions);
        },
        onHide: function() {
          // Remove listeners.
          _removeListeners(_panel);

          return options.onHide();
        },
        onBeforeShow: function(panel, beforeShowOptions) {
          // Preset the panel every time when it is presented.
          PanelUtils.preset(panel);
          _addListeners(panel);
          return options.onBeforeShow(panel, beforeShowOptions);
        },
        onBeforeHide: function() {
          return options.onBeforeHide();
        }
      });
    };
    return SettingsPanel;
});

/**
 * PanelCache is a singleton that loads a panel module based on the panel id
 * and caches the loaded modules.
 *
 * @module PanelCache
 */
define('modules/panel_cache',['require','modules/settings_panel'],function(require) {
    

    var SettingsPanel = require('modules/settings_panel');

    var _panelCache = {};
    var _panelStylesheetsLoaded = false;

    // experiment result shows
    // load all related styles once is time saver
    var _loadPanelStylesheetsIfNeeded = function loadPanelCSS() {
      if (_panelStylesheetsLoaded) {
        return;
      }

      LazyLoader.load(['shared/style/action_menu.css',
                       'shared/style/confirm.css',
                       'shared/style/progress_activity.css',
                       'shared/js/component_utils.js',
                       'shared/elements/gaia_buttons/script.js',
                       'style/apps.css',
                       'style/screen_lock.css',
                       'style/simcard.css',
                       'style/updates.css',
                       'style/downloads.css'],
      function callback() {
        _panelStylesheetsLoaded = true;
      });
    };

    // load styles in idle time after document loaded
    navigator.addIdleObserver({
      time: 3,
      onidle: _loadPanelStylesheetsIfNeeded
    });

    return {
      // this is for unit test
      reset: function spc_reset() {
        _panelCache = {};
        _panelStylesheetsLoaded = false;
      },

      /**
       * Get the panel module of a specified id. If there is no corresponding
       * panel module of the id, it returns SettingsPanel.
       *
       * @alias module:PanelCache#get
       * @param {String} panelId
       *                 The id of the to be loaded panel.
       * @param {Function} callback
       *                   The function to be called when the panel is loaded.
       */
      get: function spc_get(panelId, callback) {
        if (!panelId && !callback) {
          return;
        }

        if (panelId !== 'root') {
          _loadPanelStylesheetsIfNeeded();
        }

        var cachedPanel = _panelCache[panelId];
        if (cachedPanel) {
          if (callback) {
            callback(cachedPanel);
          }
        } else {
          // Get the path of the panel creation function
          var panelElement = document.getElementById(panelId);
          if (panelElement) {
            var pathElement = panelElement.querySelector('panel');
            var path = pathElement ? pathElement.dataset.path : null;

            var panelFuncLoaded = function(panelFunc) {
              var panel = panelFunc();
              _panelCache[panelId] = panel;
              if (callback) {
                callback(panel);
              }
            };

            if (path) {
              require([path], function(panelFunc) {
                // Create a new panel object for static panels.
                panelFuncLoaded(panelFunc ? panelFunc : SettingsPanel);
              });
            } else {
              panelFuncLoaded(SettingsPanel);
            }
          } else {
            if (callback) {
              callback(null);
            }
          }
        }
      }
    };
});

/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



/**
 * This script can identify the size and watch change of mediaquery.
 *
 * You can get current layout by calling |gerCurrentLayout|,
 * it will only return matching type from defaultQueries.
 *
 * You can use |watch| and |unwatch| to start/stop watch on specific
 * mediaquery string, such as tiny/small/medium/large, you can also
 * define your own watcher. After start watcher, this script
 * will dispatch 'screenlayoutchange' event and pass name and status.
 */

var ScreenLayout = {
  //Refer to famous libraries, like Twitter Bootstrap and Foundation
  //we choose 768, 992, 1200 width as our breakpoints
  defaultQueries: {
    tiny: '(max-width: 767px)',
    small: '(min-width: 768px) and (max-width: 991px)',
    medium: '(min-width: 992px) and (max-width: 1200px)',
    large: '(min-width: 1201px)',
    hardwareHomeButton: '(-moz-physical-home-button)'
  },

  init: function sl_init() {
    // loop defaultQueries and add window.matchMedia()
    // to this.queries object
    this.queries = (function(qs) {
      var result = {};
      for (var key in qs) {
        result[key] = window.matchMedia(qs[key]);
      }
      return result;
    })(this.defaultQueries);
  },

  _isOnRealDevice: undefined,

  isOnRealDevice: function sl_isOnRealDevice() {
    if (typeof(this._isOnRealDevice) !== 'undefined') {
      return this._isOnRealDevice;
    }

    // XXX: A hack to know we're using real device or not
    // is to detect screen size.
    // The screen size of b2g running on real device
    // is the same as the size of system app.
    if (window.innerWidth === screen.availWidth) {
      this._isOnRealDevice = true;
    } else {
      this._isOnRealDevice = false;
    }

    return this._isOnRealDevice;
  },

  // name: |String|, ex: 'tiny', 'small', 'medium'
  //
  // tell user what type it is now
  // if type is undeined, it will return matching type from "defaultQueries"
  // if type is given, it will return boolean based on all watching queries
  getCurrentLayout: function sl_getCurrentLayout(type) {
    if (type === undefined) {
      for (var name in this.defaultQueries) {
        if (this.queries[name] && this.queries[name].matches) {
          return name;
        }
      }
    }
    if (typeof this.queries[type] !== 'undefined') {
      return this.queries[type].matches;
    }
    return false;
  },

  // name: |String|, ex: 'tiny', 'small', 'medium', 'large'
  // media: |String| optional, ex: '(max-width: 767px)'
  //
  // Start the |name| watcher
  // If |name| is not predefined in defaultQueries,
  // then |media| is required.
  //
  // If overwrite defaultQueries with new |media|,
  // |getCurrentLayout| will be also based on new config.
  watch: function sl_watch(name, media) {
    var mediaString = media || this.queries[name].media;
    if (!mediaString) {
      return;
    }
    this.unwatch(name);
    this.queries[name] = window.matchMedia(mediaString);
    this.boundHandleChange = this.handleChange.bind(this);
    this.queries[name].addListener(this.boundHandleChange);
  },

  unwatch: function sl_unwatch(name) {
    if (this.queries[name]) {
      this.queries[name].removeListener(this.boundHandleChange);
    }
  },

  // Dispatch screenlayoutchange event, and pass mediaquery name and
  // status, which represent name of activating mediaquery and
  // activate status(boolean). ex: {name: 'small', status: true}
  handleChange: function sl_handleChange(evt) {
    for (var key in this.queries) {
      if (this.queries[key].media !== evt.media) {
        continue;
      }
      window.dispatchEvent(new CustomEvent('screenlayoutchange', {
        detail: {
          name: key,
          status: evt.matches
        }
      }));
    }
  }
};

ScreenLayout.init();

define("shared/screen_layout", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.ScreenLayout;
    };
}(this)));

/* jshint -W083 */

(function(exports) {
  

  /**
   * Allowable font sizes for header elements.
   */
  const HEADER_SIZES = [
    16, 17, 18, 19, 20, 21, 22, 23
  ];

  /**
   * Utility functions for measuring and manipulating font sizes
   */
  var FontSizeUtils = {

    /**
     * Keep a cache of canvas contexts with a given font.
     * We do this because it is faster to create new canvases
     * than to re-set the font on existing contexts repeatedly.
     */
    _cachedContexts: {},

    /**
     * Grab or create a cached canvas context for a given fontSize/family pair.
     * @todo Add font-weight as a new dimension for caching.
     *
     * @param {Integer} fontSize The font size of the canvas we want.
     * @param {String} fontFamily The font family of the canvas we want.
     * @param {String} fontStyle The style of the font (default to italic).
     * @return {CanvasRenderingContext2D} A context with the specified font.
     */
    _getCachedContext: function(fontSize, fontFamily, fontStyle) {
      // Default to italic style since this code is only ever used
      // by headers right now and header text is always italic.
      fontStyle = fontStyle || 'italic';

      var cache = this._cachedContexts;
      var ctx = cache[fontSize] && cache[fontSize][fontFamily] ?
                cache[fontSize][fontFamily][fontStyle] : null;

      if (!ctx) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('moz-opaque', 'true');
        canvas.setAttribute('width', '1');
        canvas.setAttribute('height', '1');

        ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.font = fontStyle + ' ' + fontSize + 'px ' + fontFamily;

        // Populate the contexts cache.
        if (!cache[fontSize]) {
          cache[fontSize] = {};
        }
        if (!cache[fontSize][fontFamily]) {
          cache[fontSize][fontFamily] = {};
        }
        cache[fontSize][fontFamily][fontStyle] = ctx;
      }

      return ctx;
    },

    /**
     * Clear any current canvas contexts from the cache.
     */
    resetCache: function() {
      this._cachedContexts = {};
    },

    /**
     * Use a single observer for all text changes we are interested in.
     */
    _textChangeObserver: null,

    /**
     * Auto resize all text changes.
     * @param {Array} mutations A MutationRecord list.
     */
    _handleTextChanges: function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        this._reformatHeaderText(mutations[i].target);
      }
    },

    /**
     * Singleton-like interface for getting our text change observer.
     * By reusing the observer, we make sure we only ever attach a
     * single observer to any given element we are interested in.
     */
    _getTextChangeObserver: function() {
      if (!this._textChangeObserver) {
        this._textChangeObserver = new MutationObserver(
          this._handleTextChanges.bind(this));
      }
      return this._textChangeObserver;
    },

    /**
     * Perform auto-resize when textContent changes on element.
     *
     * @param {HTMLElement} element The element to observer for changes
     */
    _observeHeaderChanges: function(element) {
      var observer = this._getTextChangeObserver();
      // Listen for any changes in the child nodes of the header.
      observer.observe(element, { childList: true });
    },

    /**
     * Resize and reposition the header text based on string length and
     * container position.
     *
     * @param {HTMLElement} header h1 text inside header to reformat.
     */
    _reformatHeaderText: function(header) {
      // Skip resize logic if header has no content, ie before localization.
      if (header.textContent.trim() === '') {
        return;
      }

      // Reset our centering styles.
      this.resetCentering(header);

      // Cache the element style properites to avoid reflows.
      var style = this.getStyleProperties(header);

      // Perform auto-resize and center.
      style.textWidth = this.autoResizeElement(header, style);
      this.centerTextToScreen(header, style);
    },

    /**
     * Reformat all the headers located inside a DOM node, and add mutation
     * observer to reformat when any changes are made.
     *
     * @param {HTMLElement} domNode
     */
    _registerHeadersInSubtree: function(domNode) {
      if (!domNode) {
        return;
      }

      var headers = domNode.querySelectorAll('header > h1');
      for (var i = 0; i < headers.length; i++) {
        // On some apps wrapping inside a requestAnimationFrame reduces the
        // number of calls to _reformatHeaderText().
        window.requestAnimationFrame(function(header) {
          this._reformatHeaderText(header);
          this._observeHeaderChanges(header);
        }.bind(this, headers[i]));
      }
    },

    /**
     * Get the width of a string in pixels, given its fontSize and fontFamily.
     *
     * @param {String} string The string we are measuring.
     * @param {Integer} fontSize The size of the font to measure against.
     * @param {String} fontFamily The font family to measure against.
     * @param {String} fontStyle The style of the font (default to italic).
     * @return {Integer} The pixel width of the string with the given font.
     */
    getFontWidth: function(string, fontSize, fontFamily, fontStyle) {
      var ctx = this._getCachedContext(fontSize, fontFamily, fontStyle);
      return ctx.measureText(string).width;
    },

    /**
     * Get the maximum allowable fontSize for a string such that it will
     * not overflow past a maximum width.
     *
     * @param {String} string The string for which to check max font size.
     * @param {Array} allowedSizes A list of fontSizes allowed.
     * @param {String} fontFamily The font family of the string we're measuring.
     * @param {Integer} maxWidth The maximum number of pixels before overflow.
     * @return {Object} Dict containing fontSize, overflow and textWidth.
     */
    getMaxFontSizeInfo: function(string, allowedSizes, fontFamily, maxWidth) {
      var fontSize;
      var resultWidth;
      var i = allowedSizes.length - 1;

      do {
        fontSize = allowedSizes[i];
        resultWidth = this.getFontWidth(string, fontSize, fontFamily);
        i--;
      } while (resultWidth > maxWidth && i >= 0);

      return {
        fontSize: fontSize,
        overflow: resultWidth > maxWidth,
        textWidth: resultWidth
      };
    },

    /**
     * Get the amount of characters truncated from overflow ellipses.
     *
     * @param {String} string The string for which to check max font size.
     * @param {Integer} fontSize The font size of the string we are measuring.
     * @param {String} fontFamily The font family of the string we're measuring.
     * @param {Integer} maxWidth The maximum number of pixels before overflow.
     */
    getOverflowCount: function(string, fontSize, fontFamily, maxWidth) {
      var substring;
      var resultWidth;
      var overflowCount = -1;

      do {
        overflowCount++;
        substring = string.substr(0, string.length - overflowCount);
        resultWidth = this.getFontWidth(substring, fontSize, fontFamily);
      } while (substring.length > 0 && resultWidth > maxWidth);

      return overflowCount;
    },

    /**
     * Get an array of allowed font sizes for an element
     *
     * @param {HTMLElement} element The element to get allowed sizes for.
     * @return {Array} An array containing pizels values of allowed sizes.
     */
    getAllowedSizes: function(element) {
      if (element.tagName === 'H1' && element.parentNode.tagName === 'HEADER') {
        return HEADER_SIZES;
      }
      // No allowed sizes for this element, so return empty array.
      return [];
    },

    /**
     * Get an element's content width disregarding its box model sizing.
     *
     * @param {HTMLElement|Object} HTML element, or style object.
     * @returns {Number} width in pixels of elements content.
     */
    getContentWidth: function(style) {
      var width = parseInt(style.width, 10);
      if (style.boxSizing === 'border-box') {
        width -= (parseInt(style.paddingRight, 10) +
          parseInt(style.paddingLeft, 10));
      }
      return width;
    },

    /**
     * Get an element's style properies.
     *
     * @param {HTMLElement} element The element from which to fetch style.
     * @return {Object} A dictionary containing element's style properties.
     */
    getStyleProperties: function(element) {
      var style = window.getComputedStyle(element);
      var contentWidth = this.getContentWidth(style);
      if (isNaN(contentWidth)) {
        contentWidth = 0;
      }

      return {
        fontFamily: style.fontFamily,
        contentWidth: contentWidth,
        paddingRight: parseInt(style.paddingRight, 10),
        paddingLeft: parseInt(style.paddingLeft, 10),
        offsetLeft: element.offsetLeft
      };
    },

    /**
     * Auto resize element's font to fit its content width.
     *
     * @param {HTMLElement} element The element to perform auto-resize on.
     * @param {Object} styleOptions Dictionary containing cached style props,
     *                 to avoid reflows caused by grabbing style properties.
     * @return {Integer} The pixel width of the resized text.
     */
    autoResizeElement: function(element, styleOptions) {
      var allowedSizes = this.getAllowedSizes(element);
      if (allowedSizes.length === 0) {
        return 0;
      }

      var contentWidth = styleOptions.contentWidth ||
        this.getContentWidth(element);

      var fontFamily = styleOptions.fontFamily ||
        getComputedStyle(element).fontFamily;

      var info = this.getMaxFontSizeInfo(
        element.textContent.trim(),
        allowedSizes,
        fontFamily,
        contentWidth
      );

      element.style.fontSize = info.fontSize + 'px';

      return info.textWidth;
    },

    /**
     * Reset the auto-centering styling on an element.
     *
     * @param {HTMLElement} element The element to reset.
     */
    resetCentering: function(element) {
      // We need to set the lateral margins to 0 to be able to measure the
      // element width properly. All previously set values are ignored.
      element.style.marginLeft = element.style.marginRight = '0';
    },

    /**
     * Center an elements text based on screen position rather than container.
     *
     * @param {HTMLElement} element The element whose text we want to center.
     * @param {Object} styleOptions Dictionary containing cached style props,
     *                 avoids reflows caused by caching style properties.
     */
    centerTextToScreen: function(element, styleOptions) {
      // Calculate the minimum amount of space needed for the header text
      // to be displayed without overflowing its content box.
      var minHeaderWidth = styleOptions.textWidth + styleOptions.paddingRight +
        styleOptions.paddingLeft;

      // Get the amount of space on each side of the header text element.
      var sideSpaceLeft = styleOptions.offsetLeft;
      var sideSpaceRight = this.getWindowWidth() - sideSpaceLeft -
        styleOptions.contentWidth - styleOptions.paddingRight -
        styleOptions.paddingLeft;

      // If both margins have the same width, the header is already centered.
      if (sideSpaceLeft === sideSpaceRight) {
        return;
      }

      // To center, we need to make sure the space to the left of the header
      // is the same as the space to the right, so take the largest of the two.
      var margin = Math.max(sideSpaceLeft, sideSpaceRight);

      // If the minimum amount of space our header needs plus the max margins
      // fits inside the width of the window, we can center this header.
      // We subtract 1 pixels to wrap text like Gecko.
      // See https://bugzil.la/1026955
      if (minHeaderWidth + (margin * 2) < this.getWindowWidth() - 1) {
        element.style.marginLeft = element.style.marginRight = margin + 'px';
      }
    },

    _initHeaderFormatting: function() {
      if (navigator.mozL10n) {
        // When l10n is ready, register all displayed headers for formatting.
        navigator.mozL10n.once(function() {
          this._registerHeadersInSubtree(document.body);
        }.bind(this));
      } else {
        this._registerHeadersInSubtree(document.body);
      }
    },

    /**
     * Initialize the FontSizeUtils, add overflow handler and perform
     * auto resize once strings have been localized.
     */
    init: function() {
      // Listen for lazy loaded DOM to register new headers.
      window.addEventListener('lazyload', function(evt) {
        this._registerHeadersInSubtree(evt.detail);
      }.bind(this));

      // Once document is ready, format any headers already in the DOM.
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', function() {
          this._initHeaderFormatting();
        }.bind(this));
      } else {
        this._initHeaderFormatting();
      }
    },

    /**
     * Cache and return the width of the inner window.
     *
     * @return {Integer} The width of the inner window in pixels.
     */
    getWindowWidth: function() {
      return window.innerWidth;
    }
  };

  FontSizeUtils.init();

  exports.FontSizeUtils = FontSizeUtils;
}(this));

define("shared/font_size_utils", function(){});

/**
 * SettingsService is a singleton that provides the navigation service. It
 * gets the corresponding panel module from PanelCache and call to its basic
 * functions when navigating.
 *
 * @module SettingsService
 */
define('modules/settings_service',['require','modules/page_transitions','modules/panel_cache','shared/screen_layout','settings'],function(require) {
    

    var PageTransitions = require('modules/page_transitions');
    var PanelCache = require('modules/panel_cache');
    var ScreenLayout = require('shared/screen_layout');
    var Settings = require('settings');

    var _rootPanelId = null;
    /**
     * _currentNavigation caches information of the current panel including id,
     * element, module, and options.
     */
    var _currentNavigation = null;
    var _navigating = false;
    var _pendingNavigationRequest = null;

    var _cachedNavigation = null;
    var _cachedNavigationOptions = {};

    var _activityHandler = null;

    var _loadModulesForSubPanelsPromise = null;

    var _getAppNameToLink = function ss_get_app_name_to_link(panelId) {
      var reAppName = /app:(\w+)/;
      var name = reAppName.exec(panelId);
      return name && name[1];
    };

    var _getAppInfo = function ss_get_app_info(appName) {
      // We can customize the path for specific apps
      var _supportedAppInFrame = {
        keyboard: {},
        bluetooth: {}
      };

      var appInfo = _supportedAppInFrame[appName];
      if (!appInfo) {
        return false;
      }

      var prefix = 'app://' + appName + '.gaiamobile.org/';
      var defaultSrc = prefix + 'settings.html';
      var appMozapp = prefix + 'manifest.webapp';
      var appSrc = appInfo.src ? prefix + appInfo.src : defaultSrc;

      return {
        src: appSrc,
        mozapp: appMozapp
      };
    };

    var _isTabletAndLandscape = function ss_is_tablet_and_landscape() {
      return ScreenLayout.getCurrentLayout('tabletAndLandscaped');
    };

    var _retriveParentPanelId = function ss_retriveParentPanelId(panelId) {
      var headerSelector = '#' + panelId + ' > gaia-header';
      var header = document.querySelector(headerSelector);
      return (header && header.dataset.href || '').replace('#', '');
    };

    var _shallCloseActivity = function ss_shallCloseActivity(panelId) {
      // If we're handling an activity and the 'back' button is hit, close the
      // activity if the panel id to be navigated equals the parent panel id.

      // This is for the root panel
      if (panelId === 'home') {
        return true;
      }

      if (!_currentNavigation) {
        return false;
      }

      // Get the parent panel id of the current panel.
      var parentPanelId = _retriveParentPanelId(_currentNavigation.panelId);

      // Close the activity if the current panel is the original target panel,
      // and the new panel is the parent panel of the current panel.
      return _currentNavigation.panelId === _activityHandler.targetPanelId &&
        panelId === parentPanelId;
    };

    var _transit = function ss_transit(oldPanel, newPanel, callback) {
      var promise = new Promise(function(resolve) {
        var wrappedCallback = function() {
          if (typeof callback === 'function') {
            callback();
          }
          resolve();
        };

        if (_isTabletAndLandscape()) {
          PageTransitions.twoColumn(oldPanel, newPanel, wrappedCallback);
        } else {
          PageTransitions.oneColumn(oldPanel, newPanel, wrappedCallback);
        }
      });
      return promise;
    };

    var _loadPanel = function ss_loadPanel(panelId, callback) {
      var panelElement = document.getElementById(panelId);
      if (panelElement.dataset.rendered) { // already initialized
        callback();
        return;
      }
      panelElement.dataset.rendered = true;

      // XXX remove SubPanel loader once sub panel are modulized
      if (panelElement.dataset.requireSubPanels) {
        // load the panel and its sub-panels (dependencies)
        // (load the main panel last because it contains the scripts)
        var selector = 'section[id^="' + panelElement.id + '-"]';
        var subPanels = document.querySelectorAll(selector);
        for (var i = 0, il = subPanels.length; i < il; i++) {
          LazyLoader.load([subPanels[i]]);
        }
        LazyLoader.load([panelElement], callback);
      } else {
        LazyLoader.load([panelElement], callback);
      }
    };


    var _loadModulesForSubPanels = function ss_loadModules(panelId) {
      if (panelId === _rootPanelId) {
        return Promise.resolve();
      } else {
        if (!_loadModulesForSubPanelsPromise) {
          _loadModulesForSubPanelsPromise = new Promise(function(resolve) {
            require([
              // XXX: It is assumed that the string for the header of the root
              //      panel always fits and the font size utils are not
              //      required.
              'shared/font_size_utils', // used by all header building blocks
              'shared/async_storage'
            ], resolve);
          });
        }
        return _loadModulesForSubPanelsPromise;
      }
    };

    var _onVisibilityChange = function ss_onVisibilityChange() {
      _handleVisibilityChange(!document.hidden);
    };

    /**
     * When the app becomes invisible, we should call to beforeHide and hide
     * functions of the current panel. When the app becomes visible, we should
     * call to beforeShow and show functions of the current panel with the
     * cached options.
     */
    var _handleVisibilityChange = function ss_onVisibilityChange(visible) {
      if (!_currentNavigation) {
        return;
      }

      var panel = _currentNavigation.panel;
      var element = _currentNavigation.panelElement;
      var options = _currentNavigation.options;

      if (!panel) {
        return;
      }

      options.isVisibilityChange = true;
      if (visible) {
        panel.beforeShow(element, options);
        panel.show(element, options);
      } else {
        panel.beforeHide();
        panel.hide();
      }
    };

    var _navigate = function ss_navigate(panelId, options, callback) {
      // Early return if the panel to be navigated is the same as the
      // current one.
      if (_currentNavigation && _currentNavigation.panelId === panelId) {
        callback();
        return;
      }

      _loadPanel(panelId, function() {
        // We have to make sure l10n is ready before navigations
        navigator.mozL10n.once(function() {
          PanelCache.get(panelId, function(panel) {
            var newPanelElement = document.getElementById(panelId);
            var currentPanelId =
               _currentNavigation && _currentNavigation.panelId;
            var currentPanelElement =
              _currentNavigation && _currentNavigation.panelElement;
            var currentPanel = _currentNavigation && _currentNavigation.panel;

            // Keep these to make sure we can use when going back
            _cachedNavigation = _currentNavigation;
            _cachedNavigationOptions = options;

            // Prepare options and calls to the panel object's before
            // show function.
            options = options || {};

            // 0. start the chain
            _loadModulesForSubPanels(panelId)
            // 1. beforeHide previous panel
            .then(function() {
              // We don't deactivate the root panel.
              NavigationMap.currentActivatedLength = 1 ;
              if (currentPanel && currentPanelId !== _rootPanelId) {
                return currentPanel.beforeHide();
              }
            })
            // 2. beforeShow next panel
            .then(function() {
              return panel.beforeShow(newPanelElement, options);
            })
            // 3. do the transition
            .then(function() {
              return _transit(currentPanelElement, newPanelElement);
            })
            // 4. hide previous panel
            .then(function() {
              // We don't deactivate the root panel.
              if (currentPanel && currentPanelId !== _rootPanelId) {
                return currentPanel.hide();
              }
            })
            // 5. show next panel
            .then(function() {
              return panel.show(newPanelElement, options);
            })
            // 6. keep information
            .then(function() {
              // Update the current navigation object
              _currentNavigation = {
                panelId: panelId,
                panelElement: newPanelElement,
                panel: panel,
                options: options
              };

              // XXX we need to remove this line in the future
              // to make sure we won't manipulate Settings
              // directly
              Settings._currentPanel = '#' + panelId;
              NavigationMap.currentActivatedLength = 0 ;
              Settings.isBackHref = false;
              callback();
            });
          });
        });
      });
    };

    return {
      reset: function ss_reset() {
        _rootPanelId = null;
        _currentNavigation = null;
        _cachedNavigation = null;
        _cachedNavigationOptions = {};
        _activityHandler = null;
        _navigating = false;
        _pendingNavigationRequest = null;
        window.removeEventListener('visibilitychange', _onVisibilityChange);
      },

      /**
       * Init SettingsService.
       *
       * @alias module:SettingsService#init
       * @param {Object} options
       * @param {String} options.rootPanelId
       *                 Panel with the specified id is assumed to be be kept on
       *                 on the screen always. We don't call to its hide and
       *                 beforeHide functions.
       * @param {Object} options.context
       *                 The launch context specifying the default panel and the
       *                 activity handler if the app is invoked by web
       *                 activities.
       * @param {String} options.context.initialPanelId
       * @param {ActivityHandler} options.context.activityHandler
       */
      init: function ss_init(options) {
        if (options) {
          _rootPanelId = options.rootPanelId || 'root';
          _activityHandler = options.context && options.context.activityHandler;
        }

        window.addEventListener('visibilitychange', _onVisibilityChange);
      },

      preLoad: function ss_preload(panelId, callback) {
        _loadPanel(panelId, function() {
          // We have to make sure l10n is ready before navigations
          navigator.mozL10n.once(function() {
            PanelCache.get(panelId, function(panel) {
              if (callback) {
                callback();
              }
            });
          });
        });
      },

      /**
       * Navigate to a panel with options. The navigation transition is
       * determined based on the current screen size and orientation.
       *
       * @alias module:SettingsService#navigate
       * @param {String} panelId
       * @param {Object} options
       * @param {Function} callback
       */
      navigate: function ss_navigate(panelId, options, callback) {
        // Check if the app is invoked by web activity and shall post result.
        if (_activityHandler && _shallCloseActivity(panelId)) {
          _activityHandler.postResult();
          return;
        }

        // Cache the navigation request if it is navigating.
        if (_navigating) {
          _pendingNavigationRequest = arguments;
          return;
        }

        // If we find out the link includes information about app's name,
        // it means that we are going to embed the app into our app.
        //
        // In this way, we have to navigate to `frame` panel and embed it.
        var appName = _getAppNameToLink(panelId);
        if (appName) {
          var appInfo = _getAppInfo(appName);

          if (!appInfo) {
            console.error('We only embed trust apps.');
            return;
          }

          panelId = 'frame';
          options = options || {};
          options.mozapp = appInfo.mozapp;
          options.src = appInfo.src;
        }

        _navigating = true;
        _navigate(panelId, options, (function() {
          _navigating = false;

          // Navigate to the pending navigation if any.
          if (_pendingNavigationRequest) {
            var args = _pendingNavigationRequest;
            _pendingNavigationRequest = null;
            this.navigate.apply(this, args);
          }

          if (callback) {
            callback();
          }
        }).bind(this));
      },

      /**
       * Go back to previous panel
       *
       * @alias module:SettingsService#back
       */
      back: function ss_back() {
        if (_cachedNavigation) {
          this.navigate(_cachedNavigation.panelId, _cachedNavigationOptions);
          _cachedNavigation = null;
          _cachedNavigationOptions = {};
        }
      }
    };
});

/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



var DsdsSettings = (function(window, document, undefined) {
  var _settings = window.navigator.mozSettings;
  var _mobileConnections = null;
  if (window.navigator.mozMobileConnections) {
    _mobileConnections = window.navigator.mozMobileConnections;
  }
  /** */
  var _iccCardIndexForCallSettings = 0;

  /** */
  let _iccCardIndexForVolteSettings = 0;

  /** */
  var _iccCardIndexForCellAndDataSettings = 0;

  /**
   * Init function.
   */
  function ds_init() {
    if (!_settings || !_mobileConnections) {
      return;
    }
    ds_handleDefaultIccCard();
    ds_handleCellAndDataSettingSimPanel();
  }

  /**
   * Get number of ICC slots.
   *
   * @return {Numeric} Number of ICC slots.
   */
  function ds_getNumberOfIccSlots() {
    if (_mobileConnections) {
      return _mobileConnections.length;
    }
  }

  /**
   *
   */
  function ds_getIccCardIndexForCallSettings() {
    return _iccCardIndexForCallSettings;
  }

  /**
   *
   */
  function ds_setIccCardIndexForCallSettings(
    iccCardIndexForCallSettings) {
    _iccCardIndexForCallSettings = iccCardIndexForCallSettings;
  }

  /**
   *
   */
  function ds_getIccCardIndexForVolteSettings() {
    return _iccCardIndexForVolteSettings;
  }

  /**
   *
   */
  function ds_setIccCardIndexForVolteSettings(
    iccCardIndexForVolteSettings) {
    _iccCardIndexForVolteSettings = iccCardIndexForVolteSettings;
  }

  /**
   *
   */
  function ds_getIccCardIndexForCellAndDataSettings() {
    return _iccCardIndexForCellAndDataSettings;
  }

  /**
   * Find out first available iccID for default iccID
   */
  function ds_handleDefaultIccCard() {
    for (var i = 0, len = _mobileConnections.length; i < len; i++) {
      if (_mobileConnections[i].iccId !== null) {
        ds_setIccCardIndexForCellAndDataSettings(i);
        break;
      }
    }
  }

  /**
   *
   */
  function ds_setIccCardIndexForCellAndDataSettings(
    iccCardIndexForCellAndDataSettings) {
    _iccCardIndexForCellAndDataSettings = iccCardIndexForCellAndDataSettings;
  }

  /**
   * Hide or show the cell and data settings panel in which we show the ICC
   * cards.
   */
  function ds_handleCellAndDataSettingSimPanel() {
    var cellAndDataItem = null;

    if (ds_getNumberOfIccSlots() > 1) {
      cellAndDataItem = document.getElementById('menuItem-cellularAndData');
      if ((_mobileConnections[0].radioState !== 'enabled') ||
          (!_mobileConnections[0].iccId &&
           !_mobileConnections[1].iccId)) {
        return;
      }
      cellAndDataItem = document.getElementById('data-connectivity');
      cellAndDataItem.removeAttribute('aria-disabled');
      cellAndDataItem.classList.remove('none-select');
    }
  }

  // Public API.
  return {
    init: ds_init,
    getNumberOfIccSlots: ds_getNumberOfIccSlots,
    getIccCardIndexForCallSettings:
      ds_getIccCardIndexForCallSettings,
    setIccCardIndexForCallSettings:
      ds_setIccCardIndexForCallSettings,
    getIccCardIndexForVolteSettings:
      ds_getIccCardIndexForVolteSettings,
    setIccCardIndexForVolteSettings:
      ds_setIccCardIndexForVolteSettings,
    getIccCardIndexForCellAndDataSettings:
      ds_getIccCardIndexForCellAndDataSettings,
    setIccCardIndexForCellAndDataSettings:
      ds_setIccCardIndexForCellAndDataSettings
  };
})(this, document);

define("dsds_settings", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.DsdsSettings;
    };
}(this)));

require(['config/require'], function() {
  

  define('boot', ['require','utils','shared/settings_listener','modules/settings_service','shared/screen_layout','settings','dsds_settings'],function(require) {
    // The following are the scripts used by many other scripts. We load them
    // at once here. These should be move to the dependency of each panel in the
    // future.
    require('utils');
    require('shared/settings_listener');

    var SettingsService = require('modules/settings_service');
    var ScreenLayout = require('shared/screen_layout');
    var Settings = require('settings');
    var DsdsSettings = require('dsds_settings');

    function isInitialPanel(panel) {
      if (Settings.isTabletAndLandscape()) {
        return panel === Settings.initialPanelForTablet;
      } else {
        return panel === ('#' + window.LaunchContext.initialPanelId);
      }
    }

    window.addEventListener('panelready', function onPanelReady(e) {
      if (!isInitialPanel(e.detail.current)) {
        return;
      }

      var initialPanelHandler = window.LaunchContext.initialPanelHandler;
      if (initialPanelHandler) {
        //initialPanelHandler.release();
        var pendingTargetPanel = initialPanelHandler.pendingTargetPanel;
        // XXX: In bluetooth and call item,
        // we need special logic for navigating to specific panels.

        if (pendingTargetPanel) {
          SettingsService.navigate(pendingTargetPanel);
        }
      }

      window.removeEventListener('panelready', onPanelReady);

      // XXX: Even the panel has been displayed but the content may still not
      //      stable yet. This is a estimated timing of visually complete. We
      //      should implement other mechanism waiting for all content ready.
      if (e.detail.current !== '#root') {
        window.performance.mark('visuallyLoaded');
      } else {
        // Preload 'display' panel for preload wallpaper
        Settings.SettingsService.preLoad('display');
      }
      window.dispatchEvent(new CustomEvent('moz-app-visually-complete'));

      // Activate the animation.
      document.body.dataset.ready = true;
    }, false);

    window.addEventListener('telephony-settings-loaded',
      function onTelephonySettingsLoaded() {
        window.removeEventListener('telephony-settings-loaded',
          onTelephonySettingsLoaded);

        // The loading of telephony settings is dependent on being idle,
        // once complete we are safe to declare the settings app as loaded
        window.performance.mark('fullyLoaded');
        window.dispatchEvent(new CustomEvent('moz-app-loaded'));
      });

    window.addEventListener('largetextenabledchanged', () => {
      document.body.classList.toggle('large-text', navigator.largeTextEnabled);
    });

    /**
     * In two column layout, the root panel should not be deactivated. We pass
     * the id of the root panel to SettingsService so that it won't deactivate
     * the root panel when in two column.
     * XXX: Currently we don't separate the navigation logic of one column and
     *      two column layout, so that the root panel will not be deactivated
     *      in one column layout.
     */
    SettingsService.init({
      rootPanelId: 'root',
      context: window.LaunchContext
    });

    var options = {
      SettingsService: SettingsService,
      ScreenLayout: ScreenLayout
    };
    Settings.init(options);

    // Tell audio channel manager that we want to adjust the notification
    // channel if the user press the volumeup/volumedown buttons in Settings.
    if (navigator.mozAudioChannelManager) {
      navigator.mozAudioChannelManager.volumeControlChannel = 'notification';
    }
  });

  require(['boot']);
});

define("main", function(){});
