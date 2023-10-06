
(function(exports){'use strict';function ensureValidEventName(eventName){if(!eventName||typeof eventName!=='string'){throw new Error('Event name should be a valid non-empty string!');}}
function ensureValidHandler(handler){if(typeof handler!=='function'){throw new Error('Handler should be a function!');}}
function ensureAllowedEventName(allowedEvents,eventName){if(allowedEvents&&allowedEvents.indexOf(eventName)<0){throw new Error('Event "'+eventName+'" is not allowed!');}}
let eventDispatcher={on:function(eventName,handler){ensureValidEventName(eventName);ensureAllowedEventName(this.allowedEvents,eventName);ensureValidHandler(handler);let handlers=this.listeners.get(eventName);if(!handlers){handlers=new Set();this.listeners.set(eventName,handlers);}
handlers.add(handler);},off:function(eventName,handler){ensureValidEventName(eventName);ensureAllowedEventName(this.allowedEvents,eventName);ensureValidHandler(handler);let handlers=this.listeners.get(eventName);if(!handlers){return;}
handlers.delete(handler);if(!handlers.size){this.listeners.delete(eventName);}},offAll:function(eventName){if(typeof eventName==='undefined'){this.listeners.clear();return;}
ensureValidEventName(eventName);ensureAllowedEventName(this.allowedEvents,eventName);let handlers=this.listeners.get(eventName);if(!handlers){return;}
handlers.clear();this.listeners.delete(eventName);},emit:function(eventName,parameters){ensureValidEventName(eventName);ensureAllowedEventName(this.allowedEvents,eventName);let handlers=this.listeners.get(eventName);if(!handlers){return;}
handlers.forEach(function(handler){try{handler(parameters);}catch(e){console.error(e);}});}};exports.EventDispatcher={mixin:function(target,allowedEvents){if(!target||typeof target!=='object'){throw new Error('Object to mix into should be valid object!');}
if(typeof allowedEvents!=='undefined'&&!Array.isArray(allowedEvents)){throw new Error('Allowed events should be a valid array of strings!');}
Object.keys(eventDispatcher).forEach(function(method){if(typeof target[method]!=='undefined'){throw new Error('Object to mix into already has "'+method+'" property defined!');}
target[method]=eventDispatcher[method].bind(this);},{listeners:new Map(),allowedEvents:allowedEvents});return target;}};})(window);