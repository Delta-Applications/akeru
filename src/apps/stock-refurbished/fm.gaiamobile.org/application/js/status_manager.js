/* exported FocusManager */
'use strict';

(function(exports) {

  // StatusManager Constuctor
  function StatusManager() {

  // Indicate initialized status
  this.status = 1;

  // Update only no valid antenna or airplane is enabled
  this.STATUS_WARNING_SHOWING   = 0;
  // Update only show favorite list UI, even no favorite frequency
  this.STATUS_FAVORITE_SHOWING  = 1;
  // Update only show renaming frequency UI
  this.STATUS_FAVORITE_RENAMING = 2;
  // Update only show stations list UI
  this.STATUS_STATIONS_SCANING  = 3;
  // Update only show stations scanning UI
  this.STATUS_STATIONS_SHOWING  = 4;
  // Update only show FTU dialog
  this.STATUS_DIALOG_FIRST_INIT = 5;

  };

  // Update current status
  StatusManager.prototype.update = function(status) {
    // Update current status if status valid
    switch (status) {
      case this.STATUS_WARNING_SHOWING:
      case this.STATUS_FAVORITE_SHOWING:
      case this.STATUS_FAVORITE_RENAMING:
      case this.STATUS_STATIONS_SCANING:
      case this.STATUS_STATIONS_SHOWING:
      case this.STATUS_DIALOG_FIRST_INIT:
        this.status = status;
        break;
      default:
        break;
    }

    // Update softkeys according to current state
    FMSoftkeyHelper.updateSoftkeys();
    //Update the header title
    FMSoftkeyHelper.updateHeaderTitle();
  };

  exports.StatusManager = new StatusManager();
})(window);
