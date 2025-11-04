// UI要素参照
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
// const cropRange = document.getElementById('cropRange'); // 切り抜きUIは非表示（コメントアウト）
/* const cropValue = document.getElementById('cropValue'); */ // 非表示
const opacityRange = document.getElementById('opacityRange');
const opacityValue = document.getElementById('opacityValue');
const warningArea = document.getElementById('warningArea');
const errorArea = document.getElementById('errorArea');
const resultArea = document.getElementById('result');
const usageArea = document.getElementById('usage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// デフォルト値調整（デフォルト速度を0.2秒 = 200ms に設定）
if (speedRange) speedRange.value = 200;
speedValue.textContent = `${(speedRange.value / 1000).toFixed(1)}秒`;
/* cropValue.textContent = `${cropRange.value}px`; */ // 非表示
opacityValue.textContent = `${opacityRange.value}%`;

// スライダーイベント
speedRange.addEventListener('input', () => {
  speedValue.textContent = `${(speedRange.value / 1000).toFixed(1)}秒`;
});
/*
cropRange.addEventListener('input', () => {
  cropValue.textContent = `${cropRange.value}px`;
});
*/
opacityRange.addEventListener('input', () => {
  opacityValue.textContent = `${opacityRange.value}%`;
});

// wheel support
function enableWheelControl(slider, step = 1, min = null, max = null, displayFn = null) {
  slider.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    let value = parseInt(slider.value);
    value -= delta * step;
    if (min !== null) value = Math.max(min, value);
    if (max !== null) value = Math.min(max, value);
    slider.value = value;
    if (displayFn) displayFn();
  });
}
enableWheelControl(speedRange, 100, 100, 1000, () => {
  speedValue.textContent = `${(speedRange.value / 1000).toFixed(1)}秒`;
});
/* enableWheelControl(cropRange, 1, -64, 64, () => {
  cropValue.textContent = `${cropRange.value}px`;
}); */ // 切り抜きUI非表示のため無効化
enableWheelControl(opacityRange, 1, 0, 100, () => {
  opacityValue.textContent = `${opacityRange.value}%`;
});

// UI 表示ユーティリティ
function showWarning(msg) { if (warningArea) warningArea.textContent = msg; }
function clearWarning() { if (warningArea) warningArea.textContent = ''; }
function showError(msg) { if (errorArea) errorArea.textContent = msg; console.error(msg); }
function clearError() { if (errorArea) errorArea.textContent = ''; }

// 利用ヒント（usage 下に表示する小さな注意書き）
function ensureUsageHint() {
  if (!usageArea) return;
  // 既に追加済みならスキップ
  if (document.getElementById('usageTip')) return;
  const tip = document.createElement('div');
  tip.id = 'usageTip';
  tip.style.marginTop = '0.5em';
  tip.style.fontSize = '0.95em';
  tip.style.color = '#333';
  tip.innerHTML = `
    <strong>ヒント:</strong> 立体感の出やすい被写体（建造物やはっきり輪郭のあるオブジェクト）を、画像の中心に配置したMPOで試してください。左右の視差が小さい画像や被写体が遠すぎる画像は立体感が出にくいです。
  `;
  usageArea.appendChild(tip);
}
ensureUsageHint();

// -------------------------
// MPO -> JPEG 抽出フォールバック実装
// 外部 mpo.js / azo_mpotojpg.js がグローバル関数を提供していればそちらを使う。
// なければ簡易SOI/EOI分割でJPEGを取り出す（完全なMPF解析ではない）。
// -------------------------
function fallbackMpoToJpegs(uint8arr) {
  const arr = uint8arr;
  const n = arr.length;
  const imgs = [];
  let i = 0;
  while (i < n - 1) {
    if (arr[i] === 0xFF && arr[i+1] === 0xD8) {
      const start = i;
      i += 2;
      while (i < n - 1) {
        if (arr[i] === 0xFF && arr[i+1] === 0xD9) {
          const end = i + 2;
          imgs.push(arr.slice(start, end));
          i = end;
          break;
        }
        i++;
      }
    } else {
      i++;
    }
  }
  return imgs;
}

