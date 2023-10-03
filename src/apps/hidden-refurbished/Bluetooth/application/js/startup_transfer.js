

require(['config/require', 'modules/transfer_manager'], function(config, TransferManager) {
  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function btst_debug(msg) {
      console.log('--> [startup_transfer]: ' + msg);
    };
  }

  debug('Bluetooth transfer manager startup.');
  navigator.mozL10n.once(() => TransferManager.init());
});
