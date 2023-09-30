
var AVRCP={PLAY_PRESS:'media-play-button-press',PLAY_RELEASE:'media-play-button-release',PAUSE_PRESS:'media-pause-button-press',PAUSE_RELEASE:'media-pause-button-release',PLAY_PAUSE_PRESS:'media-play-pause-button-press',PLAY_PAUSE_RELEASE:'media-play-pause-button-release',STOP_PRESS:'media-stop-button-press',STOP_RELEASE:'media-stop-button-release',NEXT_PRESS:'media-next-track-button-press',NEXT_RELEASE:'media-next-track-button-release',PREVIOUS_PRESS:'media-previous-track-button-press',PREVIOUS_RELEASE:'media-previous-track-button-release',FAST_FORWARD_PRESS:'media-fast-forward-button-press',FAST_FORWARD_RELEASE:'media-fast-forward-button-release',REWIND_PRESS:'media-rewind-button-press',REWIND_RELEASE:'media-rewind-button-release'};var IAC={PLAY_PRESS:'play',PLAY_PAUSE_PRESS:'playpause',PAUSE_PRESS:'pause',STOP_PRESS:'stop',NEXT_PRESS:'nexttrack',PREVIOUS_PRESS:'prevtrack',FAST_FORWARD_PRESS:'fastforwardstart',FAST_FORWARD_RELEASE:'fastforwardend',REWIND_PRESS:'rewindstart',REWIND_RELEASE:'rewindend'};var REMOTE_CONTROLS={PLAY:'play',PLAY_PAUSE:'playpause',PAUSE:'pause',STOP:'stop',NEXT:'next',PREVIOUS:'previous',SEEK_PRESS:'seekpress',SEEK_RELEASE:'seekrelease',UPDATE_METADATA:'updatemetadata',UPDATE_PLAYSTATUS:'updateplaystatus'};function MediaRemoteControls(){this._bluetoothHelper=null;this._commandListeners={};this._isSCOConnected=false;for(var command in REMOTE_CONTROLS)
this._commandListeners[REMOTE_CONTROLS[command]]=[];}
MediaRemoteControls.prototype.addCommandListener=function(command,listener){if(this._commandListeners[command])
this._commandListeners[command].push(listener);};MediaRemoteControls.prototype.removeCommandListener=function(name,listener){if(this._commandListeners[name]){var index=-1;this._commandListeners[name].forEach(function(currListener,i){if(currListener===listener)
index=i;});if(index!==-1)
this._commandListeners[name].splice(index,1);}};MediaRemoteControls.prototype.start=function(callback){this._setupBluetooth(callback);this._setupIAC();};MediaRemoteControls.prototype._setupBluetooth=function(callback){if(!window.navigator.mozBluetooth){return callback&&callback();}
var self=this;navigator.mozSetMessageHandler('media-button',this._commandHandler.bind(this));this._bluetoothHelper=new BluetoothHelper();this._bluetoothHelper.onrequestmediaplaystatus=playstatusHandler;this._bluetoothHelper.ona2dpstatuschanged=a2dpConnectionHandler;this._bluetoothHelper.onscostatuschanged=scoConnectionHandler;if(callback){callback();}
function playstatusHandler(){if(self._commandListeners['updateplaystatus'].length>0)
self._commandHandler(REMOTE_CONTROLS.UPDATE_PLAYSTATUS);}
function a2dpConnectionHandler(event){var isConnected=event.status;if(isConnected&&self._commandListeners['updatemetadata'].length>0){self._commandHandler(REMOTE_CONTROLS.UPDATE_METADATA);}else if(!navigator.mozAudioChannelManager||!navigator.mozAudioChannelManager.headphones){self._commandHandler(AVRCP.PAUSE_PRESS);}}
function scoConnectionHandler(event){self._isSCOConnected=event.status;if(self._isSCOConnected)
self._commandHandler(AVRCP.PAUSE_PRESS);else
self._commandHandler(AVRCP.PLAY_PRESS);}};MediaRemoteControls.prototype._setupIAC=function(){var self=this;this._queuedMessages=[];navigator.mozApps.getSelf().onsuccess=function(){var app=this.result;if(!app.connect){this._queuedMessages=null;return;}
app.connect('mediacomms').then(function(ports){self._ports=ports;self._ports.forEach(function(port){port.onmessage=function(event){self._commandHandler(event.data.command);};self._queuedMessages.forEach(function(message){port.postMessage(message);});});self._queuedMessages=null;});};};MediaRemoteControls.prototype.getSCOStatus=function(callback){if(!this._bluetoothHelper){return callback(false);};this._bluetoothHelper.isScoConnected(callback,function onerror(){callback(false);});};MediaRemoteControls.prototype.hasConnectedDevicesByA2dp=function(){return new Promise(resolve=>{if(!this._bluetoothHelper){return resolve(false);}
this._bluetoothHelper.getConnectedDevicesByProfile(this._bluetoothHelper.profiles.A2DP,devices=>{resolve(devices.length>0?true:false);},()=>{resolve(false);});})};MediaRemoteControls.prototype._postMessage=function(name,value){var message={type:name,data:value};if(!this._ports){if(this._queuedMessages)
this._queuedMessages.push(message);}else{this._ports.forEach(function(port){port.postMessage(message);});}};MediaRemoteControls.prototype._commandHandler=function(message){var type='remote';var option={};switch(message){case AVRCP.PLAY_PRESS:case IAC.PLAY_PRESS:option.detail={command:REMOTE_CONTROLS.PLAY,isSCOConnected:this._isSCOConnected};break;case AVRCP.PLAY_PAUSE_PRESS:case IAC.PLAY_PAUSE_PRESS:option.detail={command:REMOTE_CONTROLS.PLAY_PAUSE,isSCOConnected:this._isSCOConnected};break;case AVRCP.PAUSE_PRESS:case IAC.PAUSE_PRESS:option.detail={command:REMOTE_CONTROLS.PAUSE,isSCOConnected:this._isSCOConnected};break;case AVRCP.STOP_PRESS:case IAC.STOP_PRESS:option.detail={command:REMOTE_CONTROLS.STOP};break;case AVRCP.NEXT_PRESS:case IAC.NEXT_PRESS:option.detail={command:REMOTE_CONTROLS.NEXT};break;case AVRCP.PREVIOUS_PRESS:case IAC.PREVIOUS_PRESS:option.detail={command:REMOTE_CONTROLS.PREVIOUS};break;case AVRCP.FAST_FORWARD_PRESS:case IAC.FAST_FORWARD_PRESS:option.detail={command:REMOTE_CONTROLS.SEEK_PRESS,direction:1};break;case AVRCP.REWIND_PRESS:case IAC.REWIND_PRESS:option.detail={command:REMOTE_CONTROLS.SEEK_PRESS,direction:-1};break;case AVRCP.FAST_FORWARD_RELEASE:case IAC.FAST_FORWARD_RELEASE:case AVRCP.REWIND_RELEASE:case IAC.REWIND_RELEASE:option.detail={command:REMOTE_CONTROLS.SEEK_RELEASE};break;case REMOTE_CONTROLS.UPDATE_METADATA:case REMOTE_CONTROLS.UPDATE_PLAYSTATUS:option.detail={command:message};break;default:return;}
var event=new CustomEvent(type,option);this._executeCommandListeners(event);};MediaRemoteControls.prototype._executeCommandListeners=function(event){if(!event.detail)
return;this._commandListeners[event.detail.command].forEach(function(listener){listener(event);});};MediaRemoteControls.prototype.notifyAppInfo=function(info){this._postMessage('appinfo',info);};MediaRemoteControls.prototype.notifyMetadataChanged=function(metadata){if(this._bluetoothHelper){this._bluetoothHelper.sendMediaMetaData(metadata,function onsuccess(){},function onerror(){console.log('Sending Metadata error');});}
this._postMessage('nowplaying',metadata);};MediaRemoteControls.prototype.notifyStatusChanged=function(status){if(status.playStatus==='mozinterruptbegin'){return;}
if(this._bluetoothHelper){this._bluetoothHelper.sendMediaPlayStatus(status,function onsuccess(){},function onerror(){console.log('Sending Playstatus error');});}
this._postMessage('status',status);};