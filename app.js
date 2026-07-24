// Cấu hình API
const API_BASE = "https://phimapi.com";
const appDiv = document.getElementById('app');

// Khởi tạo Router dựa trên Hash (#)
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

async function router() {
    const hash = window.location.hash.slice(1) || '/';
    const paths = hash.split('/').filter(Boolean);

    appDiv.innerHTML = `<div class="loader">Đang tải...</div>`;

    try {
        if (paths.length === 0) {
            await renderHome();
        } 
        else if (paths[0] === 'type' && paths[1]) {
            // Ví dụ: #/type/phim-bo?page=2 (Xử lý query nếu có)
            await renderList(paths[1]);
        }
        else if (paths[0] === 'the-loai' && paths[1]) {
            await renderCategory(paths[1]);
        }
        else if (paths[0] === 'quoc-gia' && paths[1]) {
            await renderCountry(paths[1]);
        }
        else if (paths[0] === 'search' && paths[1]) {
            await renderSearch(paths[1]);
        }
        else if (paths[0] === 'phim' && paths[1]) {
            // Ví dụ: #/phim/tro-choi-con-muc
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

// 1. Trang Chủ
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

// 2. Danh sách theo type (phim-bo, phim-le...)
async function renderList(type) {
    const res = await fetch(`${API_BASE}/v1/api/danh-sach/${type}`);
    const data = await res.json();
    
    let html = `<h1 class="section-title">Danh sách: ${type.toUpperCase()}</h1><div class="movie-grid">`;
    data.data.items.forEach(movie => {
        html += createMovieCard(movie);
    });
    html += `</div>`;
    appDiv.innerHTML = html;
}

// 3. Chi tiết Phim
async function renderDetail(slug) {
    const res = await fetch(`${API_BASE}/phim/${slug}`);
    const data = await res.json();
    const movie = data.movie;
    const episodes = data.episodes; // Mảng các server tập

    let html = `
        <div class="detail-banner" style="background: url('${movie.poster_url || movie.thumb_url}') center/cover no-repeat;">
            <div class="detail-content">
                <img src="${movie.poster_url || movie.thumb_url}" alt="${movie.name}">
                <div class="detail-info">
                    <h1>${movie.name}</h1>
                    <p><strong>Tên gốc:</strong> ${movie.origin_name}</p>
                    <p><strong>Năm:</strong> ${movie.year} | <strong>Thời lượng:</strong> ${movie.time}</p>
                    <p>${movie.content}</p>
                    <button class="play-btn" onclick="openPlayer()">▶ Xem Phim</button>
                </div>
            </div>
        </div>
    `;
    
    appDiv.innerHTML = html;

    // Lưu dữ liệu server/tập vào window để hàm openPlayer sử dụng
    window.currentMovieData = data;
}

// ==================== PLAYER VÀ XỬ LÝ M3U8 ====================

let hls = null;
let currentVideoUrl = '';
let currentEpData = null;

window.openPlayer = function() {
    const modal = document.getElementById('player-modal');
    const container = document.getElementById('player-container');
    const data = window.currentMovieData;
    
    if(!data || !data.episodes || data.episodes.length === 0) {
        alert("Không có dữ liệu tập phim!");
        return;
    }

    // Mặc định load server đầu tiên, tập đầu tiên
    const firstServer = data.episodes[0];
    const firstEp = firstServer.items[0];
    
    renderPlayerUI(firstServer, firstEp, data.episodes);
    playVideo(firstEp.link_m3u8); // PLAY LINK M3U8 THẬT

    modal.style.display = "block";
}

function renderPlayerUI(activeServer, activeEp, allServers) {
    const container = document.getElementById('player-container');
    let html = `
        <video id="video-player" controls autoplay></video>
        <div class="server-ep-container">
            <div>
                <h3>Servers (Đang xem: ${activeServer.server_name})</h3>
                <div class="server-group">
                    ${allServers.map(sv => `
                        <button class="server-btn ${sv.server_name === activeServer.server_name ? 'active' : ''}" 
                                onclick="changeServer('${sv.server_name}')">${sv.server_name}</button>
                    `).join('')}
                </div>
            </div>
            <div>
                <h3>Tập phim (Đang xem: ${activeEp.name})</h3>
                <div class="ep-group">
                    ${activeServer.items.map(ep => `
                        <button class="ep-btn ${ep.name === activeEp.name ? 'active' : ''}" 
                                onclick="changeEpisode('${ep.name}')">${ep.name}</button>
                    `).join('')}
                </div>
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
    // Tìm server đang active (dựa vào nút đang có class 'active')
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

    // Hủy HLS cũ nếu có
    if (hls) { hls.destroy(); hls = null; }

    if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play();
        });
    } 
    // Cho Safari (native support HLS)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
            video.play();
        });
    }
}

// Đóng modal player
document.querySelector('.close-btn').addEventListener('click', () => {
    const modal = document.getElementById('player-modal');
    modal.style.display = "none";
    const video = document.getElementById('video-player');
    if(video) video.pause(); // Dừng video khi đóng
    if(hls) { hls.destroy(); hls = null; }
});

// ==================== HELPER ====================

function createMovieCard(movie) {
    return `
        <a href="#/phim/${movie.slug}" class="movie-card">
            <img src="${movie.poster_url || movie.thumb_url}" alt="${movie.name}">
            <div class="info">
                <h3>${movie.name}</h3>
                <p>${movie.year} - ${movie.episode_current || movie.episode_total}</p>
            </div>
        </a>
    `;
}

// Xử lý form search
document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyword = document.getElementById('search-input').value.trim();
    if(keyword) {
        window.location.hash = `#/search/${keyword}`;
    }
});

async function renderSearch(keyword) {
    const res = await fetch(`${API_BASE}/v1/api/tim-kiem?keyword=${keyword}&page=1`);
    const data = await res.json();
    let html = `<h1 class="section-title">Kết quả tìm kiếm: ${keyword}</h1>`;
    if(data.data.items.length > 0) {
        html += `<div class="movie-grid">`;
        data.data.items.forEach(movie => {
            html += createMovieCard(movie);
        });
        html += `</div>`;
    } else {
        html += `<p>Không tìm thấy phim nào.</p>`;
    }
    appDiv.innerHTML = html;
}