function extractJpegsFromMpo(uint8arr) {
  if (typeof window.azo_mpotojpg === 'function') {
    try {
      return window.azo_mpotojpg(uint8arr);
    } catch (err) {
      console.warn('azo_mpotojpg 呼び出しで例外。フォールバックを使用します。', err);
      return fallbackMpoToJpegs(uint8arr);
    }
  } else if (typeof window.mpoToJpegs === 'function') {
    try {
      return window.mpoToJpegs(uint8arr);
    } catch (err) {
      console.warn('mpoToJpegs 呼び出しで例外。フォールバックを使用します。', err);
      return fallbackMpoToJpegs(uint8arr);
    }
  } else {
    console.warn('MPO抽出ライブラリが見つかりません。フォールバックで JPEG を抽出します。');
    return fallbackMpoToJpegs(uint8arr);
  }
}

// 視差推定
function estimateOffset(leftImg, rightImg, maxRange = 64, sampleStep = 4, edgeMargin = 64) {
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  const width = Math.min(leftImg.width, rightImg.width);
  const height = Math.min(leftImg.height, rightImg.height);
  tmp.width = width;
  tmp.height = height;

  tctx.clearRect(0,0,width,height);
  tctx.drawImage(leftImg,0,0,width,height);
  const leftData = tctx.getImageData(0,0,width,height).data;

  tctx.clearRect(0,0,width,height);
  tctx.drawImage(rightImg,0,0,width,height);
  const rightData = tctx.getImageData(0,0,width,height).data;

  let best = 0;
  let minDiff = Infinity;
  for (let offset = -maxRange; offset <= maxRange; offset++) {
    let diff = 0;
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = edgeMargin; x < width - edgeMargin; x += sampleStep) {
        const lx = x, rx = x + offset;
        if (rx < 0 || rx >= width) continue;
        const li = (y * width + lx) * 4;
        const ri = (y * width + rx) * 4;
        diff += Math.abs(leftData[li] - rightData[ri]);
        diff += Math.abs(leftData[li+1] - rightData[ri+1]);
        diff += Math.abs(leftData[li+2] - rightData[ri+2]);
      }
    }
    if (diff < minDiff) { minDiff = diff; best = offset; }
  }

  console.log(`🔍 推定オフセット(raw): ${best}px diff=${minDiff}`);
  const adjusted = -best;
  if (Math.abs(best) === maxRange) {
    showWarning(`⚠️ 推定は探索限界に到達しました（±${maxRange}px）。3D視差が検出できない可能性があります。`);
  } else {
    clearWarning();
  }
  return adjusted;
}

// 描画（crop は現在 UI 非表示のため常に 0 を使う）
function drawCroppedToCanvas(img, dx, cropPx, targetW, targetH) {
  const cropLeft = Math.max(0, cropPx + (dx > 0 ? dx : 0));
  const cropRight = Math.max(0, cropPx - (dx < 0 ? dx : 0));
  const sx = cropLeft;
  const sw = img.width - cropLeft - cropRight;
  if (sw <= 0) return;
  ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, targetW, targetH);
}

