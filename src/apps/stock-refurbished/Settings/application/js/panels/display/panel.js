
/* global MozActivity */
/**
 * Wallpaper:
 *   - Select wallpaper by calling wallpaper.selectWallpaper.
 *   - Update wallpaperSrc if wallpaper.image is changed, which is watched
 *     by Observable module.
 * Wallpaper handles only data and does not involve in any UI logic.
 *
 * @module Wallpaper
 */
define('panels/display/wallpaper',['require','shared/settings_listener','shared/settings_url','shared/omadrm/fl','modules/mvvm/observable'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var SettingsURL = require('shared/settings_url');
  var ForwardLock = require('shared/omadrm/fl');
  var Observable = require('modules/mvvm/observable');
  var WALLPAPER_KEY = 'wallpaper.image';
  /**
   * @alias module:display/wallpaper
   * @requires module:modules/mvvm/observable
   * @returns {wallpaperPrototype}
   */
  var wallpaperPrototype = {
    /**
     * Init Wallpaper module.
     *
     * @access private
     * @memberOf wallpaperPrototype
     */
    _init: function w_init() {
      this.WALLPAPER_KEY = WALLPAPER_KEY;
      this.wallpaperURL = new SettingsURL();
      this._watchWallpaperChange();
      this.inSelectWallpaper = false;
    },

    _downResolusion: function w_down_resolusion(blob) {
      return new Promise((resolve) => {
        LazyLoader.load([
          'shared/js/media/image_size.js',
          'shared/js/blobview.js',
          'shared/js/media/downsample.js',
          'shared/js/media/jpeg_metadata_parser.js'], () => {
          getImageSize(blob, (metadata) => {
            let imagesize = metadata.width * metadata.height;
            let scale = (window.innerWidth * window.devicePixelRatio
              * window.innerHeight * window.devicePixelRatio) / imagesize;
            let sampleSize = Downsample.areaNoMoreThan(scale);
            let url = URL.createObjectURL(blob);
            url = url + sampleSize;

            // Create a canvas to have an image that is exactly
            // the size of the screen in device pixels.
            let canvas = document.createElement('canvas');
            // To have an image which matches the device pixel, we need to multiply
            // window.devicePixelRatio.
            let screenWidth = document.body.clientWidth * window.devicePixelRatio;
            let screenHeight = document.body.clientHeight * window.devicePixelRatio;

            canvas.width = screenWidth;
            canvas.height = screenHeight;
            let img = new Image();
            img.src = url
            img.onload = () => {
              // The image has been decoded now, so we know its actual size.
              // If getSizeAndType failed, or if we used a media fragment then
              // this may be different than the inputWidth and inputHeight
              // values we used previously.
              let actualWidth = img.width;
              let actualHeight = img.height;

              // Now figure how much we have to scale the decoded image down
              // (or up) so that it covers the specified output dimensions.
              let widthScale = screenWidth / actualWidth;
              let heightScale = screenHeight / actualHeight;
              let scale = Math.max(widthScale, heightScale);

              // Scaling the output dimensions by this much tells us the
              // dimensions of the crop area on the decoded image
              let cropWidth = Math.round(screenWidth / scale);
              let cropHeight = Math.round(screenHeight / scale);

              // Now center that crop region within the decoded image
              let cropLeft = Math.floor((actualWidth - cropWidth) / 2);
              let cropTop = Math.floor((actualHeight - cropHeight) / 2);

              // Set up the canvas we need to copy the crop region into
              let cvs = document.createElement('canvas');
              cvs.width = screenWidth;
              cvs.height = screenHeight;
              let context = cvs.getContext('2d');
              context.drawImage(img, cropLeft, cropTop, cropWidth, cropHeight,
                            0, 0, screenWidth, screenHeight);
              cvs.toBlob((newBlob) => {
                URL.revokeObjectURL(img.src);
                resolve(newBlob);
              }, 'image/jpeg');
            };
          });
        });
      });
    },

    /**
     * Watch the value of wallpaper.image from settings and change wallpaperSrc.
     *
     * @access private
     * @memberOf wallpaperPrototype
     */
    _watchWallpaperChange: function w__watch_wallpaper_change() {
      SettingsListener.observe(this.WALLPAPER_KEY, '',
        function onHomescreenchange(value) {
          this.wallpaperSrc = this.wallpaperURL.set(value);
      }.bind(this));
    },

    /**
     * Switch to wallpaper or gallery app to pick wallpaper.
     *
     * @access private
     * @memberOf wallpaperPrototype
     * @param {String} secret
     */
    _triggerActivity: function w__trigger_activity(secret) {
      this.inSelectWallpaper = true;
      var mozActivity = new MozActivity({
        name: 'pick',
        data: {
          type: ['wallpaper', 'image/*'],
          includeLocked: (secret !== null),
          // XXX: This will not work with Desktop Fx / Simulator.
          width: Math.ceil(window.screen.width * window.devicePixelRatio),
          height: Math.ceil(window.screen.height * window.devicePixelRatio),
          appname: 'setting'
        }
      });
      mozActivity.onsuccess = () => {
        this._onPickSuccess(mozActivity.result.blob, secret);
      };

      mozActivity.onerror = () => {
        this._onPickError();
      }
    },

    /**
     * Call back when picking success.
     *
     * @access private
     * @memberOf wallpaperPrototype
     * @param {String} blob
     * @param {String} secret
     */
    _onPickSuccess: function w__on_pick_success(blob, secret) {
      this.inSelectWallpaper = false;
      if (!blob) {
        return;
      }
      if (blob.type.split('/')[1] === ForwardLock.mimeSubtype) {
        // If this is a locked image from the locked content app, unlock it
        ForwardLock.unlockBlob(secret, blob, function(unlocked) {
          this._setWallpaper(unlocked);
        }.bind(this));
      } else {
        this._setWallpaper(blob);
      }
    },

    /**
     * Update the value of wallpaper.image from settings.
     *
     * @access private
     * @param {String} value
     * @memberOf wallpaperPrototype
     */
    _setWallpaper: function w__set_wallpaper(value) {
      DeviceFeature.ready(() => {
        if (DeviceFeature.getValue('lowMemory') === 'true') {
          this._downResolusion(value).then((blob) => {
            let config = {};
            config[this.WALLPAPER_KEY] = blob;
            SettingsListener.getSettingsLock().set(config);
            showToast('changessaved');
          });
        } else {
          let config = {};
          config[this.WALLPAPER_KEY] = value;
          SettingsListener.getSettingsLock().set(config);
          showToast('changessaved');
        }
      });
    },

    /**
     * Call back when picking fail.
     *
     * @access private
     * @memberOf wallpaperPrototype
     */
    _onPickError: function w__on_pick_error() {
      this.inSelectWallpaper = false;
      console.warn('pick failed!');
    },

    /**
     * Source path of wallpaper.
     *
     * @access public
     * @memberOf wallpaperPrototype
     * @type {String}
     */
    wallpaperSrc: '',

    /**
     * Start to select wallpaper.
     *
     * @access public
     * @memberOf wallpaperPrototype
     */
    selectWallpaper: function w_select_wallpaper() {
      ForwardLock.getKey(this._triggerActivity.bind(this));
    }
  };

  return function ctor_wallpaper() {
    // Create the observable object using the prototype.
    var wallpaper = Observable(wallpaperPrototype);
    wallpaper._init();
    return wallpaper;
  };
});

