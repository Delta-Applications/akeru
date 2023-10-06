'use strict';

/* global */

(function(exports) {

var KeypadHelper = function() {
  this.t9Enabled = null;
  this.wordSuggestion = null;
  this.layouts = null;
  this.activeLayout = null;
  this.activeMode = null;
};

KeypadHelper.prototype.DISPLAY_LANGUAGES = {
  'english_us': 'English(US)',
  'spanish_us': 'Español(US)',
  'french_ca': 'Français(CA)',
  'hindi':'हिन्दी',
  'assamese': 'অসমীয়া',
  'bengali': 'বাংলা(IN)',
  'gujarati': 'ગુજરાતી',
  'marathi': 'मराठी',
  'telugu': 'తెలుగు',
  'tamil': 'தமிழ்',
  'malayalam': 'മലയാളം',
  'punjabi': 'ਪੰਜਾਬੀ',
  'odia': 'ଓଡ଼ିଆ',
  'kannada': 'ಕನ್ನಡ',
  'nepali': 'नेपाली',
  'konkani': 'कोंकणी',
  'maithili': 'मैथिली',
  'dogri': 'डोगरी',
  'sindhi': 'सिन्धी',
  'sanskrit': 'संस्कृत',
  'manipuri': 'মণিপুরী',
  'bodo': 'बोड़ो',
  'santali': 'ᱥᱟᱱᱛᱟᱞᱤ',
  'urdu': 'اُردُو',
  'portugese_br': 'Português(BR)',
  'afrikaans': 'Afrikaans',
  'arabic': 'العربية',
  'chinese_cn': '中文(拼音)',
  'dutch': 'Nederlands',
  'english_gb': 'English(GB)',
  'french_fr': 'Français(FR)',
  'german': 'Deutsch',
  'hungarian': 'Magyar',
  'indonesian': 'Bahasa Indonesia',
  'italian': 'Italiano',
  'malay': 'Bahasa Melayu',
  'persian': 'فارسی',
  'polish': 'Polski',
  'portugese_pt': 'Português(PT)',
  'romanian': 'Română',
  'russian': 'Русский',
  'spanish_es': 'Español(ES)',
  'swahili': 'Kiswahili',
  'thai': 'ไทย',
  'turkish': 'Türkçe',
  'vietnamese': 'Tiếng Việt',
  'zulu': 'isiZulu',
  'bengali_bd': 'বাংলা(BD)',
  'bulgarian': 'Български',
  'croatian': 'Hrvatski',
  'czech': 'Česky',
  'finnish': 'Suomi',
  'greek': 'Ελληνικά',
  'kazakh': 'Қазақша',
  'khmer': 'ភាសាខ្មែរ',
  'macedonian': 'Македонски',
  'serbian': 'Српски',
  'sinhala': 'සිංහල',
  'slovak': 'Slovenčina',
  'slovenian': 'Slovenščina',
  'swedish': 'Svenska',
  'tagalog': 'Tagalog',
  'ukrainian': 'Українська',
  'xhosa': 'isiXhosa',
  'albanian': 'Shqip',
  'armenian': 'Հայերեն',
  'azerbaijani': 'Azərbaycan',
  'belarusian': 'Беларуская',
  'bosnian': 'Bosanski',
  'chinese_hk': '中文(筆劃)',
  'chinese_tw': '中文(注音)',
  'danish': 'Dansk',
  'estonian': 'Eesti',
  'georgian': 'ქართული',
  'hebrew': 'עברית',
  'icelandic': 'Íslenska',
  'lao': 'ລາວ',
  'latvian': 'Latviešu',
  'lithuanian': 'Lietuvių',
  'norwegian': 'Norsk (bokmål)',
  'uzbek_cyrillic': 'O\'zbek',
  'korean': '한국어(대한민국)',
  'galician': 'Galego',
  'basque': 'Euskara',
  'catalan': 'Català'
};

KeypadHelper.prototype.LANGUAGES_ICON_TEXT = {
  'hindi':'हि',
  'assamese': 'অস',
  'bengali': 'বাং',
  'gujarati': 'ક',
  'marathi': 'ळ',
  'telugu': 'కే',
  'tamil': 'க',
  'malayalam': 'ക',
  'punjabi': 'ਕ',
  'odia': 'କ',
  'kannada': 'ಕೆ',
  'nepali': 'नेपा',
  'konkani': 'कों',
  'maithili': 'मैथ',
  'dogri': 'डो',
  'sindhi': 'सि',
  'sanskrit': 'संस',
  'manipuri': 'মণি',
  'bodo': 'बर',
  'santali': 'ᱟ',
  'urdu': 'اُردُو',
  'arabic': 'Ar',
  'chinese_cn': '拼',
  'persian': 'Pe',
  'thai': 'Th',
  'bengali_bd': 'বাং',
  'khmer': 'Km',
  'sinhala': 'Si',
  'chinese_hk': '筆',
  'chinese_tw': '注',
  'georgian': 'Ka',
  'hebrew': 'He',
  'lao': 'Lo',
  'korean': '가'
};

KeypadHelper.prototype.SETTINGS_KEYS = {
  T9_ENABLED: 'keypad.t9-enabled',
  WORD_SUGGESTION: 'keypad.wordsuggestion',
  EN_US: 'keypad.layouts.english_us',
  ES_US: 'keypad.layouts.spanish_us',
  FR_CA: 'keypad.layouts.french_ca',
  HI_IN: 'keypad.layouts.hindi',
  AS_IN: 'keypad.layouts.assamese',
  BN_IN: 'keypad.layouts.bengali',
  GU_IN: 'keypad.layouts.gujarati',
  MR_IN: 'keypad.layouts.marathi',
  TE_IN: 'keypad.layouts.telugu',
  TA_IN: 'keypad.layouts.tamil',
  ML_IN: 'keypad.layouts.malayalam',
  PN_IN: 'keypad.layouts.punjabi',
  OD_IN: 'keypad.layouts.odia',
  KA_IN: 'keypad.layouts.kannada',
  NE_IN: 'keypad.layouts.nepali',
  KO_IN: 'keypad.layouts.konkani',
  MA_IN: 'keypad.layouts.maithili',
  DO_IN: 'keypad.layouts.dogri',
  SI_IN: 'keypad.layouts.sindhi',
  SA_IN: 'keypad.layouts.sanskrit',
  MN_IN: 'keypad.layouts.manipuri',
  BO_IN: 'keypad.layouts.bodo',
  SN_IN: 'keypad.layouts.santali',
  UR_IN: 'keypad.layouts.urdu',
  PO_BR: 'keypad.layouts.portugese_br',
  AF: 'keypad.layouts.afrikaans',
  AR: 'keypad.layouts.arabic',
  ZH_CN: 'keypad.layouts.chinese_cn',
  DU: 'keypad.layouts.dutch',
  EN_GB: 'keypad.layouts.english_gb',
  FR_FR: 'keypad.layouts.french_fr',
  GE: 'keypad.layouts.german',
  HU: 'keypad.layouts.hungarian',
  IN: 'keypad.layouts.indonesian',
  IT: 'keypad.layouts.italian',
  MA: 'keypad.layouts.malay',
  PE: 'keypad.layouts.persian',
  PO: 'keypad.layouts.polish',
  RO: 'keypad.layouts.romanian',
  PO_PT: 'keypad.layouts.portugese_pt',
  RU: 'keypad.layouts.russian',
  ES_ES: 'keypad.layouts.spanish_es',
  SW: 'keypad.layouts.swahili',
  TH: 'keypad.layouts.thai',
  TU: 'keypad.layouts.turkish',
  VI: 'keypad.layouts.vietnamese',
  ZU: 'keypad.layouts.zulu',
  BN_BD: 'keypad.layouts.bengali_bd',
  BG: 'keypad.layouts.bulgarian',
  HR: 'keypad.layouts.croatian',
  CS: 'keypad.layouts.czech',
  FI: 'keypad.layouts.finnish',
  EL: 'keypad.layouts.greek',
  KK: 'keypad.layouts.kazakh',
  KM: 'keypad.layouts.khmer',
  MK: 'keypad.layouts.macedonian',
  SR: 'keypad.layouts.serbian',
  SI: 'keypad.layouts.sinhala',
  SK: 'keypad.layouts.slovak',
  SL: 'keypad.layouts.slovenian',
  SV: 'keypad.layouts.swedish',
  TL: 'keypad.layouts.tagalog',
  UK: 'keypad.layouts.ukrainian',
  XH: 'keypad.layouts.xhosa',
  SQ: 'keypad.layouts.albanian',
  HY: 'keypad.layouts.armenian',
  AZ: 'keypad.layouts.azerbaijani',
  BE: 'keypad.layouts.belarusian',
  BS: 'keypad.layouts.bosnian',
  ZH_HK: 'keypad.layouts.chinese_hk',
  ZH_TW: 'keypad.layouts.chinese_tw',
  DA: 'keypad.layouts.danish',
  ET: 'keypad.layouts.estonian',
  KA: 'keypad.layouts.georgian',
  HE: 'keypad.layouts.hebrew',
  IS: 'keypad.layouts.icelandic',
  LO: 'keypad.layouts.lao',
  LV: 'keypad.layouts.latvian',
  LT: 'keypad.layouts.lithuanian',
  NO: 'keypad.layouts.norwegian',
  UZ: 'keypad.layouts.uzbek_cyrillic',
  KO: 'keypad.layouts.korean',
  GA: 'keypad.layouts.galician',
  BA: 'keypad.layouts.basque',
  CA: 'keypad.layouts.catalan',
  ACTIVE_LAYOUT: 'keypad.active-layout',
  ACTIVE_MODE: 'keypad.active-mode'
};

KeypadHelper.prototype.getDisplayLanguageName = function(key) {
  key = key.split('keypad.layouts.')[1];
  return this.DISPLAY_LANGUAGES[key];
};

KeypadHelper.prototype.start = function() {
  this._startComponents();
};

KeypadHelper.prototype._startComponents = function() {
  this.mozSettings = window.navigator.mozSettings;

  this._observeSettings();
};

KeypadHelper.prototype._observeSettings = function() {
  var handler = (event) => {
    var key = event.settingName;
    var value = event.settingValue;

    this._stashSettings(key, value, {notify: true});
  };

  for (var prop in this.SETTINGS_KEYS) {
    var key = this.SETTINGS_KEYS[prop];
    this.mozSettings.addObserver(key, handler);
  }
};

KeypadHelper.prototype.getSettings = function() {
  return new Promise((resolve, reject) => {
    var promises = [];

    for (var prop in this.SETTINGS_KEYS) {
      var key = this.SETTINGS_KEYS[prop];
      var lock = this.mozSettings.createLock();

      var promise = new Promise((resolve, reject) => {
        lock.get(key).onsuccess = (event) => {
          var result = event.target.result;
          var key, value;

          if (result) {
            for (var prop in result) {
              key = prop;
              value = result[prop];
            }

            this._stashSettings(key, value);
            resolve();
          } else {
            reject();
          }
        };
      });

      promises.push(promise);
    }

    Promise.all(promises).then(() => {
      var result = {
        t9Enabled: this.t9Enabled,
        wordSuggestion: this.wordSuggestion,
        layouts: this.layouts,
        activeLayout: this.activeLayout,
        activeMode: this.activeMode
      };
      resolve(result);
    }).catch((reason) => {
      console.log(reason);
      reject();
    });
  });
};

KeypadHelper.prototype._stashSettings = function(key, value, option) {
  switch (key) {
    case this.SETTINGS_KEYS.T9_ENABLED:
      this.t9Enabled = value;

      if (option && option.notify && this.t9ChangedCallback) {
        this.t9ChangedCallback(value);
      }
      break;
    case this.SETTINGS_KEYS.WORD_SUGGESTION:
      this.wordSuggestion = value;

      if (option && option.notify && this.wordSuggestionChangedCallback) {
        this.wordSuggestionChangedCallback(value);
      }
      break;
    case this.SETTINGS_KEYS.ACTIVE_LAYOUT:
      this.activeLayout = value;

      if (option && option.notify && this.activeLayoutChangedCallback) {
        this.activeLayoutChangedCallback(value);
      }
      break;
    case this.SETTINGS_KEYS.ACTIVE_MODE:
      this.activeMode = value;

      if (option && option.notify && this.activeModeChangedCallback) {
        this.activeModeChangedCallback(value);
      }
      break;
    default:
      if (!this.layouts) {
        this.layouts = new Map();
      }

      if (key) {
        this.layouts.set(key, value);
      }

      if (option && option.notify && this.layoutsChangedCallback) {
        this.layoutsChangedCallback(this.layouts);
      }
      break;
  }

  if (option && option.save) {
    this._saveSettings(key, value);
  }
};

KeypadHelper.prototype._saveSettings = function(key, value) {
  var lock = this.mozSettings.createLock();
  var setting = {};
  setting[key] = value;
  lock.set(setting);
};

KeypadHelper.prototype.setT9Enabled = function(option) {
  this._stashSettings(this.SETTINGS_KEYS.T9_ENABLED, option, {save: true});
};

KeypadHelper.prototype.setWordSuggestion = function(option) {
  this._stashSettings(this.SETTINGS_KEYS.WORD_SUGGESTION, option, {save: true});
};

KeypadHelper.prototype.setLayoutEnabled = function(layout, option) {
  this._stashSettings(this.SETTINGS_KEYS[layout], option, {save: true});
};

KeypadHelper.prototype.setActiveLayout = function(layout) {
  this._stashSettings(this.SETTINGS_KEYS.ACTIVE_LAYOUT, layout, {save: true});
};

KeypadHelper.prototype.setActiveMode = function(mode) {
  this._stashSettings(this.SETTINGS_KEYS.ACTIVE_MODE, mode, {save: true});
};

KeypadHelper.prototype.getT9Enabled = function() {
  return new Promise((resolve, reject) => {
    if (this.t9Enabled === null) {
      this.getSettings().then((result) => {
        resolve(result.t9Enabled);
      });
    } else {
      resolve(this.t9Enabled);
    }
  });
};

KeypadHelper.prototype.getWordSuggestion = function() {
  return new Promise((resolve, reject) => {
    if (this.wordSuggestion === null) {
      this.getSettings().then((result) => {
        resolve(result.wordSuggestion);
      });
    } else {
      resolve(this.wordSuggestion);
    }
  });
};

KeypadHelper.prototype.getLayouts = function() {
  return new Promise((resolve, reject) => {
    this.getSettings().then((result) => {
      resolve(result.layouts);
    });
  });
};

KeypadHelper.prototype.getActiveLayout = function() {
  return new Promise((resolve, reject) => {
    if (this.activeLayout === null) {
      this.getSettings().then((result) => {
        resolve(result.activeLayout);
      });
    } else {
      resolve(this.activeLayout);
    }
  });
};

KeypadHelper.prototype.getActiveMode = function() {
  return new Promise((resolve, reject) => {
    if (this.activeMode === null) {
      this.getSettings().then((result) => {
        resolve(result.activeMode);
      });
    } else {
      resolve(this.activeMode);
    }
  });
};

KeypadHelper.prototype.setT9ChangedCallback = function(callback) {
  this.t9ChangedCallback = callback;
};

KeypadHelper.prototype.setWordSuggestionChangedCallback = function(callback) {
  this.wordSuggestionChangedCallback = callback;
};

KeypadHelper.prototype.setLayoutsChangedCallback = function(callback) {
  this.layoutsChangedCallback = callback;
};

KeypadHelper.prototype.setActiveLayoutChangedCallback = function(callback) {
  this.activeLayoutChangedCallback = callback;
};

KeypadHelper.prototype.setActiveModeChangedCallback = function(callback) {
  this.activeModeChangedCallback = callback;
};

exports.KeypadHelper = KeypadHelper;

})(window);
