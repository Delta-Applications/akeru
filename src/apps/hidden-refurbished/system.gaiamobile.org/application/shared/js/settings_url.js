'use strict';function SettingsURL(){this._url=null;this._isBlob=false;}
SettingsURL.prototype={set:function(value){if(this._isBlob){window.URL.revokeObjectURL(this._url);}
if(value instanceof Blob){this._isBlob=true;this._url=window.URL.createObjectURL(value);}else{this._isBlob=false;this._url=value;}
return this._url;},get:function(){return this._url;}};