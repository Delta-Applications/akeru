'use strict';function eventSafety(obj,event,callback,timeout){var finishTimeout;function done(e){if(e&&e.type==='transitionend'&&e.target!==obj){return;}
clearTimeout(finishTimeout);obj.removeEventListener(event,done);callback.apply(this,arguments);}
obj.addEventListener(event,done);finishTimeout=setTimeout(done,timeout);}