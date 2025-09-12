/* ========== UTILITÁRIOS/ESTADO GLOBAL ========== */
const state = {
  favorites: JSON.parse(localStorage.getItem("pt_favs") || "[]"),
  theme: localStorage.getItem("pt_theme") || "dark",
  indexData: {news:[], videos:[], images:[]},
  imagesPage: 1,
};

const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const page = document.body.dataset.page || "index";

/* ========== THEME ========== */
function applyTheme(t){
  if(t === "light"){
    document.documentElement.style.setProperty("--bg","#f6f8fb");
    document.documentElement.style.setProperty("--bg2","#e6eefb");
    document.documentElement.style.setProperty("--text","#071428");
    document.documentElement.style.setProperty("--card","#ffffff");
  } else {
    document.documentElement.style.setProperty("--bg","#0b1020");
    document.documentElement.style.setProperty("--bg2","#0e1428");
    document.documentElement.style.setProperty("--text","#e5e7eb");
    document.documentElement.style.setProperty("--card","#121a33");
  }
  localStorage.setItem("pt_theme", t);
  state.theme = t;
}
document.addEventListener("DOMContentLoaded", ()=>{
  applyTheme(state.theme);
  // common UI setup
  document.getElementById?.("themeToggle")?.addEventListener("click", ()=>{
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });
  // auth bind (login/signup buttons shown on topbar)
  initAuthUI();
  // search global hookup
  const globalSearch = qs("#globalSearch");
  if(globalSearch) globalSearch.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if(q.length < 2) return;
    // simple instant navigation heuristics
    const n = state.indexData.news.filter(i => (i.title||"").toLowerCase().includes(q));
    if(n.length) location.href = "noticias.html";
  });
  // page-specific init
  initPage();
});

/* ========== AUTH (localStorage) ========== */
function initAuthUI(){
  const openAuth = qs("#openAuth");
  const userBadge = qs("#userBadge");
  const usernameLabel = qs("#usernameLabel");
  const logoutBtn = qs("#logoutBtn");
  function currentUser(){ return localStorage.getItem("pt_user") || null; }
  function sync(){
    const u = currentUser();
    if(u){
      if(userBadge){ userBadge.classList.remove("hidden"); usernameLabel.textContent = u; }
      if(openAuth) openAuth.classList.add("hidden");
    } else {
      if(userBadge) userBadge.classList.add("hidden");
      if(openAuth) openAuth.classList.remove("hidden");
    }
  }
  if(openAuth) openAuth.addEventListener("click", ()=> location.href = "login.html");
  if(logoutBtn) logoutBtn.addEventListener("click", ()=> { localStorage.removeItem("pt_user"); sync(); location.href = "index.html"; });
  sync();
}

/* ========== FAVORITOS ========== */
function saveFav(item){
  const raw = JSON.stringify(item);
  if(!state.favorites.includes(raw)){
    state.favorites.push(raw);
    localStorage.setItem("pt_favs", JSON.stringify(state.favorites));
    alert("Favorito salvo!");
  } else alert("Já favoritado.");
}
function renderFavsOnProfile(){
  const favContainer = qs("#favContainer");
  if(!favContainer) return;
  favContainer.innerHTML = "";
  if(!state.favorites.length){ favContainer.innerHTML = "<div class='muted'>Nenhum favorito salvo.</div>"; return; }
  state.favorites.forEach(raw => {
    const i = JSON.parse(raw);
    const card = document.createElement("div"); card.className = "card";
    card.innerHTML = `<strong>${(i.type||"item").toUpperCase()}</strong><div style="margin-top:8px">${i.title || i.author || i.url}</div>
      <div style="margin-top:8px" class="row"><button class="primary">Abrir</button><button style="margin-left:8px">Remover</button></div>`;
    card.querySelector("button:first-of-type").addEventListener("click", ()=> { if(i.url) window.open(i.url, "_blank"); });
    card.querySelector("button:last-of-type").addEventListener("click", ()=> {
      state.favorites = state.favorites.filter(x=>x!==raw);
      localStorage.setItem("pt_favs", JSON.stringify(state.favorites));
      renderFavsOnProfile();
    });
    favContainer.appendChild(card);
  });
}

