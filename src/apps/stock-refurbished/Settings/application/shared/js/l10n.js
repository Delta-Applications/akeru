!function(t,e){function n(t,e,n){this.name="L10nError",this.message=t,this.id=e,this.loc=n}function r(){}function i(t){function e(t,e){return-1!==e.indexOf(t)}function n(t,e,n){return typeof t==typeof e&&t>=e&&n>=t}var r={af:3,ak:4,am:4,ar:1,asa:3,az:0,be:11,bem:3,bez:3,bg:3,bh:4,bm:0,bn:3,bo:0,br:20,brx:3,bs:11,ca:3,cgg:3,chr:3,cs:12,cy:17,da:3,de:3,dv:3,dz:0,ee:3,el:3,en:3,eo:3,es:3,et:3,eu:3,fa:0,ff:5,fi:3,fil:4,fo:3,fr:5,fur:3,fy:3,ga:8,gd:24,gl:3,gsw:3,gu:3,guw:4,gv:23,ha:3,haw:3,he:2,hi:4,hr:11,hu:0,id:0,ig:0,ii:0,is:3,it:3,iu:7,ja:0,jmc:3,jv:0,ka:0,kab:5,kaj:3,kcg:3,kde:0,kea:0,kk:3,kl:3,km:0,kn:0,ko:0,ksb:3,ksh:21,ku:3,kw:7,lag:18,lb:3,lg:3,ln:4,lo:0,lt:10,lv:6,mas:3,mg:4,mk:16,ml:3,mn:3,mo:9,mr:3,ms:0,mt:15,my:0,nah:3,naq:7,nb:3,nd:3,ne:3,nl:3,nn:3,no:3,nr:3,nso:4,ny:3,nyn:3,om:3,or:3,pa:3,pap:3,pl:13,ps:3,pt:3,rm:3,ro:9,rof:3,ru:11,rwk:3,sah:0,saq:3,se:7,seh:3,ses:0,sg:0,sh:11,shi:19,sk:12,sl:14,sma:7,smi:7,smj:7,smn:7,sms:7,sn:3,so:3,sq:3,sr:11,ss:3,ssy:3,st:3,sv:3,sw:3,syr:3,ta:3,te:3,teo:3,th:0,ti:4,tig:3,tk:3,tl:4,tn:3,to:0,tr:0,ts:3,tzm:22,uk:11,ur:3,ve:3,vi:0,vun:3,wa:4,wae:3,wo:0,xh:3,xog:3,yo:0,zh:0,zu:3},i={0:function(){return"other"},1:function(t){return n(t%100,3,10)?"few":0===t?"zero":n(t%100,11,99)?"many":2===t?"two":1===t?"one":"other"},2:function(t){return 0!==t&&0===t%10?"many":2===t?"two":1===t?"one":"other"},3:function(t){return 1===t?"one":"other"},4:function(t){return n(t,0,1)?"one":"other"},5:function(t){return n(t,0,2)&&2!==t?"one":"other"},6:function(t){return 0===t?"zero":1===t%10&&11!==t%100?"one":"other"},7:function(t){return 2===t?"two":1===t?"one":"other"},8:function(t){return n(t,3,6)?"few":n(t,7,10)?"many":2===t?"two":1===t?"one":"other"},9:function(t){return 0===t||1!==t&&n(t%100,1,19)?"few":1===t?"one":"other"},10:function(t){return n(t%10,2,9)&&!n(t%100,11,19)?"few":1!==t%10||n(t%100,11,19)?"other":"one"},11:function(t){return n(t%10,2,4)&&!n(t%100,12,14)?"few":0===t%10||n(t%10,5,9)||n(t%100,11,14)?"many":1===t%10&&11!==t%100?"one":"other"},12:function(t){return n(t,2,4)?"few":1===t?"one":"other"},13:function(t){return n(t%10,2,4)&&!n(t%100,12,14)?"few":1!==t&&n(t%10,0,1)||n(t%10,5,9)||n(t%100,12,14)?"many":1===t?"one":"other"},14:function(t){return n(t%100,3,4)?"few":2===t%100?"two":1===t%100?"one":"other"},15:function(t){return 0===t||n(t%100,2,10)?"few":n(t%100,11,19)?"many":1===t?"one":"other"},16:function(t){return 1===t%10&&11!==t?"one":"other"},17:function(t){return 3===t?"few":0===t?"zero":6===t?"many":2===t?"two":1===t?"one":"other"},18:function(t){return 0===t?"zero":n(t,0,2)&&0!==t&&2!==t?"one":"other"},19:function(t){return n(t,2,10)?"few":n(t,0,1)?"one":"other"},20:function(t){return!n(t%10,3,4)&&9!==t%10||n(t%100,10,19)||n(t%100,70,79)||n(t%100,90,99)?0===t%1e6&&0!==t?"many":2!==t%10||e(t%100,[12,72,92])?1!==t%10||e(t%100,[11,71,91])?"other":"one":"two":"few"},21:function(t){return 0===t?"zero":1===t?"one":"other"},22:function(t){return n(t,0,1)||n(t,11,99)?"one":"other"},23:function(t){return n(t%10,1,2)||0===t%20?"one":"other"},24:function(t){return n(t,3,10)||n(t,13,19)?"few":e(t,[2,12])?"two":e(t,[1,11])?"one":"other"}},o=r[t.replace(/-.*$/,"")];return o in i?i[o]:function(){return"other"}}function o(t,n){var r=Object.keys(t);if("string"==typeof t.$v&&2===r.length)return t.$v;for(var i,o,s=0;o=r[s];s++)"$"!==o[0]&&(i||(i=Object.create(null)),i[o]=a(t[o],n,t.$i+"."+o));return{id:t.$i,value:t.$v!==e?t.$v:null,index:t.$x||null,attrs:i||null,env:n,dirty:!1}}function a(t,n,r){return"string"==typeof t?t:{id:r,value:t.$v||(t!==e?t:null),index:t.$x||null,env:n,dirty:!1}}function s(t,e){var r={overlay:!1};if("string"==typeof e)return[r,e];if(e.dirty)throw new n("Cyclic reference detected: "+e.id);e.dirty=!0;var i;try{i=f(r,t,e.env,e.value,e.index)}finally{e.dirty=!1}return i}function c(t,e,r){if(ue.indexOf(r)>-1)return[{},e["__"+r]];if(t&&t.hasOwnProperty(r)){if("string"==typeof t[r]||"number"==typeof t[r]&&!isNaN(t[r]))return[{},t[r]];throw new n("Arg must be a string or a number: "+r)}if(r in e&&"__proto__"!==r)return s(t,e[r]);throw new n("Unknown reference: "+r)}function u(t,e,r,i){var o;try{o=c(e,r,i)}catch(a){return[{error:a},"{{ "+i+" }}"]}var s=o[1];if("number"==typeof s)return o;if("string"==typeof s){if(s.length>=le)throw new n("Too many characters in placeable ("+s.length+", max allowed is "+le+")");return(t.contextIsNonLatin1||s.match(fe))&&(o[1]=pe+s+he),o}return[{},"{{ "+i+" }}"]}function l(t,e,n,r){return r.reduce(function(r,i){if("string"==typeof i)return[r[0],r[1]+i];if("idOrVar"===i.t){var o=u(t,e,n,i.v);return o[0].overlay&&(r[0].overlay=!0),[r[0],r[1]+o[1]]}},[t,""])}function d(t,n,r,i){var o=i[0].v,a=c(t,n,o)[1];if("function"!=typeof a)return a;var s=i[1]?c(t,n,i[1])[1]:e;if(a===n.__plural){if(0===s&&"zero"in r)return"zero";if(1===s&&"one"in r)return"one";if(2===s&&"two"in r)return"two"}return a(s)}function f(t,e,r,i,o){if(!i)return[t,i];if(i.$o&&(i=i.$o,t.overlay=!0),"string"==typeof i||"boolean"==typeof i||"number"==typeof i)return[t,i];if(Array.isArray(i))return t.contextIsNonLatin1=i.some(function(t){return"string"==typeof t&&t.match(fe)}),l(t,e,r,i);if(o){var a=d(e,r,i,o);if(i.hasOwnProperty(a))return f(t,e,r,i[a])}if("other"in i)return f(t,e,r,i.other);throw new n("Unresolvable value")}function p(t,e){if("string"==typeof t)return e(t);if("idOrVar"===t.t)return t;for(var n,r=Array.isArray(t)?[]:{},i=Object.keys(t),o=0;n=i[o];o++)r[n]="$i"===n||"$x"===n?t[n]:p(t[n],e);return r}function h(t){return t.replace(ve,function(t){return t+t.toLowerCase()})}function g(t,e){return e.replace(me,function(e){return t.charAt(e.charCodeAt(0)-65)})}function m(t){return t.replace(Se,function(t){return"‮"+t+"‬"})}function v(t,e){if(!e)return e;var n=e.split(Ee),r=n.map(function(e){return Ee.test(e)?e:t(e)});return r.join("")}function y(t,e,n,r){this.id=t,this.translate=v.bind(null,function(t){return g(n,r(t))}),this.name=this.translate(e)}function _(t,e){this.id=t,this.ctx=e,this.isReady=!1,this.isPseudo=be.hasOwnProperty(t),this.entries=Object.create(null),this.entries.__plural=i(this.isPseudo?this.ctx.defaultLocale:t)}function S(t,e){return ge.createEntry(p(t,be[this.id].translate),e)}function E(t){this.id=t,this.isReady=!1,this.isLoading=!1,this.defaultLocale="en-US",this.availableLocales=[],this.supportedLocales=[],this.resLinks=[],this.locales={},this._emitter=new r,this._ready=new Promise(this.once.bind(this))}function b(t,e){return this._emitter.emit("notfounderror",e),t}function w(t){for(var r,i,o=0;r=this.supportedLocales[o];){i=this.getLocale(r),i.isReady||i.build(null);var a=i.entries[t];if(a!==e)return a;o++,b.call(this,t,new n('"'+t+'"'+" not found in "+r+" in "+this.id,t,r))}throw new n('"'+t+'"'+" missing from all supported locales in "+this.id,t)}function I(t,e){try{return ge.format(t,e)}catch(n){this._emitter.emit("resolveerror",n);var r={error:n};return[r,e.id]}}function L(t,e){return"string"==typeof e?e:I.call(this,t,e)[1]}function A(t,e){var n=I.call(this,t,e),r=n[0],i=n[1],o={value:i,attrs:null,overlay:r.overlay};e.attrs&&(o.attrs=Object.create(null));for(var a in e.attrs)o.attrs[a]=L.call(this,t,e.attrs[a]);return o}function T(t,e,n){return this._ready.then(w.bind(this,e)).then(t.bind(this,n),b.bind(this,e))}function N(t,e,r){if(!this.isReady)throw new n("Context not ready");var i;try{i=w.call(this,e)}catch(o){if(o.loc)throw o;return b.call(this,e,o),""}return t.call(this,r,i)}function O(t,e,n){return-1===t.indexOf(e[0])||e[0]===n?[n]:[e[0],n]}function M(t){var e=this.getLocale(t[0]);e.isReady?C.call(this,t):e.build(C.bind(this,t))}function C(t){this.supportedLocales=t,this.isReady=!0,this._emitter.emit("ready")}function k(t){return Te.indexOf(t)>=0?"rtl":"ltr"}function z(t,e){return t=Ce[t],Ce[document.readyState]>=t?(e(),void 0):(document.addEventListener("readystatechange",function n(){Ce[document.readyState]>=t&&(document.removeEventListener("readystatechange",n),e())}),void 0)}function x(){Ne=new MutationObserver(K.bind(navigator.mozL10n)),Ne.observe(document,Me)}function D(e){e?P.call(navigator.mozL10n):(x(),t.setTimeout(P.bind(navigator.mozL10n)))}function P(){for(var t,e={},n=document.head.querySelectorAll('link[rel="localization"],meta[name="availableLanguages"],meta[name="defaultLanguage"],meta[name="appVersion"],script[type="application/l10n"]'),r=0;t=n[r];r++){var i=t.getAttribute("rel")||t.nodeName.toLowerCase();switch(i){case"localization":this.ctx.resLinks.push(t.getAttribute("href"));break;case"meta":H.call(this,t,e);break;case"script":V.call(this,t)}}var o;navigator.mozApps&&navigator.mozApps.getAdditionalLanguages?(o=navigator.mozApps.getAdditionalLanguages().catch(function(t){console.error("Error while loading getAdditionalLanguages",t)}),document.addEventListener("additionallanguageschange",function(t){R.call(this,e,t.detail)}.bind(this))):o=Promise.resolve(),o.then(function(t){R.call(this,e,t),Y.call(this)}.bind(this))}function R(t,e){var n=F.call(this,t,e);navigator.mozL10n._config.localeSources=n[1],this.ctx.registerLocales(n[0],Object.keys(n[1]))}function U(t,e){for(var n,r=0;n=e[r];r++)if(n.target===t)return n;return null}function F(t,e){var n,r,i=Object.create(null),o=t.defaultLocale||this.ctx.defaultLocale;if(t.availableLanguages)for(n in t.availableLanguages)i[n]="app";if(e)for(n in e)r=U(this._config.appVersion,e[n]),r&&(n in i&&t.availableLanguages[n]&&!(parseInt(r.revision)>t.availableLanguages[n])||(i[n]="extra"));return o in i||(i[o]="app"),[o,i]}function j(t){var e={};return t.split(",").forEach(function(t){t=t.trim().split(":"),e[t[0]]=parseInt(t[1])}),e}function H(t,e){switch(t.getAttribute("name")){case"availableLanguages":e.availableLanguages=j(t.getAttribute("content"));break;case"defaultLanguage":e.defaultLanguage=t.getAttribute("content");break;case"appVersion":navigator.mozL10n._config.appVersion=t.getAttribute("content")}}function V(t){var e=t.getAttribute("lang"),n=this.ctx.getLocale(e);n.addAST(JSON.parse(t.textContent))}function Y(){this.ctx.requestLocales.apply(this.ctx,navigator.languages||[navigator.language]),t.addEventListener("languagechange",function(){this.ctx.requestLocales.apply(this.ctx,navigator.languages||[navigator.language])}.bind(this))}function B(t){for(var e,n=new Set,r=0;r<t.length;r++){if(e=t[r],"childList"===e.type)for(var i,o=0;o<e.addedNodes.length;o++)i=e.addedNodes[o],i.nodeType===Node.ELEMENT_NODE&&n.add(i);"attributes"===e.type&&n.add(e.target)}n.forEach(function(t){t.childElementCount?W.call(this,t):t.hasAttribute("data-l10n-id")&&te.call(this,t)},this)}function K(t,e){e.disconnect(),B.call(this,t),e.observe(document,Me)}function $(){if(Ae||q.call(this),Ae=!1,Oe){for(var t,e=0;t=Oe[e];e++)te.call(this,t);Oe=null}Ne||x(),G.call(this)}function G(){var e=new CustomEvent("localized",{bubbles:!1,cancelable:!1,detail:{language:this.ctx.supportedLocales[0]}});t.dispatchEvent(e)}function q(){document.documentElement.lang=this.language.code,document.documentElement.dir=this.language.direction,W.call(this,document.documentElement)}function W(t){t.hasAttribute("data-l10n-id")&&te.call(this,t);for(var e=Z(t),n=0;n<e.length;n++)te.call(this,e[n])}function X(t,e,n){t.setAttribute("data-l10n-id",e),n&&t.setAttribute("data-l10n-args",JSON.stringify(n))}function J(t){return{id:t.getAttribute("data-l10n-id"),args:JSON.parse(t.getAttribute("data-l10n-args"))}}function Z(t){return t?t.querySelectorAll("*[data-l10n-id]"):[]}function Q(t){return"ariaValueText"===t?"aria-valuetext":t.replace(/[A-Z]/g,function(t){return"-"+t.toLowerCase()}).replace(/^-/,"")}function te(t){if(!this.ctx.isReady)return Oe||(Oe=[]),Oe.push(t),void 0;var e=J(t);if(!e.id)return!1;var n=this.ctx.getEntity(e.id,e.args);if("string"==typeof n.value)if(n.overlay){var r=t.ownerDocument.createElement("template");r.innerHTML=n.value,ee(t,r.content)}else t.textContent=n.value;for(var i in n.attrs)if("innerHTML"!==i){var o=Q(i);re({name:o},t)&&t.setAttribute(o,n.attrs[i])}else t.innerHTML=n.attrs[i]}function ee(t,e){for(var n,r,i,o=e.ownerDocument.createDocumentFragment();i=e.childNodes[0];)if(e.removeChild(i),i.nodeType!==Node.TEXT_NODE){var a=oe(i),s=ie(t,i,a);if(s)ee(s,i),o.appendChild(s);else if(ne(i)){const c=i.ownerDocument.createElement(i.nodeName);ee(c,i),o.appendChild(c)}else o.appendChild(document.createTextNode(i.textContent))}else o.appendChild(i);if(t.textContent="",t.appendChild(o),e.attributes)for(n=0,r;r=e.attributes[n];n++)re(r,t)&&t.setAttribute(r.name,r.value)}function ne(t){return-1!==Ie.elements.indexOf(t.tagName.toLowerCase())}function re(t,e){var n=t.name.toLowerCase(),r=e.tagName.toLowerCase();if(-1!==Ie.attributes.global.indexOf(n))return!0;if(!Ie.attributes[r])return!1;if(-1!==Ie.attributes[r].indexOf(n))return!0;if("input"===r&&"value"===n){var i=e.type.toLowerCase();if("submit"===i||"button"===i||"reset"===i)return!0}return!1}function ie(t,e,n){for(var r,i=0,o=0;r=t.children[o];o++)if(r.nodeType===Node.ELEMENT_NODE&&r.tagName===e.tagName){if(i===n)return r;i++}return null}function oe(t){for(var e,n=0;e=t.previousElementSibling;)e.tagName===t.tagName&&n++;return n}n.prototype=Object.create(Error.prototype),n.prototype.constructor=n;var ae={_load:function(t,e,r,i){var o,a=new XMLHttpRequest;a.overrideMimeType&&a.overrideMimeType(t),a.open("GET",e,!i),"application/json"===t&&(i?o=!0:a.responseType="json"),a.addEventListener("load",function(t){if(200===t.target.status||0===t.target.status){var i=t.target.response||t.target.responseText;r(null,o?JSON.parse(i):i)}else r(new n("Not found: "+e))}),a.addEventListener("error",r),a.addEventListener("timeout",r);try{a.send(null)}catch(s){r(new n("Not found: "+e))}},load:function(t,e,n){return ae._load("text/plain",t,e,n)},loadJSON:function(t,e,n){return ae._load("application/json",t,e,n)}};r.prototype.emit=function(){if(this._listeners){var t=Array.prototype.slice.call(arguments),e=t.shift();if(this._listeners[e])for(var n=this._listeners[e].slice(),r=0;r<n.length;r++)n[r].apply(this,t)}},r.prototype.addEventListener=function(t,e){this._listeners||(this._listeners={}),t in this._listeners||(this._listeners[t]=[]),this._listeners[t].push(e)},r.prototype.removeEventListener=function(t,e){if(this._listeners){var n=this._listeners[t],r=n.indexOf(e);-1!==r&&n.splice(r,1)}};var se=100,ce={patterns:null,entryIds:null,init:function(){this.patterns={comment:/^\s*#|^\s*$/,entity:/^([^=\s]+)\s*=\s*(.*)$/,multiline:/[^\\]\\$/,index:/\{\[\s*(\w+)(?:\(([^\)]*)\))?\s*\]\}/i,unicode:/\\u([0-9a-fA-F]{1,4})/g,entries:/[^\r\n]+/g,controlChars:/\\([\\\n\r\t\b\f\{\}\"\'])/g,placeables:/\{\{\s*([^\s]*?)\s*\}\}/}},parse:function(t,e){this.patterns||this.init();var n=[];this.entryIds=Object.create(null);var r=e.match(this.patterns.entries);if(!r)return n;for(var i=0;i<r.length;i++){var o=r[i];if(!this.patterns.comment.test(o)){for(;this.patterns.multiline.test(o)&&i<r.length;)o=o.slice(0,-1)+r[++i].trim();var a=o.match(this.patterns.entity);if(a)try{this.parseEntity(a[1],a[2],n)}catch(s){if(!t)throw s;t._emitter.emit("parseerror",s)}}}return n},parseEntity:function(t,e,r){var i,o,a=t.indexOf("[");-1!==a?(i=t.substr(0,a),o=t.substring(a+1,t.length-1)):(i=t,o=null);var s=i.split(".");if(s.length>2)throw new n('Error in ID: "'+i+'".'+" Nested attributes are not supported.");var c;if(s.length>1){if(i=s[0],c=s[1],"$"===c[0])throw new n('Attribute can\'t start with "$"',t)}else c=null;this.setEntityValue(i,c,o,this.unescapeString(e),r)},setEntityValue:function(t,n,r,i,o){var a,s,c=i.indexOf("{{")>-1?this.parseString(i):i;return(i.indexOf("<")>-1||i.indexOf("&")>-1)&&(c={$o:c}),n?(a=this.entryIds[t],a===e?(s={$i:t},r?(s[n]={},s[n][r]=c):s[n]=c,o.push(s),this.entryIds[t]=o.length-1,void 0):r?("string"==typeof o[a][n]&&(o[a][n]={$x:this.parseIndex(o[a][n]),$v:{}}),o[a][n].$v[r]=c,void 0):(o[a][n]=c,void 0)):r?(a=this.entryIds[t],a===e?(s={},s[r]=c,o.push({$i:t,$v:s}),this.entryIds[t]=o.length-1,void 0):("string"==typeof o[a].$v&&(o[a].$x=this.parseIndex(o[a].$v),o[a].$v={}),o[a].$v[r]=c,void 0)):(o.push({$i:t,$v:c}),this.entryIds[t]=o.length-1,void 0)},parseString:function(t){var e=t.split(this.patterns.placeables),r=[],i=e.length,o=(i-1)/2;if(o>=se)throw new n("Too many placeables ("+o+", max allowed is "+se+")");for(var a=0;a<e.length;a++)0!==e[a].length&&(1===a%2?r.push({t:"idOrVar",v:e[a]}):r.push(e[a]));return r},unescapeString:function(t){return-1!==t.lastIndexOf("\\")&&(t=t.replace(this.patterns.controlChars,"$1")),t.replace(this.patterns.unicode,function(t,e){return unescape("%u"+"0000".slice(e.length)+e)})},parseIndex:function(t){var e=t.match(this.patterns.index);if(!e)throw new n("Malformed index");return e[2]?[{t:"idOrVar",v:e[1]},e[2]]:[{t:"idOrVar",v:e[1]}]}},ue=["plural"],le=2500,de=/\{\{\s*(.+?)\s*\}\}/g,fe=/[^\x01-\xFF]/,pe="⁨",he="⁩",ge={createEntry:o,format:s,rePlaceables:de},me=/[a-zA-Z]/g,ve=/[aeiouAEIOU]/g,ye="ȦƁƇḒḖƑƓĦĪĴĶĿḾȠǾƤɊŘŞŦŬṼẆẊẎẐ[\\]^_`ȧƀƈḓḗƒɠħīĵķŀḿƞǿƥɋřşŧŭṽẇẋẏẑ",_e="∀ԐↃpƎɟפHIſӼ˥WNOԀÒᴚS⊥∩ɅＭXʎZ[\\]ᵥ_,ɐqɔpǝɟƃɥıɾʞʅɯuodbɹsʇnʌʍxʎz",Se=/[^\W0-9_]+/g,Ee=/(%[EO]?\w|\{\s*.+?\s*\})/,be={"qps-ploc":new y("qps-ploc","Accented English",ye,h),"qps-plocm":new y("qps-plocm","Mirrored English",_e,m)},we={extra:function(t,e,n,r,i,o){"properties"===r&&(r="text"),navigator.mozApps.getLocalizationResource(t,e,n,r).then(i.bind(null,null),o)},app:function(t,e,n,r,i,o,a){switch(r){case"properties":ae.load(n,i,a);break;case"json":ae.loadJSON(n,i,a)}}};_.prototype.build=function(t){function e(e){e&&o._emitter.emit("fetcherror",e),--s<=0&&(a.isReady=!0,t&&t())}function n(t,n){!t&&n&&a.addAST(n),e(t)}function r(t,n){if(!t&&n){var r=ce.parse(o,n);a.addAST(r)}e(t)}var i=!t,o=this.ctx,a=this,s=o.resLinks.length;if(0===s)return e(),void 0;for(var c=this.isPseudo?o.defaultLocale:this.id,u=navigator.mozL10n._config.localeSources[this.id]||"app",l=navigator.mozL10n._config.appVersion,d=0;d<o.resLinks.length;d++){var f,p=decodeURI(o.resLinks[d]),h=p.replace("{locale}",c),g=h.substr(h.lastIndexOf(".")+1);switch(g){case"json":f=n;break;case"properties":f=r}we[u](this.id,l,h,g,f,e,i)}},_.prototype.addAST=function(t){for(var e=this.isPseudo?S.bind(this):ge.createEntry,n=0;n<t.length;n++)this.entries[t[n].$i]=e(t[n],this.entries)},E.prototype.formatValue=function(t,e){return T.call(this,L,t,e)},E.prototype.formatEntity=function(t,e){return T.call(this,A,t,e)},E.prototype.get=function(t,e){return N.call(this,L,t,e)},E.prototype.getEntity=function(t,e){return N.call(this,A,t,e)},E.prototype.getLocale=function(t){var e=this.locales;return e[t]?e[t]:e[t]=new _(t,this)},E.prototype.registerLocales=function(t,e){if(t&&(this.defaultLocale=t),this.availableLocales=[this.defaultLocale],e)for(var n,r=0;n=e[r];r++)-1===this.availableLocales.indexOf(n)&&this.availableLocales.push(n)},E.prototype.requestLocales=function(){if(this.isLoading&&!this.isReady)throw new n("Context not ready");this.isLoading=!0;var t=Array.prototype.slice.call(arguments);if(0===t.length)throw new n("No locales requested");var e=t.filter(function(t){return t in be}),r=O(this.availableLocales.concat(e),t,this.defaultLocale);M.call(this,r)},E.prototype.addEventListener=function(t,e){this._emitter.addEventListener(t,e)},E.prototype.removeEventListener=function(t,e){this._emitter.removeEventListener(t,e)},E.prototype.ready=function(t){return this.isReady?(setTimeout(t),void 0):(this.addEventListener("ready",t),void 0)},E.prototype.once=function(t){if(this.isReady)return setTimeout(t),void 0;var e=function(){this.removeEventListener("ready",e),t()}.bind(this);this.addEventListener("ready",e)};var Ie={elements:["a","em","strong","small","s","cite","q","dfn","abbr","data","time","code","var","samp","kbd","sub","sup","i","b","u","mark","ruby","rt","rp","bdi","bdo","span","br","wbr"],attributes:{global:["title","aria-label","aria-valuetext","aria-moz-hint"],a:["download"],area:["download","alt"],input:["alt","placeholder"],menuitem:["label"],menu:["label"],optgroup:["label"],option:["label"],track:["label"],img:["alt"],textarea:["placeholder"],th:["abbr"]}},Le=!1,Ae=!1,Te=["ar-SA","he-IL","fa-IR","ps-AF","qps-plocm","ur-PK","ks-IN","ur-IN"],Ne=null,Oe=null,Me={attributes:!0,characterData:!1,childList:!0,subtree:!0,attributeFilter:["data-l10n-id","data-l10n-args"]};navigator.mozL10n={ctx:new E(t.document?document.URL:null),get:function(t,e){return navigator.mozL10n.ctx.get(t,e)},formatValue:function(t,e){return navigator.mozL10n.ctx.formatValue(t,e)},formatEntity:function(t,e){return navigator.mozL10n.ctx.formatEntity(t,e)},translateFragment:function(t){return W.call(navigator.mozL10n,t)},setAttributes:X,getAttributes:J,ready:function(t){return navigator.mozL10n.ctx.ready(t)},once:function(t){return navigator.mozL10n.ctx.once(t)},get readyState(){return navigator.mozL10n.ctx.isReady?"complete":"loading"},language:{set code(t){navigator.mozL10n.ctx.requestLocales(t)},get code(){return navigator.mozL10n.ctx.supportedLocales[0]},get direction(){return k(navigator.mozL10n.ctx.supportedLocales[0])}},qps:be,_config:{appVersion:null,localeSources:Object.create(null)},_getInternalAPI:function(){return{Error:n,Context:E,Locale:_,Resolver:ge,getPluralRule:i,rePlaceables:de,translateDocument:q,onMetaInjected:H,PropertiesParser:ce,walkContent:p,buildLocaleList:F}}},navigator.mozL10n.ctx.ready($.bind(navigator.mozL10n)),navigator.mozL10n.ctx.addEventListener("notfounderror",function(t){(Le||"en-US"===t.loc)&&console.warn(t.toString())}),Le&&(navigator.mozL10n.ctx.addEventListener("fetcherror",console.error.bind(console)),navigator.mozL10n.ctx.addEventListener("parseerror",console.error.bind(console)),navigator.mozL10n.ctx.addEventListener("resolveerror",console.error.bind(console)));var Ce={loading:0,interactive:1,complete:2};if(t.document){Ae=!be.hasOwnProperty(navigator.language)&&document.documentElement.lang===navigator.language;var ke=document.documentElement.dataset.noCompleteBug?!0:!Ae;z("interactive",D.bind(navigator.mozL10n,ke))}}(this);