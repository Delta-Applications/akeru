const dateMultipliers={days:864e5,hours:36e5,minutes:6e4,seconds:1e3,milliseconds:1},units=Object.keys(dateMultipliers),wakeTarget={requests:{cpu:new Map,screen:new Map,wifi:new Map},locks:{cpu:null,screen:null,wifi:null},timeouts:{cpu:null,screen:null,wifi:null}};function getLongestLock(e){let t=0;for(var r of wakeTarget.requests[e]){var[,r]=r;r.time>t&&(t=r.time)}return{time:t,lock:wakeTarget.locks[e],timeout:wakeTarget.timeouts[e]}}const Utils={isShowToast:!0,singleton(a,o){const n=new Map;return()=>{var e=Array.prototype.slice.call(arguments),t="function"==typeof o?o(e):a;let r=n.get(t);return r||(r=Object.create(a.prototype),a.apply(r,e),n.set(t,r)),r}},memoizedDomPropertyDescriptor(e){let t=null;return{get(){return null===t&&(t=document.querySelector(e)),t},set(e){t=e}}},extendWithDomGetters(e,t){for(var r in t)Object.defineProperty(e,r,Utils.memoizedDomPropertyDescriptor(t[r]));return e},dateMath:{toMS(r,e){let t=null;let a=null;return r instanceof Date||"number"==typeof r?+r:(e=e||{},a=e.unitsPartial||units,a=a.map(e=>e.endsWith("s")?e:e.concat("s")),e=a.some(e=>r[e]<0)?-1:1,t=a.map(e=>{var t;return(t=Math.abs(r[e]))?t*dateMultipliers[e]:0}),e*t.reduce((e,t)=>e+t))},fromMS(r,e){let a=null,t=null,o=null;return e=e||{},o=e.unitsPartial||units,o=o.map(e=>e.endsWith("s")?e:e.concat("s")),r<0?(a=-1,r=Math.abs(r)):a=1,t=o.map(e=>{var t=dateMultipliers[e],e=Math.floor(r/t);return r-=e*t,a*e}),t.reduce((e,t,r)=>(e[o[r]]=t,e),{})}},extend(t,r){r=Array.prototype.slice.call(arguments,1);for(let e=0;e<r.length;e++){var a,o=r[e];for(a in o){var n=Object.getOwnPropertyDescriptor(o,a);n&&void 0!==n.value&&(t[a]=o[a])}}return t},getLocalizedTimeHtml(e){const t=new window.api.l10n.DateTimeFormat;var r=window.api.hour12?window.api.l10n.get("shortTimeFormat12"):window.api.l10n.get("shortTimeFormat24");return t.localeFormat(e,r)},getLocalizedTimeText(e){const t=new window.api.l10n.DateTimeFormat;var r=window.api.hour12?window.api.l10n.get("shortTimeFormat12"):window.api.l10n.get("shortTimeFormat24");return t.localeFormat(e,r)},changeSelectByValue(t,r){var{options:a}=t;for(let e=0;e<a.length;e++)if(a[e].value===r){t.selectedIndex!==e&&(t.selectedIndex=e);break}},getSelectedValueByIndex(e){return e.options[e.selectedIndex].value},safeWakeLock(e,t){const r=(e=e||{}).type||"cpu";var a=e.timeoutMs||0,e=Date.now();let o={};wakeTarget.requests[r].set(o,{time:e+a}),a=getLongestLock(r);const n=()=>{var e,t;o&&(wakeTarget.requests[r].delete(o),e=Date.now(),(t=getLongestLock(r)).time>e?(clearTimeout(wakeTarget.timeouts[r]),wakeTarget.timeouts[r]=setTimeout(n,t.time-e)):(wakeTarget.locks[r]&&wakeTarget.locks[r].unlock(),wakeTarget.locks[r]=null,clearTimeout(wakeTarget.timeouts[r]),wakeTarget.timeouts[r]=null),o=null)};clearTimeout(wakeTarget.timeouts[r]),wakeTarget.timeouts[r]=setTimeout(n,a.time-e);try{!wakeTarget.locks[r]&&a.time>e&&(wakeTarget.locks[r]=navigator.b2g.requestWakeLock(r)),t(n)}catch(e){throw n(),e}},repeatString(e,r){const a=[];let o=e;for(let e=0,t=1;t<=r;e++)0<(r&&t)&&a.push(o),o+=o,t<<=1;return a.join("")},format:{hms(e,t){let r=0,a=0;return 3600<=e&&(r=Math.floor(e/3600),e-=3600*r),60<=e&&(a=Math.floor(e/60),e-=60*a),r=r<10?`0${r}`:r,a=a<10?`0${a}`:a,e=e<10?`0${e}`:e,void 0!==t?(t=(t=t.replace("hh",r)).replace("mm",a)).replace("ss",e):`${r}:${a}:${e}`},durationMs(e){var t=Utils.dateMath.fromMS(e,{unitsPartial:["minutes","seconds","milliseconds"]});return[(e=(e,t)=>(e=String(e),Utils.repeatString("0",Math.max(0,t-e.length))+e))(t.minutes,2),":",e(t.seconds,2),".",e(t.milliseconds/10|0,2)].join("")}},getOnOffValueText(e){const t=window.api.l10n.get;return t("true"==e?"kai-on":"false"==e?"kai-off":null)},summarizeDaysOfWeek(e,t){const r=[];if(e)for(var a in e)e[a]&&r.push(a);const o=window.api.l10n.get;if(7===r.length)return o("everyday");if(5===r.length&&-1===r.indexOf("saturday")&&-1===r.indexOf("sunday"))return o("weekdays");if(2===r.length&&-1!==r.indexOf("saturday")&&-1!==r.indexOf("sunday"))return o("weekends");if(0===r.length)return o(t);t=parseInt(o("weekStartsOnMonday"),10)?Constants.DAYS_STARTING_MONDAY:Constants.DAYS_STARTING_SUNDAY;const n=[];return[].forEach.call(t,e=>{-1!==r.indexOf(e)&&n.push(o(Constants.DAY_STRING_TO_L10N_ID[e]))}),n.join(" ")},showToast(e,t){if(Utils.isShowToast){const r={messageL10nId:e,messageL10nArgs:void 0===t?null:t,latency:2e3,useTransition:!0};"undefined"==typeof Toaster?LazyLoader.load(["http://shared.localhost/js/utils/toaster/toaster.js"],()=>{Toaster.showToast(r)}):Toaster.showToast(r)}},deleteItemFromArray(t,r){for(let e=0;e<t.length;e++)t[e].id===r&&t.splice(e,1);return t},soundRadioChecked(e,t){const r=document.querySelector(t),a=e.querySelector(".clsSoundBackIcon");r.classList.toggle("soundChecked",!1),r.setAttribute("data-icon","radio-off"),a.classList.toggle("soundChecked",!0),a.setAttribute("data-icon","radio-on")},soundLabelSet(e,t){const r=document.getElementById(t);r.setAttribute("data-l10n-id",e)}};window.Utils=Utils;