'use strict';
/*
MimeMapper - refurbished akeru stock file manager

How to add MIME types:
- Add MIME type to _fileTypeMap
- Link all of it's extensions to the MIME Type through _typeToExtensionMap and _extensionToTypeMap

This modified file adds some mime types like java archives (coffee icon), and app installation packages so 
they can be properly recognized by other applications through mozactivities.
*/

var MimeMapper = {
    _fileTypeMap: {
    /* 🎵 */ audio: ["audio/mpeg", "audio/mp4", "audio/midi", "audio/ogg", "audio/webm", "audio/3gpp", "audio/amr", "audio/x-wav", "audio/aac"],

    /* 🎵 */ video: ["video/mp4", "video/mpeg", "video/ogg", "video/webm", "video/3gpp", "video/3gpp2"],

    /* 🎵 */ photo: ["image/svg+xml", "image/png", "image/jpeg", "image/gif", "image/bmp"],

    /* 🗜️ */ compressed: ["application/zip", "application/java-archive"], // Extract archives in the future

    /* 🎵 */ app: ["application/x-install-bundle", "application/x-gerda-bundle", "application/openwebapp+zip", "application/x-web-package"],

    /* 🎵 */ font: ["font/otf", "font/ttf", "font/woff", "font/woff2"],

    /* 🦆 */ other: ["application/geo+json", "application/gpx+xml", "application/x-sh", "application/msword","application/pdf", "text/vcard", "application/json", "text/plain", "unknown/unknown", "text/html", 
                 "application/x-chip8-image", "application/x-bin-image", "application/x-gb-image", "application/x-gbc-image", "application/x-nes-image"]
    },
    getFileTypeFromType: function (e) {
        return e.length < 1 ? "type-other" :
            MimeMapper._fileTypeMap.photo.includes(e) ? "type-photo" :
            MimeMapper._fileTypeMap.audio.includes(e) ? "type-audio" :
            MimeMapper._fileTypeMap.app.includes(e) ? "type-app" :
            MimeMapper._fileTypeMap.compressed.includes(e) ? "type-compressed" :
            MimeMapper._fileTypeMap.video.includes(e) ? "type-video" :
            "type-other"
    },
    openFile: function (e) {
        // Manages support when opening files, currently supports any recognized MIME type (open) and contacts (import)
        // Previously had a snippet for installing .zip app packages, it has now been moved as a mozactivity in the "Installer" akeru app

        var t = MimeMapper.guessTypeFromFileProperties(e.name, e.type);
      
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
    getSpecialIcon: function (e) {
        // Manages custom folder icons for music, documents, DCIM, etc.
        /* SPECIAL FOLDER audio  mime_mapper.js:51:13
SPECIAL FOLDER music  mime_mapper.js:51:13
SPECIAL FOLDER photos  mime_mapper.js:51:13
SPECIAL FOLDER videos  mime_mapper.js:51:13
SPECIAL FOLDER DCIM  mime_mapper.js:51:13
SPECIAL FOLDER downloads  mime_mapper.js:51:13
SPECIAL FOLDER others */
            console.log("SPECIAL FOLDER "+e)
            if (e == "audio") return "sound-max";
            if (e == "music") return "music";
            if (e == "photos") return "file-photo";
            if (e == "videos") return "file-video";
            if (e == "DCIM") return "camera";
            if (e == "downloads") return "file-download-01";
            if (e == "callrecording") return "call";
            if (e == "screenshots") return "mobile-phone";
            if (e == "LOST.DIR") return "delete";
            if (e == "whatsapp") return "messages";
            if (e == "others") return "duck"; // :)
            return "email-move"

    },
    getIconFromType: function (e) {
        // Manages file icons for basic mime groups and other special files
        if (this.isSupportedType(e)) {
            // Exclusive File Type
            if (e == "application/java-archive") return "coffee"
            if (e == "text/vcard") return "file-vcf"
            if (e == "text/html") return "roaming"
            if (e == "text/plain") return "browser-reader-mode"
            if (e == "application/pdf") return "file-pdf"
            if (e == "application/msword") return "file-doc"
            if (e == "application/x-sh") return "puzzle"
            if (e == "application/gpx+xml") return "poi"
            if (e == "application/geo+json") return "poi"

            // Categories
            if (MimeMapper._fileTypeMap.photo.includes(e)) return "file-photo"
            if (MimeMapper._fileTypeMap.audio.includes(e)) return "file-audio"
            if (MimeMapper._fileTypeMap.video.includes(e)) return "file-video"
            if (MimeMapper._fileTypeMap.compressed.includes(e)) return "file-compress"
            if (MimeMapper._fileTypeMap.font.includes(e)) return "browser-type"
            if (MimeMapper._fileTypeMap.app.includes(e)) return "rocket"
            if (MimeMapper._fileTypeMap.other.includes(e)) return "file"

        } else {
            return "file"
        }
    },
    _typeToExtensionMap: {
        "application/gpx+xml": "gpx",
        "application/geo+json" : "geojson",
        'application/x-sh': 'sh',
        'font/otf': 'otf',
        'font/ttf': 'ttf',
        'font/woff': 'woff',
        'font/woff2': 'woff2',
        'image/svg+xml': 'svg',
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
        'application/pdf' : 'pdf',
        'application/msword': 'doc',
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
        "gpx": "application/gpx+xml",
        "geojson": "application/geo+json",
        'sh': 'application/x-sh',
        'otf': 'font/otf',
        'ttf': 'font/ttf',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'svg': 'image/svg+xml',
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
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'gbc': 'application/x-gbc-image',
        'nes': 'application/x-nes-image',
        'ch8': 'application/x-chip8-image',
        "unknown": "unknown/unknown",
    },

    _parseExtension: function (filename) {
        var array = filename.split('.');
        return array.length > 1 ? array.pop() : '';
    },
    isSupportedType: function (mimetype) {
        return (mimetype in this._typeToExtensionMap);
    },
    isSupportedExtension: function (extension) {
        return (extension in this._extensionToTypeMap);
    },
    isFilenameMatchesType: function (filename, mimetype) {
        var extension = this._parseExtension(filename);
        var guessedType = this.guessTypeFromExtension(extension);
        return (guessedType == mimetype);
    },
    guessExtensionFromType: function (mimetype) {
        return this._typeToExtensionMap[mimetype];
    },
    guessTypeFromExtension: function (extension) {
        return this._extensionToTypeMap[extension];
    },
    guessTypeFromFileProperties: function (filename, mimetype) {
        var extension = this._parseExtension(filename);
        var type = this.isSupportedType(mimetype) ? mimetype : this.guessTypeFromExtension(extension);
        return type || "unknown/unknown";
    },
    ensureFilenameMatchesType: function (filename, mimetype) {
        if (!this.isFilenameMatchesType(filename, mimetype)) {
            var guessedExt = this.guessExtensionFromType(mimetype);
            if (guessedExt) {
                filename += '.' + guessedExt;
            }
        }
        return filename;
    }
};