/**
 * Handle the brightness.
 *
 * @module SliderHandler
 */
define('panels/display/slider_handler',['require','shared/settings_listener'],function(require) {
  
  var SettingsListener = require('shared/settings_listener');
  const BRIGHTNESS_KEY = 'screen.brightness';

  var SliderHandler = function() {
    this._container = null;
    this._element = null;
    this._label = null;
    this._value = null;
  };

  SliderHandler.prototype = {
    init: function sh_init(container) {
      this._container = container;
      this._element = container.querySelector('input');
      this._label = container.querySelector('span.level');

      SettingsListener.observe(BRIGHTNESS_KEY, '', this._setSliderValue.bind(this));
      this._container.addEventListener('keydown',
          this._keydownHandler.bind(this));
    },

    _keydownHandler: function sh_keydownHandler(evt) {
      // Add support to RTL
      let isRtl = window.document.dir === 'rtl';
      let arrowLR = isRtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];

      switch (evt.key) {
        case arrowLR[0]:
          this._setBrightness(this._value <= 10 ? 10 : this._value - 10);
          evt.preventDefault();
          break;

        case arrowLR[1]:
          this._setBrightness(this._value >= 100 ? 100 : this._value + 10);
          evt.preventDefault();
          break;

        default:
          break;
      }
    },

    _setSliderValue: function sh_setSliderValue(value) {
      this._element.value = this._value = value * 100;
      // The slider is transparent if the value is not set yet, display it
      // once the value is set.
      if (this._element.style.opacity !== 1) {
        this._element.style.opacity = 1;
      }
      navigator.mozL10n.setAttributes(this._label,
        'display-percent',
        { percent: this._value });
    },

    _setBrightness: function sh_setBrightness(value) {
      var settingObject = {};
      settingObject[BRIGHTNESS_KEY] = (value === 0) ? 0.1 : value / 100;
      navigator.mozSettings.createLock().set(settingObject);
    }
  };

  return function ctor_sliderHandler() {
    return new SliderHandler();
  };
});

