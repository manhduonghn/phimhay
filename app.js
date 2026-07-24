// ============== CẤU HÌNH ĐƯỜNG DẪN ==============
// Nếu deploy tại: https://username.github.io/ -> BASE_PATH = ""
// Nếu deploy tại: https://username.github.io/phim/ -> BASE_PATH = "/phim"
const BASE_PATH = "/phimhay"; // <== ĐỔI THÀNH "" NẾU DEPLOY Ở GỐC DOMAIN

const API_BASE = "https://phimapi.com";
const appDiv = document.getElementById('app');

// Khởi tạo Router
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Cập nhật link logo
document.getElementById('logo-link').href = `#${BASE_PATH}/`;

async function router() {
    let hash = window.location.hash.slice(1);
    
    // Xóa BASE_PATH khỏi hash để parse routing
    if (hash.startsWith(BASE_PATH)) {
        hash = hash.replace(BASE_PATH, '');
    }
    
    const paths = hash.split('/').filter(Boolean);
    appDiv.innerHTML = `<div class="loader">Đang tải...</div>`;

    try {
        if (paths.length === 0) {
            await renderHome();
        } 
        else if (paths[0] === 'type' && paths[1]) {
            await renderList(paths[1]);
        }
        else if (paths[0] === 'search' && paths[1]) {
            await renderSearch(paths[1]);
        }
        else if (paths[0] === 'phim' && paths[1]) {
            await renderDetail(paths[1]);
        }
        else {
            appDiv.innerHTML = `<h1>404 - Trang không tồn tại</h1>`;
        }
    } catch (error) {
        console.error(error);
        appDiv.innerHTML = `<h1>Lỗi tải dữ liệu. Vui lòng thử lại.</h1>`;
    }
}

// ==================== CÁC HÀM RENDER ====================

async function renderHome() {
    const res = await fetch(`${API_BASE}/v1/api/home`);
    const data = await res.json();
    
    let html = `<h1 class="section-title">Phim Mới Cập Nhật</h1><div class="movie-grid">`;
    data.data.items.forEach(movie => {
        html += createMovieCard(movie);
    });
    html += `</div>`;
    appDiv.innerHTML = html;
}

async function renderList(type) {
    const res = await fetch(`${API_BASE}/v1/api/danh-sach/${type}`);
    const data = await res.json();
    
    let html = `<h1 class="section-title">Danh sách: ${type.replace(/-/g, ' ')}</h1><div class="movie-grid">`;
    data.data.items.forEach(movie => {
        html += createMovieCard(movie);
    });
    html += `</div>`;
    appDiv.innerHTML = html;
}

async function renderDetail(slug) {
    const res = await fetch(`${API_BASE}/phim/${slug}`);
    const data = await res.json();
    
    if(!data.movie) {
        appDiv.innerHTML = `<h1>Không tìm thấy phim</h1>`;
        return;
    }

    const movie = data.movie;
    const episodes = data.episodes; 

    let html = `
        <div class="detail-banner" style="background: url('${API_BASE}/${movie.thumb_url}') center/cover no-repeat;">
            <div class="detail-content">
                <img src="${API_BASE}/${movie.poster_url}" alt="${movie.name}">
                <div class="detail-info">
                    <h1>${movie.name}</h1>
                    <p><strong>Năm:</strong> ${movie.year} | <strong>Thời lượng:</strong> ${movie.time} | <strong>Chất lượng:</strong> ${movie.quality}</p>
                    <p class="description">${movie.content || 'Chưa có mô tả cho phim này.'}</p>
                    <button class="play-btn" onclick="openPlayer()">▶ Xem Phim Ngay</button>
                </div>
            </div>
        </div>
    `;
    
    appDiv.innerHTML = html;
    window.currentMovieData = data;
}

// ==================== PLAYER VÀ XỬ LÝ M3U8 ====================

let hls = null;

window.openPlayer = function() {
    const modal = document.getElementById('player-modal');
    const data = window.currentMovieData;
    
    if(!data || !data.episodes || data.episodes.length === 0) {
        alert("Không có dữ liệu tập phim!");
        return;
    }

    const firstServer = data.episodes[0];
    const firstEp = firstServer.items[0];
    
    renderPlayerUI(firstServer, firstEp, data.episodes);
    playVideo(firstEp.link_m3u8); // Gọi link m3u8

    modal.style.display = "block";
    document.body.style.overflow = 'hidden'; // Ẩn scroll body
}

