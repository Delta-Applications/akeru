

require(['config/require', 'modules/pair_manager'], function(config, PairManager) {
  const LOCK_SCREEN_KEY = 'lockscreen.locked';

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function btam_debug(msg) {
      console.log('--> [PairManager]: ' + msg);
    };
  }

  navigator.mozSettings.createLock().get(LOCK_SCREEN_KEY).then((result) => {
    debug('Get lockscreen state: ' + result[LOCK_SCREEN_KEY]);
    localStorage.setItem(LOCK_SCREEN_KEY, result[LOCK_SCREEN_KEY]);
  }, (error) => {
    localStorage.setItem(LOCK_SCREEN_KEY, false);
    debug('Get lockscreen state failed: ' + error.name);
  });

  debug('Bluetooth pair manager startup.');
  navigator.mozL10n.once(() => PairManager.init());
});
