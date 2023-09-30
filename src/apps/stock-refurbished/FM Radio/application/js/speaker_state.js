/* exported SpeakerState */
'use strict';

(function(exports) {

  var SpeakerState = {
    _speakerManager: null,

    init: function() {
      window.SpeakerManager = window.SpeakerManager || window.MozSpeakerManager;
      this._speakerManager = new SpeakerManager('playing');
      this._speakerManager.forcespeaker = false;
    },

    get state() {
      return this._speakerManager.forcespeaker;
    },

    set state(value) {
      if ((value !== true) && (value !== false)) {
        return;
      }

      this._speakerManager.forcespeaker = value;

      StatusManager.update();
    }
  };

  exports.SpeakerState = SpeakerState;
})(window);
