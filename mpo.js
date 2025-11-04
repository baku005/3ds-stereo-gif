// 3D pictuer file(.mpo) viewer (c) 2016 AZO

// azo_search : search target from buffer.
// param 1 : Uint8Array buffer
// param 2 : Uint8Array target
// return : Uint32Array foundlocates
function azo_search(i_u8aBuffer, i_u8aTarget) {
	var uiLocate = 0; uiLocate >>> 0;
	var res = [];

	if(i_u8aTarget.length == 0) {
		return;
	}
	while(uiLocate <= i_u8aBuffer.length - i_u8aTarget.length) {
		var add = 0;
		var mat = 1;
		for(var i = 0; i < i_u8aTarget.length; i++) {
			if(i_u8aTarget[0] == i_u8aBuffer[uiLocate + i]) {
				add = i;
			}
			if(i_u8aTarget[i] != i_u8aBuffer[uiLocate + i]) {
				mat = 0;
			}
			if(add != 0 && mat == 0) {
				break;
			}
		}
		if(mat == 1) {
			res.push(uiLocate);
		}
		if(add == 0) {
			add = i_u8aTarget.length;
		}
		uiLocate += add;
	}

	return res;
}

// azo_memcpy : copy part of buffer.
// param 1 : Uint8Array buffer
// param 2 : uint start locate
// param 3 : uint length
// return : Uint8Array OutputBuffer
function azo_memcpy(i_u8aBuffer, i_Start, i_Length) {
	i_Start >>> 0;
	i_Length >>> 0;
	var res = [];
	if(i_Start >= i_u8aBuffer.length) {
		return;
	}
	if(i_Start + i_Length > i_u8aBuffer.length) {
		i_Length = i_u8aBuffer.length - i_Start;
	}
	if(i_Length != 0) {
		res = i_u8aBuffer.slice(i_Start, i_Start + i_Length);
	}

	return res;
}

// azo_mpotojpg : MPO to JPEGs.
// param 1 : Uint8Array MPO
// return : Array(Uint8Array) JPEGs
function azo_mpotojpg(i_u8aMPO) {
	var pat = [0xFF, 0xD8, 0xFF, 0xE1];
	var soi = azo_search(i_u8aMPO, pat);
	if(soi.length == 0) {
		pat = [0xFF, 0xD8, 0xFF, 0xE0];
		soi = azo_search(i_u8aMPO, pat);
		if(soi.length == 0) {
			pat = [0xFF, 0xD8, 0xFF, 0xDB];
			soi = azo_search(i_u8aMPO, pat);
		}
	}
	var jpg;
	var res = [];
	for(var i = 0; i < soi.length; i++) {
		if(i + 1 < soi.length) {
			jpg = azo_memcpy(i_u8aMPO, soi[i], soi[i + 1]);
		} else {
			jpg = azo_memcpy(i_u8aMPO, soi[i], i_u8aMPO.length - soi[i]);
		}
		if(jpg) {
			res.push(jpg);
		}
	}

	return res;
}


// azo_get : Get http request.
// param 1 : URL
// param 2 : ResponseType
// return : ArrayBuffer
function azo_httpget(i_strURL, i_strResponseType) {
	return new Promise(function(resolve, reject) {
		var oXHR = new XMLHttpRequest();
		oXHR.open('GET', i_strURL);
		oXHR.responseType = i_strResponseType;
		oXHR.onload = function() {
			if(oXHR.status == 200) {
				resolve(oXHR.response);
			} else {
				reject(Error(oXHR.statusText));
			}
		};
		oXHR.onerror = function() {
			reject(Error("Network Error"));
		};
		oXHR.send();
	});
}


function azo_urltofilename(i_strURL)
{
	return i_strURL.substring(i_strURL.lastIndexOf('/') + 1); 
}


function azo_urltobasefilename(i_strURL)
{
	i_strURL = i_strURL.substring(i_strURL.lastIndexOf('/') + 1); 
	if(i_strURL.lastIndexOf('.') != -1) {
		i_strURL = i_strURL.substring(0, i_strURL.lastIndexOf('.'));
	}
	return i_strURL;
}


// tick class
function azo_tick() {
	oTick.Tick();
}

