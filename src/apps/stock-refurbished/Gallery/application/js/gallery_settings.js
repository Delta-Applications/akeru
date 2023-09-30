'use strict';(function(exports){let Settings={isInitSettingsdb:false,settingsDialog:null,db:null,SORTTYPE:0,GROUPBYDATEANDLOCATION:false,sortbySelect:null,groupSelect:null,sortbyValue:null,groupValue:null,loadSettingDB:function(){let self=this;if(!this.isInitSettingsdb){this.isInitSettingsdb=true;if(!this.settingsDialog){enable(this.settingsDialog=$('settings-dialog'));}
this.sortbySelect=this.settingsDialog.querySelector('select[name="sortby"]');this.groupSelect=this.settingsDialog.querySelector('select[name="groupby"]');this.sortbyValue=this.settingsDialog.querySelector('#sortbyLabel');this.groupValue=this.settingsDialog.querySelector('#groupLabel');this.initConfigDB(()=>{self.loadSettings();});}},initConfigDB:function(callback){let self=this;let request=window.indexedDB.open('galleryconfig',1.0);request.onerror=(e)=>{console.error('error in Settings.initConfigDB()');};request.onupgradeneeded=(e)=>{self.db=e.target.result;self.db.createObjectStore('settings',{keyPath:'id'});};request.onsuccess=(e)=>{self.db=e.target.result;callback&&callback();};},read:function(id){let self=this;let settingStore=this.db.transaction('settings','readwrite').objectStore('settings');let req=settingStore.get(id);req.onsuccess=()　=>{let result=req.result;if(result==undefined){self.save();}else{self.SORTTYPE=result.SORTTYPE;self.GROUPBYDATEANDLOCATION=result.GROUPBYDATEANDLOCATION;ViewHelper.resetGroupNavigator();}}},save:function(){let settingStore=this.db.transaction('settings','readwrite').objectStore('settings');let saveReq=settingStore.put({'id':1,'SORTTYPE':this.SORTTYPE,'GROUPBYDATEANDLOCATION':this.GROUPBYDATEANDLOCATION});saveReq.onerror=()=>{console.error('error in Settings.save()');}},loadSettings:function(){this.read(1);},settingsChangeHandler:function(){this.SORTTYPE=parseInt(this.sortbySelect.value);this.GROUPBYDATEANDLOCATION=this.groupSelect.value==='on';this.setSettingsItemsValue();let listView=[LAYOUT_MODE.list,LAYOUT_MODE.favorite];if(!listView.contains(currentView)){let view=Favorite.isFavoriteList?LAYOUT_MODE.favorite:LAYOUT_MODE.list;setView(view);NavigationMap.lastView=view;}else{ViewHelper.resetGroupNavigator();}
thumbnailList.resetThumbnail();Gallery.currentFocusIndex=0;FilesStore.currentFileKey=-1;let elements=null;if(Favorite.isFavoriteList){elements=Favorite.getALLFavorites();Favorite.refreshFavoriteThumbnails();}else{elements=NavigationMap.listControls();}
if(elements.length>0){FilesStore.currentFileKey=FilesStore.getFilesKeyCounterByName(elements[0].firstElementChild.dataset.filename);}
Favorite.refreshBackground(Gallery.currentFocusIndex);NavigationHelper.setFocus(NavigationMap.focusedDialogElement);this.save();Message.show('kai-changes-saved');},initSettings:function(callback){this.sortbySelect.value=this.SORTTYPE;this.groupSelect.value=this.GROUPBYDATEANDLOCATION?'on':'off';this.sortbySelect.onchange=this.settingsChangeHandler.bind(this);this.groupSelect.onchange=this.settingsChangeHandler.bind(this);this.setSettingsItemsValue();callback&&callback();},setSettingsItemsValue:function(){this.sortbyValue.textContent=this.sortbySelect.options[this.sortbySelect.selectedIndex].text;this.groupValue.textContent=this.groupSelect.options[this.groupSelect.selectedIndex].text;},gallerySettings:function(){let self=this;this.initSettings(()=>{self.settingsDialog.classList.remove('hidden');});}}
exports.Settings=Settings;})(window);