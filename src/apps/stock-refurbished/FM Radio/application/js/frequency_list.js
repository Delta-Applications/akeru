/* exported frequencyList */
'use strict';

(function(exports) {

  const frequencyIconHidden = 'frequency-list-favorite-icon favorite-icon-hidden';
  const frequencyIcon = 'frequency-list-favorite-icon favorite-icon';
  // FrequencyList Constructor
  var FrequencyList = function() {};

  // Format frequency list item element innerHTML
  FrequencyList.prototype.formatFrequencyElement = function(frequencyObject) {
    if (!frequencyObject) {
      return;
    }

    let frequencyItem = FMElementFrequencyListTemplate.content.querySelectorAll('div');
    let frequencyClassName = frequencyObject.favorite ? frequencyIcon : frequencyIconHidden;
    frequencyItem[0].className = frequencyClassName;
    frequencyItem[1].textContent = frequencyObject.name;
    return document.importNode(FMElementFrequencyListTemplate.content, true);
  };

  // Format frequency list item element ID
  FrequencyList.prototype.formatFrequencyElementId = function(frequency) {
    return !frequency ? null : ('frequency-' + frequency);
  };

  // Clear current frequency list UI
  FrequencyList.prototype.clearCurrentFrequencyList = function() {
    FMElementFrequencyListContainer.innerHTML = '';
  };

  // Add frequency to frequency list UI
  FrequencyList.prototype.addFrequencyToListUI = function(frequencyObject) {
    if (!frequencyObject) {
      return;
    }

    var element = document.createElement('div');
    element.id = this.formatFrequencyElementId(frequencyObject.frequency);
    element.className = 'frequency-list-item';
    element.setAttribute('role', 'option');
    element.appendChild(this.formatFrequencyElement(frequencyObject));

    FMElementFrequencyListContainer.appendChild(element);
    element.scrollIntoView();
  };

  // Update current frequency list UI, favorite list UI, rename UI or stations list UI
  FrequencyList.prototype.updateFrequencyListUI = function(frequencyList) {
    if (!frequencyList) {
      return;
    }

    this.clearCurrentFrequencyList();
    for (var index = 0; index < frequencyList.length; index++) {
      var frequencyObject = frequencyList[index];
      this.addFrequencyToListUI(frequencyObject);
    }
    if (!(StatusManager.status === StatusManager.STATUS_WARNING_SHOWING)) {
      FMRadio.saveCache();
    } else {
      this.updateCache = true;
    }
  };

  // Update current single frequency list item element
  FrequencyList.prototype.updateCurrentFrequencyElement = function(element) {
    if (!element) {
      return;
    }

    var frequency = this.getFrequencyByElement(element);
    if (element.id === 'frequency') {
      FrequencyDialer.updateFrequency();
    } else {
      var frequencyObject = FrequencyManager.getCurrentFrequencyObject(frequency);
      element.innerHTML = '';
      element.appendChild(this.formatFrequencyElement(frequencyObject));
    }
  };

  // Update favorite list UI
  FrequencyList.prototype.updateFavoriteListUI = function() {
    var favoritesList = FrequencyManager.getFavoriteFrequencyList();
    if (favoritesList) {
      favoritesList.sort(function(a, b) {return b.favoriteTime - a.favoriteTime});
      this.updateFrequencyListUI(favoritesList);
    }
  };

  // Update rename list UI
  FrequencyList.prototype.updateRenameListUI = function() {
    var currentFrequency = FrequencyDialer.getFrequency();
    var currentFrequencyObject = FrequencyManager.getCurrentFrequencyObject(currentFrequency);
    var currentFrequencyList = [];

    currentFrequencyList.push(currentFrequencyObject);
    this.updateFrequencyListUI(currentFrequencyList);
  };

  // Update stations list UI
  FrequencyList.prototype.updateStationsListUI = function() {
    var stationslist = FrequencyManager.getStationsFrequencyList();
    if (stationslist) {
      stationslist.sort(function(a, b) {return a.stationTime - b.stationTime});
      this.updateFrequencyListUI(stationslist);
    }
  };

  // Get the name of current frequency list item
  FrequencyList.prototype.getFrequencyItemName = function(frequency) {
    return document.getElementById('frequency-' + frequency)
          .querySelector('.frequency-list-frequency').textContent;
  };

  // Get the frequency of current frequency list item
  FrequencyList.prototype.getFrequencyByElement = function(element) {
    if (!element) {
      return;
    }

    var isParentListItem = element.parentNode.classList.contains('frequency-list-item');
    var listItem = isParentListItem ? element.parentNode : element;
    return parseFloat(listItem.id.substring(listItem.id.indexOf('-') + 1));
  };

  exports.FrequencyList = new FrequencyList();
})(window);
