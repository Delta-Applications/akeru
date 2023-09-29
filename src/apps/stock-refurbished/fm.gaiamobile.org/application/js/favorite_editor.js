/* exported FavoriteEditor */
'use strict';

(function(exports) {

  // FavoriteEditor Constructor
  // FavoriteEditor will be loaded only while station will be renamed
  var FavoriteEditor = function() {
    this.previousStatus = null;
    this.frequencyToRenameElement = null;
  };

  // Switch current frequency list UI to rename mode UI
  FavoriteEditor.prototype.switchToRenameModeUI = function() {
    if (StatusManager.status === StatusManager.STATUS_FAVORITE_RENAMING) {
      // Current status must NOT be STATUS_FAVORITE_RENAMING
      // before switching to rename UI
      return;
    }

    // Hidden frequency bar
    FMElementFrequencyBar.classList.add('hidden');
    // Mark frequency list class to update UI
    FMElementFrequencyListUI.classList.add('edit-mode');
    // Show FM Header
    FMElementFMHeader.classList.remove('hidden');
    
    // Update rename list UI
    FrequencyList.updateRenameListUI();

    // Remember current rename element to get rename name
    this.frequencyToRenameElement = FMElementFrequencyListContainer.children[0];

    // Remember status as previous status to update status again
    // after renamed
    this.previousStatus = StatusManager.status;
    // Update current status to update softkeys
    StatusManager.update(StatusManager.STATUS_FAVORITE_RENAMING);
    // Update focus
    FocusManager.update();
  };

  // Switch rename mode UI to the previous frequency list UI
  FavoriteEditor.prototype.switchToFrequencyListUI = function() {
    if (StatusManager.status !== StatusManager.STATUS_FAVORITE_RENAMING) {
      // Current status must be STATUS_FAVORITE_RENAMING
      // before switching out of rename UI
      return;
    }

    // Mark frequency list class to update UI
    FMElementFrequencyListUI.classList.remove('edit-mode');

    // Update previous status to update softkeys
    StatusManager.update(this.previousStatus);

    if (this.previousStatus === StatusManager.STATUS_FAVORITE_SHOWING) {
      // Previous status is STATUS_FAVORITE_SHOWING
      // Show frequency bar again
      FMElementFrequencyBar.classList.remove('hidden');
      // Update favorite list UI
      FrequencyList.updateFavoriteListUI();
      // Hide FM Header
      FMElementFMHeader.classList.add('hidden');
    } else if (this.previousStatus === StatusManager.STATUS_STATIONS_SHOWING) {
      // Previous status is STATUS_STATIONS_SHOWING
      // Update favorite list UI
      FrequencyList.updateStationsListUI();
    }

    // Update focus
    FocusManager.update(true);
  };

  // Update current rename UI
  FavoriteEditor.prototype.renameFavorite = function() {
    if (!this.frequencyToRenameElement) {
      // Current rename element must be exist
      return;
    }

    // Mark rename element class to update UI
    this.frequencyToRenameElement.classList.add('rename');
    // Hidden current frequency name
    this.frequencyToRenameElement.querySelector('.frequency-list-frequency').classList.add('hidden');

    // Get current frequency name from current rename element
    var frequency = FrequencyList.getFrequencyByElement(this.frequencyToRenameElement);
    var frequencyName = FrequencyList.getFrequencyItemName(frequency);
    if (!frequencyName) {
      return;
    }

    // Update input UI
    var input = this.frequencyToRenameElement.querySelector('input');
    input.value = frequencyName;
    input.classList.remove('hidden');
    input.setSelectionRange(input.value.length, input.value.length);
    input.focus();
    // The max number of char for rename text field is 20.
    input.setAttribute('maxLength', '20');
  };

  // Cancel current rename operation
  FavoriteEditor.prototype.undoRename = function() {
    // Update current rename element UI after or cancel renamed
    this.frequencyToRenameElement.querySelector('.frequency-list-frequency').classList.remove('hidden');
    this.frequencyToRenameElement.querySelector('input').classList.add('hidden');
    this.frequencyToRenameElement.classList.remove('rename');
    this.frequencyToRenameElement.focus();
  };

  // Save the renamed station name
  FavoriteEditor.prototype.saveRename = function() {
    // Get renamed frequency name from input UI
    var frequencyName = this.frequencyToRenameElement.querySelector('input').value;
    var frequency = FrequencyList.getFrequencyByElement(this.frequencyToRenameElement);
    if (!frequencyName) {
      frequencyName = frequency.toFixed(1) + ' MHz';
    }

    // Update renamed frequency name to data base
    FrequencyManager.updateFrequencyName(frequency, frequencyName);

    // Update renamed frequency name to UI
    this.frequencyToRenameElement.querySelector('.frequency-list-frequency').textContent = frequencyName;
    this.undoRename();

    // Show toast to notice renamed success
    FMRadio.showMessage('station-renamed');
  };

  exports.FavoriteEditor = new FavoriteEditor();
})(window);
