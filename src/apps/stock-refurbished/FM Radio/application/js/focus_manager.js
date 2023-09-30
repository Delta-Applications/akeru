/* exported FocusManager */
'use strict';

(function(exports) {

  // FocusManager Constructor
  var FocusManager = function() {
    this.focus = -1;
    this.focusList = {};
    this.previousFocusedItem = null;
    this.previousFocusedIndex = -1;
  };

  // Update current list should be focued in current screen
  FocusManager.prototype.updateCurrentFocusList = function() {
    var elements = [];
    switch (this.focus) {
      case StatusManager.STATUS_FAVORITE_SHOWING:
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
        elements.push(FMElementFrequencyDialer);
      case StatusManager.STATUS_FAVORITE_RENAMING:
      case StatusManager.STATUS_STATIONS_SCANING:
      case StatusManager.STATUS_STATIONS_SHOWING:
        [].forEach.call(FMElementFrequencyListContainer.children, function(element) {
          elements.push(element);
        });
        break;
      default:
        break;
    }

    if (elements.length === 0) {
      return;
    }

    if (!this.focusList[this.focus]) {
      this.focusList[this.focus] = {};
      this.focusList[this.focus].index = 0;
    }
    this.focusList[this.focus].elements = elements;
    return this.focusList[this.focus];
  };

  // Get current focus list
  FocusManager.prototype.getCurrentFocusList = function() {
    return this.focusList[this.focus];
  };

  // Update current focus index
  FocusManager.prototype.updateCurrentFocusIndex = function(index) {
    var focusList = this.getCurrentFocusList();
    if (!focusList || (focusList.elements.length === 0)) {
      return;
    }

    if ((index < 0) || (index >= focusList.elements.length)) {
      return;
    }

    focusList.index = index;
    var focusedItem = focusList.elements[index];
    if (focusedItem) {
      // Update current focused item and index
      this.previousFocusedItem = focusedItem;
      this.previousFocusedIndex = index;
      if (index === 0) {
        this.backOff = true;
      } else {
        this.backOff = false;
      }
    }

    // Dispatch 'index-changed' event
    window.dispatchEvent(new CustomEvent('index-changed', {
      detail: {
        focusedItem: focusedItem
      }
    }));
  };

  // Update current focus
  FocusManager.prototype.update = function(fixed) {
    switch (StatusManager.status) {
      case StatusManager.STATUS_FAVORITE_SHOWING:
      case StatusManager.STATUS_FAVORITE_RENAMING:
      case StatusManager.STATUS_STATIONS_SCANING:
      case StatusManager.STATUS_STATIONS_SHOWING:
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
        if (StatusManager.status === StatusManager.STATUS_DIALOG_FIRST_INIT) {
          this.focus = StatusManager.STATUS_FAVORITE_SHOWING;
        } else {
          this.focus = StatusManager.status;
        }
        break;
      default:
        return;
    }

    this.resetCurrentFocusedItems(fixed);
  };

  // Reset and update current focused items
  // fixed: change current focus to the first item in station list UI or not
  FocusManager.prototype.resetCurrentFocusedItems = function(fixed) {
    var currentFocusList = this.updateCurrentFocusList();
    if (!currentFocusList || (currentFocusList.elements.length === 0)) {
      return;
    }

    var index = 0;
    if (this.focus === StatusManager.STATUS_STATIONS_SHOWING) {
      // @fixed: if fixed is station index ,should update currentFocus index.
      if (fixed) {
        if (typeof fixed === 'number') {
          currentFocusList.index = fixed;
        }
        index = currentFocusList.index;
      } else {
        index = 0;
      }
    } else if (this.focus === StatusManager.STATUS_STATIONS_SCANING) {
      if (currentFocusList.elements.length === 0) {
        return;
      }
      // Always focus the last item while scanning
      index = currentFocusList.elements.length - 1;
    }

    // Update the specified index item to focus
    this.updateFocus(index);
    // Scroll to the focus item if needed
    this.previousFocusedItem.scrollIntoView(false);
  };

  // Update the specified index item to focus
  FocusManager.prototype.updateFocus = function(index) {
    var focusList = this.getCurrentFocusList();
    if (!focusList || (focusList.elements.length === 0)) {
      return;
    }

    if (index >= 0 && index < focusList.elements.length) {
      this.dismissFocus();

      var toFocused = focusList.elements[index];
      toFocused.classList.add('focus');
      toFocused.focus();
    }

    this.updateCurrentFocusIndex(index);
  };

  // Change the focus to the next item
  FocusManager.prototype.focusNext = function(next) {
    var focusList = this.getCurrentFocusList();
    if (!focusList || focusList.elements.length <= 1) {
      return;
    }

    var toFocusedIndex = next ? (this.previousFocusedIndex + 1) : (this.previousFocusedIndex - 1);
    if (toFocusedIndex < 0) {
      toFocusedIndex = focusList.elements.length - 1;
    } else if (toFocusedIndex >= focusList.elements.length) {
      toFocusedIndex = 0;
    }

    this.updateFocus(toFocusedIndex);
    this.previousFocusedItem.scrollIntoView(false);
  };

  // Remove current focus
  FocusManager.prototype.dismissFocus = function() {
    var focused = document.querySelectorAll('.focus');
    for (var i = 0; i < focused.length; i++) {
      focused[i].classList.remove('focus');
    }

    focused = document.querySelectorAll('.hasfocused');
    for (var i = 0; i < focused.length; i++) {
      focused[i].classList.remove('hasfocused');
    }
  };

  // Get current focused item
  FocusManager.prototype.getCurrentFocusElement = function() {
    return this.previousFocusedItem;
  };

  exports.FocusManager = new FocusManager();
})(window);
