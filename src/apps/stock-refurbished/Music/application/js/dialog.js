
function _dialog(){this.element=document.querySelector('.dialog-container');this.content=document.querySelector('.dialog-container .content');this.header=document.querySelector('#dialog-header');this.inputHtml='<input id="dialog-content-input" \
                           class="focusable p-pri" \
                           x-inputmode="verbatim" \
                           maxlength="40" \
                           aria-labelledby="dialog-header"\
                           type="text">';}
_dialog.prototype={init:function(){this.onKeyDown=this.onKeyDown.bind(this);this.element.addEventListener('keydown',this.onKeyDown);this.updateSoftKeys();},updateSoftKeys:function(type){if(type==='input'){SoftKeyStore.register({left:'cancel',center:'',right:'ok'},this.element);}else if(type==='hint'){SoftKeyStore.register({left:'',center:'ok',right:''},this.element);}else if(/^goto-.*/.test(type)){SoftKeyStore.register({left:'cancel',center:'',right:type.substring(5)},this.element);}else{SoftKeyStore.register({left:'cancel',center:'',right:'delete'},this.element);}},show:function(l10nId,l10nArgs,cancel,confirm,options={}){let{headerl10nId,type,primaryValue}=options
this.cancelCallback=cancel;this.confirmCallback=confirm;this.inputBox=null;this.header.classList.remove('rename-text');this.type=type;l10nId&&(this.content.dataset.l10nId=l10nId);l10nArgs&&(this.content.dataset.l10nArgs=JSON.stringify(l10nArgs));if(headerl10nId){this.header.dataset.l10nId=headerl10nId;if(headerl10nId==='rename'){this.header.classList.add('rename-text');}}else{this.header.dataset.l10nId='confirmation-title';}
this.updateSoftKeys(type);this.element.classList.remove('hidden');this.element.focus();if(type==='input'){this.content.dataset.l10nId='';this.content.innerHTML=this.inputHtml;this.inputBox=document.getElementById('dialog-content-input');this.inputBox.value=primaryValue||'';this.inputBox.focus();this.inputBox.setSelectionRange(0,this.inputBox.value.length);}},hide:function(){this.element.classList.add('hidden');},cancel:function(){this.hide();this.cancelCallback&&this.cancelCallback();},confirm:function(){this.hide();this.confirmCallback&&this.confirmCallback();},isActive:function(){return!this.element.classList.contains('hidden');},onKeyDown(e){switch(e.key){case'Enter':if(this.type==='hint'){this.confirm();}
break;case'SoftLeft':if(this.type==='hint'){return;}
this.cancel();break;case'Backspace':e.stopPropagation();e.preventDefault();this.cancel();break;case'SoftRight':if(this.inputBox&&this.inputBox.value.trim()===''||this.type==='hint'){return;}
this.confirm();break;}}};var Dialog=new _dialog();Dialog.init();