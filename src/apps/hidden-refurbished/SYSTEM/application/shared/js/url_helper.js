'use strict';var rscheme=/^(?:[a-z\u00a1-\uffff0-9-+]+)(?::(?:\/\/)?)/i;var UrlHelper={a:null,getUrlFromInput:function urlHelper_getUrlFromInput(input){this.a=this.a||document.createElement('a');this.a.href=input;return this.a.href;},_getScheme:function(input){return(rscheme.exec(input)||[])[0];},hasScheme:function(input){return!!this._getScheme(input);},isURL:function urlHelper_isURL(input){return!UrlHelper.isNotURL(input);},isNotURL:function urlHelper_isNotURL(input){var case1Reg=/^(\?)|(\?.+\s)/;var case2Reg=/[\?\.\s\:]/;var case3Reg=/^(data|view-source)\:/;var str=input.trim();if(case1Reg.test(str)||!case2Reg.test(str)||this._getScheme(str)===str){return true;}
if(case3Reg.test(str)){return false;}
if(!this.hasScheme(str)){str='http://'+str;}
if(!this.urlValidate){this.urlValidate=document.createElement('input');this.urlValidate.setAttribute('type','url');}
this.urlValidate.setAttribute('value',str);return!this.urlValidate.validity.valid;}};