/* ========== INICIALIZAÇÃO POR PÁGINA ========== */
function initPage(){
  // small GSAP intro
  gsap.from(".topbar",{y:-20, opacity:0, duration:.5});
  gsap.from(".hero, .card, .panel",{y:12, opacity:0, duration:.6, stagger:.06});

  if(page === "index") initHome();
  if(page === "clima") initClima();
  if(page === "noticias") initNoticias();
  if(page === "videos") initVideos();
  if(page === "imagens") initImagens();
  if(page === "chat") initChat();
  if(page === "login") initLogin();
  if(page === "cadastro") initSignup();
  if(page === "perfil") initProfile();
}

/* ========== HOME ========== */
async function initHome(){
  // tentar geo e buscar clima
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(async pos => {
      await getWeatherAndRender(pos.coords.latitude, pos.coords.longitude, "Sua localização", "#homeWeatherContent", "homeTempChart");
    }, ()=> { qs("#homeWeatherContent").textContent = "Não foi possível obter localização."; });
  }
  // carregar notícias + vídeos + imagens previews
  loadNews(1).then(items => {
    const ul = qs("#homeNewsList");
    if(ul) ul.innerHTML = (items||[]).slice(0,5).map(a => `<li><a href="${a.url}" target="_blank">${a.title}</a></li>`).join("");
  });
  loadNasaVideos("moon").then(cards => {
    const slider = qs("#homeVideosSlider");
    if(slider) slider.innerHTML = (cards||[]).slice(0,6).map(c => `<div class="swiper-slide">${c}</div>`).join("");
    try{ new Swiper(".videos-swiper", {pagination:{el:".swiper-pagination"}, autoplay:{delay:2400}, loop:true}); }catch(e){}
  });
  loadImagesPreview();
}

/* ========== CLIMA MODULE ========== */
async function initClima(){
  qs("#searchCity")?.addEventListener("click", async ()=>{
    const v = qs("#cityInput").value.trim(); if(!v) return alert("Digite cidade.");
    qs("#weatherPanel").innerHTML = "<div class='loading'>Buscando...</div>";
    try{
      const {lat, lon, label} = await cityToCoords(v);
      await getWeatherAndRender(lat, lon, label, "#weatherPanel", "tempChart");
      // atualização a cada 60s
      setInterval(()=> getWeatherAndRender(lat, lon, label, "#weatherPanel", "tempChart"), 60000);
    }catch(e){ qs("#weatherPanel").innerHTML = `<div class='loading'>${e.message}</div>`; }
  });
  qs("#useGeo")?.addEventListener("click", ()=>{
    if(!navigator.geolocation) return alert("Geolocalização não suportada.");
    navigator.geolocation.getCurrentPosition(async pos => {
      await getWeatherAndRender(pos.coords.latitude, pos.coords.longitude, "Sua localização", "#weatherPanel", "tempChart");
      setInterval(()=> getWeatherAndRender(pos.coords.latitude, pos.coords.longitude, "Sua localização", "#weatherPanel", "tempChart"), 60000);
    }, err => alert(err.message));
  });
}

async function cityToCoords(city){
  const u = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
  const r = await fetch(u);
  const j = await r.json();
  if(!j.length) throw new Error("Cidade não encontrada");
  return { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name };
}