AZO_Tick = function(i_iMS) {
	if(i_iMS < 0) {
		i_iMS = 0;
	}
	this.iMS = i_iMS;
	this.bDrive = false;
	this.funcaHandlers = [];
	this.oaParam1 = [];
};

AZO_Tick.prototype.AddHandler = function(i_funcHandler, i_param1) {
	if(i_funcHandler) {
		this.funcaHandlers.push(i_funcHandler);
		this.oaParam1.push(i_param1);
	}
};

AZO_Tick.prototype.RemoveHandler = function(i_funcHandler, i_param1) {
	var iaIndexes = [];

	for(var i = 0; i < this.funcaHandlers.length; i++) {
		if(i_funcHandler === this.funcaHandlers[i] && i_param1 == this.oaParam1[i]) {
			iaIndexes.push(i);
		}
	}
	for(var i = iaIndexes.length - 1; i >= 0; i--) {
		this.funcaHandlers.splice(iaIndexes[i], 1) ;
	}
};

AZO_Tick.prototype.RemoveAllHandler = function() {
	this.Stop();
	this.funcaHandlers = [];
};

AZO_Tick.prototype.Start = function() {
	if(this.iMS > 0) {
		this.bDrive = true;
		this.oIntervalId = setInterval(azo_tick, this.iMS);
	}
};

AZO_Tick.prototype.Stop = function() {
	this.bDrive = false;
	clearInterval(this.oIntervalId);
};

AZO_Tick.prototype.Tick = function() {
	if(this.bDrive) {
		for(var i = 0; i < this.funcaHandlers.length; i++) {
			this.funcaHandlers[i](this.oaParam1[i]);
		}
	}
};


// MPO class
AZO_MPO = function(i_iType, i_strOutputId, i_funcCallback, i_Data) {
	this.oaBlob = [];
	this.oaImage = [];

	this.init(i_iType, i_strOutputId, i_funcCallback, i_Data);
};

AZO_MPO.prototype.init = function(i_iType, i_strOutputId, i_funcCallback, i_Data) {
	this.bProblem = true;
	if(!i_Data) {
		return;
	}

	if(i_iType == 0) {
		var u8aMPO = new Uint8Array(i_Data);
		var u8aPictures = azo_mpotojpg(u8aMPO);
		this.straBlobURLs = [];
		for(var i = 0; i < u8aPictures.length; i++) {
			var blob = new Blob([u8aPictures[i]], {type: 'image\/jpeg'});
			this.oaBlob.push(blob);
			var bloburl = window.URL.createObjectURL(blob);
			this.straBlobURLs.push(bloburl);
			var oImage = new Image();
			oImage.src = bloburl;
			this.oaImage.push(oImage);
		}
		if(u8aPictures.length > 0) {
			this.bProblem = false;
		}
		this.oaImage[this.oaImage.length - 1].onload = function() {
			i_funcCallback(i_strOutputId);
		};
	} else if(i_iType == 1) {
		this.strMPOURL = i_Data;
		var oMPO = this;
		azo_httpget(i_Data, 'arraybuffer').then(function(response) {
			var u8aMPO = new Uint8Array(response);
			var u8aPictures = azo_mpotojpg(u8aMPO);
			oMPO.straBlobURLs = [];
			for(var i = 0; i < u8aPictures.length; i++) {
				var blob = new Blob([u8aPictures[i]], {type: 'image\/jpeg'});
				oMPO.oaBlob.push(blob);
				var bloburl = window.URL.createObjectURL(blob);
				oMPO.straBlobURLs.push(bloburl);
				var oImage = new Image();
				oImage.src = bloburl;
				oMPO.oaImage.push(oImage);
			}
			if(u8aPictures.length > 0) {
				oMPO.bProblem = false;
			}
			oMPO.oaImage[oMPO.oaImage.length - 1].onload = function() {
				i_funcCallback(i_strOutputId);
			};
		}, function(error) {
			;
		});
	}
};

AZO_MPO.prototype.getBlobURLs = function() {
	return this.straBlobURLs;
};


// MPO local parallel view class
AZO_MPOLocalParallelView = function(i_iWidth, i_bReverse) {
	this.iWidth = i_iWidth;
	this.bReverse = i_bReverse;
	this.oMPO = null;
};

AZO_MPO_LocalParallelViewControl = function() {
	this.doMPOLocalParallelView = {};
};

