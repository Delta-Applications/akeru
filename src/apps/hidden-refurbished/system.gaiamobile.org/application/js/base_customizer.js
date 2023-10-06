'use strict';var BaseCustomizer=function(element){this.element=element;this.appDataset=null;this.dataToCustomize={classes:[]};this.dataCustomized={classes:[]};};BaseCustomizer.prototype.constructor=BaseCustomizer;BaseCustomizer.prototype.init=function(element){this.element=element;};BaseCustomizer.prototype.parseAppData=function(dataset){this.appDataset=dataset;this.dataToCustomize.classes=(dataset&&dataset.classes?dataset.classes.split(' '):[]);};BaseCustomizer.prototype.customize=function(){this.decustomize();if(this.appDataset){this.dataToCustomize.classes.forEach(function(className){if(!this.element.classList.contains(className)){this.element.classList.add(className);this.dataCustomized.classes.push(className);}},this);}};BaseCustomizer.prototype.decustomize=function(){var customizedClasses=this.dataCustomized.classes;for(var index=0,count=customizedClasses.length;count>0;count--){var className=customizedClasses[index];if(this.dataToCustomize.classes.indexOf(className)==-1){this.element.classList.remove(className);customizedClasses.splice(index,1);}else{index++;}}};BaseCustomizer.prototype.isSettingApplied=function(settingName){return(this.dataToCustomize.classes.indexOf(settingName)>-1);};