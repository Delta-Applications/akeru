!function(e){const c={};function n(e){if(void 0!==e){if(!e)return null;const t={};for(const o in e)Object.prototype.hasOwnProperty.call(e,o)&&(t[o]=e[o]);return t}}e.RttCache={getMessage:function(e,t){return e&&c[e]?n(c[e][t]):(dump(`RTT cache getMessage: callId is invalid ${e}`),null)},setMessageColor:function(e,t,o,n){e?RttBubbleControl.setMessageColor(e,t,o,n):dump("RTT cache setMessageColor: callId is null")},setMessage:function(e,t,o){e?(c[e]||(c[e]={}),c[e][t]=n(o),RttBubbleControl.updateMessage(e,t)):dump("RTT cache setMessage: callId is null")},clearCache:function(e){if(e)delete c[e];else for(const t in c)Object.prototype.hasOwnProperty.call(c,t)&&delete c[t]},getLastMessage:function(e,t){const o={};if(!e||!c[e])return o;var{length:n}=Object.keys(c[e]);let s=n-1;for(s;0<=s;s--){var l=c[e][s];if(l&&l.direction===t&&l.body&&"<br>"!==l.body){o.body=l.body;break}}return o.body&&(o.id=s),o}}}(window);