/* global BaseModule */

'use strict';

(function() {
  var Radio = function(core) {
    /*
     * An internal key used to make sure Radio is
     * enabled or not.
     *
     * @default {Boolean} null
     */
    this._enabled = null;

    /*
     * An internal key used to track how may operations have
     * been executed on radio.
     *
     * @default {Number} 0
     */
    this._setRadioOpCount = 0;

    /*
     * An internal key used to track whether there is any error
     * happened when calling setRadioEnabled
     *
     * @default {Boolean} false
     */
    this._isSetRadioOpError = false;

    /*
     * An internal variable to cache mozMobileConnections
     */
    this._mobileConnections = core.mobileConnections || null;
  };

  Radio.EVENTS = [
    'airplanemode-enabled',
    'airplanemode-disabled'
  ];

  BaseModule.create(Radio, {
    name: 'Radio',
    EVENT_PREFIX: 'radio',

    '_handle_airplanemode-enabled': function() {
      this.enabled = false;
    },

    '_handle_airplanemode-disabled': function() {
      this.enabled = true;
    },

    _onRadioStateChange: function(conn, index) {
      this.debug('radiostatechange: [' + index + '] ' + conn.radioState);
      this.publish('statechange', {
        index: index,
        state: conn.radioState
      });
    },

    /*
     * An internal function used to make sure current radioState
     * is ok to do following operations.
     */
    _start: function() {
      this._simcardsPresent = 0;
      this.mobileConnections.forEach(function(conn, index) {
        conn.addEventListener('radiostatechange',
          this._onRadioStateChange.bind(this, conn, index));
        if (conn.iccId) {
          this._simcardsPresent++;
        }
      }, this);
      this.service.request('AirplaneMode:registerNetwork', 'radio', this);
      var airplaneMode = this.service.query('AirplaneMode.isActive');
      if (undefined !== airplaneMode) {
        this.enabled = !airplaneMode;
      }
    },

    _stop: function() {
      this.service.request('AirplaneMode:unregisterNetwork', 'radio', this);
    },

    /*
     * An internal function used to make sure current radioState
     * is ok to do following operations.
     *
     * @param {MozMobileConnection} conn
     * @param {Boolean} enabled
     */
    _setRadioEnabled: function(conn, enabled, index) {
      this.debug(conn.radioState + ' ======> ' + enabled);
      if (conn.radioState !== 'enabling' &&
          conn.radioState !== 'disabling' &&
          conn.radioState !== null) {
        this._doSetRadioEnabled(conn, enabled, index);
      } else {
        var radioStateChangeHandler = (function onchange() {
          if (conn.radioState == 'enabling' ||
              conn.radioState == 'disabling' ||
              conn.radioState == null) {
            return;
          }
          conn.removeEventListener('radiostatechange',
            radioStateChangeHandler);
          this._doSetRadioEnabled(conn, enabled, index);
        }).bind(this);
        conn.addEventListener('radiostatechange', radioStateChangeHandler);
      }
    },

    /*
     * An internal function to tell Gecko setRadioEnabled
     *
     * @param {MozMobileConnection} conn
     * @param {Boolean} enabled
     */
    _doSetRadioEnabled: function(conn, enabled, index) {
      this.debug('Real operation to turn ' + (enabled ? 'on' : 'off') +
        ' for ' + index + ' connection.');
      var self = this;
      (function() {
        var req = conn.setRadioEnabled(enabled);

        req.onsuccess = function() {
          self._setRadioOpCount++;
          self._setRadioAfterReqsCalled(enabled);
        };

        req.onerror = function() {
          self.debug('toggle connection ' + index + ' error.');
          self._isSetRadioOpError = true;
          self._setRadioOpCount++;
          self._setRadioAfterReqsCalled(enabled);
        };
      }());
    },

    /*
     * We have to make sure all mobileConnections work
     * as what we have expected and dispatch event to
     * tell AirplaneMode that Radio operations are done.
     *
     * @param {Boolean} enabled
     */
    _setRadioAfterReqsCalled: function(enabled) {
      if (this._isSetRadioOpError) {
        throw new Error('We got error when disabling radio');
      }

      // XXX, on some DSDS devices when there's only one simcard avaliable,
      // readioState will stay at enabling/disabling on the empty slot (no update from ril),
      // leave us at an arkward state that the count is not equal to
      // mobileconnections.length. Instead, we use number of simcards present as a workaround,
      // consider setRadioEnabled done when there's no simcard or operation count equal to
      // simcards present in callback of the request.
      // TODO: fix gecko and ril and revert this patch
      if (this._setRadioOpCount !== this.mobileConnections.length &&
          this._setRadioOpCount !== this._simcardsPresent &&
          this._simcardsPresent !== 0) {
        this.debug('operation not completed yet.', this._setRadioOpCount);
        return;
      } else {
        this._enabled = enabled;
        var evtName = enabled ?
          '-enabled' : '-disabled';

        this.publish(evtName);
      }
    }
  }, {
    /*
     * We can use this value to know Radio is enabled or not
     *
     * @return {Boolean}
     */
    enabled: {
      congfigurable: false,
      get: function() {
        return this._enabled;
      },
      /*
       * We can set this value to tell Radio service turn on / off
       * radio.
       *
       * @param {Boolean} value
       */
      set: function(value) {
        this.debug(this._enabled + ' => ' + value);
        if (value !== this._enabled) {
          this._setRadioOpCount = 0;
          this._isSetRadioOpError = false;

          this.mobileConnections.forEach(function(conn, index) {
            this._setRadioEnabled(conn, value, index);
          }, this);
        }
      }
    },

    /*
     * An internal helper to make mobileConnections iterable
     */
    mobileConnections: {
      congfigurable: false,
      get: function() {
        if (!this._mozMobileConnections) {
          this._mozMobileConnections =
            Array.prototype.slice.call(this._mobileConnections);
        }
        return this._mozMobileConnections;
      }
    }
  });
})();
