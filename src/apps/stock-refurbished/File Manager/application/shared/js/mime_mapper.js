'use strict';
var MimeMapper = {
    _fileTypeMap: {
     audio: ["audio/mpeg", "audio/mp4", "audio/midi", "audio/ogg", "audio/webm", "audio/3gpp", "audio/amr", "audio/x-wav", "audio/aac"],
     video: ["video/mp4", "video/mpeg", "video/ogg", "video/webm", "video/3gpp", "video/3gpp2"],
     photo: ["image/png", "image/jpeg", "image/gif", "image/bmp"],
     package: ["application/zip","application/java-archive"], // Extract archives in the future
     app: ["application/x-install-bundle","application/x-gerda-bundle","application/openwebapp+zip", "application/x-web-package"],
     other: ["text/vcard", "application/json","text/plain", "unknown/unknown", "text/html", "application/x-chip8-image", "application/x-bin-image", "application/x-gb-image", "application/x-gbc-image", "application/x-nes-image"]
    },
    getFileTypeFromType: function(e){
        return e.length < 1 ? "type-other" : 
        MimeMapper._fileTypeMap.photo.includes(e) ? "type-photo" : 
        MimeMapper._fileTypeMap.audio.includes(e) ? "type-audio" : 
        MimeMapper._fileTypeMap.app.includes(e) ? "type-app" : 
        MimeMapper._fileTypeMap.package.includes(e) ? "type-pkg" : 
        MimeMapper._fileTypeMap.video.includes(e) ? "type-video" : 
        "type-other"
    },
    openFile: function(e){
        // Support for other files without mozActivity can be added here
        var t = MimeMapper.guessTypeFromFileProperties(e.name, e.type);
        // if (t == "text/html") return thing
        /*if (t == "application/openwebapp+zip") return navigator.mozApps.mgmt.import(e).then(function(){
            
          }).catch(function(e){
           alert("Failed to import Openwebapp Package: "+e.name)
           console.error(e)
          })*/

        // Non-chad default MozActivity Fallback
        return new MozActivity({
            name: "text/vcard" === t ? "import" : "open",
            data: {
                type: t,
                filename: e.name,
                blob: e,
                allowSave: !1
            }
        }).onerror = function () {
            this.showNotSupportDialog()
        }
    },
    getIconFromType: function(e){
        if (this.isSupportedType(e)){
        // Exclusive File Type
        if (e == "application/java-archive") return "coffee"
        if (e == "text/vcard") return "file-vcf"
        if (e == "text/html") return "roaming"
        // Categories
        if (MimeMapper._fileTypeMap.photo.includes(e)) return "file-photo"
        if (MimeMapper._fileTypeMap.audio.includes(e)) return "file-audio"
        if (MimeMapper._fileTypeMap.video.includes(e)) return "file-video"
        if (MimeMapper._fileTypeMap.package.includes(e)) return "file-compress"
        if (MimeMapper._fileTypeMap.app.includes(e)) return "rocket"

        }else{
            return "file"
        }
    },
    _typeToExtensionMap: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/3gpp': '3gp',
        'audio/amr': 'amr',
        'audio/x-wav': 'wav',
        'video/mp4': 'mp4',
        'video/mpeg': 'mpg',
        'video/ogg': 'ogg',
        'video/webm': 'webm',
        'video/3gpp': '3gp',
        'video/3gpp2': '3g2',
        'application/vcard': 'vcf',
        'text/vcard': 'vcf',
        'text/x-vcard': 'vcf',
        'application/zip': 'zip',
        'text/html': 'html',
        'text/plain': 'txt',
        "application/json": 'json',
        "application/java-archive": 'jar',
        "application/openwebapp+zip": 'wpk',
        "application/openwebapp+zip": 'omnisd',
        "application/openwebapp+zip": 'omnipkg',
        "application/openwebapp+zip": 'kai',
        "application/x-web-package": 'webpkg',
        'application/x-install-bundle': 'aib',
        'application/x-bzip': 'bz',
        'application/x-bzip2': 'bz2',
        'application/x-tar': 'tar',
        'application/x-gerda-bundle': 'gab',
        'application/x-bin-image': 'bin',
        'application/x-gb-image': 'gb',
        'application/x-gbc-image': 'gbc',
        'application/x-nes-image': 'nes',
        'application/x-chip8-image': 'ch8',
        "unknown/unknown": "unknown",
    },
    _extensionToTypeMap: {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'jpe': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'm4b': 'audio/mp4',
        'm4p': 'audio/mp4',
        'm4r': 'audio/mp4',
        'aac': 'audio/aac',
        'opus': 'audio/ogg',
        'amr': 'audio/amr',
        'wav': 'audio/x-wav',
        'mid': 'audio/x-midi',
        'mp4': 'video/mp4',
        'mpeg': 'video/mpeg',
        'mpg': 'video/mpeg',
        'ogv': 'video/ogg',
        'ogx': 'video/ogg',
        'webm': 'video/webm',
        '3gp': 'video/3gpp',
        '3g2': 'video/3gpp2',
        'ogg': 'video/ogg',
        'txt': 'text/plain',
        'html': 'text/html',
        'jar': "application/java-archive",
        'json': "application/json",
        'webpkg': 'application/x-web-package',
        'wpk': 'application/openwebapp+zip',
        'omnisd': 'application/openwebapp+zip',
        'omnipkg': 'application/openwebapp+zip',
        'kai': 'application/openwebapp+zip',
        'aib': 'application/x-install-bundle',
        'tar': 'application/x-tar',
        'apk': 'application/vnd.android.package-archive',
        'zip': 'application/zip',
        'vcf': 'text/vcard',
        'bz': 'application/x-bzip',
        'bz2': 'application/x-bzip2',
        'gab': 'application/x-gerda-bundle',
        'bin': 'application/x-bin-image',
        'gb': 'application/x-gb-image',
        'gbc': 'application/x-gbc-image',
        'nes': 'application/x-nes-image',
        'ch8': 'application/x-chip8-image',
        "unknown": "unknown/unknown",
    },
    
    _parseExtension: function(filename) {
        var array = filename.split('.');
        return array.length > 1 ? array.pop() : '';
    },
    isSupportedType: function(mimetype) {
        return (mimetype in this._typeToExtensionMap);
    },
    isSupportedExtension: function(extension) {
        return (extension in this._extensionToTypeMap);
    },
    isFilenameMatchesType: function(filename, mimetype) {
        var extension = this._parseExtension(filename);
        var guessedType = this.guessTypeFromExtension(extension);
        return (guessedType == mimetype);
    },
    guessExtensionFromType: function(mimetype) {
        return this._typeToExtensionMap[mimetype];
    },
    guessTypeFromExtension: function(extension) {
        return this._extensionToTypeMap[extension];
    },
    guessTypeFromFileProperties: function(filename, mimetype) {
        var extension = this._parseExtension(filename);
        var type = this.isSupportedType(mimetype) ? mimetype : this.guessTypeFromExtension(extension);
        return type || "unknown/unknown";
    },
    ensureFilenameMatchesType: function(filename, mimetype) {
        if (!this.isFilenameMatchesType(filename, mimetype)) {
            var guessedExt = this.guessExtensionFromType(mimetype);
            if (guessedExt) {
                filename += '.' + guessedExt;
            }
        }
        return filename;
    }
};
