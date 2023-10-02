
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.GaiaProgress=e()}}(function(){var define,module,exports;return(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){;(function(define){define(function(require,exports,module){var textContent=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');var innerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');var removeAttribute=Element.prototype.removeAttribute;var setAttribute=Element.prototype.setAttribute;var noop=function(){};exports.register=function(name,props){var baseProto=getBaseProto(props.extends);delete props.extends;if(props.template){var output=processCss(props.template,name);props.template=document.createElement('template');props.template.innerHTML=output.template;props.lightCss=output.lightCss;props.globalCss=props.globalCss||'';props.globalCss+=output.globalCss;}
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
dirObserver=new MutationObserver(onChanged);dirObserver.observe(document.documentElement,{attributeFilter:['dir'],attributes:true});function onChanged(mutations){document.dispatchEvent(new Event('dirchanged'));}}});})(typeof define=='function'&&define.amd?define:(function(n,w){return typeof module=='object'?function(c){c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-component',this));},{}],2:[function(require,module,exports){;(function(define){define(function(require,exports,module){var component=require('gaia-component');module.exports=component.register('gaia-progress',{created:function(){this.setupShadowRoot();this.els={inner:this.shadowRoot.querySelector('.inner'),bar:this.shadowRoot.querySelector('.bar')};this.els.inner.setAttribute('role','progressbar');this.els.inner.setAttribute('aria-valuemin','0');this.els.inner.setAttribute('aria-valuemax','100');this.els.bar.classList.toggle('focus',this.getAttribute('selected')==='true');this.value=this.getAttribute('value')||0;this.handleAnimationEnd=()=>{var classList=this.els.inner.classList;if(classList.contains('no-value')){if(classList.contains('increasing')){classList.remove('increasing');classList.add('decreasing');}else{classList.remove('decreasing');classList.add('increasing');}}};this.addEventListener('animationend',this.handleAnimationEnd);},detached:function(){this.removeEventListener('animationend',this.handleAnimationEnd);},fillTime:2000,attrs:{value:{get:function(){return this._value||0;},set:function(value){value=Math.min(100,Math.max(0,Number(value)));if(value){var delta=Math.abs(this.value-value);var duration=(delta/100)*this.fillTime;this.els.bar.style.transform=`translateX(${value}%)`;this.els.bar.style.transitionDuration=duration+'ms';this.els.inner.setAttribute('aria-valuenow',value);}else{this.els.inner.removeAttribute('aria-valuenow');}
this.els.inner.classList.toggle('no-value',!value);this.els.inner.classList.toggle('increasing',!value);this._value=value;}},selected:{set:function(value){this.els.bar.classList.toggle('focus',value==='true');}}},template:`
    <div class="inner">
      <div class="bar"></div>
    </div>

    <style>

      :host {
        display: block;
        overflow: hidden;
        height: 0.6rem;
        border-radius: 0.3rem;
        width: 100%;
      }

      .inner {
        height: 100%;
        background: var(--color-gs45, #aaa)
      }

      .bar {
        position: relative;
        top: 0;
        left: -100%;

        width: 100%;
        height: 100%;

        background: var(--highlight-color);
        transition: transform 0ms linear;
      }

      .bar:after {
        position: absolute;
        left: 100%;

        display: block;
        content: '';
        width: 0;
        height: 0;

        border-top: 0.6rem solid var(--color-gs00, #fff);
        border-left: 0.3rem solid var(--color-gs00, #fff);
      }

      .focus.bar {
        background-color: var(--color-gs00);
      }

      .focus.bar::after {
        border-top: 0.6rem solid var(--highlight-color);
        border-left: 0.3rem solid var(--highlight-color);
      }

      .bar:before {
        position: absolute;
        left: -0.3rem;

        display: block;
        content: '';
        width: 0;
        height: 0;

        border-top: 0.6rem solid var(--color-gs00, #fff);
        border-left: 0.3rem solid var(--color-gs00, #fff);
      }

      .no-value .bar {
        left: 0;
        width: 100%;

      }

      .no-value.increasing  .bar {
        animation: moving-in 1520ms cubic-bezier(0.3, 0, 0.4, 1);
      }

      .no-value.decreasing  .bar {
        animation: moving-out 1520ms cubic-bezier(0.6, 0, 0.3, 1);
      }

    </style>
  `,globalCss:`
    @keyframes moving-in {
      0% { width: 0; }
      100% { width: 100%; }
    }

   @keyframes moving-out {
      0% { left: 0; }
      100% { left: 100%; }
    }
  `});});})(typeof define=='function'&&define.amd?define:(function(n,w){return typeof module=='object'?function(c){c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-progress',this));},{"gaia-component":1}]},{},[2])(2)});