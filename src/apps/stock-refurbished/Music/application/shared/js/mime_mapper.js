
var MimeMapper={_typeToExtensionMap:{"image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/bmp":"bmp","audio/mpeg":"mp3","audio/mp4":"m4a","audio/ogg":"ogg","audio/webm":"webm","audio/3gpp":"3gp","audio/amr":"amr","audio/x-wav":"wav","audio/x-midi":"mid","audio/acc":"acc","video/mp4":"mp4","video/mpeg":"mpg","video/ogg":"ogg","video/webm":"webm","video/3gpp":"3gp","video/3gpp2":"3g2","application/vcard":"vcf","text/vcard":"vcf","text/x-vcard":"vcf","text/plain":"txt","text/kai_plain":"note"},_extensionToTypeMap:{jpg:"image/jpeg",jpeg:"image/jpeg",jpe:"image/jpeg",png:"image/png",gif:"image/gif",bmp:"image/bmp",mp3:"audio/mpeg",m4a:"audio/mp4",m4b:"audio/mp4",m4p:"audio/mp4",m4r:"audio/mp4",aac:"audio/aac",opus:"audio/ogg",amr:"audio/amr",awb:"audio/amr-wb",wav:"audio/x-wav",mid:"audio/x-midi",mp4:"video/mp4",mpeg:"video/mpeg",mpg:"video/mpeg",ogv:"video/ogg",ogx:"video/ogg",webm:"video/webm","3gp":"video/3gpp","3g2":"video/3gpp2",ogg:"video/ogg",apk:"application/vnd.android.package-archive",zip:"application/zip",vcf:"text/vcard",txt:"text/plain",note:"text/kai_plain"},_parseExtension:function(e){var o=e.split(".");return o.length>1?o.pop():""},isSupportedType:function(e){return e in this._typeToExtensionMap},isSupportedExtension:function(e){return e in this._extensionToTypeMap},isFilenameMatchesType:function(e,o){var n=this._parseExtension(e),r=this.guessTypeFromExtension(n);return r==o},guessExtensionFromType:function(e){return this._typeToExtensionMap[e]},guessTypeFromExtension:function(e){return this._extensionToTypeMap[e]},guessTypeFromFileProperties:function(e,o){var n=this._parseExtension(e),r=this.isSupportedType(o)?o:this.guessTypeFromExtension(n);return r||""},ensureFilenameMatchesType:function(e,o){if(!this.isFilenameMatchesType(e,o)){var n=this.guessExtensionFromType(o);n&&this._parseExtension(e)!==n&&(e+="."+n)}return e}};