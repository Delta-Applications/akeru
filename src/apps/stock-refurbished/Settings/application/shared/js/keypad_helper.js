

/* global */

(function(exports) {

var KeypadHelper = function() {
  this.t9Enabled = null;
  this.wordSuggestion = null;
  this.layouts = null;
  this.activeLayout = null;
  this.activeMode = null;
  this.defalutLayout = null;
};

KeypadHelper.prototype.DISPLAY_LANGUAGES = {
  'english': 'English',
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
  'kashmiri': 'کأشُر',
  'portuguese_br': 'Português(BR)',
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
  'portuguese_pt': 'Português(PT)',
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
  'bosnian_latin': 'Bosanski(latin)',
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
  'galician': 'Galego',
  'basque': 'Euskara',
  'catalan': 'Català',
  'spanish_mx': 'Español(MX)',
  'burmese': 'မြန်မာဘာသာ',
  'french_af': 'Français(AF)',
  'portuguese_af': 'Português(AF)',
  'spanish_ar': 'Español(AR)',
  'bosnian_cyrillic': 'Bosanski(ćirilicom)',
  'russian_blr': 'Русский(Беларусь)',
  'english_gl': 'English(general)'
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
  'kashmiri': 'کأ',
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
  'korean': '가',
  'burmese': 'ဗမာ'
};

KeypadHelper.prototype.SETTINGS_KEYS = {
  T9_ENABLED: 'keypad.t9-enabled',
  WORD_SUGGESTION: 'keypad.wordsuggestion',
  KEYPAD_LAYOUTS: 'keypad.layouts',
  DEFALUT_LAYOUT: 'keypad.layouts.defalut',
  ACTIVE_LAYOUT: 'keypad.active-layout',
  ACTIVE_MODE: 'keypad.active-mode'
};

KeypadHelper.prototype.getDisplayLanguageName = function(key) {
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
      var promise = new Promise((resolve, reject) => {
        var lock = this.mozSettings.createLock();
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
        if (lock.forceClose) {
          lock.forceClose()
        }
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
    case this.SETTINGS_KEYS.KEYPAD_LAYOUTS:
      this.layouts = value;

      if (option && option.notify && this.layoutsChangedCallback) {
        this.layoutsChangedCallback(this.layouts);
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
    case this.SETTINGS_KEYS.DEFALUT_LAYOUT:
      this.defalutLayout = value;
      break;
    default:
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
  if (lock.forceClose) {
    lock.forceClose();
  }
};

KeypadHelper.prototype.setT9Enabled = function(option) {
  this._stashSettings(this.SETTINGS_KEYS.T9_ENABLED, option, {save: true});
};

KeypadHelper.prototype.setWordSuggestion = function(option) {
  this._stashSettings(this.SETTINGS_KEYS.WORD_SUGGESTION, option, {save: true});
};

KeypadHelper.prototype.setActiveLayout = function(layout) {
  this._stashSettings(this.SETTINGS_KEYS.ACTIVE_LAYOUT, layout, {save: true});
};

KeypadHelper.prototype.setActiveMode = function(mode) {
  this._stashSettings(this.SETTINGS_KEYS.ACTIVE_MODE, mode, {save: true});
};

KeypadHelper.prototype.setDefaultLayout = function() {
  for (let key in this.layouts) {
    this.layouts[key] = key === this.defalutLayout;
  }

  this._stashSettings(this.SETTINGS_KEYS.KEYPAD_LAYOUTS, this.layouts, {save: true});
};

KeypadHelper.prototype.setLayouts = function(layouts) {
  this._stashSettings(this.SETTINGS_KEYS.KEYPAD_LAYOUTS, layouts, {save: true});
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
