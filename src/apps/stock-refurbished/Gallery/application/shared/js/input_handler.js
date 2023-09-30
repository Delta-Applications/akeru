/* globals focusChanged */
'use strict';

var inputHandler = {
  init: function() {
    var self = inputHandler;
    window.addEventListener('keyup', function(e){
      self.inputHandler(e);
    });
    document.addEventListener('focusChanged', function(e){
      self.focusChanged(e.detail.focusedElement);
    });
    document.addEventListener('setFocus', function(e){
      self.focusChanged(e.detail.focusedElement);
    });
  },
  inputHandler:function (e) {
    switch(e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      inputHandler.setSelection(e.key);
      break;
    }
  },
  setSelection:function (key) {
    if(['text','email'].indexOf(document.activeElement.type)>-1) {
      switch (key) {
        case 'ArrowLeft':
        if(document.activeElement.selectionStart > 0)
          document.activeElement.setSelectionRange(document.activeElement.selectionStart-1, document.activeElement.selectionStart-1);
        break;
        case 'ArrowRight':
        if(document.activeElement.selectionStart < document.activeElement.value.length)
          document.activeElement.setSelectionRange(document.activeElement.selectionStart+1, document.activeElement.selectionStart+1);
        break;
      }
    }
  },
  focusChanged:function (focusedElement) {
    focusedElement.focus();
    var input = focusedElement.querySelector('input');
    if(input && ['text','password','email','checkbox'].indexOf(input.type)>-1){
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
};