// GIF 生成メイン
async function generateStereoGifFromMpoArrayBuffer(arrayBuffer) {
  clearError();
  clearWarning();
  resultArea.innerHTML = '処理中...';

  const uint8 = new Uint8Array(arrayBuffer);
  const images = extractJpegsFromMpo(uint8);

  if (!images || images.length < 2) {
    showError('MPO から左右画像を抽出できませんでした（抽出結果が 2 枚未満）。mpo.js を同一フォルダに置くか、MPOの中身を確認してください。');
    resultArea.innerHTML = '';
    return;
  }

  // Blob -> Image
  const blobs = images.map(b => new Blob([b], { type: 'image/jpeg' }));
  const urls = blobs.map(b => URL.createObjectURL(b));
  const imgPromises = urls.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  }));
  const imgElements = await Promise.all(imgPromises);
  if (!imgElements[0] || !imgElements[1]) {
    showError('左右画像の読み込みに失敗しました。MPOの中身を確認してください。');
    resultArea.innerHTML = '';
    return;
  }

  const leftImg = imgElements[0];
  const rightImg = imgElements[1];

  // Canvas をソースサイズに合わせる（3DSは 640x480 が想定）
  canvas.width = leftImg.width || 640;
  canvas.height = leftImg.height || 480;

  // 簡易判定：3DS由来の可能性が低い場合に注意喚起
  // 目安: 3DSは通常640x480。サイズが大きく異なる場合や縦横比が違う場合に警告を出す。
  if (!((leftImg.width === 640 && leftImg.height === 480) || (rightImg.width === 640 && rightImg.height === 480))) {
    showWarning('注意: このMPOは3DS以外の可能性があります。本ツールは3DS向けのMPOを想定しています。期待どおりに立体化しないことがあります。');
  }

  const offset = estimateOffset(leftImg, rightImg, 64, 4, 64);

  const delay = parseInt(speedRange.value); // ms
  const crop = 0; // 切り抜き機能はUI非表示のため固定
  const opacity = parseInt(opacityRange.value) / 100;

  // gif.js が存在するか確認
  if (typeof GIF !== 'function') {
    showError('gif.js が読み込まれていません。gif.js と gif.worker.js を同一フォルダに配置してください。');
    resultArea.innerHTML = '';
    return;
  }

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    workerScript: './gif.worker.js',
    repeat: 0
  });

  gif.on('finished', blob => {
    const gifUrl = URL.createObjectURL(blob);
    resultArea.innerHTML = `<img src="${gifUrl}" alt="ステレオGIF"><br><a id="downloadBtn" href="${gifUrl}" download="stereo.gif">GIFをダウンロード</a>`;
  });

  async function addFrame(drawFn, label) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawFn();
    await new Promise(r => setTimeout(r, 50));
    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    await new Promise(r => img.onload = r);
    gif.addFrame(img, { delay });
    console.log('frame:', label);
  }

  await addFrame(() => {
    ctx.globalAlpha = 1.0;
    drawCroppedToCanvas(rightImg, -offset, crop, canvas.width, canvas.height);
  }, '右目');

  await addFrame(() => {
    ctx.globalAlpha = 1.0;
    drawCroppedToCanvas(rightImg, -offset, crop, canvas.width, canvas.height);
    ctx.globalAlpha = opacity;
    drawCroppedToCanvas(leftImg, offset, crop, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  }, '右に左を重ね');

  await addFrame(() => {
    ctx.globalAlpha = 1.0;
    drawCroppedToCanvas(leftImg, offset, crop, canvas.width, canvas.height);
  }, '左目');

  await addFrame(() => {
    ctx.globalAlpha = 1.0;
    drawCroppedToCanvas(leftImg, offset, crop, canvas.width, canvas.height);
    ctx.globalAlpha = opacity;
    drawCroppedToCanvas(rightImg, -offset, crop, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  }, '左に右を重ね');

  gif.render();
}

// ファイル選択→処理開始
document.getElementById('generateBtn').addEventListener('click', () => {
  clearError();
  clearWarning();
  resultArea.innerHTML = '';

  const fileInput = document.getElementById('mpoInput');
  const file = fileInput.files[0];
  if (!file) {
    showError('MPOファイルを選択してください。');
    return;
  }

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      await generateStereoGifFromMpoArrayBuffer(e.target.result);
    } catch (err) {
      showError('処理中に例外が発生しました。コンソールを確認してください。');
      console.error(err);
      resultArea.innerHTML = '';
    }
  };
  reader.onerror = err => {
    showError('ファイル読み込みに失敗しました。');
    console.error(err);
    resultArea.innerHTML = '';
  };
  reader.readAsArrayBuffer(file);
});

// --- 備忘録 ---
// 切り抜き（crop）機能は現在 UI から非表示にしています。
// 将来的に復帰させる場合:
// 1) HTML に切り抜きスライダーを戻す（id="cropRange" と id="cropValue"）
// 2) 上部のコメントアウトを解除し、cropRange の値を crop 変数に反映する
// 3) enableWheelControl で微調整を有効化する