AZO_MPO_LocalParallelViewControl.prototype.AddControl = function(i_strOutputId, i_iWidth, i_bReverse) {
	this.doMPOLocalParallelView[i_strOutputId] = new AZO_MPOLocalParallelView(i_iWidth, i_bReverse);

	var elmMPOLocalParallelFileSelect = document.getElementById([i_strOutputId, '_fileselect'].join(''));
	if(!elmMPOLocalParallelFileSelect) {
		return;
	}
	var child;
	while(child = elmMPOLocalParallelFileSelect.lastChild) elmMPOLocalParallelFileSelect.removeChild(child);
	var eTag;
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'file');
	eTag.setAttribute('id', [i_strOutputId, '_file'].join(''));
	eTag.setAttribute('accept', '.mpo');
	eTag.setAttribute('onchange', 'oMPOLocalParallelViewControl.OpenFile(this);');
	elmMPOLocalParallelFileSelect.appendChild(eTag);
};

AZO_MPO_LocalParallelViewControl.prototype.OpenFile = function(i_elmFileSelect) {
	var reader = new FileReader();
	reader.readAsArrayBuffer(i_elmFileSelect.files[0]);
	reader.onloadend = function(evt) {
		if(evt.target.readyState == FileReader.DONE) {
			var strOutputId = i_elmFileSelect.id.substring(0, i_elmFileSelect.id.length - 5);
			var oMPOLocalParallelView = oMPOLocalParallelViewControl.doMPOLocalParallelView[strOutputId];
			var funcCallback = function(id) {
				oMPOLocalParallelViewControl.Update(id);
			};
			oMPOLocalParallelView.oMPO = new AZO_MPO(0, strOutputId, funcCallback, evt.target.result);
		}
	}
};

AZO_MPO_LocalParallelViewControl.prototype.Update = function(i_strOutputId) {
	var oMPOLocalParallelView = this.doMPOLocalParallelView[i_strOutputId];
	if(!oMPOLocalParallelView) {
		return;
	}

	var elmMPOLocalParallelView = document.getElementById(i_strOutputId);
	if(!elmMPOLocalParallelView) {
		return;
	}
	var child;
	while(child = elmMPOLocalParallelView.lastChild) elmMPOLocalParallelView.removeChild(child);

	var eTag;
	eTag = document.createElement('img');
	if(oMPOLocalParallelView.bReverse) {
		eTag.setAttribute('src', oMPOLocalParallelView.oMPO.straBlobURLs[1]);
	} else {
		eTag.setAttribute('src', oMPOLocalParallelView.oMPO.straBlobURLs[0]);
	}
	eTag.setAttribute('width', oMPOLocalParallelView.iWidth);
	elmMPOLocalParallelView.appendChild(eTag);
	elmMPOLocalParallelView.appendChild(document.createTextNode(' '));
	eTag = document.createElement('img');
	if(oMPOLocalParallelView.bReverse) {
		eTag.setAttribute('src', oMPOLocalParallelView.oMPO.straBlobURLs[0]);
	} else {
		eTag.setAttribute('src', oMPOLocalParallelView.oMPO.straBlobURLs[1]);
	}
	eTag.setAttribute('width', oMPOLocalParallelView.iWidth);
	elmMPOLocalParallelView.appendChild(eTag);
	eTag = document.createElement('br');
	elmMPOLocalParallelView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_check'].join(''));
	eTag.checked = oMPOLocalParallelView.bReverse;
	eTag.setAttribute('onclick', 'oMPOLocalParallelViewControl.doMPOLocalParallelView[this.id.substring(0, this.id.length - 6)].bReverse = this.checked; oMPOLocalParallelViewControl.Update(this.id.substring(0, this.id.length - 6));');
	elmMPOLocalParallelView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_check'].join(''));
	eTag.innerText = 'reverse';
	elmMPOLocalParallelView.appendChild(eTag);
	elmMPOLocalParallelView.appendChild(document.createTextNode(' width'));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'number');
	eTag.setAttribute('id', [i_strOutputId, '_width'].join(''));
	eTag.setAttribute('min', '0');
	eTag.setAttribute('max', '5000');
	eTag.setAttribute('step', '50');
	eTag.setAttribute('value', oMPOLocalParallelView.iWidth);
	elmMPOLocalParallelView.appendChild(eTag);
	elmMPOLocalParallelView.appendChild(document.createTextNode('px '));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'button');
	eTag.setAttribute('id', [i_strOutputId, '_update'].join(''));
	eTag.setAttribute('value', 'update');
	eTag.setAttribute('onclick', ['oMPOLocalParallelViewControl.doMPOLocalParallelView[this.id.substring(0, this.id.length - 7)].iWidth = document.getElementById(\'', i_strOutputId, '_width\').value; oMPOLocalParallelViewControl.Update(this.id.substring(0, this.id.length - 7));'].join(''));
	elmMPOLocalParallelView.appendChild(eTag);
};


