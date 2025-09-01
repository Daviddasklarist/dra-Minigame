/* RADIO AUGSBURG 404 Runner (ES5, ohne Abhängigkeiten)
   - Schwarz/Weiß, Dino-Style
   - Springendes RA-Logo (vektorisiert)
   - Hindernisse: Rathaus / Perlach / Theater / Schlagloch
   - €-Coins -> verteilen auf 3 Sanierungsprojekte
   - Richtiger Restart (Speed/Spawns reset + Start-Safety)
*/
(function () {
  // Public API (optional): RA404.attach(canvasOrId)
  window.RA404 = { attach: attach };

  function onReady(fn){ if(document.readyState!=="loading"){ fn(); } else { document.addEventListener("DOMContentLoaded", fn); } }

  onReady(function(){
    var el = document.getElementById("ra404");
    if (el) attach(el);
  });

  function attach(target){
    var cvs = typeof target==="string" ? document.getElementById(target) : target;
    if(!cvs || !cvs.getContext) return;
    var ctx = cvs.getContext("2d");
    var DPR = Math.max(1, Math.min(window.devicePixelRatio||1, 2));
    var last = performance.now();

    // robust skalieren (ohne aspect-ratio)
    function size(){
      var w = Math.min(1100, document.documentElement.clientWidth * 0.96);
      var h = 350;
      cvs.style.width = w + "px";
      cvs.style.height = h + "px";
      cvs.width  = Math.round(w * DPR);
      cvs.height = Math.round(h * DPR);
    }
    size(); window.addEventListener("resize", size);

    // Projekte
    var PROJECTS = [
      { n:"Perlach",  g:404,  a:0, d:false },
      { n:"Rathaus",  g:808,  a:0, d:false },
      { n:"Theater",  g:1200, a:0, d:false }
    ];

    // LocalStorage-safe
    var LS = { get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(_){ return d; } },
               set:function(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } } };

    // Game State
    var G = {
      run:false,
      t:0,
      s:0.32, base:0.32,    // speed
      grav:0.0021,
      jump:-0.9,
      gy: function(){ return Math.floor(cvs.height * 0.78); },
      eur:0,
      hi: (LS.get("ra404_hi_eur",0)|0),
      p:{ x:150*DPR, y:0, w:96*DPR, h:96*DPR, vy:0, ground:false },
      obs:[], coins:[], bg:[],
      nObs:0, nCoin:0, nBg:0,
      safe:0,
      hintTxt:"", hintUntil:0
    };

    function reset(now){
      if(now==null) now=performance.now();
      G.t=now; G.s=G.base; G.eur=0;
      G.obs.length=0; G.coins.length=0; G.bg.length=0;
      G.p.vy=0; G.p.y=G.gy()-G.p.h; G.p.ground=true;
      G.nObs=now+950; G.nCoin=now+700; G.nBg=now+600;
      G.safe=now+1200; // 1.2s safety
      for (var i=0;i<PROJECTS.length;i++){ PROJECTS[i].a=0; PROJECTS[i].d=false; }
    }

    // Drawing helpers
    function roundedRect(x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.fill();
    }
    function drawLogo(x,y,w,h,onGround){
      var ground = G.gy();
      // Körper (RA-Logo vereinfacht)
      ctx.save();
      ctx.translate(x+w/2, y-h/2);
      ctx.rotate(onGround?0:-0.08);
      ctx.translate(-w/2, -h/2);
      ctx.fillStyle = "#000";
      var r = Math.min(w,h)*0.28;
      roundedRect(0,0,w,h,r);
      // Innenausschnitt
      ctx.globalCompositeOperation = "destination-out";
      roundedRect(w*0.18, h*0.18, w*0.64, h*0.64, r*0.7);
      ctx.globalCompositeOperation = "source-over";
      // Querbalken „a“
      ctx.fillStyle="#000";
      ctx.fillRect(w*0.58, h*0.62, w*0.24, h*0.22);
      ctx.restore();
      // Schatten
      var sh = Math.max(0.3, 1 - (ground - y) / (160*DPR));
      ctx.fillStyle="#0002";
      ctx.beginPath();
      ctx.ellipse(x+w/2, ground+6*DPR, (w*0.5)*sh, (8*DPR)*sh, 0, 0, Math.PI*2);
      ctx.fill();
    }
    function drawGround(){
      var y = G.gy();
      ctx.strokeStyle="#000"; ctx.lineWidth=Math.max(2,2*DPR);
      ctx.beginPath(); ctx.moveTo(0, y+0.5); ctx.lineTo(cvs.width, y+0.5); ctx.stroke();
      var step=28*DPR, scroll=(G.t*G.s*170)%step; ctx.fillStyle="#000";
      for(var x=-scroll; x<cvs.width; x+=step){ ctx.fillRect(x, y+8*DPR, 9*DPR, 2*DPR); }
    }
    function drawCrane(c){
      var x=c.x, y=G.gy()-40*DPR, h=110*DPR;
      ctx.strokeStyle="#000"; ctx.globalAlpha=0.1; ctx.lineWidth=2*DPR;
      ctx.beginPath();
      ctx.moveTo(x,y); ctx.lineTo(x,y-h);
      ctx.moveTo(x-30*DPR,y-h+10*DPR); ctx.lineTo(x+90*DPR,y-h+10*DPR);
      ctx.moveTo(x+30*DPR,y-h+10*DPR); ctx.lineTo(x+30*DPR,y-h+40*DPR);
      ctx.stroke(); ctx.globalAlpha=1;
    }
    function drawObstacle(o){
      var y = G.gy();
      ctx.fillStyle="#000";
      if(o.k==="hole"){
        ctx.beginPath();
        ctx.ellipse(o.x+o.w/2, y+5*DPR, o.w/2, 8*DPR, 0, 0, Math.PI*2);
        ctx.fill();
        return;
      }
      // Rathaus / Perlach / Theater als simple Vektorformen
      ctx.save(); ctx.translate(o.x, y-o.h);
      var u=6*DPR;
      if(o.k==="rathaus"){
        ctx.fillRect(2*u,5*u,2*u,6*u); ctx.fillRect(8*u,5*u,2*u,6*u);
        ctx.fillRect(0*u,8*u,12*u,3*u);
        ctx.fillRect(1*u,11*u,10*u,5*u);
        ctx.clearRect(2*u,12*u,1*u,2*u);
        ctx.clearRect(4*u,12*u,1*u,2*u);
        ctx.clearRect(6*u,12*u,1*u,2*u);
        ctx.clearRect(8*u,12*u,1*u,2*u);
        ctx.clearRect(5.5*u,14*u,1*u,2*u);
      } else if(o.k==="perlach"){
        ctx.fillRect(5*u,2*u,2*u,14*u);
        ctx.fillRect(4*u,1*u,4*u,1*u);
        ctx.clearRect(5.5*u,3*u,1*u,1*u);
        ctx.clearRect(5.5*u,5*u,1*u,1*u);
        ctx.clearRect(5.5*u,7*u,1*u,1*u);
        ctx.clearRect(5.5*u,9*u,1*u,1*u);
        ctx.clearRect(5.5*u,11*u,1*u,1*u);
      } else {
        // Theater
        ctx.fillRect(1*u,12*u,10*u,4*u);
        ctx.beginPath(); ctx.moveTo(1*u,12*u); ctx.lineTo(11*u,12*u); ctx.lineTo(6*u,7*u); ctx.closePath(); ctx.fill();
        ctx.clearRect(2*u,13*u,1*u,2*u);
        ctx.clearRect(4*u,13*u,1*u,2*u);
        ctx.clearRect(6*u,13*u,1*u,2*u);
        ctx.clearRect(8*u,13*u,1*u,2*u);
      }
      ctx.restore();
    }
    function drawCoin(c){
      ctx.fillStyle="#000";
      ctx.beginPath(); ctx.arc(c.x, c.y, 6*DPR, 0, Math.PI*2); ctx.fill();
      ctx.clearRect(c.x-2*DPR, c.y-3*DPR, 4*DPR, 6*DPR); // kleines €-Loch
    }

    // Collision
    function rectRect(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
    function circleRect(c,r){
      var pr={x:r.x, y:r.y-r.h, w:r.w, h:r.h};
      var cx=Math.max(pr.x, Math.min(c.x, pr.x+pr.w));
      var cy=Math.max(pr.y, Math.min(c.y, pr.y+pr.h));
      var dx=c.x-cx, dy=c.y-cy, rr=6*DPR;
      return dx*dx + dy*dy <= rr*rr;
    }
    function pRect(){ return {x:G.p.x, y:G.p.y-G.p.h, w:G.p.w, h:G.p.h}; }

    // Logic helpers
    function flash(t){ G.hintTxt=t; G.hintUntil=G.t+1100; }
    function deposit(n){
      var open=[]; for(var i=0;i<PROJECTS.length;i++){ if(!PROJECTS[i].d) open.push(PROJECTS[i]); }
      if(!open.length) return;
      var s = n/open.length;
      for(i=0;i<open.length;i++){
        var p=open[i]; p.a+=s; if(p.a>=p.g){ p.a=p.g; p.d=true; flash("✓ "+p.n); }
      }
    }

    // Spawns
    function spawnObs(){
      var r=Math.random();
      if(r<0.25){
        var w=60*DPR;
        G.obs.push({ k:"hole", x:cvs.width+20*DPR, y:G.gy(), w:w, h:12*DPR });
      } else {
        var kinds=["rathaus","perlach","theater"];
        var k=kinds[(Math.random()*kinds.length)|0];
        var sc=1 + Math.random()*0.2;
        var h=18*6*DPR*sc, w2=12*6*DPR*sc;
        G.obs.push({ k:k, x:cvs.width+20*DPR, y:G.gy(), w:w2, h:h });
      }
    }
    function spawnCoin(){
      var y = G.gy() - (30*DPR + Math.random()*90*DPR);
      G.coins.push({ x:cvs.width+20*DPR, y:y });
    }
    function spawnBg(){ G.bg.push({ x:cvs.width+60*DPR }); }

    // Update/Render
    function update(now,dt){
      G.t = now; if(!G.run) return;
      G.s += 0.0000035 * dt; // Speed ramp
      // Player
      G.p.vy += G.grav*dt; G.p.y += G.p.vy*dt;
      var gy=G.gy();
      if(G.p.y>=gy){ G.p.y=gy; G.p.vy=0; G.p.ground=true; } else { G.p.ground=false; }
      // Spawns
      if(now>G.nBg){ spawnBg(); G.nBg = now + 1800 + Math.random()*1800; }
      if(now>G.nCoin){ spawnCoin(); G.nCoin = now + 600 + Math.random()*800; }
      if(now>G.nObs && now>G.safe){ spawnObs(); G.nObs = now + (820 + Math.random()*900) / (1 + (G.s-G.base)*2); }
      // Move
      var i,b,c,o;
      for(i=G.bg.length-1;i>=0;i--){ b=G.bg[i]; b.x -= 0.06*dt*DPR*4; if(b.x<-120*DPR) G.bg.splice(i,1); }
      for(i=G.coins.length-1;i>=0;i--){ c=G.coins[i]; c.x -= G.s*dt*0.95*DPR*4; if(c.x<-10) G.coins.splice(i,1);
        if(circleRect(c,G.p)){ G.eur+=1; deposit(1); G.coins.splice(i,1); flash("+€1"); }
      }
      for(i=G.obs.length-1;i>=0;i--){ o=G.obs[i]; o.x -= G.s*dt*0.95*DPR*4; if(o.x+o.w<-20) G.obs.splice(i,1);
        var ro = (o.k==="hole") ? {x:o.x,y:o.y-6*DPR,w:o.w,h:10*DPR} : {x:o.x,y:o.y-o.h,w:o.w,h:o.h};
        if(rectRect(pRect(), ro)){ over(); return; }
      }
    }

    function render(){
      ctx.clearRect(0,0,cvs.width,cvs.height);
      for(var i=0;i<G.bg.length;i++) drawCrane(G.bg[i]);
      drawGround();
      for(i=0;i<G.obs.length;i++) drawObstacle(G.obs[i]);
      for(i=0;i<G.coins.length;i++) drawCoin(G.coins[i]);
      drawLogo(G.p.x, G.p.y-G.p.h, G.p.w, G.p.h, G.p.ground);
      // HUD
      ctx.fillStyle="#000"; ctx.font=(14*DPR)+"px ui-monospace, monospace"; ctx.textBaseline="top";
      ctx.textAlign="right"; ctx.fillText("€ "+("0000"+G.eur).slice(-4), cvs.width-10*DPR, 8*DPR);
      if(G.hi>0){ ctx.textAlign="left"; ctx.fillText("HI € "+("0000"+G.hi).slice(-4), 10*DPR, 8*DPR); }
      // Projektbalken
      var x0=10*DPR, y0=26*DPR, w=120*DPR, h=4*DPR, gap=7*DPR;
      for(i=0;i<PROJECTS.length;i++){
        var p=PROJECTS[i], k=p.a/p.g;
        ctx.fillStyle="#000"; ctx.globalAlpha=0.16; ctx.fillRect(x0, y0+i*(h+gap), w, h);
        ctx.globalAlpha=1; ctx.fillRect(x0, y0+i*(h+gap), Math.round(w*Math.min(1,k)), h);
      }
      // Hints / Start
      if(!G.run){ ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("Leertaste / Tippen zum Springen", cvs.width/2, cvs.height/2); }
      if(G.t < G.hintUntil){ ctx.textAlign="center"; ctx.textBaseline="alphabetic"; ctx.fillText(G.hintTxt, cvs.width/2, 60*DPR); }
    }

    function loop(now){
      var dt = Math.min(50, now-last); last = now;
      update(now,dt); render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function start(){ if(!G.run){ reset(); G.run=true; flash("Augsburg baut…"); } }
    function over(){
      G.run=false;
      if(G.eur > G.hi){ G.hi = G.eur; LS.set("ra404_hi_eur", G.hi); }
      flash("Umleitung!");
    }
    function jump(){ if(G.p.ground){ G.p.vy = G.jump; G.p.ground=false; } }

    document.addEventListener("keydown", function(e){
      var c = e.code || e.key || "";
      if(c==="Space" || c==="ArrowUp" || c==="KeyW" || c==="Up"){
        e.preventDefault(); if(!G.run){ start(); } jump();
      }
    });
    cvs.addEventListener("pointerdown", function(){
      if(!G.run){ start(); } jump();
    }, {passive:true});

    // init paused
    reset();
  }
})();
