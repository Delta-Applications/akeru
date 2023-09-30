
(function(exports){'use strict';var priv=new WeakMap();var rmatcher=/\$\{([^}]+)\}/g;var rentity=/[&<>"']/g;var rentities={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'};function extract(node){var nodeId;if(typeof node==='string'){nodeId=node;node=document.getElementById(node);}else if(node){nodeId=node.id;}
if(!node){console.error('Can not find the node passed to Template',nodeId);return'';}
if(!node.firstChild){console.error('Node passed to Template should have a comment node',nodeId);return'';}
node=node.firstChild;do{if(node.nodeType===Node.COMMENT_NODE){return(node.nodeValue||'').trim();}}while((node=node.nextSibling));console.error('Nodes passed to Template should have a comment node',nodeId);return'';}
function Template(idOrNode){if(!(this instanceof Template)){return new Template(idOrNode);}
priv.set(this,{idOrNode:idOrNode});}
Template.prototype.extract=function(){var members=priv.get(this);if(!members.tmpl){members.tmpl=extract(members.idOrNode);delete members.idOrNode;}
return members.tmpl;};Template.prototype.toString=function(){return this.extract().slice();};Template.prototype.interpolate=function(data,options){options=options||{};options.safe=options.safe||[];return this.extract().replace(rmatcher,function(match,property){property=property.trim();return options.safe.indexOf(property)===-1?Template.escape(data[property]):data[property];});};Template.prototype.prepare=function(data,options){var self=this;return{toString:function t_toString(){return self.interpolate(data,options);},toDocumentFragment:function t_toDocumentFragment(){var template=document.createElement('template');template.innerHTML=this.toString();return template.content.cloneNode(true);}};};Template.escape=function escape(str){if(typeof str!=='string'){return'';}
return str.replace(rentity,function(s){return rentities[s];});};exports.Template=Template;}(this));