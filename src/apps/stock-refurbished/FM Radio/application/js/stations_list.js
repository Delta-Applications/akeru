/* exported StationsList */
'use strict';

(function(exports) {

  // StationsList Constructor
  // StationsList will be loaded only while station list shown
  var StationsList = function() {
    this.scanningAborted = false;
    this.currentFrequency = null;
    this.previousFrequency = null;
    this.STATION_MAX_INTERVAL = 2000;
    this.CANCEL_RETRY_TIMES = 3;
  };

  // Switch from favorite list UI to station list UI
  StationsList.prototype.switchToStationListUI = function() {
    if (StatusManager.status !== StatusManager.STATUS_FAVORITE_SHOWING) {
      // Only in favorite list UI can switch to station list UI
      return;
    }

    // Hidden frequencu dialer UI
    FMElementFrequencyBar.classList.add('hidden');
    // Change frequency list to 'stations-list' to update UI
    FMElementFrequencyListUI.className = 'stations-list';
    // Show FM Header
    FMElementFMHeader.classList.remove('hidden');

    var stationslist = FrequencyManager.getStationsFrequencyList();
    let currentFrequency = document.getElementById('frequency').textContent;
    let fixed = 0;
    stationslist.some((frequency, i) => {
      let frequencyCompare = (frequency.frequency == currentFrequency);
      if (frequencyCompare) {
        fixed = i;
      }
      return frequencyCompare;
    });
    if (stationslist.length === 0) {
      // Scan stations if no stations
      this.startScanStations();
    } else {
      // Update StatusManager to update softkeys
      StatusManager.update(StatusManager.STATUS_STATIONS_SHOWING);
      // Show stations lit UI
      FrequencyList.updateStationsListUI();
    }

    // Update current focus
    FocusManager.update(fixed);
    // Update warning UI
    // in case of favorite list warning UI is showing
    WarningUI.update();
  };

  // Switch from station list UI to favorite list UI
  StationsList.prototype.switchToFavoriteListUI = function() {
    if (StatusManager.status !== StatusManager.STATUS_STATIONS_SHOWING) {
      // Only in station list UI can switch to favorite list UI
      return;
    }

    // Show frequency dialer
    FMElementFrequencyBar.classList.remove('hidden');
    // Change frequency list to 'favorites-list' to update UI
    FMElementFrequencyListUI.className = 'favorites-list';
    // Hide FM Header
    FMElementFMHeader.classList.add('hidden');

    // Update StatusManager to update softkeys
    StatusManager.update(StatusManager.STATUS_FAVORITE_SHOWING);

    // Show favorite list UI
    FrequencyList.updateFavoriteListUI();

    // Update current focus
    FocusManager.update();
    // Update warning UI
    // in case of favorite list warning UI is showing
    WarningUI.update();

  };

  // Start scan stations
  StationsList.prototype.startScanStations = function() {
    // Show scan progress UI
    FMElementScanProgress.className = 'throb';
    // Add 'scanning' to update stations list UI
    FMElementFrequencyListUI.classList.add('scanning');

    // Update StatusManager to update softkeys
    StatusManager.update(StatusManager.STATUS_STATIONS_SCANING);

    // clear the stations list scanned before
    this.clearAllStationsList();

    // Mark flag 'scanningAborted' as false
    this.scanningAborted = false;

    // Reset parameter 'previousFrequency' as frequencyLowerBound
    this.previousFrequency = mozFMRadio.frequencyLowerBound;

    // request to scan stations
    this.requestToScanStations();
  };

  // Request to scan stations
  StationsList.prototype.requestToScanStations = function() {
    // Set frequency as 'frequencyLowerBound', whether success or failed, start scan stations
    // It is to make sure stations scanning start from the lower bound frequency
    var request = mozFMRadio.setFrequency(this.previousFrequency);
    request.onsuccess = this.continueScanStations.bind(this);
    request.onerror = this.continueScanStations.bind(this);
  };

  // clear the stations list scanned before
  StationsList.prototype.clearAllStationsList = function() {
    FrequencyList.clearCurrentFrequencyList();
    FrequencyManager.clearAllStationsFrequencyList();
  };

  // Add frequency scanned to stations list UI
  StationsList.prototype.addStationScanned = function(frequency) {
    // Update current frequency to data base
    FrequencyManager.updateFrequencyStation(frequency, true);
    // Update current stations list UI
    FrequencyList.updateStationsListUI();
    // Make the frequency in frequency dialer UI is current palying frequency
    this.onFrequencyChanged();
    // Update current focus
    FocusManager.update();
  };

  StationsList.prototype.onFrequencyChanged = function() {
    var frequency = mozFMRadio.frequency;
    // Add current frequency to history
    HistoryFrequency.add(frequency);
    // Update frequency dialer UI
    FrequencyDialer.updateFrequency(frequency);
    // Update status to update softkeys
    StatusManager.update();
  };

  // Handle the fm channel frequency
  StationsList.prototype.handleFrequencyChanged = function() {
    if (StatusManager.status !== StatusManager.STATUS_STATIONS_SCANING &&
      !this.scanningAborted) {
      return this.onFrequencyChanged();
    }

    // Get the frequency scanned
    this.currentFrequency = mozFMRadio.frequency;

    if (this.previousFrequency === this.currentFrequency) {
      // Continue scanning if scanned frequency has no change
      this.continueScanStations();
      return;
    }

    if (this.previousFrequency > this.currentFrequency) {
      // Scanning finished if scanned frequency is smaller
      this.scanFinished(true, 'tcl-scanning-completed');
      return;
    }

    // Update the scanned frequency to 'previousFrequency'
    this.previousFrequency = this.currentFrequency;
    // Add frequency scanned to stations list UI
    this.addStationScanned(this.currentFrequency);

    // Check if current scanning is aborted or not
    if (this.scanningAborted) {
      this.scanFinished(true);
      return;
    }

    // Continue scanning
    this.continueScanStations();
  };

  // The actually station scanning operation
  StationsList.prototype.continueScanStations = function() {
    setTimeout(function() { mozFMRadio.seekUp(); }, 100);
  };

  // Stations scanning operation finished
  StationsList.prototype.scanFinished = function(needupdate, message) {
    // Hidden scan progress UI
    FMElementScanProgress.className = 'hidden';
    // Remove 'scanning' to update stations list UI
    FMElementFrequencyListUI.classList.remove('scanning');

    // Mark flag 'scanningAborted' as false
    this.scanningAborted = false;

    // Show toast message
    FMRadio.showMessage(message);

    // Update StatusManager to update softkeys
    StatusManager.update(StatusManager.STATUS_STATIONS_SHOWING);

    if (needupdate) {
      /**
       * After execute seekUp, by comparing the value of the last channel and
       * the next channel, we　confirm whether the DUT has completed FM channel
       * scan, but gaia layer cann't observe fm channel frequency changed, so
       * here need to perform the onFrequencyChanged function manually to make
       * the frequency in frequency dialer UI is current palying frequency
       * Make the frequency in frequency dialer UI is current palying frequency.
       */
      this.onFrequencyChanged();
      // Update current focus
      FocusManager.update();
    }
  };

  // Abort stations scanning operation
  StationsList.prototype.abortScanStations = function(headphone, retryTime) {
    // Cancel seek
    var request = mozFMRadio.cancelSeek();
    if (headphone) {
      // Abort for headphone has been unplugged
      request.onsuccess = this.scanAbortedHeadphone.bind(this);
    } else {
      // Abort for abort softkey clicked
      request.onsuccess = this.scanAbortedNormal.bind(this);
    }

    request.onerror = () => {
      this.retryCancel(retryTime, () => {
        if (headphone) {
          this.scanAbortedHeadphone();
        } else {
          this.scanAbortedNormal();
        }
      }, (retryTime) => {
        this.abortScanStations(headphone, retryTime);
      })
    };
  };

  StationsList.prototype.retryCancel = function(retryTime = this.CANCEL_RETRY_TIMES, cancelCB, continueCB) {
    retryTime --;    
    if (retryTime <= 0) {
      cancelCB && cancelCB();
    } else {
      continueCB && continueCB(retryTime);
    }    
  }

  // Abort stations scanning operation for headphone has been unplugged
  // no need to update focus
  StationsList.prototype.scanAbortedHeadphone = function() {
    this.scanningAborted = true;
    this.scanFinished(false);
    this.switchToFavoriteListUI();
  };

  // Abort stations scanning operation for abort softkey clicked
  // need to update focus
  StationsList.prototype.scanAbortedNormal = function() {
    this.scanningAborted = true;
    this.ensureScanningAborted();
  };

  // Abort stations scanning operation for quickly click BrowserBack times
  // not defined update focus or not, decide update to avoid focus error when
  // scanning interrupted.
  StationsList.prototype.scanAbortOnBrowserBack = function(retryTime) {
    // Cancel seek
    const request = mozFMRadio.cancelSeek();
    request.onsuccess = () => {
      this.scanningAborted = true;
      this.scanFinished(true);
    };

    request.onerror = () => {
      this.retryCancel(retryTime, () => {
        this.scanningAborted = true;
        this.scanFinished(true);      
      }, (retryTime) => {
        this.scanAbortOnBrowserBack(retryTime);
      })
    };
  };


  // when signal is too week. this is no station could be scanned, so
  // the frequency would not changed. then scanFinished would not be executed.
  StationsList.prototype.ensureScanningAborted = function() {
    setTimeout(() => {
      if (this.scanningAborted) {
        this.scanFinished(false);
      }
    }, this.STATION_MAX_INTERVAL);
  };

  exports.StationsList = new StationsList();
})(window);