/**
 * The display panel allow user to modify timeout forscreen-off, brightness, and
 * change wallpaper.
 */
define('panels/display/panel',['require','modules/settings_panel','panels/display/wallpaper','panels/display/slider_handler'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var WallpaperModule = require('panels/display/wallpaper');
  var SliderHandler = require('panels/display/slider_handler');

  return function ctor_display_panel() {
    var wallpaperElements = {};
    var wallpaper = WallpaperModule();
    var brightnessContainer = null;
    var autoKeypadLockElement = null;
    var autoKeypadLockSelect = null;
    var hideSoftkey = false;
    var listElements = document.querySelectorAll('#display li');
    wallpaperElements = {
      wallpaperPreview: document.querySelector('#display .wallpaper-preview'),
      wallpaperSelect: document.querySelector('#display .wallpaper-select')
    };
    wallpaperElements.wallpaperPreview.src = wallpaper.wallpaperSrc;
    wallpaper.observe('wallpaperSrc', function(newValue) {
      wallpaperElements.wallpaperPreview.src = newValue;
    });
    function _updateSoftkey() {
      var focusedElement = document.querySelector('#display .focus');
      if (!focusedElement) {
        return;
      }
      if (hideSoftkey || focusedElement.classList.contains('none-select')) {
        SettingsSoftkey.hide();
      } else {
        SettingsSoftkey.show();
      }
    }

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
      _updateSoftkey();
    }

    function _wallpaperKeydownHandler(evt) {
      if (evt.key === 'Enter' && !wallpaper.inSelectWallpaper) {
        wallpaper.selectWallpaper();
      }
    }

    function updateWallpaperItem(value) {
      var priviewItem = wallpaperElements.wallpaperPreview;
      var selectItem = wallpaperElements.wallpaperSelect;
      var current = priviewItem.hidden;
      if (!value) {
        priviewItem.hidden = false;
        selectItem.hidden = false;
      } else {
        selectItem.classList.remove('focus');
        priviewItem.hidden = true;
        selectItem.hidden = true;
      }
      if (priviewItem.hidden !== current) {
        NavigationMap.refresh();
      }
    }

    return SettingsPanel({
      onInit: function dp_onInit(panel) {
        brightnessContainer = panel.querySelector('.slider-container');
        autoKeypadLockElement = panel.querySelector('#auto-lock');
        autoKeypadLockSelect = panel.querySelector('#auto-lock select');
        var brightness = SliderHandler();
        brightness.init(brightnessContainer);
      },

      onBeforeShow: function dp_onBeforeShow(panel) {
        if (panel.dataset.brightness) {
          hideSoftkey = true;
        }
        _initSoftKey();
        wallpaper.unobserve('wallpaperSrc');
        wallpaper.observe('wallpaperSrc', function(newValue) {
          wallpaperElements.wallpaperPreview.src = newValue;
        });
        wallpaperElements.wallpaperPreview.src = wallpaper.wallpaperSrc;
        initUIForItem(['screen-timeout', 'auto-lock']);
        addListenerForCustomization([
          'screen.timeout.settings.ui',
          'dm.screen.timeout.settings.ui',
          'pocketmode.autolock.settings.ui',
          'dm.pocketmode.autolock.settings.ui'
        ]);

        SettingsListener.observe('dm.wallpaper.image', null,
          updateWallpaperItem);
        wallpaperElements.wallpaperSelect.addEventListener('keydown', _wallpaperKeydownHandler);
        ListFocusHelper.addEventListener(listElements, _updateSoftkey);
      },

      onShow: function dp_onShow(panel) {
        if (panel.dataset.brightness) {
          requestFocus(panel, brightnessContainer);
        }
        hideSoftkey = false;
        if (window.performance.getEntriesByName('settings-display-start',
            'mark').length > 0) {
          window.performance.mark('settings-display-end');
          window.performance.measure('performance-settings-display',
            'settings-display-start', 'settings-display-end');
          window.performance.clearMarks('settings-display-start');
          window.performance.clearMarks('settings-display-end');
          window.performance.clearMeasures('performance-settings-display');
        }
      },

      onBeforeHide: function dp_onBeforeHide() {
        wallpaper.unobserve('wallpaperSrc');
        removeListenerForCustomization([
          'screen.timeout.settings.ui',
          'dm.screen.timeout.settings.ui',
          'pocketmode.autolock.settings.ui',
          'dm.pocketmode.autolock.settings.ui']);
        SettingsListener.unobserve('dm.wallpaper.image',
          updateWallpaperItem);
        wallpaperElements.wallpaperSelect.removeEventListener('keydown', _wallpaperKeydownHandler);
        ListFocusHelper.removeEventListener(listElements, _updateSoftkey);
      }
    });
  };
});
