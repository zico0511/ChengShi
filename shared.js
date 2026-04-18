// shared.js
// 包含全站通用的 Firebase 初始化與 UI 邏輯

// 1. Firebase 初始化與全域變數掛載
(function() {
  function initFirebase() {
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
      if (!firebase.apps.length) {
        try {
          firebase.initializeApp(firebaseConfig);
        } catch (err) {
          console.error("Firebase initialization failed:", err);
        }
      }
    }
  }

  // 立即嘗試初始化
  initFirebase();
  
  // 掛載全域服務，使用 getter 確保始終獲取最新狀態且延遲求值
  if (!window.db_initialized) {
    const services = ['db', 'auth', 'storage'];
    const firebaseMap = { 'db': 'firestore', 'auth': 'auth', 'storage': 'storage' };
    
    services.forEach(s => {
      Object.defineProperty(window, s, {
        get: function() {
          if (typeof firebase !== 'undefined' && typeof firebase[firebaseMap[s]] === 'function') {
            // 如果還沒初始化且有 config，嘗試初始化
            if (!firebase.apps.length && typeof firebaseConfig !== 'undefined') {
              firebase.initializeApp(firebaseConfig);
            }
            return firebase[firebaseMap[s]]();
          }
          return null;
        },
        configurable: true
      });
    });
    window.db_initialized = true;
  }
})();

// 保留這幾個常數以維持舊代碼相容性 (改為使用 getter，避免立即求值失敗)
Object.defineProperty(window, 'db_const', { get: () => window.db });
Object.defineProperty(window, 'auth_const', { get: () => window.auth });
Object.defineProperty(window, 'storage_const', { get: () => window.storage });

// 為了相容性，如果原本代碼使用了 const db = window.db; 這種寫法
// 我們無法直接讓 const db 變成響應式的，但我們可以確保在頁面腳本執行前，window.db 是可用的。

// 通用 UI 控制
function handleNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', handleNavbarScroll);

// 聯絡人資訊 (統一管理)
const CONTACTS = {
  hsu: {
    name: "許先生",
    phone: "0936-890-239",
    lineId: "zico0511",
    lineLink: "https://line.me/ti/p/~zico0511"
  },
  lin: {
    name: "林主任",
    phone: "0908-788-922",
    lineId: "t0908788922",
    lineLink: "https://line.me/ti/p/~t0908788922"
  }
};

// --- 通用房源詳情彈窗邏輯 ---
let currentPhotoList = [];
let currentPhotoIdx = 0;
let touchStartX = 0;
let touchEndX = 0;

function openImgPreview(src, photoList) {
  if (!src) return;
  currentPhotoList = photoList || [src];
  currentPhotoIdx = currentPhotoList.indexOf(src);
  if (currentPhotoIdx === -1) currentPhotoIdx = 0;
  
  const previewEl = document.getElementById('imgPreview');
  if (!previewEl) return;

  updatePreviewImg();
  previewEl.style.display = 'flex';
  
  previewEl.addEventListener('touchstart', (e) => touchStartX = e.changedTouches[0].screenX, false);
  previewEl.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) changeImg(1);
    if (touchEndX > touchStartX + swipeThreshold) changeImg(-1);
  }, false);
}

function updatePreviewImg() {
  const img = document.getElementById('previewImg');
  const spinner = document.getElementById('imgSpinner');
  if (!img) return;
  
  img.classList.add('loading');
  if (spinner) spinner.style.display = 'block';
  
  img.src = currentPhotoList[currentPhotoIdx];
  img.onload = () => {
    img.classList.remove('loading');
    if (spinner) spinner.style.display = 'none';
    preloadNextImage();
  };
}

function preloadNextImage() {
  if (currentPhotoList.length <= 1) return;
  const nextIdx = (currentPhotoIdx + 1) % currentPhotoList.length;
  const prevIdx = (currentPhotoIdx - 1 + currentPhotoList.length) % currentPhotoList.length;
  [nextIdx, prevIdx].forEach(idx => {
    const img = new Image();
    img.src = currentPhotoList[idx];
  });
}

function changeImg(step) {
  currentPhotoIdx = (currentPhotoIdx + step + currentPhotoList.length) % currentPhotoList.length;
  updatePreviewImg();
}

function closeImgPreview() {
  const previewEl = document.getElementById('imgPreview');
  if (previewEl) previewEl.style.display = 'none';
}