// MPO parallel view class
AZO_MPOParallelView = function(i_strOutputId, i_strMPOURL, i_iWidth, i_bReverse) {
	this.strOutputId = i_strOutputId;
	var funcCallback = function(id) {
		oMPOParallelViewControl.Update(id);
	};
	this.oMPO = new AZO_MPO(1, i_strOutputId, funcCallback, i_strMPOURL);
	this.iWidth = i_iWidth;
	this.bReverse = i_bReverse;
};

AZO_MPO_ParallelViewControl = function() {
	this.doMPOParallelView = {};
};

AZO_MPO_ParallelViewControl.prototype.AddControl = function(i_strOutputId, i_strMPOURL, i_iWidth, i_bReverse) {
	this.doMPOParallelView[i_strOutputId] = new AZO_MPOParallelView(i_strOutputId, i_strMPOURL, i_iWidth, i_bReverse);
};

AZO_MPO_ParallelViewControl.prototype.Update = function(i_strOutputId) {
	var oMPOParallelView = this.doMPOParallelView[i_strOutputId];
	if(!oMPOParallelView) {
		return;
	}

	var elmMPOParallelView = document.getElementById(i_strOutputId);
	if(!elmMPOParallelView) {
		return;
	}
	var child;
	while(child = elmMPOParallelView.lastChild) elmMPOParallelView.removeChild(child);

	var eTag;
	eTag = document.createElement('img');
	if(oMPOParallelView.bReverse) {
		eTag.setAttribute('src', oMPOParallelView.oMPO.straBlobURLs[1]);
	} else {
		eTag.setAttribute('src', oMPOParallelView.oMPO.straBlobURLs[0]);
	}
	eTag.setAttribute('width', oMPOParallelView.iWidth);
	elmMPOParallelView.appendChild(eTag);
	elmMPOParallelView.appendChild(document.createTextNode(' '));
	eTag = document.createElement('img');
	if(oMPOParallelView.bReverse) {
		eTag.setAttribute('src', oMPOParallelView.oMPO.straBlobURLs[0]);
	} else {
		eTag.setAttribute('src', oMPOParallelView.oMPO.straBlobURLs[1]);
	}
	eTag.setAttribute('width', oMPOParallelView.iWidth);
	elmMPOParallelView.appendChild(eTag);
	eTag = document.createElement('br');
	elmMPOParallelView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_check'].join(''));
	eTag.checked = oMPOParallelView.bReverse;
	eTag.setAttribute('onclick', 'oMPOParallelViewControl.doMPOParallelView[this.id.substring(0, this.id.length - 6)].bReverse = this.checked; oMPOParallelViewControl.Update(this.id.substring(0, this.id.length - 6));');
	elmMPOParallelView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_check'].join(''));
	eTag.innerText = 'reverse';
	elmMPOParallelView.appendChild(eTag);
	eTag = document.createTextNode(' ');
	elmMPOParallelView.appendChild(eTag);
	eTag = document.createElement('a');
	eTag.setAttribute('href', oMPOParallelView.oMPO.strMPOURL);
	eTag.setAttribute('download', azo_urltofilename(oMPOParallelView.oMPO.strMPOURL));
	eTag.innerText = 'click to download MPO file';
	elmMPOParallelView.appendChild(eTag);
};


// MPO local animation view class
AZO_MPOLocalAnimationView = function(i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing) {
	this.iWidth = i_iWidth;
	if(i_iHeight < 0) {
		i_iHeight = 0;
	}
	this.iHeight = i_iHeight;
	if(i_iXDifferemce > i_iWidth) {
		i_iXDifferemce = i_iWidth;
	} else if(i_iXDifferemce < i_iWidth * -1) {
		i_iXDifferemce = i_iWidth * -1;
	}
	this.iXDifferemce = i_iXDifferemce;
	if(i_iPeriod < 1) {
		i_iPeriod = 1;
	}
	this.iPeriod = i_iPeriod;
	this.bAnimation = i_bAnimation;
	this.bSmoothing = i_bSmoothing;
	this.iStart = 0;
	this.iNow = 0;
	this.oMPO = null;
};

