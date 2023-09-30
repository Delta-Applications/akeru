'use strict';var ToneList=(function(){var listTemplate=new Template('sound-list-template');var itemTemplate=new Template('sound-item-template');var NONE_ID='none:none';function toneCompare(a,b){if(a.id===NONE_ID&&b.id===NONE_ID){return 0;}else if(a.id===NONE_ID){return-1;}else if(b.id===NONE_ID){return 1;}
var aName=a.name.toLocaleLowerCase();var bName=b.name.toLocaleLowerCase();var cmp=aName.localeCompare(bName);if(cmp){return cmp;}
var aSubtitle=(a.subtitle||'').toLocaleLowerCase();var bSubtitle=(b.subtitle||'').toLocaleLowerCase();return aSubtitle.localeCompare(bSubtitle);}
function domify(htmlText){var dummyDiv=document.createElement('div');dummyDiv.innerHTML=htmlText;var element=dummyDiv.firstElementChild;return element;}
function ToneList(titleID,parent){this.element=domify(listTemplate.interpolate({l10nID:titleID}));if(parent){parent.appendChild(this.element);}
this._ul=this.element.querySelector('ul');this._toneMap={};}
ToneList.prototype={makeItem:function(tone){var templateArgs={};if(tone.l10nID){templateArgs.l10nID=tone.l10nID;}else{templateArgs.name=tone.name;}
var item=domify(itemTemplate.interpolate(templateArgs));item.dataset.id=tone.id;if(tone.subtitle){var subtitle=document.createElement('p');subtitle.classList.add('subtitle');subtitle.textContent=tone.subtitle;item.querySelector('.name').parentNode.appendChild(subtitle);}
return item;},add:function(tones){if(this._ul.children.length===0){if(Array.isArray(tones)){tones.sort(toneCompare);tones.forEach(this._append.bind(this));}else{this._append(tones);}}else{if(Array.isArray(tones)){tones.forEach(this._insertSorted.bind(this));}else{this._insertSorted(tones);}}},remove:function(tone){this._ul.removeChild(this._toneMap[tone.id].element);if(!this._ul.firstChild){this.element.hidden=true;}},_append:function(tone){if(tone.id in this._toneMap){throw new Error('A tone with this ID is already in the list: '+
tone.id);}
var newItem=this.makeItem(tone);this._toneMap[tone.id]={tone:tone,element:newItem};this.element.hidden=false;this._ul.appendChild(newItem);},_insertSorted:function(tone){if(tone.id in this._toneMap){throw new Error('A tone with this ID is already in the list: '+
tone.id);}
var newItem=this.makeItem(tone);this._toneMap[tone.id]={tone:tone,element:newItem};this.element.hidden=false;var items=this._ul.querySelectorAll('li');for(var i=0;i<items.length;i++){var currTone=this._toneMap[items[i].dataset.id].tone;if(toneCompare(tone,currTone)<0){this._ul.insertBefore(newItem,items[i]);return;}}
this._ul.appendChild(newItem);}};return ToneList;})();