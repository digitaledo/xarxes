const SUPABASE_URL = 'https://igvpxbefxrebxndjwolc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mbbHsnAep3if_N5DnfNFJA_kDz-0lQJ';
let supabaseClient;
let userRole = "";
let selectedFilesToUpload = [];
let currentPage = 1;
const itemsPerPage = 5;
let hasMorePosts = false;
let showingArchived = false;
let defaultHashtags = "#someugenidors #escolaeugenidors #Valls #Educació";
let defaultProjects = "CETE+, Escola verda, STEAM";
let defaultLogoUrl = "";
const groupsList = ["Tota l'escola", "Educació infantil", "I3", "I3 A", "I3 B", "I4", "I4 A", "I4 B", "I5", "I5 A", "I5 B", "Educació primària", "1r", "1r A", "1r B", "2n", "2n A", "2n B", "3r", "3r A", "3r B", "4t", "4t A", "4t B", "5è", "5è A", "5è B", "6è", "6è A", "6è B"];
window.currentPosts = [];
window.currentPostId = null;

window.wmSettings = { 
    active: false, text: '', color: '#ffffff', 
    logoSize: 15, textSize: 8, 
    logoX: 85, logoY: 85, textX: 50, textY: 85 
};

function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = `px-4 py-3 rounded-lg text-white text-sm font-bold shadow-lg transition-all duration-300 transform translate-y-4 opacity-0 ${type==='error'?'bg-rose-500':'bg-emerald-500'}`;
    t.textContent = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => { t.classList.remove('translate-y-4', 'opacity-0'); }, 10);
    setTimeout(() => { t.classList.add('opacity-0'); setTimeout(()=>t.remove(), 300); }, 3000);
}

function saveDraft() {
    localStorage.setItem('edo_draft_title', document.getElementById('postTitle').value);
    localStorage.setItem('edo_draft_group', document.getElementById('postGroup').value);
    localStorage.setItem('edo_draft_desc', document.getElementById('postDescription').value);
}

function loadDraft() {
    const t = localStorage.getItem('edo_draft_title'), g = localStorage.getItem('edo_draft_group'), d = localStorage.getItem('edo_draft_desc');
    if(t) document.getElementById('postTitle').value = t;
    if(g) document.getElementById('postGroup').value = g;
    if(d) document.getElementById('postDescription').value = d;
}

function clearDraft() {
    localStorage.removeItem('edo_draft_title'); localStorage.removeItem('edo_draft_group'); localStorage.removeItem('edo_draft_desc');
}

function initPWA() {
    const fullIconUrl = new URL("logo.png", window.location.href).href;
    const manifestData = { name: "eDoActiu Xarxes", short_name: "eDoActiu", start_url: window.location.href, display: "standalone", background_color: "#f8fafc", theme_color: "#2c6496", icons: [{ src: fullIconUrl, sizes: "512x512", type: "image/png" }] };
    const blob = new Blob([JSON.stringify(manifestData)], {type: 'application/json'});
    document.getElementById('dynamic-manifest').href = URL.createObjectURL(blob);
    const swCode = `const CACHE = 'edoactiu-v2'; self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll([location.href, '${fullIconUrl}']))); }); self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(res => res || fetch(e.request))); });`;
    const swBlob = new Blob([swCode], {type: 'text/javascript'});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(()=>{});
}

function makeDraggable(elId) {
    const dragEl = document.getElementById(elId);
    if(!dragEl) return;
    let isDragging = false, startX, startY, startLeft, startTop;
    
    function onStart(e) {
        if(e.target !== dragEl && !dragEl.contains(e.target)) return;
        isDragging = true;
        const ev = e.touches ? e.touches[0] : e;
        startX = ev.clientX; startY = ev.clientY;
        startLeft = parseFloat(dragEl.style.left || 50); 
        startTop = parseFloat(dragEl.style.top || 50);
    }
    function onMove(e) {
        if(!isDragging) return;
        e.preventDefault();
        const ev = e.touches ? e.touches[0] : e;
        const container = document.getElementById('wmPreviewWrap');
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const newLeft = startLeft + (dx / container.offsetWidth * 100);
        const newTop = startTop + (dy / container.offsetHeight * 100);
        dragEl.style.left = Math.max(0, Math.min(newLeft, 100)) + '%';
        dragEl.style.top = Math.max(0, Math.min(newTop, 100)) + '%';
    }
    function onEnd() { isDragging = false; }
    
    dragEl.addEventListener('mousedown', onStart); 
    dragEl.addEventListener('touchstart', onStart, {passive: false});
    document.addEventListener('mousemove', onMove, {passive: false}); 
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('mouseup', onEnd); 
    document.addEventListener('touchend', onEnd);
}

document.addEventListener('DOMContentLoaded', async () => {
    initPWA();
    makeDraggable('wmDraggableLogo');
    makeDraggable('wmDraggableText');
    const selectGroup = document.getElementById('postGroup');
    groupsList.forEach(g => { const opt = document.createElement('option'); opt.value = g; opt.textContent = g; selectGroup.appendChild(opt); });
    loadDraft();
    const yearSelect = document.getElementById('filterYear');
    const currentYear = new Date().getFullYear();
    for(let i = currentYear - 1; i <= currentYear + 2; i++) {
        const opt = document.createElement('option'); opt.value = i; opt.textContent = i;
        if(i === currentYear) opt.selected = true; yearSelect.appendChild(opt);
    }
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data: { session } } = await supabaseClient.auth.getSession();
            if(session) setUserRole(session.user.email);
        }
    } catch (err) {}
});

async function loadSettings() {
    try {
        const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
        if (data) {
            if (data.hashtags) defaultHashtags = data.hashtags;
            if (data.projectes) defaultProjects = data.projectes;
            if (data.logo_url) defaultLogoUrl = data.logo_url;
        }
    } catch (e) {}
}