AZO_MPO_LocalAnimationViewControl = function() {
	this.doMPOLocalAnimationView = {};
};

AZO_MPO_LocalAnimationViewControl.prototype.AddControl = function(i_strOutputId, i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing) {
	this.doMPOLocalAnimationView[i_strOutputId] = new AZO_MPOLocalAnimationView(i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing);

	var elmMPOLocalAnimationFileSelect = document.getElementById([i_strOutputId, '_fileselect'].join(''));
	if(!elmMPOLocalAnimationFileSelect) {
		return;
	}
	var child;
	while(child = elmMPOLocalAnimationFileSelect.lastChild) elmMPOLocalAnimationFileSelect.removeChild(child);
	var eTag;
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'file');
	eTag.setAttribute('id', [i_strOutputId, '_file'].join(''));
	eTag.setAttribute('accept', '.mpo');
	eTag.setAttribute('onchange', 'oMPOLocalAnimationViewControl.OpenFile(this);');
	elmMPOLocalAnimationFileSelect.appendChild(eTag);
};

AZO_MPO_LocalAnimationViewControl.prototype.OpenFile = function(i_elmFileSelect) {
	var reader = new FileReader();
	reader.readAsArrayBuffer(i_elmFileSelect.files[0]);
	reader.onloadend = function(evt) {
		if(evt.target.readyState == FileReader.DONE) {
			var strOutputId = i_elmFileSelect.id.substring(0, i_elmFileSelect.id.length - 5);
			var oMPOLocalAnimationView = oMPOLocalAnimationViewControl.doMPOLocalAnimationView[strOutputId];
			var funcCallback = function(id) {
				oMPOLocalAnimationViewControl.Update(id);
			};
			oMPOLocalAnimationView.oMPO = new AZO_MPO(0, strOutputId, funcCallback, evt.target.result);
		}
	}
};

