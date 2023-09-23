/* eslint no-console: "off" */
(() => {
  console.log('Sync Frequency Worker start............................');
  self.timer = null;
  self.dispatchSyncDaemonTask = (frequency) => {
    self.timer = setInterval(() => {
      postMessage({
        msgType: 'timer-start-syncFrequency-daemon'
      });
    }, frequency * 60 * 1000);
  };

  self.addEventListener('message', (e) => {
    if (!e) return;
    // eslint-disable-next-line no-unused-vars
    const msg = e.data;
    if ('start-syncFrequency-daemon' === msg.action) {
      const { frequency } = msg;
      if (null === self.timer) {
        self.dispatchSyncDaemonTask(frequency);
      } else {
        clearInterval(self.timer);
        self.dispatchSyncDaemonTask(frequency);
      }
    } else if ('stop-syncFrequency-daemon' === msg.action) {
      if (self.timer !== null) {
        clearInterval(self.timer);
      }
    }
  });
})();
