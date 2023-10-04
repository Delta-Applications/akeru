var TYPE_MIX = 'mix';
var TYPE_LIST = 'list';
var TYPE_SINGLE = 'single';
var TYPE_BLOB = 'blob';
var REPEAT_OFF = 0;
var REPEAT_LIST = 1;
var REPEAT_SONG = 2;
var PLAYSTATUS_STOPPED = 'STOPPED';
var PLAYSTATUS_PLAYING = 'PLAYING';
var PLAYSTATUS_PAUSED = 'PAUSED';
var PLAYSTATUS_FWD_SEEK = 'FWD_SEEK';
var PLAYSTATUS_REV_SEEK = 'REV_SEEK';
var INTERRUPT_BEGIN = 'mozinterruptbegin';
var PlayerView = {
    get view() {
        return document.getElementById('views-player');
    },
    get audio() {
        return document.getElementById('player-audio');
    },
    get visualizer() {
        return document.getElementById("player-cover-visualizer")
    },
    get playSongName() {
        return this.playingBlob ? this.playingBlob.name : '';
    },
    get playSongId() {
        return this._playSongId;
    },
    set playSongId(val) {
        return this._playSongId = val;
    },
    get playStatus() {
        return this._playStatus;
    },
    set playStatus(val) {
        const _oldStatus = this._playStatus;
        this._playStatus = val;
        if (_oldStatus !== INTERRUPT_BEGIN && this._playStatus !== INTERRUPT_BEGIN) {
            this.updateSoftKeys();
        }
    },
    get dataSource() {
        return this._dataSource;
    },
    set dataSource(source) {
        if (document.body.classList.contains('search-from-sublist-mode')) {
            this._dataSource = SearchView.dataSource;
        } else {
            this._dataSource = source;
        }
    },
    init: function pv_init() {
        this.name = document.getElementById('player-cover-name');
        this.artist = document.getElementById('player-cover-artist');
        this.album = document.getElementById('player-cover-album');
        this.nameText = document.querySelector('#player-cover-name bdi');
        this.artistText = document.querySelector('#player-cover-artist bdi');
        this.albumText = document.querySelector('#player-cover-album bdi');
        this.playerReadout = document.querySelector('#player-readout');
        this.cover = document.getElementById('player-cover');
        this.coverImage = document.getElementById('player-cover-image');
        this.offscreenImage = new Image();
        this.repeatButton = document.getElementById('player-album-repeat');
        this.shuffleButton = document.getElementById('player-album-shuffle');
        this.caption = document.getElementById('player-cover-caption');
        this.playerseek = document.getElementById('player-seek');
        this.seekRegion = document.getElementById('player-seek-bar');
        this.seekBar = document.getElementById('player-seek-bar-progress');
        this.seekElapsed = document.getElementById('player-seek-elapsed');
        this.seekRemaining = document.getElementById('player-seek-remaining');
        if (this.isopenpick && window.hasVolumeKey && !allowSave) {
            this.noOptions = true;
        }
        this.isTouching = false;
        this.isFastSeeking = false;
        this.stopFastSeekingFlag = false;
        this.longPressTimer = null;
        this.playStatus = PLAYSTATUS_STOPPED;
        this.pausedPosition = null;
        this.handle = null;
        this.dataSource = [];
        this.playingBlob = null;
        this.currentIndex = 0;
        this.setSeekBar(0, 0, 0);
        this.intervalID = null;
        this.dataSourceBeforeStop = [];
        this.indexBeforeStop = 0;
        this.view.addEventListener('contextmenu', this);
        this.view.addEventListener('keydown', this);
        this.view.addEventListener('keyup', this);
        this.seekRegion.addEventListener('touchstart', this);
        this.seekRegion.addEventListener('touchmove', this);
        this.seekRegion.addEventListener('touchend', this);
        this.audio.addEventListener('play', this);
        this.audio.addEventListener('pause', this);
        this.audio.addEventListener('playing', this);
        this.audio.addEventListener('durationchange', this);
        this.audio.addEventListener('timeupdate', this);
        this.audio.addEventListener('ended', this);
        this.audio.addEventListener('mozinterruptbegin', this);
        this.audio.addEventListener('mozinterruptend', this);
        this.onerror = function invalid() {
            Dialog.show('audioinvalid', null, () => {
                this.stop(true)
            }, () => {
                this.stop(true)
            }, {
                type: 'hint'
            });
        };
        window.addEventListener('visibilitychange', this);
        window.addEventListener('storage', this._handleInterpageMessage.bind(this));
        this.endedTimer = null;
        this._audioChannelManager = navigator.mozAudioChannelManager;
        this._audioChannelManager.onheadphoneschange = this._onHeadphoneStateChanged.bind(this);
        navigator.mozL10n.ready(this.updateL10n.bind(this));


        var context = new AudioContext();
        var src = context.createMediaElementSource(this.audio);
        var analyser = context.createAnalyser();
    
        var canvas = this.visualizer;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var ctx = canvas.getContext("2d");

        src.connect(analyser);
        analyser.connect(context.destination);
        
        analyser.fftSize = 128;
    
        var bufferLength = analyser.frequencyBinCount;
    
        var dataArray = new Uint8Array(bufferLength);
    
        var WIDTH = canvas.width;
        var HEIGHT = canvas.height;
    
        var barWidth = (WIDTH - 2 * bufferLength - 4) / bufferLength * 2.5;//(WIDTH / bufferLength) * 2.5;
        var barHeight;
        var x = 0;
    
        function renderFrame() {
          requestAnimationFrame(renderFrame);
    
          x = 0;
    
          analyser.getByteFrequencyData(dataArray);
    
          ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
          for (var i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * .75;
            
            var r = 0;//barHeight + (15 * (i/bufferLength));
            var g = 0;//250 * (i/bufferLength);
            var b = 0;//50;

            var t = Math.round((HEIGHT - barHeight)/HEIGHT * 10) + 2
            
            ctx.fillStyle = "rgba(" + r + "," + g + "," + b + ", 0."+t+")";
            ctx.lineCap = "round";
            ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
            //ctx.fill()
            x += barWidth + 1;
          }
        }
    
        renderFrame();
    },
    _onHeadphoneStateChanged: function() {
        if (!this._audioChannelManager.headphones) {
            let pausePlayer = () => {
                if (this.playStatus === PLAYSTATUS_PLAYING) {
                    this.pause();
                } else if (this.playStatus === INTERRUPT_BEGIN) {
                    this.unplugPromise = new Promise((resolve) => {
                        this.unplugResolve = resolve;
                    });
                    this.unplugPromise.then(() => {
                        this.pause();
                        this.unplugPromise = null;
                        this.unplugResolve = null;
                    });
                }
            }
            if (typeof MusicComms !== 'undefined' && MusicComms.enabled) {
                MusicComms.isA2dpConnected(isConnected => {
                    if (!isConnected) {
                        pausePlayer();
                    }
                });
            } else {
                pausePlayer();
            }
        }
    },
    updateSoftKeys: function pv_updateSoftkeys() {
        if (!this.isopenpick) {
            SoftKeyStore.register({
                'left': App.pendingPick ? 'cancel' : 'opt-library',
                'center': (this.playStatus === PLAYSTATUS_PAUSED || this.playStatus === PLAYSTATUS_STOPPED) ? 'icon=play' : 'icon=pause',
                'right': App.pendingPick ? 'done' : 'options'
            }, this.view);
        } else {
            SoftKeyStore.register({
                'left': '',
                'center': this.playStatus === PLAYSTATUS_PAUSED ? 'icon=play' : 'icon=pause',
                'right': this.noOptions ? '' : 'options'
            }, this.view);
        }
    },
    checkSCOStatus: function pv_checkSCOStatus() {
        if (typeof MusicComms !== 'undefined' && MusicComms.enabled) {
            var SCOStatus = MusicComms.isSCOEnabled;
            this.seekRegion.parentNode.classList.toggle('disabled', SCOStatus);
        }
    },
    clean: function pv_clean() {
        if (this.handle) {
            musicdb.cancelEnumeration(this.handle);
        }
        this.dataSource = [];
        this.playingBlob = null;
    },
    setSourceType: function pv_setSourceType(type) {
        this.sourceType = type;
    },
    setDBInfo: function pv_setDBInfo(info) {
        this.DBInfo = info;
        this.dataSource.length = info.count;
    },
    showInfo: function pv_showInfo() {
        this.cover.classList.add('slideOut');
        this.playerseek.classList.add('slideOut');
        this.caption.classList.add('slideOut');
    },
    setInfo: function pv_setInfo(fileinfo) {
        var metadata = fileinfo.metadata;
        if (typeof ModeManager !== 'undefined') {
            ModeManager.playerTitle = metadata.title;
            ModeManager.updateTitle();
            if (metadata.locked || (typeof App !== 'undefined' && App.pendingPick) || this.isopenpick) {
                this.artist.classList.add('hidden-cover-share');
                this.album.classList.add('hidden-cover-share');
            } else {
                this.artist.classList.remove('hidden-cover-share');
                this.album.classList.remove('hidden-cover-share');
            }
        } else {
            var titleBar = document.querySelector('#title-text');
            titleBar.textContent = metadata.title || navigator.mozL10n.get('unknownTitle');
            titleBar.dataset.l10nId = metadata.title ? '' : 'unknownTitle';
        }
        const [title, artist, album] = [metadata.title || navigator.mozL10n.get('unknownTitle'), metadata.artist || navigator.mozL10n.get('unknownArtist'), metadata.album || navigator.mozL10n.get('unknownAlbum')];
        this.nameText.textContent = title;
        this.nameText.dataset.l10nId = metadata.title ? '' : 'unknownTitle';
        this.artistText.textContent = artist;
        this.artistText.dataset.l10nId = metadata.artist ? '' : 'unknownArtist';
        this.albumText.textContent = album;
        this.albumText.dataset.l10nId = metadata.album ? '' : 'unknownAlbum';
        this.playerReadout.textContent = `${title} ${artist} ${album}`;
        this.setCoverImage(fileinfo);
    },
    setCoverImage: function pv_setCoverImage(fileinfo) {
        this.offscreenImage.src = '';
        this.coverImage.classList.remove('fadeIn');
        AlbumArt.getCoverURL(fileinfo).then(function(url) {
            this.offscreenImage.addEventListener('load', pv_showImage.bind(this));
            this.offscreenImage.src = url;
        }.bind(this));

        function pv_showImage(evt) {
            evt.target.removeEventListener('load', pv_showImage);
            var url = 'url(' + this.offscreenImage.src + ')';
            this.coverImage.style.backgroundImage = url;
            this.coverImage.classList.add('fadeIn');
        }
    },
    setOptions: function pv_setOptions(settings) {
        var repeatOption = (settings && settings.repeat) ? settings.repeat : REPEAT_OFF;
        var shuffleOption = (settings && settings.shuffle) ? settings.shuffle : false;
        this.setRepeat(repeatOption);
        this.setShuffle(shuffleOption);
    },
    setRepeat: function pv_setRepeat(value) {
        var repeatModes = ['repeat-off', 'repeat-list', 'repeat-song'];
        repeatModes.forEach(function pv_resetRepeat(targetClass) {
            this.repeatButton.classList.remove(targetClass);
        }.bind(this));
        if (value === 2) {
            this.setShuffle(0);
        }
        this.repeatOption = value;
        this.repeatButton.classList.add(repeatModes[this.repeatOption]);
        this.repeatButton.setAttribute('data-l10n-id', repeatModes[this.repeatOption]);
    },
    setShuffle: function pv_setShuffle(value, index) {
        this.shuffleOption = value;
        if (this.shuffleOption) {
            if (this.repeatButton.classList.contains('repeat-song')) {
                this.setRepeat(0);
            }
            this.shuffleButton.classList.add('shuffle-on');
            this.shuffleButton.classList.remove('disable');
            if (arguments.length > 1) {
                this.shuffleList(this.currentIndex);
            } else {
                this.shuffleList();
            }
        } else {
            this.shuffleButton.classList.remove('shuffle-on');
            this.shuffleButton.classList.add('disable');
        }
        this.shuffleButton.setAttribute('aria-pressed', this.shuffleOption);
    },
    shuffleList: function slv_shuffleList(index) {
        if (this.dataSource.length === 0) {
            return;
        }
        this.shuffleIndex = 0;
        this.shuffledList = [];
        for (var i = 0; i < this.dataSource.length; i++) {
            this.shuffledList.push(i);
        }
        if (arguments.length > 0) {
            var currentItem = this.shuffledList.splice(index, 1);
            slv_shuffle(this.shuffledList);
            this.shuffledList = currentItem.concat(this.shuffledList);
        } else {
            slv_shuffle(this.shuffledList);
        }

        function slv_shuffle(a) {
            for (var i = a.length - 1; i >= 1; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                if (j < i) {
                    var tmp = a[j];
                    a[j] = a[i];
                    a[i] = tmp;
                }
            }
        }
    },
    getMetadata: function pv_getMetadata(blob, callback) {
        AudioMetadata.parse(blob).then(pv_gotMetadata, pv_metadataError.bind(this));

        function pv_gotMetadata(metadata) {
            callback(metadata);
        }

        function pv_metadataError(e) {
            console.warn('parseAudioMetadata: error parsing metadata - ', e);
            if (this.onerror) {
                this.onerror(e);
            }
        }
    },
    setAudioSrc: function pv_setAudioSrc(file) {
        var url = URL.createObjectURL(file);
        this.playingBlob = file;
        this.audio.removeAttribute('src');
        this.audio.load();
        this.audio.mozAudioChannelType = 'content';
        this.audio.src = url;
        this.audio.load();
        this.audio.play();

        this.audio.onloadeddata = function(evt) {
            URL.revokeObjectURL(url);
        };
        this.audio.onerror = (function(evt) {
            if (this.onerror) {
                this.onerror(evt);
            }
        }).bind(this);
        this.setSeekBar(0, 0, 0);
        if (this.endedTimer) {
            clearTimeout(this.endedTimer);
            this.endedTimer = null;
        }
    },
    updateRemoteMetadata: function pv_updateRemoteMetadata() {
        if (typeof MusicComms === 'undefined' || this.dataSource.length === 0) {
            return;
        }
        var fileinfo = this.dataSource[this.currentIndex];
        var metadata = fileinfo.metadata;
        var notifyMetadata = {
            title: metadata.title || navigator.mozL10n.get('unknownTitle'),
            artist: metadata.artist || navigator.mozL10n.get('unknownArtist'),
            album: metadata.album || navigator.mozL10n.get('unknownAlbum'),
            duration: this.audio.duration * 1000,
            mediaNumber: this.currentIndex + 1,
            totalMediaCount: this.dataSource.length
        };
        if (this.audio.currentTime === 0) {
            AlbumArt.getCoverBlob(fileinfo).then(function(blob) {
                notifyMetadata.picture = blob;
                MusicComms.notifyMetadataChanged(notifyMetadata);
            });
        } else {
            MusicComms.notifyMetadataChanged(notifyMetadata);
        }
    },
    updateRemotePlayStatus: function pv_updateRemotePlayStatus() {
        if (typeof MusicComms === 'undefined') {
            return;
        }
        var position = this.pausedPosition ? this.pausedPosition : this.audio.currentTime;
        var info = {
            playStatus: this.playStatus,
            duration: this.audio.duration * 1000,
            position: position * 1000
        };
        this.pausedPosition = (this.playStatus === PLAYSTATUS_PLAYING) ? null : this.audio.currentTime;
        MusicComms.notifyStatusChanged(info);
    },
    getSongData: function pv_getSongData(index, callback) {
        var info = this.DBInfo;
        var songData = this.dataSource[index];
        if (songData) {
            callback(songData);
        } else {
            ListView.cancelEnumeration();
            var handle = musicdb.advancedEnumerate(info.key, info.range, info.direction, index, function(record) {
                musicdb.cancelEnumeration(handle);
                this.dataSource[index] = record;
                callback(record);
            }.bind(this));
        }
    },
    getFile: function pv_getFile(songData, callback) {
        musicdb.getFile(songData.name, callback, () => {
            this.dataSource.splice(this.currentIndex, 1);
            this.currentIndex--;
            this.next();
        });
        return;
    },
    PLAYER_IS_OCCUPIED_BY: 'music-player-is-occupied-by',
    _handleInterpageMessage: function(evt) {
        if (evt.key === this.PLAYER_IS_OCCUPIED_BY) {
            if (evt.newValue && evt.newValue !== location.href) {
                this.pause();
            }
        }
    },
    _sendInterpageMessage: function() {
        try {
            window.localStorage.setItem(this.PLAYER_IS_OCCUPIED_BY, location.href);
        } catch (err) {
            console.error('sendInterpageMessage: ', err);
        }
    },
    _clearInterpageMessage: function() {
        var whoIsPlaying = window.localStorage.getItem(this.PLAYER_IS_OCCUPIED_BY);
        if (whoIsPlaying && whoIsPlaying === window.location.href) {
            window.localStorage.removeItem(this.PLAYER_IS_OCCUPIED_BY);
        }
    },
    play: function pv_play(targetIndex, playFromList, isStatic, forcePlay) {
        window.performance.mark('music-play-start');
        this.checkSCOStatus();
        this._sendInterpageMessage();
        this.showInfo();
        targetIndex = targetIndex < 0 ? 0 : targetIndex;
        if (arguments.length > 0) {
            this.getSongData(targetIndex, function(songData) {
                this._playSongId = songData.id || '';
                this.currentIndex = targetIndex;
                this.setInfo(songData);
                songData.metadata.played++;
                musicdb.updateMetadata(songData.name, songData.metadata);
                if (!forcePlay && playFromList && this.playingBlob && songData.name === this.playingBlob.name) {
                    if (this.playStatus === PLAYSTATUS_PAUSED || this.playStatus === PLAYSTATUS_PLAYING) {
                        if (ListView.mode !== 'picker') {
                            this.audio.play();
                        }
                        return;
                    }
                }
                this.getFile(songData, function(file) {
                    this.setAudioSrc(file);
                    if (this.sourceType === TYPE_SINGLE || MusicComms.isSCOEnabled || isStatic) {
                        this.pause();
                    }
                }.bind(this));
            }.bind(this));
        } else if (this.sourceType === TYPE_BLOB && !this.audio.src) {
            this.getMetadata(this.dataSource, function(metadata) {
                this.setInfo({
                    metadata: metadata,
                    name: this.dataSource.name,
                    blob: this.dataSource
                });
                this.setAudioSrc(this.dataSource);
            }.bind(this));
        } else {
            this.audio.play();
        }
    },
    pause: function pv_pause() {
        window.performance.mark('music-pause-start');
        this.checkSCOStatus();
        this._clearInterpageMessage();
        this.audio.pause();
    },
    stop: function pv_stop(popview = false) {
        this.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.dataSourceBeforeStop = this.dataSource;
        this.indexBeforeStop = this.currentIndex;
        this.clean();
        this.playStatus = PLAYSTATUS_STOPPED;
        this.updateRemotePlayStatus();
        if (popview && ModeManager.currentMode === MODE_PLAYER) {
            if (ModeManager.prevMode === MODE_SUBLIST && SubListView.needReset) {
                SubListView.activate('list', SubListView.currentTarget, null, null, 'next', () => {
                    SubListView.needReset = false;
                    ModeManager.pop();
                });
            } else {
                ModeManager.pop();
            }
        }
    },
    next: function pv_next(isAutomatic) {
        window.performance.mark('music-next-start');
        if (this.sourceType === TYPE_BLOB || this.sourceType === TYPE_SINGLE) {
            this.setAudioSrc(this.playingBlob);
            this.pause();
            return;
        }
        var playingIndex = (this.shuffleOption) ? this.shuffleIndex : this.currentIndex;
        if (!(this.repeatOption === REPEAT_SONG && isAutomatic)) {
            if (playingIndex >= this.dataSource.length - 1) {
                if (this.repeatOption === REPEAT_LIST) {
                    if (this.shuffleOption) {
                        this.shuffleList(this.shuffledList[0]);
                    } else {
                        this.currentIndex = 0;
                    }
                } else {
                    this.stop(true);
                    return;
                }
            } else {
                if (this.shuffleOption) {
                    this.shuffleIndex++;
                } else {
                    this.currentIndex++;
                }
            }
        }
        var realIndex = (this.shuffleOption) ? this.shuffledList[this.shuffleIndex] : this.currentIndex;
        this.play(realIndex);
    },
    previous: function pv_previous() {
        if (this.audio.currentTime > 5) {
            this.play(this.currentIndex);
            return;
        }
        var playingIndex = (this.shuffleOption) ? this.shuffleIndex : this.currentIndex;
        if (playingIndex <= 0) {
            var newIndex = (this.repeatOption === REPEAT_LIST) ? this.dataSource.length - 1 : 0;
            if (this.shuffleOption) {
                this.shuffleIndex = newIndex;
            } else {
                this.currentIndex = newIndex;
            }
        } else {
            if (this.shuffleOption) {
                this.shuffleIndex--;
            } else {
                this.currentIndex--;
            }
        }
        var realIndex = (this.shuffleOption) ? this.shuffledList[this.shuffleIndex] : this.currentIndex;
        this.play(realIndex);
    },
    startFastSeeking: function pv_startFastSeeking(direction) {
        this.isTouching = this.isFastSeeking = true;
        var offset = direction * (this.audio.duration / 50 + 1);
        this.prevPlayStatus = this.playStatus;
        this.playStatus = direction ? PLAYSTATUS_FWD_SEEK : PLAYSTATUS_REV_SEEK;
        this.updateRemotePlayStatus();
        this.intervalID = window.setInterval(function() {
            var time = this.audio.currentTime + offset;
            if (time >= this.audio.duration) {
                this.stopFastSeekingFlag = true;
                this.stopFastSeeking();
                this.next(true);
            } else {
                this.seekAudio(time);
            }
        }.bind(this), 200);
    },
    stopFastSeeking: function pv_stopFastSeeking() {
        this.isTouching = this.isFastSeeking = false;
        if (this.intervalID) {
            window.clearInterval(this.intervalID);
        }
        this.playStatus = this.prevPlayStatus;
        this.prevPlayStatus = null;
        this.updateRemotePlayStatus();
    },
    updateSeekBar: function pv_updateSeekBar() {
        if (this.isTouching) {
            return;
        }
        if (typeof ModeManager === 'undefined' || ModeManager.currentMode === MODE_PLAYER) {
            this.seekAudio();
        }
    },
    seekAudio: function pv_seekAudio(seekTime) {
        if (seekTime !== undefined) {
            if (this.audio.readyState == 4) {
                this.audio.currentTime = Math.floor(seekTime);
            }
        }
        var startTime = this.audio.startTime;
        if (!startTime) {
            startTime = 0;
        }
        var endTime;
        if (isNaN(this.audio.duration)) {
            endTime = 0;
        } else if (this.audio.duration === Infinity) {
            endTime = (this.audio.buffered.length > 0) ? this.audio.buffered.end(this.audio.buffered.length - 1) : 0;
        } else {
            endTime = this.audio.duration;
        }
        var currentTime = this.audio.currentTime;
        this.setSeekBar(startTime, endTime, currentTime);
    },
    setSeekBar: function pv_setSeekBar(startTime, endTime, currentTime) {
        this.seekBar.min = startTime;
        this.seekBar.max = endTime;
        this.seekBar.value = currentTime;
        let displayTime = formatTime(currentTime);
        this.seekElapsed.textContent = displayTime;
        if (displayTime === '00:01') {
            if (window.performance.getEntriesByName('music-play-start', 'mark').length > 0) {
                window.performance.mark('music-play-end');
                window.performance.measure('performance-music-play', 'music-play-start', 'music-play-end');
                window.performance.clearMarks('music-play-start');
                window.performance.clearMarks('music-play-end');
            }
            if (window.performance.getEntriesByName('music-next-start', 'mark').length > 0) {
                window.performance.mark('music-next-end');
                window.performance.measure('performance-music-next', 'music-next-start', 'music-next-end');
                window.performance.clearMarks('music-next-start');
                window.performance.clearMarks('music-next-end');
            }
        }
        var remainingTime = endTime - currentTime;
        this.seekRemaining.textContent = (remainingTime > 0) ? '-' + formatTime(remainingTime) : '---:--';
    },
    handleEvent: function pv_handleEvent(evt) {
        var target = evt.target;
        if (!target) {
            return;
        }
        switch (evt.type) {
            case 'play':
                this.playStatus = PLAYSTATUS_PLAYING;
                this.updateRemotePlayStatus();
                ModeManager.updatePlayingIcon();
                break;
            case 'pause':
                this.playStatus = PLAYSTATUS_PAUSED;
                this.updateRemotePlayStatus();
                ModeManager.updatePlayingIcon();
                if (window.performance.getEntriesByName('music-pause-start', 'mark').length > 0) {
                    window.performance.mark('music-pause-end');
                    window.performance.measure('performance-music-pause', 'music-pause-start', 'music-pause-end');
                    window.performance.clearMarks('music-pause-start');
                    window.performance.clearMarks('music-pause-end');
                }
                break;
            case 'contextmenu':
                if (target.id === 'player-controls-next') {
                    this.startFastSeeking(1);
                } else if (target.id === 'player-controls-previous') {
                    this.startFastSeeking(-1);
                }
                break;
            case 'durationchange':
            case 'timeupdate':
                this.updateSeekBar();
                if (evt.type === 'durationchange' || this.audio.currentTime === 0) {
                    this.updateRemoteMetadata();
                }
                if (this.audio.currentTime >= this.audio.duration - 1 && this.endedTimer === null) {
                    var timeToNext = (this.audio.duration - this.audio.currentTime + 1);
                    this.endedTimer = setTimeout(function() {
                        this.next(true);
                    }.bind(this), timeToNext * 1000);
                }
                break;
            case 'ended':
                if (!this.endedTimer) {
                    this.next(true);
                }
                break;
            case 'visibilitychange':
                if (document.hidden) {
                    this.audio.removeEventListener('timeupdate', this);
                } else {
                    this.audio.addEventListener('timeupdate', this);
                    this.updateSeekBar();
                }
                break;
            case 'mozinterruptbegin':
                if (typeof MusicComms !== 'undefined') {
                    MusicComms.mozinterruptbegin = true;
                }
                this.playStatus = INTERRUPT_BEGIN;
                this.updateRemotePlayStatus();
                break;
            case 'mozinterruptend':
                if (typeof MusicComms !== 'undefined') {
                    MusicComms.mozinterruptbegin = false;
                }
                this.playStatus = PLAYSTATUS_PLAYING;
                this.updateRemotePlayStatus();
                this.unplugResolve && this.unplugResolve();
                break;
            case 'keydown':
                if (this.isFastSeeking) {
                    evt.preventDefault();
                    return;
                }
                switch (evt.key) {
                    case 'SoftLeft':
                        if (App.pendingPick) {
                            ModeManager.pop();
                        } else {
                            if (SubListView.needReset) {
                                SubListView.needReset = false;
                            }
                            if (SubListView.isInMyPlaylist) {
                                SubListView.listIndex = null;
                            }
                            TabBar.activeTab = 0;
                        }
                        break;
                    case 'SoftRight':
                        if (typeof App !== 'undefined' && App.pendingPick) {
                            var info = this.dataSource[this.currentIndex];
                            var playingBlob = this.playingBlob;
                            if (playingBlob.type === 'video/ogg') {
                                playingBlob = new File([playingBlob], playingBlob.name, {
                                    type: 'audio/ogg'
                                });
                            }
                            AlbumArt.getCoverBlob(info).then(function(picture) {
                                var currentMetadata = info.metadata;
                                App.pendingPick.postResult({
                                    type: playingBlob.type,
                                    blob: playingBlob,
                                    name: currentMetadata.title || '',
                                    metadata: {
                                        title: currentMetadata.title,
                                        artist: currentMetadata.artist,
                                        album: currentMetadata.album,
                                        picture: picture
                                    }
                                });
                                this.stop();
                            });
                        } else if (!this.noOptions) {
                            OptionMenu.show(this.buildOptionMenu(), () => {
                                this.view.focus();
                            });
                        }
                        break;
                    case 'Backspace':
                        if (this.isopenpick) {
                            return;
                        }
                        evt.preventDefault();
                        if (ModeManager.withRefresh) {
                            ModeManager._modeStack = [MODE_LIST, MODE_PLAYER];
                            ListView.navigator.destroy();
                            ListView.clean();
                            ModeManager.pop();
                            ListView.resetUI();
                        } else {
                            if (ModeManager.prevMode === MODE_SUBLIST && SubListView.needReset) {
                                SubListView.activate('list', SubListView.currentTarget, null, null, 'next', () => {
                                    SubListView.needReset = false;
                                    ModeManager.pop();
                                });
                            } else {
                                if (ListView.mode === 'picker') {
                                    this.pause();
                                }
                                ModeManager.pop();
                            }
                        }
                        break;
                    case 'Enter':
                    case 'HeadsetHook':
                        this.togglePlay();
                        break;
                    case 'ArrowUp':
                        navigator.volumeManager && navigator.volumeManager.requestUp();
                        evt.preventDefault();
                        break;
                    case 'ArrowDown':
                        navigator.volumeManager && navigator.volumeManager.requestDown();
                        evt.preventDefault();
                        break;
                    case 'ArrowLeft':
                    case 'ArrowRight':
                        if (!this.longPressTimer && !this.isFastSeeking) {
                            this.longPressTimer = window.setTimeout(() => {
                                var direction = 1;
                                if ((evt.key === 'ArrowLeft' && this.isLTR) || (evt.key === 'ArrowRight' && !this.isLTR)) {
                                    direction = -1;
                                }
                                this.startFastSeeking(direction);
                            }, 500);
                        }
                        break;
                }
                break;
            case 'keyup':
                if (this.longPressTimer) {
                    window.clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
                if ((evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') && this.isFastSeeking) {
                    this.stopFastSeeking();
                } else if (!this.isopenpick && !App.pendingPick) {
                    if (this.stopFastSeekingFlag) {
                        this.stopFastSeekingFlag = false;
                        return;
                    }
                    switch (evt.key) {
                        case 'ArrowLeft':
                            this.previous();
                            break;
                        case 'ArrowRight':
                            this.next();
                            break;
                    }
                }
                break;
            default:
                return;
        }
    },
    togglePlay: function pv_togglePlay() {
        if (this.playStatus === PLAYSTATUS_PLAYING) {
            this.pause();
        } else if (this.playStatus === PLAYSTATUS_STOPPED) {
            this.dataSource = this.dataSourceBeforeStop;
            this.play(this.indexBeforeStop, true);
        } else if (dongleState.canPlayByDongle) {
            playByDongle(this);
        } else {
            this.play();
        }
    },
    buildOptionMenu: function lv_buildOptionMenu() {
        if (this.isopenpick) {
            let options = [];
            if (allowSave) {
                options.push({
                    id: 'save',
                    callback: () => {
                        this.view.focus();
                        savemusic();
                    }
                });
            }
            if (!hasVolumeKey) {
                options.unshift({
                    id: 'opt-volume',
                    callback: () => {
                        navigator.volumeManager.requestShow();
                        this.view.focus();
                    }
                });
            }
            return options;
        }
        let optRepeat = {
            id: 'opt-repeat' + ['all', 'one', 'off'][this.repeatOption],
            callback: () => {
                this.setRepeat(++this.repeatOption % 3);
                this.view.focus();
            }
        };
        let optShare = {
            id: 'opt-share',
            callback: () => {
                this.view.focus();
                startActivity(this.dataSource[this.currentIndex], 'share');
            }
        };
        let optAddToPlaylist = {
            id: 'opt-addtoplaylist',
            callback: () => {
                let data = JSON.parse(JSON.stringify(this.dataSource[this.currentIndex]));
                data.id = createHash(HASH_NUM);
                toPlaylist.source.push(data);
                toPlaylist.state = true;
                SubListView.activate('lists', null, null, null, null, () => {
                    SubListView.mode = 'edit';
                    ModeManager.push(MODE_SUBLIST_LIST);
                });
            }
        };
        let optSetRingTone = {
            id: 'opt-setring',
            callback: () => {
                this.view.focus();
                startActivity(this.dataSource[this.currentIndex], 'setringtone');
            }
        };
        let options;
        let isGhost = this.currentIndex === -1 || ModeManager.withRefresh && this.dataSource[this.currentIndex] && this.playSongName !== this.dataSource[this.currentIndex].name;
        if (App.bLowMemoryDevice) {
            options = [];
        } else {
            options = isGhost ? [] : [optShare, optSetRingTone];
        }
        if (toPlaylist.enabled && !isGhost) {
            options.unshift(optRepeat, optAddToPlaylist);
        } else {
            options.unshift(optRepeat);
        }
        if (this.repeatOption !== 2) {
            options.unshift({
                id: this.shuffleOption ? 'opt-shuffleoff' : 'opt-shuffleon',
                callback: () => {
                    this.setShuffle(!this.shuffleOption, true);
                    this.view.focus();
                }
            });
        }
        if (!hasVolumeKey) {
            options.unshift({
                id: 'opt-volume',
                callback: () => {
                    navigator.volumeManager.requestShow();
                    this.view.focus();
                }
            });
        }
        return options;
    },
    updateL10n: function pv_updateL10n() {
        this.isLTR = navigator.mozL10n.language.direction === 'ltr' ? true : false;
    },
};
navigator.hasFeature('device.capability.volume-key').then((hasVolumeKey) => {
    window.hasVolumeKey = hasVolumeKey;
});