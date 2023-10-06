'use strict';var NfcHandoverManager={DEBUG:false,settings:null,bluetooth:null,nfc:null,defaultAdapter:null,actionQueue:[],sendFileQueue:[],responseTimeoutMillis:9000,responseTimeoutFunction:null,incomingFileTransferInProgress:false,bluetoothStatusSaved:false,bluetoothAutoEnabled:false,settingsNotified:false,_debug:function _debug(msg,optObject){if(this.DEBUG){this._logVisibly(msg,optObject);}},_logVisibly:function _logVisibly(msg,optObject){var output='[NfcHandoverManager]: '+msg;if(optObject){output+=JSON.stringify(optObject);}
console.log(output);},init:function init(){var self=this;this.settings=navigator.mozSettings;this.bluetooth=navigator.mozBluetooth;this.nfc=navigator.mozNfc;this.incomingFileTransferInProgress=false;this.bluetoothStatusSaved=false;this.bluetoothAutoEnabled=false;if(this.bluetooth.enabled){this._debug('Bluetooth already enabled on boot');var req=this.bluetooth.getDefaultAdapter();req.onsuccess=function bt_getAdapterSuccess(){self.defaultAdapter=req.result;self._debug('MAC address: '+self.defaultAdapter.address);self._debug('MAC name: '+self.defaultAdapter.name);};req.onerror=function bt_getAdapterError(){self._logVisibly('init: Failed to get bluetooth adapter');};}
window.addEventListener('bluetooth-adapter-added',function(){self._debug('bluetooth-adapter-added');var req=self.bluetooth.getDefaultAdapter();req.onsuccess=function bt_getAdapterSuccess(){self.settingsNotified=false;self.defaultAdapter=req.result;self._debug('MAC address: '+self.defaultAdapter.address);self._debug('MAC name: '+self.defaultAdapter.name);for(var i=0;i<self.actionQueue.length;i++){var action=self.actionQueue[i];action.callback.apply(self,action.args);}
self.actionQueue=[];};req.onerror=function bt_getAdapterError(){self._logVisibly('event listner: Failed to get bluetooth adater');};});window.addEventListener('bluetooth-disabled',function(){self._debug('bluetooth-disabled');self._clearBluetoothStatus();});window.navigator.mozSetMessageHandler('nfc-manager-send-file',function(msg){self._debug('In New event nfc-manager-send-file'+JSON.stringify(msg));self.handleFileTransfer(msg.peer,msg.blob,msg.requestId);});SettingsListener.observe('nfc.debugging.enabled',false,(enabled)=>{this.DEBUG=enabled;});window.addEventListener('nfc-transfer-started',this._transferStarted.bind(this));},_saveBluetoothStatus:function _saveBluetoothStatus(){if(!this.bluetoothStatusSaved){this.bluetoothStatusSaved=true;this.bluetoothAutoEnabled=!this.bluetooth.enabled;}},_restoreBluetoothStatus:function _restoreBluetoothStatus(){if(!this.isHandoverInProgress()&&BluetoothTransfer.isSendFileQueueEmpty){if(this.bluetoothAutoEnabled){this._debug('Disabling Bluetooth');this.settings.createLock().set({'bluetooth.enabled':false});this.bluetoothAutoEnabled=false;}
this.bluetoothStatusSaved=false;}},_clearBluetoothStatus:function _clearBluetoothStatus(){this.bluetoothStatusSaved=false;},_doAction:function _doAction(action){if(!this.bluetooth.enabled){this._debug('Bluetooth: not yet enabled');this.actionQueue.push(action);if(this.settingsNotified===false){this.settings.createLock().set({'bluetooth.enabled':true});this.settingsNotified=true;}}else{action.callback.apply(this,action.args);}},_getBluetoothSSP:function _getBluetoothSSP(ndef){var handover=NDEFUtils.parseHandoverNDEF(ndef);if(handover==null){this._debug('Bad handover messsage');return null;}
var btsspRecord=NDEFUtils.searchForBluetoothAC(handover);if(btsspRecord==null){this._debug('No BT AC');return null;}
return NDEFUtils.parseBluetoothSSP(btsspRecord);},_findPairedDevice:function _findPairedDevice(mac,foundCb,notFoundCb){this._debug('_findPairedDevice');if(this.defaultAdapter==null){this._debug('No defaultAdapter');return;}
var req=this.defaultAdapter.getPairedDevices();req.onsuccess=()=>{var devices=req.result;this._debug('# devices: '+devices.length);for(var i=0;i<devices.length;i++){var device=devices[i];this._debug('Address: '+device.address);this._debug('Connected: '+device.connected);if(device.address.toLowerCase()===mac.toLowerCase()){this._debug('Found device '+mac);foundCb(device);return;}}
if(notFoundCb){notFoundCb();}};req.onerror=()=>{this._logVisibly('Cannot get paired devices from adapter.');};},_doConnect:function _doConnect(device){this._debug('doConnect with: '+device.address);var req=this.defaultAdapter.connect(device);req.onsuccess=()=>{this._debug('Connect succeeded');};req.onerror=()=>{this._debug('Connect failed');};},_doPairing:function _doPairing(mac){this._debug('doPairing: '+mac);var alreadyPaired=(device)=>{this.defaultAdapter.connect(device);};var notYetPaired=()=>{this._debug('Device not yet paired');var req=this.defaultAdapter.pair(mac);req.onsuccess=()=>{this._debug('Pairing succeeded');this._clearBluetoothStatus();this._findPairedDevice(mac,(device)=>{this.defaultAdapter.connect(device);});};req.onerror=()=>{this._logVisibly('Pairing failed');this._restoreBluetoothStatus();};};this._findPairedDevice(mac,alreadyPaired,notYetPaired);},_showFailedNotification:function _showFailedNotification(title,msg){var body=(msg!==undefined)?msg:'';var icon='style/bluetooth_transfer/images/icon_bluetooth.png';NotificationHelper.send(title,{body:body,icon:icon});},_showTryAgainNotification:function _showTryAgainNotification(){var _=navigator.mozL10n.get;this._showFailedNotification('transferFinished-sentFailed-title',_('transferFinished-try-again-description'));},_cancelSendFileTransfer:function _cancelSendFileTransfer(){this._debug('_cancelSendFileTransfer');this.responseTimeoutFunction=null;var job=this.sendFileQueue.pop();job.onerror();this._showFailedNotification('transferFinished-sentFailed-title',job.blob.name);this._restoreBluetoothStatus();},_cancelIncomingFileTransfer:function _cancelIncomingFileTransfer(){this._debug('_cancelIncomingFileTransfer');this.responseTimeoutFunction=null;this.incomingFileTransferInProgress=false;this._showFailedNotification('transferFinished-receivedFailed-title');this._restoreBluetoothStatus();},_doFileTransfer:function _doFileTransfer(mac){this._debug('doFileTransfer');if(this.sendFileQueue.length===0){this._debug('sendFileQueue empty');return;}
this._debug('Send blob to '+mac);var blob=this.sendFileQueue[0].blob;BluetoothTransfer.sendFileViaHandover(mac,blob);},_doHandoverRequest:function _doHandoverRequest(ndef,nfcPeer){this._debug('doHandoverRequest');if(this._getBluetoothSSP(ndef)==null){return;}
if(nfcPeer.isLost){this._logVisibly('NFC peer went away during doHandoverRequest');this._showFailedNotification('transferFinished-receivedFailed-title');this._restoreBluetoothStatus();return;}
var cps=this.bluetooth.enabled?NDEF.CPS_ACTIVE:NDEF.CPS_ACTIVATING;var mac=this.defaultAdapter.address;var hs=NDEFUtils.encodeHandoverSelect(mac,cps);var promise=nfcPeer.sendNDEF(hs);promise.then(()=>{this._debug('sendNDEF(hs) succeeded');this.incomingFileTransferInProgress=true;}).catch(e=>{this._logVisibly('sendNDEF(hs) failed : '+e);this._clearTimeout();this._restoreBluetoothStatus();});this._clearTimeout();this.responseTimeoutFunction=setTimeout(this._cancelIncomingFileTransfer.bind(this),this.responseTimeoutMillis);},_initiateFileTransfer:function _initiateFileTransfer(nfcPeer,blob,requestId){this._debug('initiateFileTransfer');var self=this;var onsuccess=function(){self._dispatchSendFileStatus(0,requestId);};var onerror=function(){self._dispatchSendFileStatus(1,requestId);};if(nfcPeer.isLost){this._logVisibly('NFC peer went away during initiateFileTransfer');onerror();this._restoreBluetoothStatus();this._showFailedNotification('transferFinished-sentFailed-title',blob.name);return;}
var job={nfcPeer:nfcPeer,blob:blob,requestId:requestId,onsuccess:onsuccess,onerror:onerror};this.sendFileQueue.push(job);var cps=this.bluetooth.enabled?NDEF.CPS_ACTIVE:NDEF.CPS_ACTIVATING;var mac=this.defaultAdapter.address;var hr=NDEFUtils.encodeHandoverRequest(mac,cps);var promise=nfcPeer.sendNDEF(hr);promise.then(()=>{this._debug('sendNDEF(hr) succeeded');}).catch(e=>{this._debug('sendNDEF(hr) failed : '+e);onerror();this.sendFileQueue.pop();this._clearTimeout();this._restoreBluetoothStatus();this._showFailedNotification('transferFinished-sentFailed-title',blob.name);});this._clearTimeout();this.responseTimeoutFunction=setTimeout(this._cancelSendFileTransfer.bind(this),this.responseTimeoutMillis);},_clearTimeout:function _clearTimeout(){this._debug('_clearTimeout');if(this.responseTimeoutFunction!=null){this._debug('clearing timeout');clearTimeout(this.responseTimeoutFunction);this.responseTimeoutFunction=null;}},_dispatchSendFileStatus:function _dispatchSendFileStatus(status,requestId){this._debug('In dispatchSendFileStatus '+status);navigator.mozNfc.notifySendFileStatus(status,requestId);},_onRequestConnect:function _onRequestConnect(btssp){},_checkConnected:function _checkConnected(btssp){if(!this.bluetooth.enabled){this._onRequestConnect(btssp);return;}
this._findPairedDevice(btssp.mac,(device)=>{if(!device.connected){this._onRequestConnect(btssp);}},()=>{this._onRequestConnect(btssp);});},_handleSimplifiedPairingRecord:function _handleSimplifiedPairingRecord(ndef){this._debug('_handleSimplifiedPairingRecord');var pairingRecord=ndef[0];var btssp=NDEFUtils.parseBluetoothSSP(pairingRecord);this._debug('Simplified pairing with: '+btssp.mac);this._checkConnected(btssp);},_handleHandoverSelect:function _handleHandoverSelect(ndef){this._debug('_handleHandoverSelect');this._clearTimeout();var btssp=this._getBluetoothSSP(ndef);if(btssp==null){if(this.sendFileQueue.length!==0){this._debug('Other device is transferring file. Aborting');var job=this.sendFileQueue.shift();job.onerror();this._showTryAgainNotification();}
this._restoreBluetoothStatus();return;}
if(this.sendFileQueue.length!==0){this._doAction({callback:this._doFileTransfer,args:[btssp.mac]});}else{this._checkConnected(btssp);}},_handleHandoverRequest:function _handleHandoverRequest(ndef,nfcPeer){this._debug('_handleHandoverRequest');if(BluetoothTransfer.isFileTransferInProgress){this._debug('This device is currently transferring a file. '+'Aborting via empty Hs');var hs=NDEFUtils.encodeEmptyHandoverSelect();nfcPeer.sendNDEF(hs);return;}
this._saveBluetoothStatus();this._doAction({callback:this._doHandoverRequest,args:[ndef,nfcPeer]});},tryHandover:function(ndefMsg,nfcPeer){this._debug('tryHandover: ',ndefMsg);var nfcUtils=new NfcUtils();if(!Array.isArray(ndefMsg)||!ndefMsg.length){return false;}
var record=ndefMsg[0];if(record.tnf===NDEF.TNF_WELL_KNOWN){if(nfcUtils.equalArrays(record.type,NDEF.RTD_HANDOVER_SELECT)){this._handleHandoverSelect(ndefMsg);return true;}else if(nfcUtils.equalArrays(record.type,NDEF.RTD_HANDOVER_REQUEST)){this._handleHandoverRequest(ndefMsg,nfcPeer);return true;}}else if((record.tnf===NDEF.TNF_MIME_MEDIA)&&nfcUtils.equalArrays(record.type,NDEF.MIME_BLUETOOTH_OOB)){this._handleSimplifiedPairingRecord(ndefMsg);return true;}
return false;},handleFileTransfer:function handleFileTransfer(nfcPeer,blob,requestId){this._debug('handleFileTransfer');if(BluetoothTransfer.isFileTransferInProgress){this._debug('This device is already transferring a file. Aborting');this._dispatchSendFileStatus(1,requestId);this._showTryAgainNotification();return;}
this._saveBluetoothStatus();this._doAction({callback:this._initiateFileTransfer,args:[nfcPeer,blob,requestId]});},isHandoverInProgress:function isHandoverInProgress(){return(this.sendFileQueue.length!==0)||(this.incomingFileTransferInProgress===true);},_transferStarted:function bt__transferStarted(){this._clearTimeout();},transferComplete:function transferComplete(details){this._debug('transferComplete: '+JSON.stringify(details));if(!details.received&&details.viaHandover){var job=this.sendFileQueue.shift();if(details.success){job.onsuccess();}else{job.onerror();}}
if(details.received){this.incomingFileTransferInProgress=false;}
this._restoreBluetoothStatus();}};