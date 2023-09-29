/* exported HistoryFrequency */
'use strict';

(function(exports) {

  // HistoryFrequency Constructor
  var HistoryFrequency = function() {
    this.KEYNAME = 'history';
    this.historyFrequency = 0;
  };

  // Initialize history frequency
  HistoryFrequency.prototype.init = function(callback) {
    // Read history frequency just from local storage
    this.historyFrequency = window.localStorage.getItem(this.KEYNAME);

    // Change history frequency value to number forcely
    if (this.historyFrequency && (typeof this.historyFrequency !== 'Number')) {
      this.historyFrequency = Number(this.historyFrequency);
    }

    // Mark history frequency as the lower bound frequency if invalid
    if (!this.historyFrequency) {
      this.historyFrequency = mozFMRadio.frequencyLowerBound;
    }

    if (callback && typeof callback === 'function') {
      callback();
    }
  };

  // Add and save current frequency to history and save to local storage
  HistoryFrequency.prototype.add = function(frequency) {
    if (!frequency) {
      return;
    }

    this.historyFrequency = frequency;
    try {
      window.localStorage.setItem(this.KEYNAME, this.historyFrequency);
    } catch (e) {
      console.error('Failed set history frequency :'+ e);
    }
  };

  HistoryFrequency.prototype.getFrequency = function() {
    return this.historyFrequency;
  };

  exports.HistoryFrequency = new HistoryFrequency();
})(window);
