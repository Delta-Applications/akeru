
(function(exports){'use strict';function ManifestHelper_get(prop){var manifest=this;var value=manifest[prop];var lang=navigator.mozL10n.language.code||'';if(lang in navigator.mozL10n.qps&&(prop==='name'||prop==='description'||prop=='short_name')){value=navigator.mozL10n.qps[navigator.language].translate(value);}else if(manifest.locales){[lang,lang.substr(0,lang.indexOf('-'))].some(function tryLanguage(lang){if(this[lang]&&this[lang][prop]){value=this[lang][prop];return true;}},manifest.locales);}
if(typeof value==='object'&&!(value instanceof Array)){value=new ManifestHelper(value);}
return value;}
function ManifestHelper(manifest){for(var prop in manifest){Object.defineProperty(this,prop,{get:ManifestHelper_get.bind(manifest,prop),enumerable:true});}}
Object.defineProperty(ManifestHelper.prototype,'displayName',{get:function displayName(){return this.short_name||this.name;}});exports.ManifestHelper=ManifestHelper;}(window));