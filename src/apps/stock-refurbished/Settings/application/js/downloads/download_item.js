

/**
 * Download Item helper.
 * Creates and updates the DOM needed to render a download as a list item.
 *
 * Usage:
 *   var li = DownloadItem.create(download);
 *
 * Once you got the reference, you can attach event listeners or update the
 * content explicitely if you know the download has been modified:
 *   DownloadItem.update(li, download);
 *
 * This helper requires some l10n resources, make sure to import them:
 *   <link rel="localization"
 *         href="/shared/locales/download/download.{locale}.properties">
 */

var DownloadItem = (function DownloadItem() {

  // Generates the following DOM, take into account that
  // the css needed for the classes above is in settings app:
  // downloads.css
  // @param {DomDownload} Download object to get the output from
  //
  //<li data-url="{url}" data-state="{download.state}">
  //  <aside class="download-status">
  //  </aside>
  //  <aside class="pack-end"
  //      data-id="{download.id}">
  //  </aside>
  //  <p class="fileName">Filename.doc</p>
  //  <p class="info">57% - 4.1MB of 7MB</p>
  //  <progress value="57" max="100"></progress>
  //</li>
  var create = function create(download) {
    var id = getDownloadId(download);
    var li = document.createElement('li');
    li.classList.add('auto-height');
    li.dataset.url = download.url;
    li.dataset.state = getDownloadState(download);
    li.id = id;
    li.dataset.id = id;
    li.classList.add('list-item');
    li.setAttribute('role', 'menuitem');

    var label = document.createElement('label');
    label.classList.add('pack-checkbox');
    var checkBox = document.createElement('input');
    checkBox.setAttribute('type', 'checkbox');
    checkBox.value = getDownloadId(download);

    var span = document.createElement('span');

    label.appendChild(checkBox);
    label.appendChild(span);


    var asideStatus = document.createElement('aside');
    asideStatus.className = 'download-status';
    var asideAction = document.createElement('aside');
    asideAction.dataset.id = id;

    var pFileName = document.createElement('span');
    pFileName.classList.add('fileName');
    pFileName.classList.add('long-string');
    var fileName = DownloadFormatter.getFileName(download);
    var parsedFile = parseFileName(fileName);
    var pParseFileName = document.createElement('p');
    var pParseFileExt = document.createElement('p');
    pFileName.dataset.fileName = fileName;
    pParseFileName.classList.add('download-filename');
    pParseFileExt.classList.add('file-ext');
    if (parsedFile.extension.length > 6) {
      pParseFileExt.classList.add('hide');
      parsedFile.name = fileName;
    }
    pParseFileName.textContent = parsedFile.name;
    pParseFileExt.textContent = parsedFile.extension;
    pFileName.appendChild(pParseFileName);
    pFileName.appendChild(pParseFileExt);

    var pSize = document.createElement('p');
    pSize.classList.add('size');

    var pSizeContainer = document.createElement('div');
    pSizeContainer.classList.add('sizeContainer');
    pSizeContainer.setAttribute('aria-hidden', true);

    var pPercent = document.createElement('div');
    pPercent.classList.add('percent');

    var pDownloadedSize = document.createElement('div');
    pDownloadedSize.classList.add('downloadedSize');

    pSizeContainer.appendChild(pPercent);
    pSizeContainer.appendChild(pDownloadedSize);

    var pDate = document.createElement('p');
    pDate.classList.add('date');

    var progress = document.createElement('gaia-progress');
    progress.setAttribute('aria-hidden', true);

    var pTextContainer = document.createElement('div');
    pTextContainer.classList.add('textContainer');

    pTextContainer.appendChild(asideStatus);
    pTextContainer.appendChild(asideAction);
    pTextContainer.appendChild(pFileName);
    pTextContainer.appendChild(pSize);
    pTextContainer.appendChild(pSizeContainer);
    pTextContainer.appendChild(progress);
    pTextContainer.appendChild(pDate);

    li.appendChild(label);
    li.appendChild(pTextContainer);

    return update(li, download);
  };

  var parseFileName = function parseFileName(filename) {
    let file = {};
    let position = filename.lastIndexOf('.');
    let ext = filename.substring(position, filename.length);
    file.extension = ext;
    file.name = filename.substring(0, position);
    return file;
  };

  // Given a DOM Download Item generated with the previous
  // method, update the style and the content based on the
  // given download.
  // @param {Dom Element} LI element representing the download
  // @param {DomDownload} Download object
  var update = function update(domElement, download, click) {
    var domNodes = getElements(domElement);
    // Update content
    updateContent(domElement, domNodes, download, click);

    return domElement;
  };

  var updateContentByState =
    function updateContentByState(domNodes, download, state) {
    if (state === 'downloading') {
      domNodes['progress'].value =
        DownloadFormatter.getPercentage(download);

      if (!download.totalBytes) {
        domNodes['sizeContainer'].classList.add('hidden');
        domNodes['progress'].classList.add('hidden');
        domNodes['size'].classList.remove('hidden');

        navigator.mozL10n.setAttributes(domNodes['size'],
          'downloading-no-total', {
          partial: DownloadFormatter.getDownloadedSize(download)
        });
      }
      else {
        domNodes['size'].classList.add('hidden');
        domNodes['progress'].classList.remove('hidden');
        domNodes['sizeContainer'].classList.remove('hidden');

        navigator.mozL10n.setAttributes(domNodes['percent'],
          'display-percent',
          { percent: DownloadFormatter.getPercentage(download) });

        navigator.mozL10n.setAttributes(domNodes['downloadedSize'],
          'partialResult', {
          partial: DownloadFormatter.getDownloadedSize(download),
          total: DownloadFormatter.getTotalSize(download)
        });
      }
    } else {
      var status = '';

      domNodes['progress'].classList.add('hidden');
      domNodes['size'].textContent = status;
      domNodes['size'].classList.remove('hidden');
      domNodes['sizeContainer'].classList.add('hidden');
      switch (state) {
        case 'stopped':
        case 'failed':
          navigator.mozL10n.setAttributes(domNodes['size'],
            'download-' + state + '-item', {
            partial: DownloadFormatter.getDownloadedSize(download),
          });
          break;
        case 'succeeded':
          domNodes['size'].textContent =
            DownloadFormatter.getTotalSize(download);
          break;
      }

      domNodes['date'].textContent = getDate(download);
    }
  }

  // Update the content of the elements according to the download
  // status
  // @param {Object of DOM Element} Dictionary containing the DOM
  //   elements accesible by name
  // @param {DomDownload} Download object
  var updateContent =
    function updateContent(domElement, domNodes, download, click) {
    var _ = navigator.mozL10n.get;
    var state = download.state;

    if (click) {
      domElement.dataset.state = state;
      updateContentByState(domNodes, download, state);
      return;
    }

    getDataConnState().then((res) => {
      if (download.error) {
        state = 'failed';
      } else if (!res && 'succeeded' !== download.state) {
        state = 'downloading';
      }

      domElement.dataset.state = state;
      updateContentByState(domNodes, download, state);
    });
  };

  var dateFormat = navigator.mozL10n.DateTimeFormat();

  var getDate = function getDate(download) {
    var date;

    try {
      date = download.startTime;
    } catch (ex) {
      date = new Date();
      console.error(ex);
    }

    return prettyDate(date);
  };

  var prettyDate = function prettyDate(time, useCompactFormat, maxDiff) {
    var _ = navigator.mozL10n.get;
    maxDiff = maxDiff || 86400 * 2; // default = 2 days

    switch (time.constructor) {
      case String: // timestamp
        time = parseInt(time);
        break;
      case Date:
        time = time.getTime();
        break;
    }

    var now = Date.now();
    var secDiff = (now - time) / 1000;
    if (isNaN(secDiff)) {
      return _('incorrectDate');
    }

    if (Math.abs(secDiff) > 60) {
      // round milliseconds up if difference is over 1 minute so the result is
      // closer to what the user would expect (1h59m59s300ms diff should return
      // "in 2 hours" instead of "in an hour")
      secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff);
    }

    var today = new Date();
    today.setHours(0,0,0,0);
    var todayMidnight = today.getTime();
    var yesterdayMidnight = todayMidnight - 86400 * 1000;
    var oneWeekAgo = todayMidnight - 86400 * 1000 * 7;

    const thisyearTimestamp = (new Date(today.getFullYear().toString())).getTime();
    // ex. 11:59 PM or 23:59
    const timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

    if (time < thisyearTimestamp) {
      // before this year, ex. December 31, 2015 11:59 PM
      return dateFormat.localeFormat(new Date(time), '%a, %b %e, %Y, ' + timeFormat);
    } else if (time < oneWeekAgo) {
      return dateFormat.localeFormat(new Date(time), '%a, %B %e, ' + timeFormat);
    } else if (time < yesterdayMidnight) {
      return dateFormat.localeFormat(new Date(time), '%A, ' + timeFormat)
    } else if (time < todayMidnight) {
      // yesterday
      return _('days-ago-long', {value: 1}) + ', ' +
        dateFormat.localeFormat(new Date(time), timeFormat);
    } else if (secDiff > 3600 * 4) {
      // today and before 4 hours
      return _('days-ago-long', {value: 0}) + ', ' +
        dateFormat.localeFormat(new Date(time), timeFormat);
    } else {
      // in 4 hours
      var f = useCompactFormat ? '-short' : '-long';
      var parts = dateFormat.relativeParts(secDiff);

      var affix = secDiff >= 0 ? '-ago' : '-until';
      for (var i in parts) {
        return _(i + affix + f, { value: parts[i]});
      }
    }
  };

  // Get's the DOM nodes for the Download Node to apply
  // the specific style
  // @param {DOM element} Given a Download LI generated with the
  //   create method, returns in an object the different components
  //   making them accessible via name
  var getElements = function getElements(domElement) {
    var domNodes = {};

    var asides = domElement.querySelectorAll('aside');
    var pTextContainer = domElement.querySelector('div.textContainer');

    domNodes['asideStatus'] = pTextContainer.querySelector('aside:not(pack-end)');
    domNodes['asideAction'] = pTextContainer.querySelector('aside.pack-end');

    domNodes['progress'] = pTextContainer.querySelector('gaia-progress');

    // Should never change with current UI specs
    domNodes['fileName'] = pTextContainer.querySelector('p.fileName');

    var sizeContainer = pTextContainer.querySelector('div.sizeContainer');
    domNodes['sizeContainer'] = sizeContainer;
    domNodes['percent'] = sizeContainer.querySelector('.percent');
    domNodes['downloadedSize'] = sizeContainer.querySelector('.downloadedSize');
    domNodes['size'] = pTextContainer.querySelector('p.size');
    domNodes['date'] = pTextContainer.querySelector('p.date');

    return domNodes;
  };

  var getDownloadId = function getDownloadId(download) {
    // We need to use this to generate our id because datastore ids are not
    // compatible with dom element ids.
    return DownloadFormatter.getUUID(download);
  };

  var updateDownloadId = function updateDownloadId(download,
                                                   domElement) {
    // Get our new element id.
    var id = getDownloadId(download);
    // Update all the relevant instances of the item id.
    domElement.id = id;
    domElement.dataset.id = id;
    domElement.getElementsByTagName('input')[0].value = id;
  };

  var getDownloadState = function getDownloadState(download) {
    var state = download.state;

    if (state === 'stopped') {
      if (download.error !== null) {
        state = 'failed';
      } else if (!window.navigator.onLine) {
        // Remain downloading state when the connectivity was lost
        state = 'downloading';
      }
    }

    return state;
  };

  var getDataState = function getDataState(key) {
    return new Promise((resolve, reject) => {
      var dataCallMgr = navigator.dataCallManager;

      if(!dataCallMgr){
        reject('dataCallMgr is null')
        return;
      }

      let dataPromise = dataCallMgr.getDataCallState('default', key);
      dataPromise.then((dataObj) => {
        resolve(dataObj);
      }).catch((error) => {
        reject(error);
      });
    });
  };

  var getAllDataState = function getAllDataState() {
    return new Promise((resolve) => {
      var promiseList = [];
      for (var i = 0; i < navigator.mozMobileConnections.length; i++) {
        promiseList.push(getDataState(i));
      }

      Promise.all(promiseList).then((results) => {
        resolve(results);
      });
    });
  };

  var getDataConnState = function getDataConnState() {
    return new Promise((resolve) => {
      if (navigator.mozWifiManager && navigator.mozWifiManager.connection &&
        navigator.mozWifiManager.connection.status === 'connected') {
        resolve(true);
      } else {
        getAllDataState().then((results) => {
          let connectFlag = false;
          for (let i = 0; i < results.length; i++) {
            if (results[i] === 'connected') {
              connectFlag = true;
              break;
            }
          }

          if (connectFlag) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
  };

  var updateDownloadDate = function updateDownloadDate() {
    let listItems = document.querySelectorAll('#downloadList li');

    for (let i = 0; i < listItems.length; i++) {
      let download = DownloadApiManager.getDownload(listItems[i].dataset.id);
      listItems[i].querySelector('.date').textContent = getDate(download);
    }
  };

  return {
    'create': create,
    'refresh': update,
    'getDownloadId': getDownloadId,
    'updateDownloadId': updateDownloadId,
    'updateDownloadDate': updateDownloadDate
  };

}());
