'use strict';var Dialogs={confirm:function(options,onConfirm,onCancel){LazyLoader.load('shared/style/confirm.css',function(){var dialog=$('confirm-dialog');var msgEle=$('confirm-msg');var cancelButton=$('confirm-cancel');var confirmButton=$('confirm-ok');var addText=function(element,prefix,defaultId){if(options[prefix+'Id']){navigator.mozL10n.setAttributes(element,options[prefix+'Id'],options[prefix+'Args']);}
else if(options[prefix]||options[prefix+'Text']){var textOption=options[prefix]||options[prefix+'Text'];element.textContent=textOption;}
else if(defaultId){element.setAttribute('data-l10n-id',defaultId);}};addText(msgEle,'message');addText(cancelButton,'cancel','cancel');addText(confirmButton,'confirm','ok');if(options.danger){confirmButton.classList.add('danger');}else{confirmButton.classList.remove('danger');}
if(options.bodyClass){document.body.classList.add(options.bodyClass);}
dialog.classList.remove('hidden');function close(ev){if(options.bodyClass){document.body.classList.remove(options.bodyClass);}
dialog.classList.add('hidden');cancelButton.removeEventListener('click',onCancelClick);confirmButton.removeEventListener('click',onConfirmClick);ev.preventDefault();ev.stopPropagation();return false;}
var onCancelClick=function(ev){close(ev);if(onCancel){onCancel();}
return false;};var onConfirmClick=function(ev){close(ev);if(onConfirm){onConfirm();}
return false;};cancelButton.addEventListener('click',onCancelClick);confirmButton.addEventListener('click',onConfirmClick);});}};