function showDetail(house) {
  if (!house) return;
  const modal = document.getElementById('detailModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;

  let photosHtml = '';
  if (house.photos && house.photos.length > 0) {
    photosHtml = '<div class="modal-photos">';
    const photoListJson = JSON.stringify(house.photos).replace(/'/g, "\\'");
    house.photos.forEach(p => {
      photosHtml += `<img src="${p}" onclick='event.stopPropagation(); openImgPreview("${p}", ${photoListJson})' title="點擊放大圖片">`;
    });
    photosHtml += '</div>';
  }

  let videoHtml = '';
  if (house.video) {
    if (house.video.includes('youtube.com') || house.video.includes('youtu.be')) {
      let videoId = house.video.includes('v=') ? house.video.split('v=')[1].split('&')[0] : house.video.split('/').pop();
      videoHtml = `<div class="modal-video"><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius: 8px;"></iframe></div>`;
    } else {
      videoHtml = `<div class="modal-video"><video controls width="100%" playsinline><source src="${house.video}" type="video/mp4">您的瀏覽器不支援影片播放。</video></div>`;
    }
  }

  const addressHtml = house.address ? `<span class="map-link" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(house.address)}', '_blank')">📍 ${house.address} (點擊導航)</span>` : '未填寫';

  content.innerHTML = `
    ${photosHtml}
    ${videoHtml}
    <h3 style="margin: 15px 0 10px 0; color: var(--color-primary);">${house.title}</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95rem; line-height: 1.8;">
      <p><strong>📍 區域：</strong>${house.area || '未填'}</p>
      <p><strong>💰 租金：</strong><span style="color: #e53e3e; font-weight: bold;">${house.price || 0}</span> 元/月</p>
      <p><strong>🏢 樓層：</strong>${house.floor || '未填'}</p>
      <p><strong>📏 坪數：</strong>${house.size || 0} 坪</p>
      <p><strong>🚗 車位：</strong>${house.park || '無'}</p>
      <p><strong>🛗 電梯：</strong>${house.elevator || '無'}</p>
      <p><strong>🐾 寵物：</strong>${house.pet || '不可'}</p>
      <p><strong>💰 租補：</strong>${house.subsidy || '禁'}</p>
      <p><strong>🌐 網路：</strong>${house.internet || '無'}</p>
      <p><strong>📺 第四台：</strong>${house.cable || '無'}</p>
      <p><strong>🔥 瓦斯：</strong>${house.gas || '無'}</p>
    </div>
    <p style="margin-top: 10px;"><strong>🏠 地址：</strong>${addressHtml}</p>
    <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
      <p><strong>📝 詳細說明：</strong></p>
      <div class="modal-desc">${house.desc || house.description || '無詳細說明'}</div>
    </div>
    <div style="margin-top: 20px; border-top: 2px solid var(--color-primary); padding-top: 15px;">
      <p style="font-weight: bold; color: var(--color-primary); margin-bottom: 10px;">📞 立即預約看房</p>
      ${generateContactButtonsHtml()}
    </div>
  `;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// 點擊彈窗外關閉
window.addEventListener('click', (e) => {
  const detailModal = document.getElementById('detailModal');
  const imgPreview = document.getElementById('imgPreview');
  if (e.target === detailModal) closeModal();
  if (e.target === imgPreview) closeImgPreview();
});

// 鍵盤控制
window.addEventListener('keydown', (e) => {
  const imgPreview = document.getElementById('imgPreview');
  if (imgPreview && imgPreview.style.display === 'flex') {
    if (e.key === 'ArrowLeft') changeImg(-1);
    if (e.key === 'ArrowRight') changeImg(1);
    if (e.key === 'Escape') closeImgPreview();
  } else if (e.key === 'Escape') {
    closeModal();
  }
});

// 生成聯絡按鈕 HTML
function generateContactButtonsHtml() {
  // 移除電話中的橫線以便撥號
  const hsuPhoneRaw = CONTACTS.hsu.phone.replace(/-/g, '');
  const linPhoneRaw = CONTACTS.lin.phone.replace(/-/g, '');

  return `
    <div class="contact-btn-group">
      <a href="tel:${hsuPhoneRaw}" class="btn btn-phone">📞 ${CONTACTS.hsu.name} ${CONTACTS.hsu.phone}</a>
      <a href="${CONTACTS.hsu.lineLink}" target="_blank" class="btn btn-line">💬 ${CONTACTS.hsu.name} Line</a>
      <a href="tel:${linPhoneRaw}" class="btn btn-phone">📞 ${CONTACTS.lin.name} ${CONTACTS.lin.phone}</a>
      <a href="${CONTACTS.lin.lineLink}" target="_blank" class="btn btn-line">💬 ${CONTACTS.lin.name} Line</a>
    </div>
  `;
}
