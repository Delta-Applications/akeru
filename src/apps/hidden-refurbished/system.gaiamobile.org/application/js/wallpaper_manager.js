'use strict';(function(exports){const WALLPAPER_KEY='wallpaper.image';const WALLPAPER_VALID_KEY='wallpaper.image.valid';function WallpaperManager(){this._started=false;this._blobURL=null;}
WallpaperManager.prototype={start:function(){if(this._started){throw'Instance should not be start()\'ed twice.';}
this._started=true;debug('started');var lock=navigator.mozSettings.createLock();var query=lock.get(WALLPAPER_KEY);query.onsuccess=function(){var wallpaper=query.result[WALLPAPER_KEY];if(!wallpaper){debug('no wallpaper found at startup');}
else if(wallpaper instanceof Blob){var query2=lock.get(WALLPAPER_VALID_KEY);query2.onsuccess=function(){var valid=query2.result[WALLPAPER_VALID_KEY];this._setWallpaper(wallpaper,valid);}.bind(this);}
else{this._setWallpaper(wallpaper);}}.bind(this);this.observer=function(e){this._setWallpaper(e.settingValue);}.bind(this);navigator.mozSettings.addObserver(WALLPAPER_KEY,this.observer);if(lock.forceClose){lock.forceClose();}},stop:function(){if(!this._started){return;}
navigator.mozSettings.removeObserver(WALLPAPER_KEY,this.observer);this._started=false;},getBlobURL:function(){if(!this._started){return;}
return this._blobURL;},_setWallpaper:function(value,valid){if(!this._started){return;}
if(value instanceof Blob&&value.size===this.savedBlobSize){this.savedBlobSize=false;return;}
debug('new wallpaper',valid?'size already validated':'');if(typeof value==='string'){this._toBlob(value);}
else if(value instanceof Blob){if(valid){this._publish(value);}
else{this._checkSize(value);}}
else{debug('Invalid wallpaper value in settings.');}},_toBlob:function(url){if(!this._started){return;}
debug('converting wallpaper url to blob');var xhr=new XMLHttpRequest();xhr.open('GET',url);xhr.responseType='blob';xhr.send();xhr.onload=function(){this._checkSize(xhr.response,true);}.bind(this);xhr.onerror=function(){console.error('Cannot load wallpaper from',url);}.bind(this);},_checkSize:function(blob,needsToBeSaved){if(!this._started){return;}
debug('resizing wallpaper if needed');var screenWidth,screenHeight;if(OrientationManager&&!OrientationManager.isDefaultPortrait()){screenWidth=Math.max(screen.width,screen.height);screenHeight=Math.min(screen.width,screen.height);}else{screenWidth=Math.min(screen.width,screen.height);screenHeight=Math.max(screen.width,screen.height);}
screenWidth=Math.ceil(screenWidth*window.devicePixelRatio);screenHeight=Math.ceil(screenHeight*window.devicePixelRatio);LazyLoader.load('shared/js/image_utils.js',function(){ImageUtils.resizeAndCropToCover(blob,screenWidth,screenHeight,ImageUtils.PNG).then(function resolve(resizedBlob){if(resizedBlob!==blob||needsToBeSaved){this._save(resizedBlob);}
else{this._validate();}
this._publish(resizedBlob);}.bind(this),function reject(){console.error('Default wallpaper image is invalid');}.bind(this));}.bind(this));},_validate:function(){if(!this._started){return;}
debug('marking wallpaper as valid');var settings={};settings[WALLPAPER_VALID_KEY]=true;navigator.mozSettings.createLock().set(settings);},_save:function(blob){if(!this._started){return;}
debug('saving converted or resized wallpaper to settings');this.savedBlobSize=blob.size;var settings={};settings[WALLPAPER_KEY]=blob;settings[WALLPAPER_VALID_KEY]=true;navigator.mozSettings.createLock().set(settings);},_publish:function(blob){if(!this._started){return;}
debug('publishing wallpaperchange event');if(this._blobURL){URL.revokeObjectURL(this._blobURL);}
this._blobURL=URL.createObjectURL(blob);var evt=new CustomEvent('wallpaperchange',{bubbles:true,cancelable:false,detail:{url:this._blobURL}});window.dispatchEvent(evt);window.ExternalScreenManager.send(evt);}};function debug(...args){if(WallpaperManager.DEBUG){args.unshift('[WallpaperManager]');console.log.apply(console,args);}}
WallpaperManager.DEBUG=false;exports.WallpaperManager=WallpaperManager;}(window));