
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.GaiaSlider=e()}}(function(){var define,module,exports;return(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){;(function(define){define(function(require,exports,module){'use strict';var textContent=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');var innerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');var removeAttribute=Element.prototype.removeAttribute;var setAttribute=Element.prototype.setAttribute;var noop=function(){};exports.register=function(name,props){var baseProto=getBaseProto(props.extends);delete props.extends;if(props.template){var output=processCss(props.template,name);props.template=document.createElement('template');props.template.innerHTML=output.template;props.lightCss=output.lightCss;props.globalCss=props.globalCss||'';props.globalCss+=output.globalCss;}
injectGlobalCss(props.globalCss);delete props.globalCss;var descriptors=Object.assign(props.attrs||{},base.descriptors);props._attrs=props.attrs;delete props.attrs;var proto=createProto(baseProto,props);Object.defineProperties(proto,descriptors);try{return document.registerElement(name,{prototype:proto});}catch(e){if(e.name!=='NotSupportedError'){throw e;}}};var base={properties:{GaiaComponent:true,attributeChanged:noop,attached:noop,detached:noop,created:noop,createdCallback:function(){if(this.rtl){addDirObserver();}
injectLightCss(this);this.created();},attributeChangedCallback:function(name,from,to){var prop=toCamelCase(name);if(this._attrs&&this._attrs[prop]){this[prop]=to;}
this.attributeChanged(name,from,to);},attachedCallback:function(){this.attached();},detachedCallback:function(){this.detached();},setupShadowRoot:function(){if(!this.template){return;}
var node=document.importNode(this.template.content,true);this.createShadowRoot().appendChild(node);return this.shadowRoot;},setAttr:function(name,value){var internal=this.shadowRoot.firstElementChild;setAttribute.call(internal,name,value);setAttribute.call(this,name,value);},removeAttr:function(name){var internal=this.shadowRoot.firstElementChild;removeAttribute.call(internal,name);removeAttribute.call(this,name);}},descriptors:{textContent:{set:function(value){textContent.set.call(this,value);if(this.lightStyle){this.appendChild(this.lightStyle);}},get:textContent.get},innerHTML:{set:function(value){innerHTML.set.call(this,value);if(this.lightStyle){this.appendChild(this.lightStyle);}},get:innerHTML.get}}};var defaultPrototype=createProto(HTMLElement.prototype,base.properties);function getBaseProto(proto){if(!proto){return defaultPrototype;}
proto=proto.prototype||proto;return!proto.GaiaComponent?createProto(proto,base.properties):proto;}
function createProto(proto,props){return Object.assign(Object.create(proto),props);}
var hasShadowCSS=(function(){var div=document.createElement('div');try{div.querySelector(':host');return true;}
catch(e){return false;}})();var regex={shadowCss:/(?:\:host|\:\:content)[^{]*\{[^}]*\}/g,':host':/(?:\:host)/g,':host()':/\:host\((.+)\)(?: \:\:content)?/g,':host-context':/\:host-context\((.+)\)([^{,]+)?/g,'::content':/(?:\:\:content)/g};function processCss(template,name){var globalCss='';var lightCss='';if(!hasShadowCSS){template=template.replace(regex.shadowCss,function(match){var hostContext=regex[':host-context'].exec(match);if(hostContext){globalCss+=match.replace(regex['::content'],'').replace(regex[':host-context'],'$1 '+name+'$2').replace(/ +/g,' ');}else{lightCss+=match.replace(regex[':host()'],name+'$1').replace(regex[':host'],name).replace(regex['::content'],name);}
return'';});}
return{template:template,lightCss:lightCss,globalCss:globalCss};}
function injectGlobalCss(css){if(!css)return;var style=document.createElement('style');style.innerHTML=css.trim();headReady().then(()=>{document.head.appendChild(style)});}
function headReady(){return new Promise(resolve=>{if(document.head){return resolve();}
window.addEventListener('load',function fn(){window.removeEventListener('load',fn);resolve();});});}
function injectLightCss(el){if(hasShadowCSS){return;}
el.lightStyle=document.createElement('style');el.lightStyle.setAttribute('scoped','');el.lightStyle.innerHTML=el.lightCss;el.appendChild(el.lightStyle);}
function toCamelCase(string){return string.replace(/-(.)/g,function replacer(string,p1){return p1.toUpperCase();});}
var dirObserver;function addDirObserver(){if(dirObserver){return;}
dirObserver=new MutationObserver(onChanged);dirObserver.observe(document.documentElement,{attributeFilter:['dir'],attributes:true});function onChanged(mutations){document.dispatchEvent(new Event('dirchanged'));}}});})(typeof define=='function'&&define.amd?define:(function(n,w){'use strict';return typeof module=='object'?function(c){c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-component',this));},{}],2:[function(require,module,exports){;(function(define){define(function(require,exports,module){'use strict';var component=require('gaia-component');module.exports=component.register('gaia-slider',{created:function(){this.setupShadowRoot();this.els={input:this.shadowRoot.querySelector('input'),value:this.shadowRoot.querySelector('.value'),output:this.querySelector('output')};this.els.input.addEventListener('input',this.onInput.bind(this));this.els.input.addEventListener('change',this.onChange.bind(this));this.value=this.getAttribute('value')||0;this.noborder=this.getAttribute('data-no-border')||'false';var transparent=this.getAttribute('transparent');if(transparent){this.els.input.classList.toggle('transparent',transparent==='true');}},setRange:function(min,max){this.els.input.min=this.min=min;this.els.input.max=this.max=max;},onInput:function(e){this.dispatchEvent(new CustomEvent('input'));},onChange:function(e){this.dispatchEvent(new CustomEvent('change'));},attrs:{value:{get:function(){return this._value||0;},set:function(value){var min=this.els.input.min?this.els.input.min:0;var max=this.els.input.max?this.els.input.max:100;if(value>=min&&value<=max){this.els.input.value=value;}
this._value=parseInt(this.els.input.value);this.els.input.classList.toggle('min',this._value==min);this.els.input.classList.toggle('max',this._value==max);}},noborder:{get:function(){return this._noborder||'false';},set:function(value){this.els.input.classList.toggle('no-border-radius',value==='true');this._noborder=value;}}},template:`
    <div class="inner">
      <input type="range" orient="vertical"/>
    </div>
    <style>

    ::-moz-focus-outer { border: 0; }

    div.inner {
      height: 100%;
    }

    /** Host
     ---------------------------------------------------------*/

    :host {
      display: block;
      height: 100%;
    }

    /** Input
     ---------------------------------------------------------*/

    input {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: none;
      border: 0;
    }

    /** Progress
     ---------------------------------------------------------*/

    ::-moz-range-progress {
      background: var(--highlight-color);
      width: 1.2rem;
      border-radius: 0 0 0.6rem 0.6rem;
    }


    .transparent::-moz-range-progress {
      opacity: 1;
      width: 0.6rem;
      background: var(--color-gs00);
    }

    .no-border-radius::-moz-range-progress {
      background: var(--highlight-color);
      width: 1.2rem;
      border-radius: 0;
    }

    input.max::-moz-range-progress {
      border-radius: 0.6rem;
    }

    input.max.no-border-radius::-moz-range-progress {
      border-radius: 0;
    }

    /** Track
     ---------------------------------------------------------*/

    ::-moz-range-track {
      width: 1.2rem;
      height: 100%;
      border-radius: 0.6rem;
      background: var(--color-gs45);
    }

    .transparent::-moz-range-track {
      opacity: 0.5;
      width: 0.6rem;
      box-shadow: 0px 0px 3px 0px rgba(0,0,0,0.5);
      background: var(--color-gs00);
    }

    .no-border-radius::-moz-range-track {
      width: 1.2rem;
      height: 100%;
      background: var(--color-gs45);
      border-radius: 0;
    }

    /** Thumb
     ---------------------------------------------------------*/

    ::-moz-range-thumb {
      width: 1.2rem;
      height: 0.3rem;
      background: var(--input-background);
      border: none;
      border-radius: 0;
      position: relative;
      z-index: 100;
      left: 50%;
      transition: all 0.2s;
    }

    .transparent::-moz-range-thumb {
      width: 0.6rem;
    }

    input.min::-moz-range-thumb,
    input.max::-moz-range-thumb {
      opacity: 0;
    }

    </style>
  `});});})(typeof define=='function'&&define.amd?define:(function(n,w){'use strict';return typeof module=='object'?function(c){c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-slider',this));},{"gaia-component":1}]},{},[2])(2)});