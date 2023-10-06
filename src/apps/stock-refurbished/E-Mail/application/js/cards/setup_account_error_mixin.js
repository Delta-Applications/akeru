
define(['require','./setup_l10n_map','l10n!','toaster'],function(require) {
  let SETUP_ERROR_L10N_ID_MAP = require('./setup_l10n_map'),
      mozL10n = require('l10n!'),
      toaster = require('toaster');

  return {
    // note: this method is reused by setup_account_info and
    // setup_manual_config.
    showError: function(errName, errDetails) {

      // Attempt to get a user-friendly string for the error we got. If we can't
      // find a match, just show the "unknown" error string.
      let errorStr = SETUP_ERROR_L10N_ID_MAP.hasOwnProperty(errName) ?
          SETUP_ERROR_L10N_ID_MAP[errName] :
          SETUP_ERROR_L10N_ID_MAP.unknown;
      mozL10n.setAttributes(this.errorMessageNode, errorStr, errDetails);
      let errorNode = document.querySelector('.sup-error-region');
      let timeout = 3000;
      errorNode.classList.add('collapsed');
      setTimeout(() => {
        toaster.toast({
          text: this.errorMessageNode.textContent,
          timeout: timeout
        });
      });
    }
  };
});
