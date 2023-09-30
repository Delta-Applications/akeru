/* exported FrequencyManager */
'use strict';

(function(exports) {

  // FrequencyManager Constructor
  var FrequencyManager = function() {
    this.KEYNAME = 'frequencylist';
    this.favoriteFrequencyList = null;
    this.stationsFrequencyList = null;
  };

  // Initialize FrequencyManager
  FrequencyManager.prototype.init = function(callback) {
    // Read frequency list just from local storage
    this.frequencyList = window.localStorage.getItem(this.KEYNAME);
    // Parse frequency list to the following format:
    // {xxx(frequency):
    //   {name: xxx, frequency: xxx, favorite: true/false, station: true/false}
    //  ....
    // }
    if (!this.frequencyList) {
      this.frequencyList = {};
    } else {
      this.frequencyList = JSON.parse(this.frequencyList);
    }

    // Update favorite and stations frequency list
    this.updateFavoriteFrequencyList();
    this.updateStationsFrequencyList();

    if (callback && typeof callback === 'function') {
      callback();
    }
  };

  // Get frequency object by the specified frequency
  FrequencyManager.prototype.getCurrentFrequencyObject = function(frequency) {
    return (frequency && this.frequencyList && this.frequencyList[frequency.toFixed(1)]);
  };

  // Check the specified frequency is favorite
  FrequencyManager.prototype.checkFrequencyIsFavorite = function(frequency) {
    if (!this.getCurrentFrequencyObject(frequency)) {
      return false;
    }

    var frequencyObject = this.frequencyList[frequency.toFixed(1)];
    return frequencyObject.favorite;
  };

  // Check the specified frequency is station frequency
  FrequencyManager.prototype.checkFrequencyIsStation = function(frequency) {
    if (!this.getCurrentFrequencyObject(frequency)) {
      return false;
    }

    var frequencyObject = this.frequencyList[frequency.toFixed(1)];
    return frequencyObject.station;
  };

  // Check the specified value is a valid boolean value
  FrequencyManager.prototype.checkIsValidBoolValue = function(value) {
    return ((value === true) || (value === false));
  };

  // Update frequency to frequency list
  FrequencyManager.prototype.updateFrequencyToFrequencyList = function(frequencyObject) {
    if (!frequencyObject || !frequencyObject.frequency || !this.frequencyList) {
      return;
    }

    var updatedTime = new Date();
    var stationTimeShouldUpdate = false;
    var favoriteTimeShouldUpdate = false;
    var updatedObject = this.frequencyList[frequencyObject.frequency.toFixed(1)];
    if (updatedObject) {
      // The frequency exists in frequency list already
      stationTimeShouldUpdate = this.checkIsValidBoolValue(frequencyObject.station)
        && (updatedObject.station !== frequencyObject.station);
      favoriteTimeShouldUpdate = this.checkIsValidBoolValue(frequencyObject.favorite)
        && (updatedObject.favorite !== frequencyObject.favorite);
      updatedObject.name = frequencyObject.name ? frequencyObject.name : updatedObject.name;
      updatedObject.frequency = frequencyObject.frequency;
      updatedObject.favorite = this.checkIsValidBoolValue(frequencyObject.favorite)
        ? frequencyObject.favorite : updatedObject.favorite;
      updatedObject.station = this.checkIsValidBoolValue(frequencyObject.station)
        ? frequencyObject.station : updatedObject.station;
    } else {
      // The frequency has no exists in frequency list yet
      updatedObject = {};
      stationTimeShouldUpdate = frequencyObject.station;
      favoriteTimeShouldUpdate = frequencyObject.favorite;
      updatedObject.name = frequencyObject.name
        ? frequencyObject.name : (frequencyObject.frequency.toFixed(1) + ' MHz');
      updatedObject.frequency = frequencyObject.frequency;
      updatedObject.favorite = this.checkIsValidBoolValue(frequencyObject.favorite)
        ? frequencyObject.favorite : false;
      updatedObject.station = this.checkIsValidBoolValue(frequencyObject.station)
        ? frequencyObject.station : false;
    }
    if (stationTimeShouldUpdate) {
      updatedObject.stationTime = updatedTime.getTime();
    }
    if (favoriteTimeShouldUpdate) {
      updatedObject.favoriteTime = updatedTime.getTime();
    }
    this.frequencyList[frequencyObject.frequency.toFixed(1)] = updatedObject;

    if ((updatedObject.favorite === false) && (updatedObject.station === false)) {
      // Remove the frequency if it do not belong to favorite list and station list
      delete this.frequencyList[frequencyObject.frequency.toFixed(1)];
    }

    // Update frequency list to local storage
    try {
      window.localStorage.setItem(this.KEYNAME, JSON.stringify(this.frequencyList));
    } catch (e) {
      console.error('Failed save frequency list :' + e);
    }
  };

  // Update current favorite list from frequency list
  FrequencyManager.prototype.updateFavoriteFrequencyList = function() {
    var favoriteFrequencyList = [];
    for (var frequency in this.frequencyList) {
      var frequencyObject = this.frequencyList[frequency];
      if (!frequencyObject) {
        continue;
      }

      if (frequencyObject.favorite) {
        favoriteFrequencyList.push(frequencyObject);
      }
    }
    this.favoriteFrequencyList = favoriteFrequencyList;
  };

  // Update current stations list from frequency list
  FrequencyManager.prototype.updateStationsFrequencyList = function() {
    var stationsFrequencyList = [];
    for (var frequency in this.frequencyList) {
      var frequencyObject = this.frequencyList[frequency];
      if (!frequencyObject) {
        continue;
      }

      if (frequencyObject.station) {
        stationsFrequencyList.push(frequencyObject);
      }
    }
    this.stationsFrequencyList = stationsFrequencyList;
  };

  // Update current frequency as favorite or not
  // parameter favorite: true/false, indicate favorite or not current frequency to update
  // parameter station: true/false, indicate current frequency is station or not
  FrequencyManager.prototype.updateFrequencyFavorite = function(frequency, favorite, station) {
    // Update current frequency to frequency list
    this.updateFrequencyToFrequencyList({frequency: frequency, favorite: favorite, station: station});
    // Update favorite list after frequency list updated
    this.updateFavoriteFrequencyList();
    // Update stations list after frequency list updated
    this.updateStationsFrequencyList();
  };

  // Update frequency name
  FrequencyManager.prototype.updateFrequencyName = function(frequency, name) {
    var frequencyObject = this.getCurrentFrequencyObject(frequency);
    // for the priority of favorite frequency is higher than station frequency
    frequencyObject.name = name;
    // Update current frequency to frequency list
    this.updateFrequencyToFrequencyList(frequencyObject);
    // Update favorite list after frequency list updated
    this.updateFavoriteFrequencyList();
    // Update stations list after frequency list updated
    this.updateStationsFrequencyList();
  };

  // Update frequency as station or not
  FrequencyManager.prototype.updateFrequencyStation = function(frequency, station) {
    // Update current frequency to frequency list
    this.updateFrequencyToFrequencyList({frequency: frequency, station: station});
    // Update stations list after frequency list updated
    this.updateStationsFrequencyList();
  };

  // Clear all stations from frequency list
  FrequencyManager.prototype.clearAllStationsFrequencyList = function() {
    if (!this.stationsFrequencyList.length) {
      return;
    }

    while (this.stationsFrequencyList.length > 0) {
      var frequencyObject = this.stationsFrequencyList.shift();
      this.updateFrequencyStation(frequencyObject.frequency, false);
    }
  };

  // Get favorite list
  FrequencyManager.prototype.getFavoriteFrequencyList = function() {
    if (!this.frequencyList) {
      return;
    }

    if (!this.favoriteFrequencyList) {
      this.updateFavoriteFrequencyList();
    }

    return this.favoriteFrequencyList;
  };

  // Get stations list
  FrequencyManager.prototype.getStationsFrequencyList = function() {
    if (!this.frequencyList) {
      return;
    }

    if (!this.stationsFrequencyList) {
      this.updateStationsFrequencyList();
    }

    return this.stationsFrequencyList;
  };

  exports.FrequencyManager = new FrequencyManager();
})(window);