AZO_MPO_LocalAnimationViewControl.prototype.Update = function(i_strOutputId) {
	oMPOLocalAnimationView = this.doMPOLocalAnimationView[i_strOutputId];
	if(!oMPOLocalAnimationView) {
		return;
	}
	if(oMPOLocalAnimationView.bAnimation) {
		oMPOLocalAnimationView.iStart = Date.now();
	} else {
		oMPOLocalAnimationView.iStart = 0;
	}
	oMPOLocalAnimationView.iNow = this.iStart;

	var elmMPOLocalAnimationView = document.getElementById(i_strOutputId);
	if(!elmMPOLocalAnimationView) {
		return;
	}
	var child;
	while(child = elmMPOLocalAnimationView.lastChild) elmMPOLocalAnimationView.removeChild(child);

	var eTag;
	eTag = document.createElement('canvas');
	eTag.setAttribute('width', oMPOLocalAnimationView.iWidth - Math.abs(oMPOLocalAnimationView.iXDifferemce));
	eTag.setAttribute('height', oMPOLocalAnimationView.iHeight);
	eTag.setAttribute('id', [i_strOutputId, '_canvas'].join(''));
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createElement('br');
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_anime'].join(''));
	eTag.checked = oMPOLocalAnimationView.bAnimation;
	eTag.setAttribute('onclick', 'oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 6)].bAnimation = this.checked; oMPOLocalAnimationViewControl.Tick(this.id.substring(0, this.id.length - 6));');
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_anime'].join(''));
	eTag.innerText = 'animation';
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createTextNode(' ');
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_smooth'].join(''));
	eTag.checked = oMPOLocalAnimationView.bSmoothing;
	eTag.setAttribute('onclick', 'oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 7)].bSmoothing = this.checked; oMPOLocalAnimationViewControl.Tick(this.id.substring(0, this.id.length - 7));');
	elmMPOLocalAnimationView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_smooth'].join(''));
	eTag.innerText = 'smoothing';
	elmMPOLocalAnimationView.appendChild(eTag);
	elmMPOLocalAnimationView.appendChild(document.createTextNode(' width'));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'number');
	eTag.setAttribute('id', [i_strOutputId, '_width'].join(''));
	eTag.setAttribute('min', '0');
	eTag.setAttribute('max', '5000');
	eTag.setAttribute('step', '50');
	eTag.setAttribute('value', oMPOLocalAnimationView.iWidth);
	elmMPOLocalAnimationView.appendChild(eTag);
	elmMPOLocalAnimationView.appendChild(document.createTextNode('px '));
	elmMPOLocalAnimationView.appendChild(document.createTextNode(' height'));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'number');
	eTag.setAttribute('id', [i_strOutputId, '_height'].join(''));
	eTag.setAttribute('min', '0');
	eTag.setAttribute('max', '5000');
	eTag.setAttribute('step', '50');
	eTag.setAttribute('value', oMPOLocalAnimationView.iHeight);
	elmMPOLocalAnimationView.appendChild(eTag);
	elmMPOLocalAnimationView.appendChild(document.createTextNode('px '));
	elmMPOLocalAnimationView.appendChild(document.createTextNode(' xdiff'));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'number');
	eTag.setAttribute('id', [i_strOutputId, '_xdiff'].join(''));
	eTag.setAttribute('min', '-5000');
	eTag.setAttribute('max', '5000');
	eTag.setAttribute('step', '1');
	eTag.setAttribute('value', oMPOLocalAnimationView.iXDifferemce);
	elmMPOLocalAnimationView.appendChild(eTag);
	elmMPOLocalAnimationView.appendChild(document.createTextNode('px '));
	elmMPOLocalAnimationView.appendChild(document.createTextNode(' period'));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'number');
	eTag.setAttribute('id', [i_strOutputId, '_period'].join(''));
	eTag.setAttribute('min', '1');
	eTag.setAttribute('max', '1000');
	eTag.setAttribute('step', '10');
	eTag.setAttribute('value', oMPOLocalAnimationView.iPeriod);
	elmMPOLocalAnimationView.appendChild(eTag);
	elmMPOLocalAnimationView.appendChild(document.createTextNode('ms '));
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'button');
	eTag.setAttribute('id', [i_strOutputId, '_update'].join(''));
	eTag.setAttribute('value', 'update');
	eTag.setAttribute('onclick', ['oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 7)].iWidth = document.getElementById(\'', i_strOutputId, '_width\').value; oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 7)].iHeight = document.getElementById(\'', i_strOutputId, '_height\').value; oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 7)].iXDifferemce = document.getElementById(\'', i_strOutputId, '_xdiff\').value; oMPOLocalAnimationViewControl.doMPOLocalAnimationView[this.id.substring(0, this.id.length - 7)].iPeriod = document.getElementById(\'', i_strOutputId, '_period\').value; oMPOLocalAnimationViewControl.Update(this.id.substring(0, this.id.length - 7));'].join(''));
	elmMPOLocalAnimationView.appendChild(eTag);

	if(oMPOLocalAnimationView.bAnimation) {
		oTick.AddHandler(this.Tick, i_strOutputId);
		oTick.Start();
	} else {
		oTick.RemoveHandler(this.Tick, i_strOutputId);
		this.Tick();
	}
};

