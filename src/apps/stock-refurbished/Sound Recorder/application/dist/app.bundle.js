!function(e){function t(n){if(i[n])return i[n].exports;var r=i[n]={i:n,l:!1,exports:{}};return e[n].call(r.exports,r,r.exports,t),r.l=!0,r.exports}var n=window.webpackJsonp;window.webpackJsonp=function(t,i,s){for(var a,o,d=0,u=[];d<t.length;d++)o=t[d],r[o]&&u.push(r[o][0]),r[o]=0;for(a in i)Object.prototype.hasOwnProperty.call(i,a)&&(e[a]=i[a]);for(n&&n(t,i,s);u.length;)u.shift()()};var i={},r={2:0};t.e=function(e){function n(){o.onerror=o.onload=null,clearTimeout(d);var t=r[e];0!==t&&(t&&t[1](new Error("Loading chunk "+e+" failed.")),r[e]=void 0)}var i=r[e];if(0===i)return new Promise(function(e){e()});if(i)return i[2];var s=new Promise(function(t,n){i=r[e]=[t,n]});i[2]=s;var a=document.getElementsByTagName("head")[0],o=document.createElement("script");o.type="text/javascript",o.charset="utf-8",o.async=!0,o.timeout=12e4,t.nc&&o.setAttribute("nonce",t.nc),o.src=t.p+""+e+".bundle.js";var d=setTimeout(n,12e4);return o.onerror=o.onload=n,a.appendChild(o),s},t.m=e,t.c=i,t.i=function(e){return e},t.d=function(exports,e,n){t.o(exports,e)||Object.defineProperty(exports,e,{configurable:!1,enumerable:!0,get:n})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="dist/",t.oe=function(e){throw e},t(t.s=206)}({10:function(e,exports,t){"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var n=t(5),i=function(e){return e&&e.__esModule?e:{default:e}}(n),r={isAddMetadata:!1,fileSrc:null,openFile:null,isPicker:!1,pendingPick:null,handleTimer:!1,isAppend:!1,fileNameCache:null,listActiveElementIndex:0,isSaving:!1,showInvalidDialog:function(e){var t=this;i.default.request("showDialog",{type:"custom",header:"confirmation",content:"invalid-confirm",ok:"ok",buttons:[{message:""},{message:"ok"},{message:""}],onOk:function(){t.pendingPick?t.pendingPick.postError("Invalid audio file!"):i.default.request("back")}})}};exports.default=r},101:function(e,exports,t){"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var n={checkFileName:function(e){return e.replace(/<(?:[^"'>]|"[^"]*"|'[^']*')*>/g,"")}};exports.default=n},206:function(e,exports,t){"use strict";function n(e){return e&&e.__esModule?e:{default:e}}function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}var r=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),s=t(10),a=n(s),o=t(101),d=n(o),u=function(){function e(){i(this,e)}return r(e,[{key:"start",value:function(){this.content=document.querySelector("#audio-list"),this.ssr=document.getElementById("ssr"),window.addEventListener("DOMContentLoaded",this),window.addEventListener("fullyloaded",this),this.ssr.addEventListener("keydown",this,!0),document.body.classList.toggle("large-text",navigator.largeTextEnabled),window.addEventListener("largetextenabledchanged",function(){document.body.classList.toggle("large-text",navigator.largeTextEnabled)}),navigator.mozSetMessageHandler("activity",function(e){a.default.pendingPick=e,"pick"===e.source.name&&(a.default.isPicker=!0)})}},{key:"handleEvent",value:function(e){var t=this;switch(e.type){case"DOMContentLoaded":window.removeEventListener("DOMContentLoaded",this),this.readCache();break;case"fullyloaded":window.setTimeout(function(){var e=document.getElementsByTagName("body")[0];t.ssr&&(e.removeChild(t.ssr),t.ssr=null)},0)}}},{key:"readCache",value:function(){var e="",t=window.localStorage.getItem("records"),n=document.getElementById("softkeyPanel"),i=document.getElementById("fake-header");if(window.isVisuallyLoaded=!1,t=JSON.parse(t),t&&t.length>0?-1!==document.URL.indexOf("#open")?(n.children[1].dataset.icon="play",n.children[2].dataset.l10nId="option"):(t.forEach(function(t,n){if(t.name&&t.duration&&t.date){var i='<li>\n                        <div>\n                          <p class="audio-name"></p>\n                          <p class="audio-infor">\n                            <span class="audio-time p-sec">'+t.duration+'</span>\n                            <span class="audio-date p-thi">'+t.date+"</span>\n                          </p>\n                        </div>\n                      </li>";e+=i}}),-1!==document.URL.indexOf("#pick")?(i.dataset.l10nId="title-pick-audio-list",n.children[0].dataset.l10nId="cancel",n.children[1].dataset.l10nId="select"):(i.dataset.l10nId="title-audio-list",n.children[0].dataset.l10nId="new",n.children[1].dataset.l10nId="select",n.children[2].dataset.l10nId="options")):-1!==document.URL.indexOf("#pick")?(i.dataset.l10nId="title-pick-audio-list",e='<div class="no-record"><p data-l10n-id="audio-pick-is-empty"/></div>',n.children[1].dataset.l10nId="ok"):(i.dataset.l10nId="title-audio-list",e='<div class="no-record"><p data-l10n-id="audio-recorder-is-empty"/></div>',n.children[0].dataset.l10nId="new",n.children[2].dataset.l10nId="option"),this.content.innerHTML=e,t&&t.length>0){var r=document.querySelectorAll(".audio-name");t.forEach(function(e,t){var n=d.default.checkFileName(e.name);r.length&&r[t]&&(r[t].innerText=n)})}window.performance.mark("visuallyLoaded"),window.isVisuallyLoaded=!0,this.load()}},{key:"load",value:function(){LazyLoader.load(["shared/js/device_storage/enumerate_all.js","shared/js/date_time_helper.js","shared/js/mediadb.js","shared/js/toaster.js"],function(){window.requestAnimationFrame(function(){window.setTimeout(function(){t.e(0).then(t.bind(null,207))},50)})})}}]),e}(),c=new u;c.start(),window._app=c},5:function(e,exports,t){"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var n={_providers:new Map,_services:new Map,_requestsByService:new Map,_requestsByProvider:new Map,request:function(e){var t=e.split(":"),n=Array.prototype.slice.call(arguments,1),i=this;if(this.debug(t),t.length>1){var r=t[0],s=t[1];return this._providers.get(r)?(this.debug("service: "+s+" is online, perform the request with "+n.concat()),Promise.resolve(this._providers.get(r)[s].apply(i._providers.get(r),n))):new Promise(function(t,a){i.debug("service: "+e+" is offline, queue the task."),i._requestsByProvider.has(r)||i._requestsByProvider.set(r,[]),i._requestsByProvider.get(r).push({service:s,resolve:t,args:n})})}if(this._services.has(e)){var a=this._services.get(e);return this.debug("service ["+e+"] provider ["+a.name+"] is online, perform the task."),Promise.resolve(a[e].apply(a,n))}return this.debug("service: "+e+" is offline, queue the task."),new Promise(function(t,r){i.debug("storing the requests..."),i._requestsByService.has(e)||i._requestsByService.set(e,[]),i._requestsByService.get(e).push({service:e,resolve:t,args:n})})},register:function(e,t){var n=this;if(this._providers.has(t.name)||this._providers.set(t.name,t),this.debug((t.name||"(Anonymous)")+" is registering service: ["+e+"]"),this.debug("checking awaiting requests by server.."),this._requestsByProvider.has(t.name)&&(this._requestsByProvider.get(t.name).forEach(function(e){n.debug("resolving..",t,t.name,e.service,e.args);var i="function"==typeof t[e.service]?t[e.service].apply(t,e.args):t[e.service];e.resolve(i)}),this._requestsByProvider.delete(t.name)),this._services.has(e))return void this.debug("the service ["+e+"] has already been registered by other server:",this._services.get(e).name);this._services.set(e,t),this.debug("checking awaiting requests by service.."),this._requestsByService.has(e)&&(this._requestsByService.get(e).forEach(function(e){n.debug("resolving..",t,e.service);var i=t[e.service].apply(t,e.args);e.resolve(i)}),this._requestsByService.delete(e))},unregister:function(e,t){this._providers.delete(t.name);var n=this._services.get(e);n&&t===n&&this._services.delete(e)},_states:new Map,_statesByState:new Map,registerState:function(e,t){this._states.set(t.name,t),t.name,this._statesByState.set(e,t)},unregisterState:function(e,t){this._states.delete(t.name),this._statesByState.get(e)===t&&this._statesByState.delete(e)},query:function(e){this.debug(e);var t,n,i=e.split(".");if(i.length>1?(n=this._states.get(i[0]),t=i[1]):(t=i[0],n=this._statesByState.get(t)),!n)return void this.debug("Provider not ready, return undefined state.");if("function"==typeof n[t]){var r=Array.prototype.slice.call(arguments,1);return n[t].apply(n,r)}return n[t]},_start:(new Date).getTime()/1e3,currentTime:function(){return((new Date).getTime()/1e3-this._start).toFixed(3)},debug:function(){}};exports.default=n}});
//# sourceMappingURL=app.bundle.js.map