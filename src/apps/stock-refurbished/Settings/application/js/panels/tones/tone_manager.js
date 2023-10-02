/* global getSupportedNetworkInfo, loadJSON*/
/**
 * Used to manager tone in panels/tones/panel.js
 */
define(['require','shared/settings_listener','shared/omadrm/fl'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var ForwardLock = require('shared/omadrm/fl');

  var ToneManager = function() {
    this._elements = null;
    this._tones = null;
    this._isClickEffect = true;
    this.effectTimeout = null;
  };

  ToneManager.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf ToneManager.prototype
     */
    init: function tm_init(elements) {
      this._elements = elements;
      this._configureTones();
      this._handleTones();
    },

    /**
     * Initialize the ring tone and alert tone menus.
     *
     * @access private
     * @memberOf ToneManager.prototype
     */
    _configureTones: function tm_configureTones() {
      // This array has one element for each selectable tone that
      // appears in the "Tones" section of ../elements/sound.html.
      this._tones = [{
        pickType: 'alerttone',
        settingsKey: 'notification.ringtone',
        allowNone: true, // Allow "None" as a choice for alert tones.
        button: this._elements.alertToneSelection,
        desc: this._elements.alertToneSelectionDesc
      }];

      // If we're a telephone, then show the section for ringtones, too.
      if (navigator.mozTelephony) {
        this._tones.push({
          pickType: 'ringtone',
          settingsKey: 'dialer.ringtone',
          allowNone: false, // The ringer must always have an actual sound.
          button: this._elements.ringToneSelection,
          desc: this._elements.ringToneSelectionDesc
        });
        this._elements.ringer.hidden = false;
      }
    },

    /**
     * The button looks like a select element and holds the name of the
     * currently-selected tone. Sometimes the name is an l10n ID
     * and sometimes it is just text.
     *
     * @access private
     * @memberOf ToneManager.prototype
     */
    _renderToneName: function tm_renderToneName(tone, tonename) {
      var l10nID = tonename && tonename.l10nID;

      if (l10nID) {
        tone.desc.setAttribute('data-l10n-id', l10nID);
      } else {
        tone.desc.removeAttribute('data-l10n-id');
        tone.desc.textContent = tonename;
      }
    },

    /**
     * render tone content
     *
     * @access private
     * @memberOf ToneManager.prototype
     * @param  {Object} tone     tone element
     * @param  {Object} result     web activity result
     * @param  {String} secret   sound is playable
     */
    _renderTone: function tm_renderTone(tone, result, secret) {
      var oldRingtoneName = null;

      var l10nId = tone.desc.getAttribute('data-l10n-id');
      if (!l10nId) {
        oldRingtoneName = tone.desc.textContent;
      }
      tone.desc.setAttribute('data-l10n-id', 'saving-tone');
      var promise;
      var self = this;
      // If we got a locked ringtone, we have to unlock it first
      if (result.blob.type.split('/')[1] === ForwardLock.mimeSubtype) {
        ForwardLock.unlockBlob(secret, result.blob, function(unlocked) {
          promise = self._isPlayableTone(unlocked);
        });
      } else {  // Otherwise we can just use the blob directly.
        promise = self._isPlayableTone(result.blob);
      }
      promise.then(function(isPlayable) {
        if (isPlayable) {
          self._setRingtone(tone.settingsKey, result.l10nID,
            result.name, result.blob, result.id);
        } else {
          if (l10nId) {
            tone.desc.setAttribute('data-l10n-id', l10nId);
          } else {
             // remove temp 'saving-tone' l10nId
            tone.desc.removeAttribute('data-l10n-id');
            tone.desc.textContent = oldRingtoneName;
          }
          var dialogConfig = {
            title: {
              id: 'confirmation',
              args: {}
            },
            body: {
              id: 'unplayable-ringtone',
              args: {}
            },
            accept: {
              l10nId: 'ok',
              priority: 2,
              callback: function() {}
            },
          };
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
        }
      });
    },

    /**
     * Call web activity to pick a tone
     *
     * @access private
     * @memberOf ToneManager.prototype
     * @param  {Object} tone          tone element
     * @param  {Number} currentToneID tone id
     * @param  {String} secret        forwardlock secret key
     */
    _pickTone: function tm_pickRingTone(tone, currentToneID, secret) {
      var self = this;
      var activity = new MozActivity({
        name: 'pick',
        data: {
          type: tone.pickType,
          allowNone: tone.allowNone,
          currentToneID: currentToneID,
          // If we have a secret then there is locked content on the
          // phone so include it as a choice for the user
          includeLocked: (secret !== null)
        }
      });

      activity.onsuccess = function() {
        self._isClickEffect = true;
        var result = activity.result;
        if (!result.blob) {
          if (tone.allowNone) {
            // If we allow a null blob, then everything is okay
            self._setRingtone(tone.settingsKey, result.l10nID, result.name,
              result.blob, result.id);
          } else {
            // Otherwise this is an error and we should not change the
            // current setting. (The ringtones app should never return
            // a null blob if allowNone is false, but other apps might.)
            var dialogConfig = {
              title: {
                id: 'confirmation',
                args: {}
              },
              body: {
                id: 'unplayable-ringtone',
                args: {}
              },
              accept: {
                l10nId: 'ok',
                priority: 2,
                callback: function() {}
              },
            };
            var dialog = new ConfirmDialogHelper(dialogConfig);
            dialog.show(document.getElementById('app-confirmation-dialog'));
          }
          return;
        }
        console.log("***before renderTone****");
        self._renderTone(tone, result, secret);
      };
      activity.onerror = function () {
        self._isClickEffect = true;
      };
    },

    /**
     * Update Ringtones list.
     *
     * @access private
     * @memberOf ToneManager.prototype
     */
    _handleTones: function tm_handleTones() {
      // For each kind of tone, hook up the button that will allow the user
      // to select a sound for that kind of tone.
      this._tones.forEach(function(tone) {
        var nameKey = tone.settingsKey + '.name';
        var idKey = tone.settingsKey + '.id';

        SettingsListener.observe(nameKey, '',
          this._renderToneName.bind(this, tone));

        var self = this;
        // When the user clicks the button, we launch an activity that lets
        // the user select new ringtone.
        tone.button.addEventListener('click', function() {
          // First, get the ID of the currently-selected tone.
          if (!self._isClickEffect) {
            if (!self.effectTimeout) {
              self.effectTimeout = setTimeout(() => {
                self._isClickEffect = true;
                self.effectTimeout = null;}, 1500);
            }
            return;
          }
          self._isClickEffect = false;
          SettingsDBCache.getSettings(function(results) {
            var currentToneID = results[idKey];

            // Before we can start the Pick activity, we need to know if there
            // is locked content on the phone because we don't want the user to
            // see "Purchased Media" as a choice if there isn't any purchased
            // media on the phone. The ForwardLock secret key is not generated
            // until it is needed, so we can use its existance to
            // determine whether to show the Purchased Media app.
            ForwardLock.getKey(function(secret) {
              self._pickTone(tone, currentToneID, secret);
            });
          });
        });
      }.bind(this));
    },

    /**
     * Save the sound blob in the settings so that other apps can use it.
     * Also save the sound name in the db so we can display it in the
     * future.  And update the button text to the new name now.
     *
     * @access private
     * @memberOf ToneManager.prototype
     * @param  {String} settingsKey   key string
     * @param  {String} l10nID        element l10nID id
     * @param  {String} toneName      element name
     * @param  {Blob} blob            tone blob
     * @param  {String} id            tone id
     */
    _setRingtone: function tm_setRingtone(settingsKey, l10nID, toneName,
      blob, id) {
      var blobKey = settingsKey;
      var nameKey = settingsKey + '.name';
      var idKey = settingsKey + '.id';

      // Update the settings database. This will cause the button
      // text to change as well because of the SettingsListener above.
      var values = {};
      var name = l10nID ? {l10nID : l10nID} : toneName;

      values[blobKey] = blob;
      values[nameKey] = name || '';
      values[idKey] = id;
      navigator.mozSettings.createLock().set(values);
    },

    /**
     * Make sure that the blob we got from the activity is actually
     * a playable audio file. It would be very bad to set an corrupt
     * blob as a ringtone because then the phone wouldn't ring!
     *
     * @access private
     * @memberOf ToneManager.prototype
     * @param  {Blob} blob            tone blob
     * @return {Promise} A promise that resolves to the media playable stat
     */
    _isPlayableTone: function tm_isPlayableTone(blob) {
      return new Promise(function(resolve, reject) {
        var player = new Audio();
        player.preload = 'metadata';
        player.src = URL.createObjectURL(blob);
        player.oncanplay = function() {
          release();
          resolve(true);
        };
        player.onerror = function() {
          release();
          resolve(false);
        };

        function release() {
          URL.revokeObjectURL(player.src);
          player.removeAttribute('src');
          player.load();
        }
      });
    },
  };

  return function ctor_toneManager() {
    return new ToneManager();
  };
});
