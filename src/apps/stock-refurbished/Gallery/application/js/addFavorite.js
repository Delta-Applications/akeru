'use strict';(function(exports){let Favorite={refreshFavoriteThumbnailsCount:0,navPrefix:null,favoriteCount:0,isFavoriteList:false,createFavoriteDiv:function(imgNode,favorite,favoriteDivClass){let favoriteDiv=document.createElement('div');favoriteDiv.setAttribute('data-icon','like-on');favoriteDiv.setAttribute('aria-hidden','true');favoriteDiv.classList.add(favoriteDivClass);imgNode.favoriteNode=favoriteDiv;imgNode.appendChild(favoriteDiv);this.resetFavoriteDiv(imgNode,favorite);},createPreviewFavoriteDiv:function(){let isFavorite=this.checkIsFavorite();if(currentFrame.container.favoriteNode){this.resetFavoriteDiv(currentFrame.container,isFavorite);return;}
this.createFavoriteDiv(currentFrame.container,isFavorite,'fullscreen-favorite-status');},checkIsFavorite:function(){let fileinfo=FilesStore.getFileInfo(FilesStore.currentFileKey);if(fileinfo&&fileinfo.metadata){return fileinfo.metadata.favorite==='undefined'?false:fileinfo.metadata.favorite;}
return false;},resetFavoriteDiv:function(imgNode,isFavorite){if(isFavorite){imgNode.parentNode.classList.add('favorite');}else{imgNode.parentNode.classList.remove('favorite');}},updateStatus:function(){let fileInfo=FilesStore.getFileInfo(FilesStore.currentFileKey);let fileName=fileInfo.name;let thumbnailContainer=fileInfo.thumbnailContainer;let isFavorite=!this.checkIsFavorite();photodb.updateMetadata(fileName,{favorite:isFavorite},()=>{if(currentView===LAYOUT_MODE.fullscreen){this.resetFavoriteDiv(currentFrame.container,isFavorite);if(Gallery.lastView===LAYOUT_MODE.favorite&&!isFavorite){this.fullViewRemoveFavorite(thumbnailContainer.parentNode);}}
this.resetFavoriteDiv(thumbnailContainer,isFavorite);fileInfo.metadata.favorite=isFavorite;this.updateOptionsMenu(isFavorite);if(currentView===LAYOUT_MODE.favorite&&!isFavorite){this.favoriteViewRemoveFavorite(thumbnailContainer.parentNode);}});},updateOptionsMenu:function(isFavorite){if(!ViewHelper.options){return;}
let menu=SoftkeyManager.menuItems;let options=ViewHelper.options.call(menu);for(let option of options){if(menu.addfavorite===option&&menu.removefavorite===option){if(isFavorite&&menu.addfavorite===option){option=menu.removefavorite;}else if(!isFavorite&&menu.removefavorite===option){option=menu.addfavorite;}
break;}}
SoftkeyManager.setSkMenu();},getALLFavorites:function(){return thumbnails.querySelectorAll('.favorite');},showThumbnailListView:function(){this.isFavoriteList=false;document.body.classList.remove('enterFavorite');if(this.isShowOverlay()){this.hideEmptyLayer();}
Gallery.currentFocusIndex=0;setView(LAYOUT_MODE.list);SoftkeyManager.setSkMenu();let thumbnailsCount=thumbnails.querySelectorAll('.thumbnail').length;if(thumbnailsCount){this.refreshFavoriteThumbnails(false);this.refreshBackground(Gallery.currentFocusIndex);}else{Overlay.show('emptygallery');}},showFavoriteScreen:function(){this.isFavoriteList=true;document.body.classList.add('enterFavorite');this.refreshFavoriteThumbnailsCount=0;Gallery.currentFocusIndex=0;setView(LAYOUT_MODE.favorite);SoftkeyManager.setSkMenu();let favoritesCount=this.getALLFavorites().length;if(favoritesCount){this.refreshFavoriteThumbnails(true);this.refreshBackground(Gallery.currentFocusIndex);}else{this.showEmptyLayer();}},refreshFavoriteThumbnails:function(isFavorite){this.favoriteCount=0;isFavorite=isFavorite!==undefined?isFavorite:true;this.refreshFavoriteThumbnailsCount++;let lis=thumbnails.querySelectorAll('li');for(let i=0;i<lis.length;i++){let allThumbnails=lis[i].querySelectorAll('.favorite');if(allThumbnails.length){this.updateThumbnailsClass(allThumbnails,isFavorite);}
if(Settings.GROUPBYDATEANDLOCATION){this.updateGroupTitle(lis[i]);}
this.updateLiClass(lis[i]);};if(isFavorite){this.refreshFavoriteFocusElement();}},updateGroupTitle:function(li){let lists=[];if(this.isFavoriteList){lists=li.querySelectorAll('.favorite');}else{lists=li.querySelectorAll('.thumbnail');}
if(lists.length){li.firstElementChild.classList.remove('hidden');}else{li.firstElementChild.classList.add('hidden');}},updateLiClass:function(li){const lists=li.querySelectorAll('.favorite');if(lists.length){li.classList.add('hasFavorite');}else{li.classList.remove('hasFavorite');}},updateThumbnailsClass:function(thumbnails,isFavorite){for(let i=0;i<thumbnails.length;i++){let favorite=thumbnails[i];favorite.classList.remove('favorite-margin-right');if(isFavorite){this.favoriteCount++;favorite.setAttribute('favoriteindex',this.favoriteCount-1);if((i+1)%3!==0){favorite.classList.add('favorite-margin-right');}}}},refreshFavoriteFocusElement:function(){this.navPrefix=currentView+this.refreshFavoriteThumbnailsCount+'-';NavigationMap.focusedElement=NavigationHelper.reset(ViewHelper.navigator,ViewHelper.controls,ViewHelper.focus,this.navPrefix,false);Gallery.focusChangedHandler.call(Gallery,NavigationMap.focusedElement,NavigationMap.curIndex);if(NavigationMap.isFirstOrLastGroup(NavigationMap.focusedElement,true)&&NavigationMap.isFirstOrLastRow(NavigationMap.focusedElement,true)){thumbnails.scrollTop=0;}},getFileKey:function(element){return Gallery.numberFilesKeyCounter(element.firstElementChild);},focusChange:function(element,eleIndex){Gallery.setCurrentFileKeyByElement(element);Gallery.currentFocusIndex=eleIndex;Favorite.updateOptionsMenu();},getFavoriteListFocusIndex:function(){let focusIndex=Gallery.currentFocusIndex;if(isNaN(focusIndex)){focusIndex=0;}
let allFavorite=Favorite.getALLFavorites();if(focusIndex===allFavorite.length){focusIndex--;}else{focusIndex=focusIndex<allFavorite.length?focusIndex:0;}
return focusIndex;},favoriteViewRemoveFavorite:function(element){element.classList.remove('favorite-margin-right');if(this.getALLFavorites().length===0){this.showEmptyLayer();}else{this.refreshFavoriteThumbnails();}},fullViewRemoveFavorite:function(thumbnailContainer){let oldFocus=Gallery.currentFocusIndex;thumbnailContainer.classList.remove('favorite-margin-right');let fileKey=Gallery.getFileKey(true,true);if(fileKey===-1){fileKey=Gallery.getFileKey(false,true);}
if(fileKey===-1){setView(Gallery.lastView);}else{FilesStore.currentFileKey=fileKey;updateFrames(FilesStore.currentFileKey);}
if(oldFocus<Gallery.currentFocusIndex){Gallery.currentFocusIndex--;}},favoriteViewCreateImg:function(thumbnailItem){ProgressBar.hideGaiaProgress();let imgNode=thumbnailItem.htmlNode;if(!imgNode.classList.contains('favorite')){if(!this.getALLFavorites().length&&!this.isShowOverlay()){this.showEmptyLayer();}}else{if(this.isShowOverlay()){this.hideEmptyLayer();}
this.refreshFavoriteThumbnails();}},favoriteViewDeleteImg:function(){this.refreshFavoriteThumbnails();},showEmptyLayer:function(){Overlay.show('emptyfavorite');},hideEmptyLayer:function(){Overlay.hide();},isShowOverlay:function(){if(document.body.classList.contains('overlay-dialog')){return true;}else{return false;}},backFavoriteView:function(){this.refreshFavoriteThumbnails();SoftkeyManager.setSkMenu();},refreshBackground:function(refreshIndex){let thumbnailImageDiv=null;if(this.isFavoriteList){thumbnailImageDiv=Favorite.getALLFavorites();}else{thumbnailImageDiv=NavigationMap.listControls();}
NavigationMap.calculateTopLeftIndex(refreshIndex);NavigationMap.refreshBgImage(Gallery.thumbnailRefreshIndex,thumbnailImageDiv);},favoriteBack:function(evt){SoftkeyManager.dialogBack(()=>{Favorite.showThumbnailListView();});evt.preventDefault();}};exports.Favorite=Favorite;})(window);