AZO_MPO_LocalAnimationViewControl.prototype.Tick = function(i_strOutputId) {
	var oMPOLocalAnimationView = oMPOLocalAnimationViewControl.doMPOLocalAnimationView[i_strOutputId];
	if(!oMPOLocalAnimationView) {
		return;
	}
	if(oMPOLocalAnimationView.bAnimation) {
		oMPOLocalAnimationView.iNow = Date.now();
	} else {
		oMPOLocalAnimationView.iNow = 0;
	}
	var iTime = (oMPOLocalAnimationView.iNow - oMPOLocalAnimationView.iStart) % oMPOLocalAnimationView.iPeriod;
	var iAlpha2 = iTime / oMPOLocalAnimationView.iPeriod;
	if(!oMPOLocalAnimationView.bSmoothing) {
		if(iAlpha2 < 0.5) {
			iAlpha2 = 0;
		} else {
			iAlpha2 = 1;
		}
	}
	var iAlpha1 = 1.0 - iAlpha2;

	var elmMPOLocalAnimationCanvas = document.getElementById([i_strOutputId, '_canvas'].join(''));
	if(!elmMPOLocalAnimationCanvas) {
		return;
	}
	var c = elmMPOLocalAnimationCanvas.getContext('2d');
	if(!c) {
		return;
	}
	c.globalAlpha = iAlpha1;
	if(oMPOLocalAnimationView.iXDifferemce >= 0) {
		c.drawImage(oMPOLocalAnimationView.oMPO.oaImage[0], oMPOLocalAnimationView.iXDifferemce * -1, 0, oMPOLocalAnimationView.iWidth, oMPOLocalAnimationView.iHeight);
	} else {
		c.drawImage(oMPOLocalAnimationView.oMPO.oaImage[0], 0, 0, oMPOLocalAnimationView.iWidth, oMPOLocalAnimationView.iHeight);
	}
	c.globalAlpha = iAlpha2;
	if(oMPOLocalAnimationView.iXDifferemce >= 0) {
		c.drawImage(oMPOLocalAnimationView.oMPO.oaImage[1], 0, 0, oMPOLocalAnimationView.iWidth, oMPOLocalAnimationView.iHeight);
	} else {
		c.drawImage(oMPOLocalAnimationView.oMPO.oaImage[1], oMPOLocalAnimationView.iXDifferemce, 0, oMPOLocalAnimationView.iWidth, oMPOLocalAnimationView.iHeight);
	}
};


// MPO animation view class
AZO_MPOAnimationView = function(i_strOutputId, i_strMPOURL, i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing) {
	this.strOutputId = i_strOutputId;
	var funcCallback = function(id) {
		oMPOAnimationViewControl.Update(id);
	};
	this.oMPO = new AZO_MPO(1, i_strOutputId, funcCallback, i_strMPOURL);
	if(i_iWidth < 0) {
		i_iWidth = 0;
	}
	this.iWidth = i_iWidth;
	if(i_iHeight < 0) {
		i_iHeight = 0;
	}
	this.iHeight = i_iHeight;
	if(i_iXDifferemce > i_iWidth) {
		i_iXDifferemce = i_iWidth;
	} else if(i_iXDifferemce < i_iWidth * -1) {
		i_iXDifferemce = i_iWidth * -1;
	}
	this.iXDifferemce = i_iXDifferemce;
	if(i_iPeriod < 1) {
		i_iPeriod = 1;
	}
	this.iPeriod = i_iPeriod;
	this.bAnimation = i_bAnimation;
	this.bSmoothing = i_bSmoothing;
	this.iStart = 0;
	this.iNow = 0;
};

AZO_MPO_AnimationViewControl = function() {
	this.doMPOAnimationView = {};
};

AZO_MPO_AnimationViewControl.prototype.AddControl = function(i_strOutputId, i_strMPOURL, i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing) {
	this.doMPOAnimationView[i_strOutputId] = new AZO_MPOAnimationView(i_strOutputId, i_strMPOURL, i_iWidth, i_iHeight, i_iXDifferemce, i_iPeriod, i_bAnimation, i_bSmoothing);
};

