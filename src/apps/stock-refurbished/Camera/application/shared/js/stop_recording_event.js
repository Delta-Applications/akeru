
(function(exports){'use strict';const stopRecordingKey='private.broadcast.stop_recording';const attentionScreenKey='private.broadcast.attention_screen_opening';function start(){if(!document.hidden){listen();}
window.addEventListener('visibilitychange',visibilityChangeHandler);}
function stop(){window.removeEventListener('visibilitychange',visibilityChangeHandler);unlisten();}
function visibilityChangeHandler(){if(document.hidden){unlisten();}
else{listen();}}
function listen(){navigator.mozSettings.addObserver(stopRecordingKey,stopRecordingObserver);navigator.mozSettings.addObserver(attentionScreenKey,stopRecordingObserver);}
function unlisten(){navigator.mozSettings.removeObserver(stopRecordingKey,stopRecordingObserver);navigator.mozSettings.removeObserver(attentionScreenKey,stopRecordingObserver);}
function stopRecordingObserver(event){if(event.settingValue){window.dispatchEvent(new CustomEvent('stoprecording'));}}
exports.StopRecordingEvent={start:start,stop:stop};}(window));