async function getWeatherAndRender(lat, lon, label="Local", containerSelector="#weatherPanel", chartId="tempChart"){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m&timezone=auto`;
    const r = await fetch(url);
    const d = await r.json();
    if(!d.current_weather) { qs(containerSelector).innerHTML = "<div class='loading'>Falha ao obter clima</div>"; return; }
    const cw = d.current_weather;
    const html = `<div><h3>${label}</h3><div class="bigtemp" style="font-size:36px">${cw.temperature}°C</div>
      <div class="muted">${translateWeather(cw.weathercode)} • Vento ${cw.windspeed} km/h</div>
      <div class="muted small">Atual: ${new Date(cw.time).toLocaleString()}</div></div>`;
    qs(containerSelector).innerHTML = html;

    // gráfico das últimas 24h se disponível
    const chartEl = document.getElementById(chartId);
    if(chartEl && d.hourly && d.hourly.time){
      const times = d.hourly.time.slice(-24).map(t => new Date(t).toLocaleTimeString());
      const temps = d.hourly.temperature_2m.slice(-24);
      try{
        if(chartEl._chart) chartEl._chart.destroy();
        chartEl._chart = new Chart(chartEl, {
          type: 'line',
          data: { labels: times, datasets: [{ label: '°C', data: temps, tension:0.3, fill:true }]},
          options:{plugins:{legend:{display:false}}}
        });
      }catch(e){}
    }
  }catch(e){
    qs(containerSelector).innerHTML = `<div class='loading'>Erro: ${e.message}</div>`;
  }
}

function translateWeather(code){
  const map = {0:"Céu limpo",1:"Principalmente limpo",2:"Parcialmente nublado",3:"Nublado",45:"Nevoeiro",48:"Nevoeiro gelado",51:"Garoa",61:"Chuva",63:"Chuva moderada",65:"Chuva forte",95:"Trovoadas"};
  return map[code]||"—";
}

/* ========== NEWS MODULE (Spaceflight News) ========== */
async function loadNews(page=1, query="", category=""){
  const target = qs("#newsGrid") || qs("#homeNewsList");
  if(target) target.innerHTML = "<div class='loading'>Carregando notícias…</div>";
  try{
    const r = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?limit=12&offset=${(page-1)*12}`);
    const j = await r.json();
    const items = j.results || [];
    // simples filtro por query/category
    let list = items;
    if(query) list = list.filter(i => ((i.title||"") + (i.summary||"")).toLowerCase().includes(query.toLowerCase()));
    if(category){
      const map = {space:["space","nasa","launch"], tech:["tech","ai","software"], science:["research","study"]};
      const kws = map[category] || [];
      list = list.filter(i => kws.some(k => ((i.title||"") + (i.summary||"")).toLowerCase().includes(k)));
    }
    state.indexData.news = list.map(i => ({title:i.title, url:i.url}));
    // render
    if(qs("#newsGrid")){
      qs("#newsGrid").innerHTML = list.map(a => {
        const img = a.image_url || `https://picsum.photos/seed/news${a.id}/600/400`;
        return `<article class="news-card"><img src="${img}" alt=""><div class="pad">
          <span class="badge">${a.news_site}</span><h4>${a.title}</h4>
          <p class="time">${new Date(a.published_at).toLocaleString()}</p>
          <p>${(a.summary||"").slice(0,140)}…</p>
          <div class="row" style="margin-top:8px">
            <a href="${a.url}" target="_blank">Abrir</a>
            <button class="primary" data-fav='${JSON.stringify({type:"news",title:a.title,url:a.url})}'>Favoritar</button>
          </div>
        </div></article>`;
      }).join("");
      qsa('button[data-fav]').forEach(b => b.addEventListener("click", ()=> saveFav(JSON.parse(b.getAttribute("data-fav")))));
    } else if(qs("#homeNewsList")){
      qs("#homeNewsList").innerHTML = list.slice(0,5).map(a => `<li><a href="${a.url}" target="_blank">${a.title}</a></li>`).join("");
    }
    return items;
  }catch(e){
    if(target) target.innerHTML = `<div class='loading'>Erro: ${e.message}</div>`;
    return [];
  }
}

// news page controls
qs("#newsSearch")?.addEventListener("click", ()=> {
  const q = qs("#newsQuery").value.trim();
  const cat = qs("#newsCategory").value;
  loadNews(1, q, cat);
});
qs("#newsNext")?.addEventListener("click", ()=> {
  const p = Number(qs("#newsPage").textContent || "1") + 1;
  qs("#newsPage").textContent = p; loadNews(p, qs("#newsQuery").value.trim(), qs("#newsCategory").value);
});
qs("#newsPrev")?.addEventListener("click", ()=> {
  let p = Number(qs("#newsPage").textContent || "1"); if(p>1) p--; qs("#newsPage").textContent = p; loadNews(p, qs("#newsQuery").value.trim(), qs("#newsCategory").value);
});