function renderPlayerUI(activeServer, activeEp, allServers) {
    const container = document.getElementById('server-ep-container');
    let html = `
        <div>
            <h3 style="margin-bottom: 10px; color: #fff;">Servers (Đang xem: ${activeServer.server_name})</h3>
            <div class="server-group">
                ${allServers.map(sv => `
                    <button class="server-btn ${sv.server_name === activeServer.server_name ? 'active' : ''}" 
                            onclick="changeServer('${sv.server_name}')">${sv.server_name}</button>
                `).join('')}
            </div>
        </div>
        <div>
            <h3 style="margin-bottom: 10px; color: #fff;">Tập phim (Đang xem: ${activeEp.name})</h3>
            <div class="ep-group">
                ${activeServer.items.map(ep => `
                    <button class="ep-btn ${ep.name === activeEp.name ? 'active' : ''}" 
                            onclick="changeEpisode('${ep.name}')">${ep.name}</button>
                `).join('')}
            </div>
        </div>
    `;
    container.innerHTML = html;
}

window.changeServer = function(serverName) {
    const data = window.currentMovieData;
    const newServer = data.episodes.find(sv => sv.server_name === serverName);
    if(newServer) {
        const firstEp = newServer.items[0];
        renderPlayerUI(newServer, firstEp, data.episodes);
        playVideo(firstEp.link_m3u8);
    }
}

window.changeEpisode = function(epName) {
    const data = window.currentMovieData;
    const activeServerBtn = document.querySelector('.server-btn.active');
    const activeServerName = activeServerBtn ? activeServerBtn.innerText : data.episodes[0].server_name;
    const activeServer = data.episodes.find(sv => sv.server_name === activeServerName);
    
    const newEp = activeServer.items.find(ep => ep.name === epName);
    if(newEp) {
        renderPlayerUI(activeServer, newEp, data.episodes);
        playVideo(newEp.link_m3u8);
    }
}

function playVideo(url) {
    const video = document.getElementById('video-player');
    if (!video) return;

    // Dọn dẹp Hls cũ
    if (hls) { 
        hls.destroy(); 
        hls = null; 
    }

    if (url) {
        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log("Autoplay bị chặn bởi trình duyệt"));
            });
        } 
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native Safari
            video.src = url;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay bị chặn bởi trình duyệt"));
            });
        }
    }
}

// Đóng modal
document.querySelector('.close-btn').addEventListener('click', () => {
    const modal = document.getElementById('player-modal');
    modal.style.display = "none";
    document.body.style.overflow = 'auto'; // Hiện lại scroll body
    
    const video = document.getElementById('video-player');
    if(video) video.pause(); 
    if(hls) { hls.destroy(); hls = null; }
});

// ==================== HELPER ====================

function createMovieCard(movie) {
    const thumb = movie.poster_url || movie.thumb_url;
    return `
        <a href="#${BASE_PATH}/phim/${movie.slug}" class="movie-card">
            <img src="${API_BASE}/${thumb}" alt="${movie.name}" loading="lazy">
            <div class="info">
                <h3>${movie.name}</h3>
                <p>${movie.year} - ${movie.episode_current || movie.episode_total}</p>
            </div>
        </a>
    `;
}

document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyword = document.getElementById('search-input').value.trim();
    if(keyword) {
        window.location.hash = `${BASE_PATH}/search/${keyword}`;
    }
});

async function renderSearch(keyword) {
    const res = await fetch(`${API_BASE}/v1/api/tim-kiem?keyword=${keyword}&limit=24`);
    const data = await res.json();
    let html = `<h1 class="section-title">Kết quả tìm kiếm: ${keyword}</h1>`;
    if(data.data.items && data.data.items.length > 0) {
        html += `<div class="movie-grid">`;
        data.data.items.forEach(movie => {
            html += createMovieCard(movie);
        });
        html += `</div>`;
    } else {
        html += `<p>Không tìm thấy phim nào phù hợp.</p>`;
    }
    appDiv.innerHTML = html;
}