async function saveSettings() {
    const btnSave = document.getElementById('btnSaveSettings');
    btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardant...';
    const newTags = document.getElementById('configHashtags').value, newProjects = document.getElementById('configProjects').value, fileInput = document.getElementById('configWatermark');
    let newLogoUrl = defaultLogoUrl;
    try {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0], fileName = `watermark_${Date.now()}.png`;
            const { data, error } = await supabaseClient.storage.from('xarxes_photos').upload(fileName, file);
            if (!error) {
                const { data: publicUrlData } = supabaseClient.storage.from('xarxes_photos').getPublicUrl(fileName);
                newLogoUrl = publicUrlData.publicUrl;
            }
        }
        await supabaseClient.from('settings').upsert({ id: 1, hashtags: newTags, projectes: newProjects, logo_url: newLogoUrl });
        defaultHashtags = newTags; defaultProjects = newProjects; defaultLogoUrl = newLogoUrl;
        await supabaseClient.from('posts').update({ hashtags: newTags }).eq('estat', 'Pendent');
        showToast("Configuració desada!"); showView('manager');
    } catch (e) { showToast("Error al desar", "error"); } finally { btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar configuració'; }
}

async function setUserRole(email) {
    await loadSettings();
    if(email === 'gestor@eugenidors.com') {
        userRole = 'manager';
        document.getElementById('navButtons').classList.remove('hidden'); document.getElementById('navButtons').classList.add('flex');
        document.getElementById('navLogoutOnly').classList.add('hidden'); document.getElementById('navLogoutOnly').classList.remove('flex');
        showView('manager');
    } else {
        userRole = 'teacher';
        document.getElementById('navButtons').classList.add('hidden'); document.getElementById('navButtons').classList.remove('flex');
        document.getElementById('navLogoutOnly').classList.remove('hidden'); document.getElementById('navLogoutOnly').classList.add('flex');
        showView('teacher');
    }
    document.getElementById('userStatusText').textContent = email; document.getElementById('view-login').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const pass = document.getElementById('appPassword').value;
    let res = await supabaseClient.auth.signInWithPassword({ email: 'docent@eugenidors.com', password: pass });
    if (!res.error && res.data.user) {
        await setUserRole(res.data.user.email); document.getElementById('appPassword').value = ''; showToast("Sessió iniciada com a Mestre/a");
    } else {
        let res2 = await supabaseClient.auth.signInWithPassword({ email: 'gestor@eugenidors.com', password: pass });
        if (!res2.error && res2.data.user) {
            await setUserRole(res2.data.user.email); document.getElementById('appPassword').value = ''; showToast("Sessió iniciada com a Gestor/a");
        } else showToast("Contrasenya incorrecta", "error");
    }
    btn.disabled = false; btn.textContent = 'Entrar';
}

async function handleLogout() {
    await supabaseClient.auth.signOut(); userRole = "";
    document.getElementById('navButtons').classList.add('hidden'); document.getElementById('navButtons').classList.remove('flex');
    document.getElementById('navLogoutOnly').classList.add('hidden'); document.getElementById('navLogoutOnly').classList.remove('flex');
    document.getElementById('view-teacher').classList.add('hidden'); document.getElementById('view-manager').classList.add('hidden');
    document.getElementById('view-settings').classList.add('hidden'); document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('userStatusText').textContent = "Intranet de publicacions"; showToast("Sessió tancada");
}

function toggleArchiveView(isArchived) {
    showingArchived = isArchived;
    const btnA = document.getElementById('btnTabActive'), btnAr = document.getElementById('btnTabArchived');
    if (isArchived) {
        btnAr.className = 'flex-1 px-4 py-2 rounded-md bg-white text-edo-darkblue shadow transition font-semibold';
        btnA.className = 'flex-1 px-4 py-2 rounded-md text-edo-gray hover:text-edo-darkblue transition cursor-pointer';
    } else {
        btnA.className = 'flex-1 px-4 py-2 rounded-md bg-white text-edo-darkblue shadow transition font-semibold';
        btnAr.className = 'flex-1 px-4 py-2 rounded-md text-edo-gray hover:text-edo-darkblue transition cursor-pointer';
    }
    resetPaginationAndLoad();
}

function showView(viewName) {
    if (!userRole || ((viewName === 'manager' || viewName === 'settings') && userRole !== 'manager')) return;
    document.getElementById('view-teacher').classList.add('hidden'); document.getElementById('view-manager').classList.add('hidden'); document.getElementById('view-settings').classList.add('hidden');
    if (userRole === 'manager') {
        const btnT = document.getElementById('btnRoleTeacher'), btnM = document.getElementById('btnRoleManager');
        if (viewName === 'teacher') {
            btnT.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md bg-white text-edo-darkblue shadow transition font-semibold';
            btnM.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md text-edo-lightblue hover:text-white transition cursor-pointer';
            document.getElementById('view-teacher').classList.remove('hidden');
        } else if (viewName === 'manager') {
            btnM.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md bg-white text-edo-darkblue shadow transition font-semibold';
            btnT.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md text-edo-lightblue hover:text-white transition cursor-pointer';
            document.getElementById('view-manager').classList.remove('hidden'); showingArchived = false; toggleArchiveView(false);
        } else if (viewName === 'settings') {
            btnM.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md bg-white text-edo-darkblue shadow transition font-semibold';
            btnT.className = 'flex-1 sm:flex-none px-4 py-2 rounded-md text-edo-lightblue hover:text-white transition cursor-pointer';
            document.getElementById('view-settings').classList.remove('hidden');
            document.getElementById('configHashtags').value = defaultHashtags;
            document.getElementById('configProjects').value = defaultProjects;
            if (defaultLogoUrl) { document.getElementById('currentWatermarkContainer').classList.remove('hidden'); document.getElementById('currentWatermarkImg').src = defaultLogoUrl; }
        }
    } else if (userRole === 'teacher') { document.getElementById('view-teacher').classList.remove('hidden'); }
}

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
                let width = img.width, height = img.height;
                if (width > 1280) { height = Math.round((height * 1280) / width); width = 1280; }
                canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(new File([blob], file.name, { type: 'image/jpeg' })); }, 'image/jpeg', 0.8);
            };
        };
    });
}

function checkVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video'); video.preload = 'metadata';
        video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); if (video.duration > 31) reject(); else resolve(file); };
        video.src = URL.createObjectURL(file);
    });
}

async function previewMedia() {
    const filesInput = document.getElementById('postPhotos'), files = Array.from(filesInput.files);
    const filesToAdd = files.slice(0, 5 - selectedFilesToUpload.length);
    for (let file of filesToAdd) {
        if (file.type.startsWith('image/')) {
            const compressed = await compressImage(file);
            selectedFilesToUpload.push({ file: compressed, url: URL.createObjectURL(compressed), type: 'image' });
        } else if (file.type.startsWith('video/')) {
            try { const validVideo = await checkVideoDuration(file); selectedFilesToUpload.push({ file: validVideo, url: URL.createObjectURL(validVideo), type: 'video' }); } catch (e) { showToast(`El vídeo supera els 30 segons`, "error"); }
        }
    }
    filesInput.value = ''; renderPreview();
}

function renderPreview() {
    const container = document.getElementById('mediaPreviewContainer'); container.innerHTML = '';
    if (selectedFilesToUpload.length === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    selectedFilesToUpload.forEach((item, index) => {
        const wrapper = document.createElement('div'); wrapper.className = 'relative flex-shrink-0';
        let mediaEl = document.createElement(item.type === 'image' ? 'img' : 'video');
        mediaEl.src = item.url; mediaEl.className = 'h-24 w-24 object-cover rounded-lg shadow-sm border border-slate-200';
        const controls = document.createElement('div'); controls.className = 'absolute bottom-0 left-0 right-0 bg-black/60 flex justify-between items-center px-2 py-1 rounded-b-lg';
        const btnLeft = document.createElement('button'); btnLeft.type = 'button'; btnLeft.innerHTML = '<i class="fa-solid fa-chevron-left text-white text-sm px-1"></i>'; btnLeft.onclick = () => moveMedia(index, -1);
        const btnDel = document.createElement('button'); btnDel.type = 'button'; btnDel.innerHTML = '<i class="fa-solid fa-trash text-rose-400 text-sm px-1"></i>'; btnDel.onclick = () => removeMedia(index);
        const btnRight = document.createElement('button'); btnRight.type = 'button'; btnRight.innerHTML = '<i class="fa-solid fa-chevron-right text-white text-sm px-1"></i>'; btnRight.onclick = () => moveMedia(index, 1);
        controls.appendChild(btnLeft); controls.appendChild(btnDel); controls.appendChild(btnRight);
        wrapper.appendChild(mediaEl); wrapper.appendChild(controls); container.appendChild(wrapper);
    });
}

function moveMedia(index, dir) {
    const newIndex = index + dir; if (newIndex < 0 || newIndex >= selectedFilesToUpload.length) return;
    const temp = selectedFilesToUpload[index]; selectedFilesToUpload[index] = selectedFilesToUpload[newIndex]; selectedFilesToUpload[newIndex] = temp;
    renderPreview();
}

function removeMedia(index) { selectedFilesToUpload.splice(index, 1); renderPreview(); }

async function submitPost(e) {
    e.preventDefault(); if (!supabaseClient) return;
    const btnSubmit = document.getElementById('btnSubmitPost'), progressCont = document.getElementById('uploadProgressContainer'), progressBar = document.getElementById('uploadProgressBar'), progressTxt = document.getElementById('uploadPercentage'), statusTxt = document.getElementById('uploadStatusText');
    btnSubmit.disabled = true;
    if (selectedFilesToUpload.length > 0) { progressCont.classList.remove('hidden'); progressBar.style.width = '0%'; progressTxt.textContent = '0%'; }
    const title = document.getElementById('postTitle').value, group = document.getElementById('postGroup').value, description = document.getElementById('postDescription').value;
    let mediaUrls = [];
    try {
        let count = 0;
        for (let item of selectedFilesToUpload) {
            statusTxt.textContent = `Pujant arxiu ${count + 1} de ${selectedFilesToUpload.length}...`;
            const fileExt = item.file.name.split('.').pop(), fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('xarxes_photos').upload(fileName, item.file);
            if (error) throw error;
            const { data: publicUrlData } = supabaseClient.storage.from('xarxes_photos').getPublicUrl(fileName);
            mediaUrls.push(publicUrlData.publicUrl);
            count++; const pct = Math.round((count / selectedFilesToUpload.length) * 100); progressBar.style.width = `${pct}%`; progressTxt.textContent = `${pct}%`;
        }
        if (selectedFilesToUpload.length > 0) statusTxt.textContent = "Desant dades...";
        const { error: dbError } = await supabaseClient.from('posts').insert([{ titol: title, grup: group, descripcio: description, imatges: mediaUrls, estat: 'Pendent', hashtags: defaultHashtags }]);
        if (dbError) throw dbError;
        document.getElementById('postForm').reset(); clearDraft(); selectedFilesToUpload = []; renderPreview(); showToast("Publicació enviada correctament!");
    } catch (error) { showToast("Error pujant els arxius", "error"); } finally { btnSubmit.disabled = false; progressCont.classList.add('hidden'); }
}

function resetPaginationAndLoad() { currentPage = 1; loadPosts(); }
function prevPage() { if(currentPage > 1) { currentPage--; loadPosts(); } }
function nextPage() { if(hasMorePosts) { currentPage++; loadPosts(); } }

async function loadPosts() {
    if (!supabaseClient) return;
    const container = document.getElementById('postsContainer'), loader = document.getElementById('loadingIndicator'), filterM = document.getElementById('filterMonth').value, filterY = document.getElementById('filterYear').value;
    container.innerHTML = ''; loader.classList.remove('hidden'); document.getElementById('pageIndicator').textContent = `Pàg ${currentPage}`;
    try {
        let query = supabaseClient.from('posts').select('*', { count: 'exact' });
        if (showingArchived) query = query.eq('estat', 'Arxivat'); else query = query.neq('estat', 'Arxivat');
        if (filterM && filterY) {
            const y = parseInt(filterY), m = parseInt(filterM);
            const start = new Date(y, m-1, 1).toISOString(), end = new Date(y, m, 0, 23, 59, 59).toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        } else if (!filterM && filterY) {
            const y = parseInt(filterY);
            const start = new Date(y, 0, 1).toISOString(), end = new Date(y, 11, 31, 23, 59, 59).toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        }
        const from = (currentPage - 1) * itemsPerPage, to = from + itemsPerPage - 1;
        const { data: posts, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
        if (error) throw error;
        loader.classList.add('hidden');
        hasMorePosts = (to + 1) < count; currentPosts = posts || [];
        document.getElementById('btnPrev').classList.toggle('invisible', currentPage === 1); document.getElementById('btnNext').classList.toggle('invisible', !hasMorePosts);
        if (!posts || posts.length === 0) { container.innerHTML = `<div class="bg-white p-8 rounded-2xl text-center border border-dashed border-slate-200"><p class="text-slate-500 font-medium">${showingArchived ? "Cap publicació arxivada." : "Cap publicació activa."}</p></div>`; return; }
        container.innerHTML = posts.map(p => {
            const dateFormatted = new Date(p.created_at).toLocaleDateString('ca-ES'), tags = p.hashtags || '';
            return `<div class="bg-white p-5 rounded-2xl shadow-sm border ${p.estat === 'Pendent' ? 'border-edo-orange' : (p.estat === 'Arxivat' ? 'border-slate-300' : 'border-edo-lightblue')}">
<div class="flex justify-between items-start gap-2 mb-3"><div class="flex items-center gap-2"><span class="bg-slate-100 text-edo-gray font-school text-sm px-3 py-1 rounded-lg font-bold">${p.grup}</span><span class="text-xs text-slate-400">${dateFormatted}</span></div><span class="text-xs px-3 py-1 rounded-full font-bold ${p.estat === 'Pendent' ? 'bg-amber-100 text-edo-orange' : (p.estat === 'Arxivat' ? 'bg-slate-200 text-slate-500' : 'bg-sky-100 text-edo-darkblue')}">${p.estat}</span></div>
<h3 class="font-bold text-lg text-edo-darkblue mb-2">${p.titol}</h3>
<p class="text-sm text-edo-gray mb-2 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">${p.descripcio}</p>
<p class="text-xs text-edo-lightblue font-mono mb-4 font-bold whitespace-pre-wrap">${tags}</p>
${p.imatges && p.imatges.length > 0 ? `<div class="flex gap-2 overflow-x-auto pb-2 mb-4">${p.imatges.map(url => {
const cleanUrl = url.split('?')[0].toLowerCase();
if(cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm')) return `<video src="${url}" preload="none" controls class="h-24 w-auto rounded-lg shadow-sm border border-slate-200 flex-shrink-0"></video>`;
return `<img src="${url}" loading="lazy" class="h-24 w-24 object-cover rounded-lg shadow-sm border border-slate-200 flex-shrink-0">`;
}).join('')}</div>` : ''}
<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
<button onclick="openEditModalById(${p.id})" class="flex justify-center items-center gap-2 px-3 py-2 bg-slate-100 text-edo-darkblue text-sm font-semibold rounded-lg hover:bg-slate-200 transition"><i class="fa-solid fa-pen"></i> Editar text</button>
<button onclick="copyToClipboardById(${p.id})" class="flex justify-center items-center gap-2 px-3 py-2 bg-slate-100 text-edo-darkblue text-sm font-semibold rounded-lg hover:bg-slate-200 transition"><i class="fa-regular fa-copy"></i> Copiar text</button>
${p.imatges && p.imatges.length > 0 ? `<button onclick="openPhotoModal(${p.id})" class="flex justify-center items-center gap-2 px-3 py-2 bg-edo-lightblue/20 text-edo-darkblue text-sm font-bold rounded-lg hover:bg-edo-lightblue/30 transition"><i class="fa-solid fa-images"></i> Fotos</button>` : ''}
</div>
<div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
${showingArchived ? `<button onclick="updateStatus(${p.id}, 'Pendent')" class="px-4 py-2 bg-slate-200 text-edo-gray text-sm font-semibold rounded-lg hover:bg-slate-300 transition"><i class="fa-solid fa-rotate-left"></i> Restaurar</button><button onclick="deletePost(${p.id})" class="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition text-sm rounded-lg" title="Eliminar definitivament"><i class="fa-solid fa-trash"></i></button>` : `${p.estat === 'Pendent' ? `<button onclick="updateStatus(${p.id}, 'Publicat')" class="px-4 py-2 bg-edo-darkblue text-white text-sm font-semibold rounded-lg hover:bg-[#1a4369] transition"><i class="fa-solid fa-check"></i> Marcar publicat</button>` : `<button onclick="updateStatus(${p.id}, 'Pendent')" class="px-4 py-2 bg-slate-200 text-edo-gray text-sm font-semibold rounded-lg hover:bg-slate-300 transition">Tornar pendent</button>`}<button onclick="archivePost(${p.id})" class="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm rounded-lg transition" title="Arxivar"><i class="fa-solid fa-box-archive"></i></button>`}
</div></div>`;
        }).join('');
    } catch (error) {}
}

function getPostText(id) {
    const p = currentPosts.find(x => x.id == id);
    if(!p) return "";
    const tags = p.hashtags ? p.hashtags : '';
    return `✨ ${p.titol}\n\n${p.descripcio}\n\n📍 Grup: ${p.grup}\n\n${tags}`;
}

function copyToClipboardById(id) {
    navigator.clipboard.writeText(getPostText(id)).then(() => showToast("Text copiat al porta-retalls!")).catch(() => showToast("Error al copiar", "error"));
}

function openEditModalById(id) {
    const p = currentPosts.find(x => x.id == id); if(!p) return;
    document.getElementById('editId').value = p.id; document.getElementById('editTitle').value = p.titol; document.getElementById('editDesc').value = p.descripcio; document.getElementById('editHashtags').value = p.hashtags || '';
    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); }

async function saveEdit() {
    const id = parseInt(document.getElementById('editId').value), titol = document.getElementById('editTitle').value, desc = document.getElementById('editDesc').value, tags = document.getElementById('editHashtags').value;
    try { await supabaseClient.from('posts').update({ titol: titol, descripcio: desc, hashtags: tags }).eq('id', id); closeEditModal(); loadPosts(); showToast("Modificacions desades"); } catch (error) { showToast("Error al desar", "error"); }
}

// ----------------------------------------------------
// EDITOR MÀGIC: RETALLAR + CENSURAR CARES
// ----------------------------------------------------
let magicCropper = null;
let magicImgObj = null;
let magicPostId = null;
let magicImgIndex = null;
let magicOriginalUrl = null;
let magicCanvas = null;
let magicCtx = null;
let magicBlurCanvas = null;
let isBlurring = false;
let magicMode = 'crop'; 

window.openMagicEditor = function(id, index, url) {
    magicPostId = id;
    magicImgIndex = index;
    magicOriginalUrl = url;
    
    document.getElementById('magicEditorModal').classList.remove('hidden');
    setMagicTab('crop');
    
    const imgEl = document.getElementById('cropImage');
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = url;
    
    imgEl.onload = () => {
        if(magicCropper) magicCropper.destroy();
        magicCropper = new Cropper(imgEl, {
            viewMode: 1,
            dragMode: 'move',
            background: false,
            responsive: true,
            autoCropArea: 1,
            ready: function() { this.cropper.clear(); }
        });
        
        // Prepare blur canvases quietly in the background
        magicImgObj = new Image();
        magicImgObj.crossOrigin = 'anonymous';
        magicImgObj.src = url;
        magicImgObj.onload = initBlurTool;
    };
};

window.closeMagicEditor = function() {
    if(magicCropper) { magicCropper.destroy(); magicCropper = null; }
    document.getElementById('magicEditorModal').classList.add('hidden');
};

window.setMagicTab = function(mode) {
    magicMode = mode;
    const btnCrop = document.getElementById('btnTabCrop');
    const btnBlur = document.getElementById('btnTabBlur');
    const cCont = document.getElementById('cropContainer');
    const bCont = document.getElementById('blurContainer');
    const cCtrl = document.getElementById('cropControls');
    const bCtrl = document.getElementById('blurControls');
    
    if(mode === 'crop') {
        btnCrop.className = 'flex-1 py-2 rounded-lg bg-edo-lightblue text-slate-900 shadow font-bold';
        btnBlur.className = 'flex-1 py-2 rounded-lg bg-slate-700 text-white shadow font-bold';
        cCont.classList.remove('hidden'); bCont.classList.add('hidden');
        cCtrl.classList.remove('hidden'); bCtrl.classList.add('hidden');
    } else {
        btnBlur.className = 'flex-1 py-2 rounded-lg bg-edo-lightblue text-slate-900 shadow font-bold';
        btnCrop.className = 'flex-1 py-2 rounded-lg bg-slate-700 text-white shadow font-bold';
        bCont.classList.remove('hidden'); cCont.classList.add('hidden');
        bCtrl.classList.remove('hidden'); cCtrl.classList.add('hidden');
        
        // Hide hint after 3 seconds
        setTimeout(() => document.getElementById('blurHint').classList.add('opacity-0'), 3000);
    }
};

window.setCropRatio = function(ratio) {
    if(magicCropper) {
        magicCropper.setAspectRatio(ratio);
        if(isNaN(ratio)) magicCropper.clear(); // Mode lliure
    }
};

function initBlurTool() {
    magicCanvas = document.getElementById('blurCanvas');
    magicCtx = magicCanvas.getContext('2d');
    
    // Scale down if image is huge for performance
    const MAX_DIM = 1200;
    let w = magicImgObj.naturalWidth, h = magicImgObj.naturalHeight;
    if(w > MAX_DIM || h > MAX_DIM) {
        if(w > h) { h = (h/w)*MAX_DIM; w = MAX_DIM; }
        else { w = (w/h)*MAX_DIM; h = MAX_DIM; }
    }
    
    magicCanvas.width = w; magicCanvas.height = h;
    magicCtx.drawImage(magicImgObj, 0, 0, w, h);
    
    // Create heavily blurred off-screen canvas
    magicBlurCanvas = document.createElement('canvas');
    magicBlurCanvas.width = w; magicBlurCanvas.height = h;
    const bCtx = magicBlurCanvas.getContext('2d');
    bCtx.filter = 'blur(15px)';
    bCtx.drawImage(magicImgObj, 0, 0, w, h);
    
    magicCanvas.addEventListener('pointerdown', startBlur);
    magicCanvas.addEventListener('pointermove', drawBlur);
    magicCanvas.addEventListener('pointerup', stopBlur);
    magicCanvas.addEventListener('pointerout', stopBlur);
}

window.resetBlur = function() { initBlurTool(); };

function startBlur(e) {
    if(magicMode !== 'blur') return;
    isBlurring = true;
    drawBlur(e);
}
function stopBlur() { isBlurring = false; }
function drawBlur(e) {
    if(!isBlurring) return;
    e.preventDefault();
    const rect = magicCanvas.getBoundingClientRect();
    const scaleX = magicCanvas.width / rect.width;
    const scaleY = magicCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const brushSize = parseInt(document.getElementById('blurBrushSize').value) * scaleX;
    
    magicCtx.save();
    magicCtx.beginPath();
    magicCtx.arc(x, y, brushSize, 0, Math.PI*2);
    magicCtx.clip();
    magicCtx.drawImage(magicBlurCanvas, 0, 0);
    magicCtx.restore();
}

window.saveMagicEdits = async function() {
    const btn = document.getElementById('btnSaveMagic');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Desant...`;
    btn.disabled = true;
    
    try {
        let finalBlob = null;
        if(magicMode === 'crop' && magicCropper && Object.keys(magicCropper.getCropBoxData()).length > 0) {
            finalBlob = await new Promise(res => magicCropper.getCroppedCanvas({imageSmoothingQuality: 'high'}).toBlob(res, 'image/jpeg', 0.9));
        } else if (magicMode === 'blur') {
            finalBlob = await new Promise(res => magicCanvas.toBlob(res, 'image/jpeg', 0.9));
        } else {
            showToast("No s'ha fet cap canvi evident.");
            closeMagicEditor(); return;
        }

        const fileName = `edit_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data, error } = await supabaseClient.storage.from('xarxes_photos').upload(fileName, finalBlob);
        if(error) throw error;
        
        const { data: publicUrlData } = supabaseClient.storage.from('xarxes_photos').getPublicUrl(fileName);
        const newUrl = publicUrlData.publicUrl;
        
        // Actualitzar BBDD
        const p = currentPosts.find(x => x.id == magicPostId);
        let updatedUrls = [...p.imatges];
        updatedUrls[magicImgIndex] = newUrl;
        
        await supabaseClient.from('posts').update({ imatges: updatedUrls }).eq('id', magicPostId);
        
        // Esborrar arxiu vell
        const oldFileName = magicOriginalUrl.split('/').pop().split('?')[0];
        supabaseClient.storage.from('xarxes_photos').remove([oldFileName]).catch(e=>console.error(e));
        
        showToast("Imatge modificada correctament!");
        closeMagicEditor();
        closePhotoModal();
        loadPosts();
        
    } catch(e) {
        showToast("Error en desar la imatge.", "error");
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

// ----------------------------------------------------
// EDITOR MARCA D'AIGUA
// ----------------------------------------------------

window.handleWmEditorSelect = function() {
    const sel = document.getElementById('wmEditorSelect');
    if(sel.value === 'CUSTOM') document.getElementById('wmEditorCustom').classList.remove('hidden');
    else document.getElementById('wmEditorCustom').classList.add('hidden');
    window.updateWmEditorPreview();
};

window.updateWmEditorPreview = function() {
    const sel = document.getElementById('wmEditorSelect').value;
    const textStr = sel === 'CUSTOM' ? document.getElementById('wmEditorCustom').value : (sel.startsWith('PREDEF_') ? sel.replace('PREDEF_', '') : (sel === 'NOMES_LOGO' ? 'NOMES_LOGO' : ''));
    const color = document.getElementById('wmEditorColor').value;
    const logoSzPct = parseFloat(document.getElementById('wmEditorLogoSize').value);
    const textSzPct = parseFloat(document.getElementById('wmEditorTextSize').value);
    const containerW = document.getElementById('wmPreviewWrap').offsetWidth;
    
    const logoEl = document.getElementById('wmPreviewLogo');
    const textEl = document.getElementById('wmPreviewText');
    const dragLogoEl = document.getElementById('wmDraggableLogo');
    const dragTextEl = document.getElementById('wmDraggableText');
    
    if(sel === '') { 
        dragLogoEl.classList.add('hidden'); dragTextEl.classList.add('hidden'); return; 
    }
    
    if(defaultLogoUrl && textStr !== 'NOMES_TEXT') {
        logoEl.src = defaultLogoUrl; logoEl.style.width = (containerW * (logoSzPct/100)) + 'px'; logoEl.style.height = 'auto'; dragLogoEl.classList.remove('hidden');
    } else dragLogoEl.classList.add('hidden');
    
    if(textStr && textStr !== 'NOMES_LOGO') {
        textEl.textContent = textStr; textEl.style.color = color; textEl.style.fontSize = (containerW * (textSzPct/100)) + 'px'; dragTextEl.classList.remove('hidden');
    } else dragTextEl.classList.add('hidden');
};

window.openWmEditor = function() {
    const p = currentPosts.find(x => x.id == window.currentPostId);
    if(!p || !p.imatges || p.imatges.length === 0) return;
    const firstImg = p.imatges[0];
    const cleanUrl = firstImg.split('?')[0].toLowerCase();
    
    if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm')) { showToast("La primera imatge és un vídeo.", "error"); return; }
    
    document.getElementById('wmPreviewImg').src = firstImg;
    let projectOptions = `<option value="">Sense cap marca d'aigua</option>`;
    if (defaultLogoUrl) projectOptions += `<option value="NOMES_LOGO">Només el logo</option>`;
    const projs = defaultProjects ? defaultProjects.split(',').map(s=>s.trim()).filter(s=>s) : [];
    projs.forEach(proj => { projectOptions += `<option value="PREDEF_${proj}">${defaultLogoUrl ? 'Logo + ' : ''}${proj}</option>`; });
    projectOptions += `<option value="CUSTOM">✏️ Text lliure personalitzat...</option>`;
    document.getElementById('wmEditorSelect').innerHTML = projectOptions;
    
    if(window.wmSettings.active) {
        if(window.wmSettings.text !== '' && window.wmSettings.text !== 'NOMES_LOGO') {
            let found = false;
            projs.forEach(proj => { if(proj === window.wmSettings.text) found = true; });
            if(found) document.getElementById('wmEditorSelect').value = `PREDEF_${window.wmSettings.text}`;
            else { document.getElementById('wmEditorSelect').value = 'CUSTOM'; document.getElementById('wmEditorCustom').value = window.wmSettings.text; document.getElementById('wmEditorCustom').classList.remove('hidden'); }
        } else if(window.wmSettings.text === 'NOMES_LOGO') document.getElementById('wmEditorSelect').value = 'NOMES_LOGO';
        
        document.getElementById('wmEditorColor').value = window.wmSettings.color;
        document.getElementById('wmEditorLogoSize').value = window.wmSettings.logoSize;
        document.getElementById('wmEditorTextSize').value = window.wmSettings.textSize;
        document.getElementById('wmDraggableLogo').style.left = window.wmSettings.logoX + '%';
        document.getElementById('wmDraggableLogo').style.top = window.wmSettings.logoY + '%';
        document.getElementById('wmDraggableText').style.left = window.wmSettings.textX + '%';
        document.getElementById('wmDraggableText').style.top = window.wmSettings.textY + '%';
    } else {
        document.getElementById('wmEditorSelect').value = '';
        document.getElementById('wmEditorCustom').classList.add('hidden');
        document.getElementById('wmDraggableLogo').style.left = '85%';
        document.getElementById('wmDraggableLogo').style.top = '85%';
        document.getElementById('wmDraggableText').style.left = '50%';
        document.getElementById('wmDraggableText').style.top = '85%';
    }
    
    document.getElementById('wmEditorModal').classList.remove('hidden');
    setTimeout(window.updateWmEditorPreview, 100);
};

window.closeWmEditor = function() { document.getElementById('wmEditorModal').classList.add('hidden'); };

window.saveWmSettings = function() {
    const sel = document.getElementById('wmEditorSelect').value;
    if(sel === '') {
        window.wmSettings.active = false;
        document.getElementById('wmStatusBadge').textContent = 'Desactivada';
        document.getElementById('wmStatusBadge').className = 'text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold';
    } else {
        window.wmSettings.active = true;
        window.wmSettings.text = sel === 'CUSTOM' ? document.getElementById('wmEditorCustom').value : (sel.startsWith('PREDEF_') ? sel.replace('PREDEF_', '') : 'NOMES_LOGO');
        window.wmSettings.color = document.getElementById('wmEditorColor').value;
        window.wmSettings.logoSize = parseFloat(document.getElementById('wmEditorLogoSize').value);
        window.wmSettings.textSize = parseFloat(document.getElementById('wmEditorTextSize').value);
        window.wmSettings.logoX = parseFloat(document.getElementById('wmDraggableLogo').style.left);
        window.wmSettings.logoY = parseFloat(document.getElementById('wmDraggableLogo').style.top);
        window.wmSettings.textX = parseFloat(document.getElementById('wmDraggableText').style.left);
        window.wmSettings.textY = parseFloat(document.getElementById('wmDraggableText').style.top);
        document.getElementById('wmStatusBadge').textContent = 'Activada';
        document.getElementById('wmStatusBadge').className = 'text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-bold';
    }
    window.closeWmEditor();
};

window.openPhotoModal = function(id) {
    window.currentPostId = id; const p = currentPosts.find(x => x.id == id);
    if(!p || !p.imatges) return;
    window.wmSettings.active = false;
    const urls = p.imatges, container = document.getElementById('photoModalContent');
    
    let html = `
<div class="mb-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div class="flex justify-between items-center mb-3">
<label class="block text-sm font-bold text-edo-darkblue"><i class="fa-solid fa-stamp text-edo-lightblue"></i> Marca d'aigua (1a foto):</label>
<span id="wmStatusBadge" class="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold">Desactivada</span>
</div>
<button onclick="openWmEditor()" class="w-full py-2 bg-edo-lightblue/10 text-edo-darkblue font-bold rounded-lg border border-edo-lightblue/30 hover:bg-edo-lightblue/20 transition"><i class="fa-solid fa-palette"></i> Crear i ajustar...</button>
</div>`;

    html += `
<div class="mb-6 p-4 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
<button id="btnPublishIg" onclick="publishToInstagram(${id})" class="w-full py-3.5 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition hover:opacity-90">
<i class="fa-brands fa-instagram text-xl"></i> Publicar-ho (${urls.length})
</button>
<p class="text-xs text-slate-500 mt-3 leading-relaxed"><strong>El text s'auto-copiarà!</strong> Obre el menú natiu per enviar-ho a Instagram. Si falla, et descarregarà l'arxiu.</p>
</div><hr class="border-slate-200 mb-6">`;

    html += `<h4 class="font-bold text-edo-darkblue mb-4 text-sm">Descarregar d'una en una:</h4><div class="space-y-5">`;
    urls.forEach((url, index) => {
        const cleanUrl = url.split('?')[0].toLowerCase(), isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm');
        const mediaTag = isVideo ? `<video src="${url}" controls class="w-full h-48 object-cover rounded-t-lg bg-black"></video>` : `<img src="${url}" class="w-full h-48 object-cover rounded-t-lg bg-slate-100">`;
        html += `
<div class="border border-slate-200 rounded-xl shadow-sm flex flex-col bg-white">
${mediaTag}
<div class="flex border-t border-slate-100">
    <button onclick="openMagicEditor(${id}, ${index}, '${url}')" class="flex-1 py-3.5 hover:bg-slate-50 text-edo-gray font-bold border-r border-slate-100 transition"><i class="fa-solid fa-wand-magic-sparkles text-edo-lightblue"></i> Editar</button>
    <button onclick="downloadSingleMedia('${url}', ${id}, ${index})" id="btnDlSingle_${index}" class="flex-1 py-3.5 hover:bg-slate-50 text-edo-darkblue font-bold transition"><i class="fa-solid fa-download"></i> Baixar</button>
</div>
</div>`;
    });
    html += `</div>`; container.innerHTML = html; document.getElementById('photoModal').classList.remove('hidden');
};

window.closePhotoModal = function() { document.getElementById('photoModal').classList.add('hidden'); };

async function applyWatermarkDynamic(imageUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            await document.fonts.load("500 24px Oswald");
            const img = new Image(); img.crossOrigin = 'anonymous';
            img.onload = async () => {
                const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
                if(!window.wmSettings.active) { canvas.toBlob(b => resolve(b), 'image/jpeg', 0.95); return; }
                
                const { text, color, logoSize, textSize, logoX, logoY, textX, textY } = window.wmSettings;

                if (defaultLogoUrl && text !== 'NOMES_TEXT') {
                    try {
                        const wm = new Image(); wm.crossOrigin = 'anonymous'; wm.src = defaultLogoUrl;
                        await new Promise((r, e) => { wm.onload = r; wm.onerror = e; });
                        
                        const wmWidth = canvas.width * (logoSize / 100);
                        const wmHeight = wmWidth * (wm.naturalHeight / wm.naturalWidth);
                        const wmFinalX = (canvas.width * (logoX / 100)) - (wmWidth / 2);
                        const wmFinalY = (canvas.height * (logoY / 100)) - (wmHeight / 2);
                        ctx.drawImage(wm, wmFinalX, wmFinalY, wmWidth, wmHeight);
                    } catch(e) {}
                }
                
                if (text && text !== 'NOMES_LOGO') {
                    const fSize = canvas.width * (textSize / 100);
                    ctx.font = `500 ${fSize}px 'Oswald', sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = Math.max(4, fSize*0.1); ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
                    const tFinalX = canvas.width * (textX / 100); const tFinalY = canvas.height * (textY / 100);
                    ctx.fillText(text, tFinalX, tFinalY);
                }
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
            };
            img.onerror = () => reject(); img.src = imageUrl;
        } catch (error) { reject(); }
    });
}

window.publishToInstagram = async function(id) {
    const p = currentPosts.find(x => x.id == id), urls = p.imatges, btn = document.getElementById('btnPublishIg'), ogHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xl"></i> Preparant...`; btn.disabled = true;
    try { await navigator.clipboard.writeText(getPostText(id)); } catch(e) {}
    showToast("Text copiat! Preparant arxius...");
    try {
        const fetchPromises = urls.map(async (url, index) => {
            const cleanUrl = url.split('?')[0].toLowerCase(), isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm');
            let blob;
            if (index === 0 && !isVideo && window.wmSettings.active) blob = await applyWatermarkDynamic(url);
            else { const response = await fetch(url); blob = await response.blob(); }
            const extension = blob.type.split('/')[1] || 'jpeg';
            return new File([blob], `eDoActiu_media_${index + 1}.${extension}`, { type: blob.type });
        });
        const filesArray = await Promise.all(fetchPromises);
        if (navigator.canShare && navigator.canShare({ files: filesArray })) { 
            await navigator.share({ files: filesArray, title: 'Publicació eDoActiu' }); btn.innerHTML = `<i class="fa-solid fa-check text-xl"></i> Fet!`; 
        } else {
            if (filesArray.length === 1) {
                const file = filesArray[0], downloadUrl = URL.createObjectURL(file), a = document.createElement('a'); 
                a.href = downloadUrl; a.download = file.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
                showToast("S'ha descarregat l'arxiu directament."); btn.innerHTML = `<i class="fa-solid fa-check text-xl"></i> Descarregat!`;
            } else { showToast("El navegador no suporta compartir múltiples arxius. Fes servir els botons de sota.", "error"); btn.innerHTML = ogHtml; }
        }
    } catch (error) { btn.innerHTML = ogHtml; if (error.name !== 'AbortError') showToast("Acció cancel·lada", "error"); 
    } finally { btn.disabled = false; setTimeout(() => { if(btn.innerHTML.includes('Fet!') || btn.innerHTML.includes('Descarregat!')) btn.innerHTML = ogHtml; }, 2000); }
};

window.downloadSingleMedia = async function(url, id, index) {
    const btn = document.getElementById(`btnDlSingle_${index}`), ogHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processant...`; btn.disabled = true;
    if(id) navigator.clipboard.writeText(getPostText(id)).catch(()=>{});
    const cleanUrl = url.split('?')[0].toLowerCase(), isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm');
    try {
        if (index === 0 && !isVideo && window.wmSettings.active) {
            const finalBlob = await applyWatermarkDynamic(url);
            const a = document.createElement('a'); a.href = URL.createObjectURL(finalBlob); a.download = `eDoActiu_media_1.jpeg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Descàrrega iniciada!");
        } else {
            const downloadUrl = url + (url.includes('?') ? '&' : '?') + 'download=';
            const a = document.createElement('a'); a.href = downloadUrl; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("Descàrrega iniciada!");
        }
    } catch (error) { showToast("Error en la descàrrega", "error"); } finally { btn.innerHTML = ogHtml; btn.disabled = false; }
};

window.updateStatus = async function(id, st) { try { await supabaseClient.from('posts').update({ estat: st }).eq('id', id); loadPosts(); if(st === 'Pendent') showToast("Publicació restaurada a Pendent"); } catch (e) {} };
window.archivePost = async function(id) { if(confirm("Segur que vols arxivar aquesta publicació? Desapareixerà del tauler actiu.")) { try { await supabaseClient.from('posts').update({ estat: 'Arxivat' }).eq('id', id); loadPosts(); showToast("Publicació arxivada"); } catch (e) {} } };
window.deletePost = async function(id) {
    if(confirm("ATENCIÓ: Aquesta acció esborrarà la publicació i totes les fotos definitivament. N'estàs segur/a?")) {
        try {
            const p = currentPosts.find(x => x.id == id);
            if (p && p.imatges && p.imatges.length > 0) {
                const filenames = p.imatges.map(url => { const parts = url.split('/'); return parts[parts.length - 1].split('?')[0]; });
                await supabaseClient.storage.from('xarxes_photos').remove(filenames);
            }
            await supabaseClient.from('posts').delete().eq('id', id); loadPosts(); showToast("Publicació eliminada definitivament");
        } catch (e) {}
    }
};
