'use strict';
var pickEditor = {
  canvas: null,
  previousBlob: null,
  blob: null,
  container: null,
  callback: null,
  preview: null,
  cw: 0, // container width
  ch: 0, //container height
  config: {
    zoomRatio: 1,
    previewX: 0,
    previewY: 0,
    previewW: 0,
    previewH: 0,
    status: '',
    cropType: 0,
    displayDest: {}
  },

  metadata: null,

  init: function(blob,container,cw,ch) {
    this.blob = blob;
    this.previousBlob = this.blob;
    this.container = container;
    this.cw = cw;
    this.ch = ch;
    this.createImage();
  },

  createImage: function() {
    var canvasNode = document.createElement('canvas');
    canvasNode.width = this.cw;
    canvasNode.height = this.ch;
    canvasNode.id = 'crop-preview-canvas'; // for stylesheet
    canvasNode.setAttribute('role', 'img');
    this.container.appendChild(canvasNode);
    this.canvas = $("crop-preview-canvas");
    var _self = this;
    var maxsize = CONFIG_MAX_EDIT_PIXEL_SIZE || CONFIG_MAX_IMAGE_PIXEL_SIZE;
    LazyLoader.load(['shared/js/media/image_size.js', 'shared/js/blobview.js', 'shared/js/media/jpeg_metadata_parser.js'], function() {
      getImageSize(_self.blob, function success(metadata) {
        var imagesize = metadata.width * metadata.height;
        _self.metadata = metadata;
        if (imagesize > maxsize) {
          cropResizeRotate(_self.blob, null, CONFIG_MAX_IMAGE_PIXEL_SIZE || null, null, null, function(error, rotatedBlob) {
            Spinner.hide();
            if (error) {
              console.error('Error while rotating image:', error);
              rotatedBlob = file;
            }
            _self.drawPick(null, null, rotatedBlob);
          });
        } else {
          _self.drawPick();
        }
      }, function error() {
        _self.drawPick();
      });
      _self.addListener();
    });
  },

  addListener: function() {
    window.addEventListener('keyup',this);
  },
  removeListener: function() {
    window.removeEventListener('keyup',this);
  },

  drawPick: function(data,callback, blob) {
    var self = this;
    self.config.zoomRatio = 1; //zoom ratio
    var url = URL.createObjectURL(blob || this.blob);
    if (lowMemory) {
      let scale = (window.innerWidth * window.devicePixelRatio
        * window.innerHeight * window.devicePixelRatio) /
        (self.metadata.width * self.metadata.height);
      let sampleSize = Downsample.areaNoMoreThan(scale);
      url = url + sampleSize;
    }
    var ctx=this.canvas.getContext("2d",{ willReadFrequently: true });
    this.preview = new Image();
    this.preview.src = url;
    this.preview.onload = function() {
      var previewWidth = self.preview.width;
      var previewHeight = self.preview.height;
      // calculate the preview's zoom ratio
      if(previewWidth > self.cw || previewHeight > self.ch) {
        self.config.zoomRatio = self.cw/previewWidth < self.ch/previewHeight?self.cw/previewWidth:self.ch/previewHeight;
      }
      // calculate the preview's position and width/height
      var displayWidth = previewWidth * self.config.zoomRatio;
      var displayHeight = previewHeight * self.config.zoomRatio;
      var displayX = (self.cw - displayWidth)/2;
      var displayY = (self.ch - displayHeight)/2;
      self.config.previewX = self.config.previewY = 0;
      self.config.previewW = previewWidth;
      self.config.previewH = previewHeight;
      self.config.displayDest = {
        x: self.cw/2 - displayWidth/2,
        y: self.ch/2 - displayHeight/2
      };
      ctx.drawImage(self.preview,0,0,previewWidth,previewHeight,displayX,displayY,displayWidth,displayHeight);
      if(callback)
        callback();
    };
  },

  destroy: function() {
    this.container.removeChild(this.canvas);
    this.canvas = null;
  },

  handleEvent: function(dir) {
  },
};