AZO_MPO_AnimationViewControl.prototype.Update = function(i_strOutputId) {
	oMPOAnimationView = this.doMPOAnimationView[i_strOutputId];
	if(!oMPOAnimationView) {
		return;
	}
	if(oMPOAnimationView.bAnimation) {
		oMPOAnimationView.iStart = Date.now();
	} else {
		oMPOAnimationView.iStart = 0;
	}
	oMPOAnimationView.iNow = this.iStart;

	var elmMPOAnimationView = document.getElementById(i_strOutputId);
	if(!elmMPOAnimationView) {
		return;
	}
	var child;
	while(child = elmMPOAnimationView.lastChild) elmMPOAnimationView.removeChild(child);

	var eTag;
	eTag = document.createElement('canvas');
	eTag.setAttribute('width', oMPOAnimationView.iWidth - Math.abs(oMPOAnimationView.iXDifferemce));
	eTag.setAttribute('height', oMPOAnimationView.iHeight);
	eTag.setAttribute('id', [i_strOutputId, '_canvas'].join(''));
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('br');
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_anime'].join(''));
	eTag.checked = oMPOAnimationView.bAnimation;
	eTag.setAttribute('onclick', 'oMPOAnimationViewControl.doMPOAnimationView[this.id.substring(0, this.id.length - 6)].bAnimation = this.checked; oMPOAnimationViewControl.Tick(this.id.substring(0, this.id.length - 6));');
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_anime'].join(''));
	eTag.innerText = 'animation';
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createTextNode(' ');
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('input');
	eTag.setAttribute('type', 'checkbox');
	eTag.setAttribute('id', [i_strOutputId, '_smooth'].join(''));
	eTag.checked = oMPOAnimationView.bSmoothing;
	eTag.setAttribute('onclick', 'oMPOAnimationViewControl.doMPOAnimationView[this.id.substring(0, this.id.length - 7)].bSmoothing = this.checked; oMPOAnimationViewControl.Tick(this.id.substring(0, this.id.length - 7));');
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('label');
	eTag.setAttribute('for', [i_strOutputId, '_smooth'].join(''));
	eTag.innerText = 'smoothing';
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createTextNode(' ');
	elmMPOAnimationView.appendChild(eTag);
	eTag = document.createElement('a');
	eTag.setAttribute('href', oMPOAnimationView.oMPO.strMPOURL);
	eTag.setAttribute('download', azo_urltofilename(oMPOAnimationView.oMPO.strMPOURL));
	eTag.innerText = 'click to download MPO file';
	elmMPOAnimationView.appendChild(eTag);

	if(oMPOAnimationView.bAnimation) {
		oTick.AddHandler(this.Tick, i_strOutputId);
		oTick.Start();
	} else {
		oTick.RemoveHandler(this.Tick, i_strOutputId);
		this.Tick();
	}
};

AZO_MPO_AnimationViewControl.prototype.Tick = function(i_strOutputId) {
	var oMPOAnimationView = oMPOAnimationViewControl.doMPOAnimationView[i_strOutputId];
	if(!oMPOAnimationView) {
		return;
	}
	if(oMPOAnimationView.bAnimation) {
		oMPOAnimationView.iNow = Date.now();
	} else {
		oMPOAnimationView.iNow = 0;
	}
	var iTime = (oMPOAnimationView.iNow - oMPOAnimationView.iStart) % oMPOAnimationView.iPeriod;
	var iAlpha2 = iTime / oMPOAnimationView.iPeriod;
	if(!oMPOAnimationView.bSmoothing) {
		if(iAlpha2 < 0.5) {
			iAlpha2 = 0;
		} else {
			iAlpha2 = 1;
		}
	} else {
		iAlpha2 *= 2;
		iAlpha2 = 1 - (iAlpha2 - 1);
	}
	var iAlpha1 = 1.0 - iAlpha2;

	var elmMPOAnimationCanvas = document.getElementById([i_strOutputId, '_canvas'].join(''));
	if(!elmMPOAnimationCanvas) {
		return;
	}
	var c = elmMPOAnimationCanvas.getContext('2d');
	if(!c) {
		return;
	}
	c.globalAlpha = iAlpha1;
	if(oMPOAnimationView.iXDifferemce >= 0) {
		c.drawImage(oMPOAnimationView.oMPO.oaImage[0], oMPOAnimationView.iXDifferemce * -1, 0, oMPOAnimationView.iWidth, oMPOAnimationView.iHeight);
	} else {
		c.drawImage(oMPOAnimationView.oMPO.oaImage[0], 0, 0, oMPOAnimationView.iWidth, oMPOAnimationView.iHeight);
	}
	c.globalAlpha = iAlpha2;
	if(oMPOAnimationView.iXDifferemce >= 0) {
		c.drawImage(oMPOAnimationView.oMPO.oaImage[1], 0, 0, oMPOAnimationView.iWidth, oMPOAnimationView.iHeight);
	} else {
		c.drawImage(oMPOAnimationView.oMPO.oaImage[1], oMPOAnimationView.iXDifferemce, 0, oMPOAnimationView.iWidth, oMPOAnimationView.iHeight);
	}
};


// implementation
var oTick = new AZO_Tick(32);
var oMPOLocalParallelViewControl = new AZO_MPO_LocalParallelViewControl();
var oMPOParallelViewControl = new AZO_MPO_ParallelViewControl();
var oMPOLocalAnimationViewControl = new AZO_MPO_LocalAnimationViewControl();
var oMPOAnimationViewControl = new AZO_MPO_AnimationViewControl();
