'use strict';
function showFileInformation(fileinfo) {
  populateMediaInfo(fileinfo);
  function populateMediaInfo(fileinfo) {
    var data = {
      'info-name': getFileName(fileinfo.name),
      'info-size': MediaUtils.formatSize(fileinfo.size),
      'info-type': fileinfo.type,
      'info-date': formatDate(fileinfo.date),
      'info-resolution':
        fileinfo.metadata.width + 'x' + fileinfo.metadata.height,
      'path-label': getDisplayPath(fileinfo.name)
    };

    var name_label = 'name-label';
    var size_label =  'size-label';
    var image_type_label = 'image-type-label';
    var date_taken_label = 'date-taken-label';
    var resolution_label = 'resolution-label';
    var path_label = 'path-label';

    var list_cont = {};
    list_cont[name_label] = data['info-name'];
    list_cont[size_label] = data['info-size'];
    list_cont[image_type_label] = data['info-type'];
    list_cont[date_taken_label] = data['info-date'];
    list_cont[resolution_label] = data['info-resolution'];
    list_cont[path_label] = data['path-label'];

    var infoContainer = infoDialog.querySelector('#infoView');
    infoContainer.innerHTML = '';
    Object.keys(list_cont).forEach(function (key) {
      var nameItem = document.createElement('dt');
      nameItem.setAttribute('data-l10n-id',key);
      nameItem.classList.add('p-pri');
      nameItem.textContent = lget(key);
      var valueItem = document.createElement('dd');
      valueItem.classList.add('value');
      valueItem.classList.add('p-sec');
      valueItem.textContent = list_cont[key];
      infoContainer.appendChild(nameItem);
      infoContainer.appendChild(valueItem);
    });
    infoDialog.classList.remove('hidden');
    infoDialog.querySelector('#info-view-container').focus();
    infoDialog.querySelector('#info-view-container').scroll(0, 0);
  }

  function getFileName(path) {
    return path.split('/').pop();
  }

  function getDisplayPath(displayPath) {
    let _ = navigator.mozL10n.get;
    let displayArr = displayPath.split('/');
    if (displayArr[1] === 'sdcard1') {
      displayArr[1] = _('sd-card');
    } else {
      displayArr[1] = _('internal');
    }
    displayPath = displayArr.join('/');
    return displayPath;
  }

  function formatDate(time) {
    let formattedTime = new Date(time).toLocaleString(navigator.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formattedTime;
  }
}