/* ========== VIDEOS MODULE (NASA) ========== */
async function loadNasaVideos(q="moon", page=1){
  const target = qs("#videosGrid") || qs("#homeVideosSlider");
  if(target) target.innerHTML = "<div class='loading'>Buscando vídeos…</div>";
  try{
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=video`;
    const r = await fetch(url);
    const j = await r.json();
    const items = (j.collection && j.collection.items) ? j.collection.items.slice( (page-1)*8, page*8 ) : [];
    state.indexData.videos = items.map(it => ({ title: it.data?.[0]?.title || "Vídeo NASA" }));
    const cards = await Promise.all(items.map(async it => {
      const title = it.data?.[0]?.title || "Vídeo NASA";
      const href = it.href;
      try{
        const ar = await fetch(href); const assets = await ar.json();
        const mp4 = assets.find(u => /\.mp4$/i.test(u));
        const thumb = assets.find(u => /\.jpg$/i.test(u)) || "";
        return `<div class="video-card">${ mp4 ? `<video src="${mp4}" controls preload="none" poster="${thumb}"></video>` : `<img src="${thumb}" alt="">` }<div class="pad"><strong>${title}</strong>
          <div class="row" style="margin-top:6px"><button class="primary" data-fav='${JSON.stringify({type:"video",title, url: mp4 || thumb})}'>Favoritar</button></div></div></div>`;
      }catch(e){ return `<div class="video-card"><div class="pad">Erro ao carregar ativo</div></div>`; }
    }));
    if(qs("#videosGrid")) qs("#videosGrid").innerHTML = cards.join("");
    if(qs("#homeVideosSlider") && qs("#homeVideosSlider").children.length === 0) qs("#homeVideosSlider").innerHTML = cards.slice(0,6).map(c => `<div class="swiper-slide">${c}</div>`).join("");
    qsa('button[data-fav]').forEach(b => b.addEventListener("click", ()=> saveFav(JSON.parse(b.getAttribute("data-fav")))));
    try{ if(document.querySelector(".videos-swiper")) new Swiper(".videos-swiper", {pagination:{el:".swiper-pagination"}, autoplay:{delay:2500}, loop:true}); }catch(e){}
    return cards;
  }catch(e){
    if(target) target.innerHTML = `<div class='loading'>Erro: ${e.message}</div>`;
    return [];
  }
}
qs("#videoSearch")?.addEventListener("click", ()=> loadNasaVideos(qs("#videoQuery").value.trim() || "moon"));
qs("#videoNext")?.addEventListener("click", ()=> { const p = Number(qs("#videoPage").textContent || "1") + 1; qs("#videoPage").textContent = p; loadNasaVideos(qs("#videoQuery").value.trim() || "moon", p); });
qs("#videoPrev")?.addEventListener("click", ()=> { let p = Number(qs("#videoPage").textContent || "1"); if(p>1) p--; qs("#videoPage").textContent = p; loadNasaVideos(qs("#videoQuery").value.trim() || "moon", p); });

/* ========== IMAGES MODULE (Picsum) ========= */
async function loadImages(page=1, limit=30){
  const container = qs("#imagesMasonry");
  if(!container) return;
  if(page === 1) container.innerHTML = "<div class='loading'>Carregando imagens…</div>";
  try{
    const r = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=${limit}`);
    const j = await r.json();
    state.indexData.images = state.indexData.images ? state.indexData.images.concat(j) : j;
    const nodes = j.map(x => {
      const w = 800, h = Math.floor(300 + Math.random()*500);
      const src = `https://picsum.photos/id/${x.id}/${w}/${h}`;
      return `<div class="img-card"><img src="${src}" alt="${x.author}"><div class="pad"><small class="muted">Autor: ${x.author}</small>
        <div style="margin-top:6px"><button class="primary" data-fav='${JSON.stringify({type:"image",author:x.author,url:src})}'>Favoritar</button></div></div></div>`;
    }).join("");
    container.insertAdjacentHTML("beforeend", nodes);
    qsa('button[data-fav]').forEach(b => b.addEventListener("click", ()=> saveFav(JSON.parse(b.getAttribute("data-fav")))));
    gsap.from(".img-card",{opacity:0, y:10, stagger:.02});
  }catch(e){
    container.innerHTML = `<div class='loading'>Erro: ${e.message}</div>`;
  }
}
function loadImagesPreview(){
  const preview = qs("#homeImgsPreview");
  if(!preview) return;
  fetch("https://picsum.photos/v2/list?page=1&limit=6").then(r=>r.json()).then(arr=>{
    preview.innerHTML = arr.map(x=>`<img src="https://picsum.photos/id/${x.id}/300/180" alt="${x.author}" style="width:100%;margin-bottom:6px;border-radius:6px">`).join("");
  }).catch(()=> preview.innerHTML = "<div class='muted'>Preview indisponível</div>");
}
qs("#reloadImages")?.addEventListener("click", ()=> { qs("#imagesMasonry").innerHTML=""; state.imagesPage = 1; loadImages(1); });

