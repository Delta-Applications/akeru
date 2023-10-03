/**
 * The template function for generating an UI element for an item of Bluetooth
 * paired/remote device.
 *
 * @module bluetooth/bt_template_factory
 */
define([],function() {
  

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function bttf_debug(msg) {
      console.log('--> [BluetoothTemplateFactory]: ' + msg);
    };
  }

  function btTemplate(deviceType, onItemClick, observableItem) {
    var device = observableItem;

    var nameSpan = document.createElement('span');
    _updateItemName(nameSpan, device.name, device.address);

    var descSmall = document.createElement('small');
    if (deviceType === 'remote') {
      descSmall.setAttribute('data-l10n-id', 'device-status-tap-connect');
    }

    let btIcon = document.createElement('img');
    btIcon.setAttribute('src', 'style/images/ic_bluetooth_sprite_normal.png');
    btIcon.setAttribute('aria-hidden', true);

    let btFocusIcon = document.createElement('img');
    btFocusIcon.setAttribute('src', 'style/images/ic_bluetooth_sprite_focused.png');
    btFocusIcon.setAttribute('aria-hidden', true);

    var li = document.createElement('li');
    var anchor = document.createElement('a');
    li.classList.add('bluetooth-device');

    // According to Bluetooth class of device to give icon style.
    debug('device.type = ' + device.type + ' paired: ' + device.paired);
    if (device.type === 'phone' || device.type === 'computer' ||
        device.type === 'pda') {
      li.classList.add('bluetooth-type-' + device.type);
    } else {
      li.classList.add('hidden');
    }

    // According to 'descriptionText' property to give description.
    _updateItemDescriptionText(li, descSmall, device.descriptionText,
                               deviceType);

    anchor.appendChild(nameSpan);
    anchor.appendChild(descSmall); // should append this first
    li.appendChild(btIcon);
    li.appendChild(btFocusIcon);
    li.appendChild(anchor);

    // Register the handler for the click event.
    if (typeof onItemClick === 'function') {
      li.onclick = function() {
        onItemClick(observableItem);
      };
    }

    // Observe name property for update device name
    // while device 'onattributechanged' event is coming.
    device.observe('name', function(newName) {
      _updateItemName(nameSpan, newName);
    });

    // Observe descriptionText property for update device description
    // while the connection status changed.
    device.observe('descriptionText', function(descriptionText) {
      _updateItemDescriptionText(li, descSmall, descriptionText, deviceType);
    });

    device.observe('type', function(newType) {
      debug('observe type: ' + newType);
      if (newType === 'phone' || newType === 'computer' ||
        newType === 'pda') {
        li.classList.add('bluetooth-type-' + device.type);
        li.classList.remove('hidden');
      }
    });

    return li;
  }

  function _updateItemName(element, name, address) {
    if (name !== '') {
      element.textContent = name;
    } else {
      element.textContent = address;
    }
  }

  function _updateItemDescriptionText(li, element, descriptionText,
                                      deviceType) {
    debug('_updateItemDescriptionText(): descriptionText = ' + descriptionText);
    switch (descriptionText) {
      case 'tapToConnect':
        li.removeAttribute('aria-disabled');
        element.setAttribute('data-l10n-id', 'device-status-tap-connect');
        break;
      case 'pairing':
        li.setAttribute('aria-disabled', true);
        element.setAttribute('data-l10n-id', 'device-status-pairing');
        break;
      case 'paired':
        li.removeAttribute('aria-disabled');
        break;
      case 'connecting':
        li.setAttribute('aria-disabled', true);
        element.setAttribute('data-l10n-id', 'device-status-connecting');
        break;
      case 'connectedWithDeviceMedia':
        li.removeAttribute('aria-disabled');
        element.setAttribute('data-l10n-id',
          'device-status-connected-device-media');
        break;
      case 'connectedWithDevice':
        li.removeAttribute('aria-disabled');
        element.setAttribute('data-l10n-id',
          'device-status-connected-device');
        break;
      case 'connectedWithMedia':
        li.removeAttribute('aria-disabled');
        element.setAttribute('data-l10n-id',
          'device-status-connected-media');
        break;
      case 'connectedWithNoProfileInfo':
        li.removeAttribute('aria-disabled');
        element.setAttribute('data-l10n-id',
          'device-status-connected');
        break;
      case 'disconnected':
        li.removeAttribute('aria-disabled');
        element.removeAttribute('data-l10n-id');
        element.textContent = '';
        break;
      default:
        break;
    }
  }

  return function ctor_btTemplate(deviceType, onItemClick) {
    return btTemplate.bind(null, deviceType, onItemClick);
  };
});
