/*global Utils */
(function(exports) {
  'use strict';

  exports.TimeHeaders = {
    updateTimer: null,

    init: function th_init() {
      onvisibilityChange();
      document.addEventListener('visibilitychange', onvisibilityChange);
    },
    startScheduler: function th_startScheduler() {
      let now = Date.now(),
          nextTimeout = new Date(now + 60000);
      nextTimeout.setSeconds(0);
      nextTimeout.setMilliseconds(0);

      // stop updateTimer first
      this.stopScheduler();

      // then register a new one
      this.updateTimer = setTimeout(() => {
        this.updateAll('header[data-time-update=repeat]');
        this.startScheduler();
      }, nextTimeout.getTime() - now);
    },
    stopScheduler: function th_stopScheduler() {
      clearTimeout(this.updateTimer);
    },
    updateAll: function th_updateAll(selector) {
      selector = selector || '[data-time-update]';
      let elements = document.querySelectorAll(selector),
          length = elements.length,
          i;

      for (i = 0; i < length; i++) {
        this.update(elements[i]);
      }
    },
    update: function th_update(element) {
      let ts = element.dataset.time;
      if (!ts) {
        return;
      }

      Utils.initDateTime(ts);

      let newElement;

      // only date
      if (element.dataset.dateOnly === 'true') {
        newElement = Utils.getHeaderDate();
      // only time
      } else if (element.dataset.timeOnly === 'true') {
        newElement = Utils.getFormattedHour();
      // date + time
      } else {
        newElement = Utils.getAllHeaderDate();
      }
      if (newElement !== element.textContent) {
        element.textContent = newElement;
      }
    }
  };

  function onvisibilityChange() {
    if (document.hidden) {
      TimeHeaders.stopScheduler();
    }
    else {
      TimeHeaders.updateAll();
      TimeHeaders.startScheduler();
    }
  }
}(this));