// infinite scroll
window.addEventListener("scroll", ()=>{
  if((window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 1200)){
    if(!state.loadingImages){
      state.loadingImages = true;
      state.imagesPage = (state.imagesPage || 1) + 1;
      loadImages(state.imagesPage).then(()=> state.loadingImages = false);
    }
  }
});

/* ========== CHAT (WebSocket echo) ========= */
function initChat(){
  const chatLog = qs("#chatLog");
  const chatForm = qs("#chatForm");
  const chatInput = qs("#chatInput");
  const chatStatus = qs("#chatStatus");
  if(!chatLog || !chatForm) return;

  let ws;
  function connect(){
    try{
      ws = new WebSocket("wss://ws.ifelse.io");
      ws.addEventListener("open", ()=> chatStatus.textContent = "Conectado (echo)");
      ws.addEventListener("message", ev => addMsg(ev.data, "other"));
      ws.addEventListener("close", ()=> chatStatus.textContent = "Desconectado — tentando reconectar...");
      ws.addEventListener("error", ()=> chatStatus.textContent = "Erro no chat");
    }catch(e){ chatStatus.textContent = "Erro WS"; }
  }
  function addMsg(text, who="me"){ const d = document.createElement("div"); d.className = "msg " + (who==="me"?"me":"other"); d.textContent = text; chatLog.appendChild(d); chatLog.scrollTop = chatLog.scrollHeight; }
  chatForm.addEventListener("submit", e => {
    e.preventDefault();
    const txt = chatInput.value.trim(); if(!txt || !ws || ws.readyState !== 1) return;
    addMsg(txt, "me"); ws.send(txt); chatInput.value = "";
  });
  connect();
  setInterval(()=> { if(!ws || ws.readyState === 3) connect(); }, 4000);
}

/* ========== LOGIN / SIGNUP (localStorage simulated) ========== */
function initLogin(){
  const form = qs("#loginForm");
  if(!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const u = qs("#loginUser").value.trim();
    const p = qs("#loginPass").value;
    const stored = localStorage.getItem("pt_pass_" + u);
    if(stored && stored === p){
      localStorage.setItem("pt_user", u);
      alert("Login OK");
      location.href = "perfil.html";
    } else qs("#loginMsg").textContent = "Credenciais inválidas.";
  });
}
function initSignup(){
  const form = qs("#signupForm");
  if(!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const u = qs("#signupUser").value.trim();
    const p = qs("#signupPass").value;
    if(u.length < 3 || p.length < 3) return qs("#signupMsg").textContent = "Mínimo 3 caracteres.";
    localStorage.setItem("pt_pass_" + u, p);
    localStorage.setItem("pt_user", u);
    alert("Cadastro feito. Redirecionando para o perfil...");
    location.href = "perfil.html";
  });
}

/* ========== PROFILE ========= */
function initProfile(){
  const user = localStorage.getItem("pt_user");
  if(!user) { alert("Você precisa entrar."); location.href = "login.html"; return; }
  qs("#profileInfo").innerHTML = `<div><strong>${user}</strong><div class="muted">Membro do Portal Interativo</div></div>`;
  renderFavsOnProfile();
  qs("#logoutBtnProfile")?.addEventListener("click", ()=> { localStorage.removeItem("pt_user"); location.href="index.html"; });
}

/* ========== BOOTSTRAP CALLS PARA CARREGAR DADOS INICIAIS ========== */
document.addEventListener("DOMContentLoaded", ()=>{
  // Always load home-ish content if available
  if(page === "index" || page === "home") {
    // home init is called in initPage()
  }
  // if user visited pages directly, initPage already called specific in DOMContentLoaded earlier
});

/* ========== NOTAS E LIMITAÇÕES ========= */
/*
 - Este projeto é um demo pesado: muitas requisições às APIs públicas ao abrir várias páginas.
 - Para produção: faça paginação adequada, lazy loading de módulos (código dividido) e proteja chaves.
 - Chat real requer backend (Firebase, Socket.io). Favoritos e auth em localStorage são apenas para protótipo.
*/
