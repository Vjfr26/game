/* Sprites generados por código en pixel art: monstruos nuevos, objetos, iconos y partículas.
   Se dibujan con el Canvas 2D y después se "pixelan": el alfa se binariza y se añade un
   contorno de 1 px, para que encajen con el estilo del paquete de gráficos. */
const Arte = (() => {
    function lienzo(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        return [c, g];
    }

    function rgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    /** Alfa a 0 o 255 y contorno exterior de 1 px (si se pide). */
    function pixelar(g, x0, y0, w, h, contorno) {
        const img = g.getImageData(x0, y0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] >= 100) d[i + 3] = 255;
            else d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        }
        if (contorno) {
            const [r, gg, b] = rgb(contorno);
            const opaco = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] === 255;
            const marcar = [];
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (opaco(x, y)) continue;
                    if (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1)) marcar.push((y * w + x) * 4);
                }
            }
            for (const i of marcar) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
        }
        g.putImageData(img, x0, y0);
    }

    /** Registra un lienzo como hoja de fotogramas numerados 0…n-1. */
    function registrar(escena, clave, canvas, fw, fh) {
        if (escena.textures.exists(clave)) escena.textures.remove(clave);
        const tex = escena.textures.addCanvas(clave, canvas);
        fw = fw || canvas.width; fh = fh || canvas.height;
        let i = 0;
        for (let y = 0; y + fh <= canvas.height; y += fh) {
            for (let x = 0; x + fw <= canvas.width; x += fw) tex.add(i++, 0, x, y, fw, fh);
        }
        return tex;
    }

    function pixel(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }

    function elipse(g, cx, cy, rx, ry, color) {
        g.fillStyle = color;
        g.beginPath(); g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); g.fill();
    }

    function poligono(g, puntos, color) {
        g.fillStyle = color;
        g.beginPath();
        puntos.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath(); g.fill();
    }

    /* ---------- Monedas ---------- */
    function monedas(escena) {
        const anchos = [10, 8, 5, 2, 5, 8];
        const [c, g] = lienzo(12 * anchos.length, 12);
        anchos.forEach((w, f) => {
            const ox = f * 12;
            for (let y = 0; y < 12; y++) {
                for (let x = 0; x < 12; x++) {
                    const dx = (x + 0.5 - 6) / (w / 2), dy = (y + 0.5 - 6) / 5.2;
                    if (dx * dx + dy * dy > 1) continue;
                    let col = '#f5c033';
                    if (dx * dx + dy * dy > 0.62) col = '#c98a12';
                    else if (dx < -0.1 && dy < 0.1) col = '#ffe680';
                    if (w >= 5 && Math.abs(x + 0.5 - 6) < 0.6 && Math.abs(dy) < 0.55) col = '#d99a1c';
                    pixel(g, ox + x, y, col);
                }
            }
            pixelar(g, ox, 0, 12, 12, '#6b3f02');
        });
        registrar(escena, 'moneda', c, 12, 12);
    }

    /* ---------- Corazones ---------- */
    function corazones(escena) {
        const forma = [
            '.XX...XX.',
            'XRRX.XRRX',
            'XRWRXRRRX',
            'XRRRRRRRX',
            'XRRRRRRRX',
            '.XRRRRRX.',
            '..XRRRX..',
            '...XRX...',
            '....X....',
        ];
        const [c, g] = lienzo(18, 9);
        [{ R: '#ff3b5c', W: '#ffd0d8' }, { R: '#3a2430', W: '#5a3a48' }].forEach((pal, f) => {
            forma.forEach((fila, y) => [...fila].forEach((ch, x) => {
                if (ch === 'X') pixel(g, f * 9 + x, y, '#26070f');
                else if (pal[ch]) pixel(g, f * 9 + x, y, pal[ch]);
            }));
        });
        registrar(escena, 'corazon', c, 9, 9);
    }

    /* ---------- Slimes (y el Rey Slime) ---------- */
    const COLORES_SLIME = {
        verde: { cuerpo: '#5ccf4a', claro: '#b6f59a', oscuro: '#2f8a2c', lado: '#45ac3a', borde: '#123d12' },
        morado: { cuerpo: '#a15ce0', claro: '#e0b6ff', oscuro: '#5e2a96', lado: '#8446c4', borde: '#2a0f45' },
        azul: { cuerpo: '#3fb6ec', claro: '#b6ecff', oscuro: '#1b6aa8', lado: '#2d92cc', borde: '#0b2c4a' },
        rey: { cuerpo: '#4fc79a', claro: '#b9f7dc', oscuro: '#227a5a', lado: '#3aa57e', borde: '#0d3a2a' },
    };

    function dibujarSlime(g, ox, W, H, sx, sy, pal, rey) {
        const rx = (W / 2 - 2.5) * sx, ry = (H - (rey ? 18 : 3)) * sy;
        const cx = W / 2, base = H - 1;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const dx = (x + 0.5 - cx) / rx, u = (base - y) / ry;
                if (u < 0 || dx * dx + u * u > 1) continue;
                if (u < 0.1 && Math.abs(dx) > 0.9) continue;
                let col = pal.cuerpo;
                if (u < 0.16) col = pal.oscuro;
                else if (dx > 0.5) col = pal.lado;
                if (u > 0.55 && dx < -0.12 && dx > -0.62 && u < 0.88) col = pal.claro;
                pixel(g, ox + x, y, col);
            }
        }
        pixelar(g, ox, 0, W, H, pal.borde);
        // Ojos (y boca y corona para el rey)
        const ojoY = Math.round(base - ry * (rey ? 0.5 : 0.48));
        const sep = Math.max(3, Math.round(rx * 0.36));
        const tam = rey ? 3 : 1;
        [-1, 1].forEach((lado) => {
            const ex = Math.round(cx + lado * sep - (lado < 0 ? tam : 0));
            g.fillStyle = '#ffffff'; g.fillRect(ox + ex - (rey ? 1 : 0), ojoY - tam - 1, tam + (rey ? 2 : 1), tam + 3);
            g.fillStyle = '#10141c'; g.fillRect(ox + ex, ojoY - tam, tam, tam + 1);
            if (rey) { g.fillStyle = '#ffffff'; g.fillRect(ox + ex, ojoY - tam, 1, 1); }
        });
        if (rey) {
            // Cejas enfadadas y boca con dientes
            g.fillStyle = pal.borde;
            g.fillRect(ox + cx - sep - 4, ojoY - 7, 5, 2); g.fillRect(ox + cx - sep + 1, ojoY - 6, 2, 1);
            g.fillRect(ox + cx + sep, ojoY - 7, 5, 2); g.fillRect(ox + cx + sep - 2, ojoY - 6, 2, 1);
            const by = ojoY + 5;
            g.fillStyle = '#3a0c1a'; g.fillRect(ox + cx - 7, by, 14, 4);
            g.fillStyle = '#ffffff';
            for (let i = 0; i < 4; i++) g.fillRect(ox + cx - 6 + i * 4, by, 2, 2);
            // Corona dorada con joyas
            const top = Math.round(base - ry) - 1;
            const corona = [
                '.G......G......G.',
                'GYG....GYG....GYG',
                'GYYG..GYYYG..GYYG',
                'GYYYGGYYRYYGGYYYG',
                'GYYYYYYYYYYYYYYYG',
                'GYBYYYYYRYYYYYBYG',
                'GYYYYYYYYYYYYYYYG',
                'GGGGGGGGGGGGGGGGG',
            ];
            const pal2 = { G: '#7a4a00', Y: '#ffd23f', R: '#ff3b5c', B: '#4fd2ff' };
            const ancho = corona[0].length;
            corona.forEach((fila, y) => [...fila].forEach((ch, x) => {
                if (pal2[ch]) pixel(g, ox + Math.round(cx - ancho / 2) + x, top - corona.length + 2 + y, pal2[ch]);
            }));
        }
    }

    function slime(escena, clave, W, H, pal, rey) {
        const formas = [[1, 1], [1.14, 0.8], [0.86, 1.16], [1.05, 0.95]];
        const [c, g] = lienzo(W * formas.length, H);
        formas.forEach(([sx, sy], f) => dibujarSlime(g, f * W, W, H, sx, sy, pal, rey));
        registrar(escena, clave, c, W, H);
    }

    /* ---------- Murciélago ---------- */
    function murcielago(escena) {
        const W = 24, H = 16;
        const puntas = [1, 6, 12, 6];
        const [c, g] = lienzo(W * 4, H);
        puntas.forEach((ty, f) => {
            const ox = f * W;
            [-1, 1].forEach((lado) => {
                const sx = (v) => ox + 12 + lado * v;
                poligono(g, [[sx(2), 7], [sx(11), ty], [sx(10), ty + 3], [sx(7), ty + 2], [sx(6), 10], [sx(3), 10]], '#3b2560');
                g.fillStyle = '#5a3a86'; g.fillRect(Math.min(sx(3), sx(9)), Math.min(ty + 1, 8), 1, 1);
            });
            elipse(g, ox + 12, 8, 4, 4.5, '#5b3a8c');
            elipse(g, ox + 12, 9.5, 2.5, 2.5, '#7a55aa');
            poligono(g, [[ox + 9, 5], [ox + 9.5, 1.5], [ox + 11, 4.5]], '#5b3a8c');
            poligono(g, [[ox + 15, 5], [ox + 14.5, 1.5], [ox + 13, 4.5]], '#5b3a8c');
            pixelar(g, ox, 0, W, H, '#140a22');
            pixel(g, ox + 10, 7, '#ff4d6d'); pixel(g, ox + 13, 7, '#ff4d6d');
            pixel(g, ox + 11, 10, '#ffffff'); pixel(g, ox + 12, 10, '#ffffff');
        });
        registrar(escena, 'murcielago', c, W, H);
    }

    /* ---------- Abeja ---------- */
    function abeja(escena) {
        const W = 18, H = 16;
        const [c, g] = lienzo(W * 2, H);
        [3, 5].forEach((ay, f) => {
            const ox = f * W;
            elipse(g, ox + 7, ay, 3.5, 2.5, 'rgba(225,245,255,0.95)');
            elipse(g, ox + 10.5, ay + 0.5, 3, 2.2, 'rgba(200,232,255,0.95)');
            elipse(g, ox + 9, 9.5, 5.5, 4, '#ffcf33');
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = '#2b2118';
            g.fillRect(ox + 6, 5, 2, 10); g.fillRect(ox + 10, 5, 2, 10);
            g.globalCompositeOperation = 'source-over';
            elipse(g, ox + 15, 8.5, 2.6, 2.8, '#2b2118');
            poligono(g, [[ox + 4, 8.5], [ox + 0.5, 10], [ox + 4, 11.5]], '#2b2118');
            pixelar(g, ox, 0, W, H, '#3a2600');
            pixel(g, ox + 16, 7, '#ffffff');
        });
        registrar(escena, 'abeja', c, W, H);
    }

    /* ---------- Fantasma ---------- */
    function fantasma(escena) {
        const W = 22, H = 24;
        const [c, g] = lienzo(W * 4, H);
        for (let f = 0; f < 4; f++) {
            const ox = f * W;
            g.fillStyle = '#eef3ff';
            g.beginPath();
            g.arc(ox + 11, 10, 8, Math.PI, 0);
            g.lineTo(ox + 19, 18);
            for (let i = 0; i <= 4; i++) {
                const x = ox + 19 - i * 4;
                const y = 18 + ((i + f) % 2 === 0 ? 3 : 0);
                g.lineTo(x, y);
            }
            g.lineTo(ox + 3, 10);
            g.closePath(); g.fill();
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = '#c4cff2'; g.fillRect(ox + 15, 0, 6, H);
            g.fillStyle = '#ffffff'; g.fillRect(ox + 6, 4, 3, 3);
            g.globalCompositeOperation = 'source-over';
            pixelar(g, ox, 0, W, H, '#2c3560');
            g.fillStyle = '#1d2340';
            g.fillRect(ox + 7, 9, 2, 3); g.fillRect(ox + 13, 9, 2, 3);
            g.fillRect(ox + 10, 14, 2, 2);
            pixel(g, ox + 7, 9, '#5a6aa0'); pixel(g, ox + 13, 9, '#5a6aa0');
        }
        registrar(escena, 'fantasma', c, W, H);
    }

    /* ---------- Pinchos, bandera de control y proyectiles ---------- */
    function pinchos(escena) {
        const [c, g] = lienzo(16, 12);
        for (let i = 0; i < 4; i++) {
            poligono(g, [[i * 4, 10], [i * 4 + 2, 1], [i * 4 + 4, 10]], '#d3d9e6');
            poligono(g, [[i * 4 + 2, 1], [i * 4 + 4, 10], [i * 4 + 2, 10]], '#8a93a8');
        }
        g.fillStyle = '#4a4f5e'; g.fillRect(0, 9, 16, 3);
        pixelar(g, 0, 0, 16, 12, '#1e212b');
        registrar(escena, 'pinchos', c);
    }

    function bandera(escena) {
        const W = 26, H = 44;
        const [c, g] = lienzo(W * 4, H);
        for (let f = 0; f < 4; f++) {
            const ox = f * W;
            g.fillStyle = '#6b4a2b'; g.fillRect(ox + 4, 5, 3, 36);
            g.fillStyle = '#8c6239'; g.fillRect(ox + 4, 5, 1, 36);
            elipse(g, ox + 5.5, 4, 2.6, 2.6, f ? '#ffd23f' : '#9a9aa4');
            g.fillStyle = '#6e6a60'; g.fillRect(ox + 1, 39, 10, 5);
            if (f === 0) {
                poligono(g, [[ox + 7, 8], [ox + 15, 10], [ox + 14, 17], [ox + 7, 20]], '#7d7d88');
            } else {
                const o = [0, 2, -1, 1][f];
                const pts = [[ox + 7, 7], [ox + 12, 7 + o], [ox + 18, 7 - o], [ox + 24, 8], [ox + 24, 17], [ox + 18, 16 - o], [ox + 12, 16 + o], [ox + 7, 17]];
                poligono(g, pts, '#e2453c');
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = '#ffd23f'; g.fillRect(ox + 7, 14 + Math.min(0, o), 18, 2);
                g.fillStyle = '#ff8a6a'; g.fillRect(ox + 7, 8, 18, 1);
                g.globalCompositeOperation = 'source-over';
            }
            pixelar(g, ox, 0, W, H, '#2a1a12');
        }
        registrar(escena, 'bandera', c, W, H);
    }

    function proyectiles(escena) {
        // Magia: dos fotogramas que alternan el brillo
        let [c, g] = lienzo(28, 14);
        [0, 1].forEach((f) => {
            const ox = f * 14;
            elipse(g, ox + 7, 7, 6.5 - f * 0.5, 6.5 - f * 0.5, '#4fd2ff');
            elipse(g, ox + 7, 7, 4.5, 4.5, '#aef3ff');
            elipse(g, ox + 7, 7, 2.5 + f * 0.5, 2.5 + f * 0.5, '#ffffff');
            pixelar(g, ox, 0, 14, 14, null);
        });
        registrar(escena, 'magia', c, 14, 14);

        [c, g] = lienzo(12, 12);
        elipse(g, 6, 6.5, 5, 4.6, '#6fdc4f');
        elipse(g, 4.5, 4.5, 1.8, 1.4, '#d6ffb0');
        pixelar(g, 0, 0, 12, 12, '#16471a');
        registrar(escena, 'baba', c);

        [c, g] = lienzo(28, 16);
        elipse(g, 14, 16, 13, 15, '#ffffff');
        g.globalCompositeOperation = 'destination-out';
        elipse(g, 14, 17, 9, 11, '#000');
        g.globalCompositeOperation = 'source-over';
        pixelar(g, 0, 0, 28, 16, null);
        registrar(escena, 'onda', c);
    }

    /* ---------- Poderes e iconos ---------- */
    function iconos(escena) {
        let [c, g] = lienzo(18, 20);
        g.save(); g.translate(9, 10); g.rotate(-0.6);
        elipse(g, 0, -1, 4, 8.5, '#f0f6ff');
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = '#c3d6f5'; g.fillRect(0, -10, 5, 20);
        g.fillStyle = '#7fe0ff'; g.fillRect(-5, -10, 10, 3);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#7f94bf'; g.fillRect(-0.5, -6, 1, 15);
        g.restore();
        pixelar(g, 0, 0, 18, 20, '#26355c');
        registrar(escena, 'pluma', c);

        [c, g] = lienzo(18, 20);
        poligono(g, [[2, 2], [16, 2], [16, 10], [9, 18], [2, 10]], '#ffd23f');
        poligono(g, [[4, 4], [14, 4], [14, 10], [9, 15.5], [4, 10]], '#3d8bff');
        g.fillStyle = '#ffffff'; g.fillRect(8, 6, 2, 7); g.fillRect(6, 8, 6, 2);
        pixelar(g, 0, 0, 18, 20, '#13254a');
        registrar(escena, 'escudo', c);

        // Burbuja del escudo: suave a propósito, sin pixelar
        [c, g] = lienzo(60, 76);
        const grad = g.createRadialGradient(30, 38, 10, 30, 38, 36);
        grad.addColorStop(0, 'rgba(120,200,255,0.02)');
        grad.addColorStop(0.8, 'rgba(120,200,255,0.18)');
        grad.addColorStop(1, 'rgba(160,225,255,0.7)');
        g.fillStyle = grad;
        g.beginPath(); g.ellipse(30, 38, 28, 36, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(210,240,255,0.9)'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(30, 38, 27, 35, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
        g.beginPath(); g.arc(30, 38, 22, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
        registrar(escena, 'burbuja', c);

        // Cargas de magia (llena / vacía)
        [c, g] = lienzo(24, 12);
        [['#5fd0ff', '#d4f6ff'], ['#22364c', '#33506c']].forEach(([cu, br], f) => {
            poligono(g, [[f * 12 + 6, 1], [f * 12 + 11, 6], [f * 12 + 6, 11], [f * 12 + 1, 6]], cu);
            pixel(g, f * 12 + 5, 4, br); pixel(g, f * 12 + 6, 3, br);
            pixelar(g, f * 12, 0, 12, 12, '#0b1726');
        });
        registrar(escena, 'mana', c, 12, 12);

        // Estrellas del resumen (llena / vacía)
        [c, g] = lienzo(56, 28);
        [['#ffd23f', '#fff1a6'], ['#3a3346', '#4b4358']].forEach(([cu, br], f) => {
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? 5.5 : 12.5, a = -Math.PI / 2 + i * Math.PI / 5;
                pts.push([f * 28 + 14 + Math.cos(a) * r, 15 + Math.sin(a) * r]);
            }
            poligono(g, pts, cu);
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = br; g.fillRect(f * 28 + 6, 3, 8, 8);
            g.globalCompositeOperation = 'source-over';
            pixelar(g, f * 28, 0, 28, 28, '#3d2200');
        });
        registrar(escena, 'estrella', c, 28, 28);

        // Pausa, sonido sí, sonido no, candado
        [c, g] = lienzo(64, 16);
        g.fillStyle = '#ffffff';
        g.fillRect(4, 3, 3, 10); g.fillRect(9, 3, 3, 10);
        poligono(g, [[17, 6], [20, 6], [24, 2], [24, 14], [20, 10], [17, 10]], '#ffffff');
        g.fillRect(26, 6, 1, 4); g.fillRect(28, 4, 1, 8); g.fillRect(30, 2, 1, 12);
        poligono(g, [[33, 6], [36, 6], [40, 2], [40, 14], [36, 10], [33, 10]], '#ffffff');
        g.fillStyle = '#ff5a6e';
        for (let i = 0; i < 6; i++) { g.fillRect(42 + i, 5 + i, 1, 1); g.fillRect(47 - i, 5 + i, 1, 1); }
        g.fillStyle = '#c9b48a'; g.fillRect(50, 7, 12, 8);
        g.strokeStyle = '#c9b48a'; g.lineWidth = 2; g.beginPath(); g.arc(56, 7, 3.5, Math.PI, 0); g.stroke();
        g.fillStyle = '#4a3a20'; g.fillRect(55, 9, 2, 3);
        pixelar(g, 0, 0, 64, 16, '#151020');
        registrar(escena, 'iconos', c, 16, 16);
    }

    /* ---------- Paneles de la interfaz (para NineSlice, esquinas de 8 px) ---------- */
    function paneles(escena) {
        const [c, g] = lienzo(48, 48);
        g.fillStyle = '#2a1408'; g.fillRect(0, 0, 48, 48);
        g.fillStyle = '#c8924e'; g.fillRect(2, 2, 44, 44);
        g.fillStyle = '#9a6a36'; g.fillRect(3, 3, 42, 42);
        g.fillStyle = '#6b4423'; g.fillRect(5, 5, 38, 38);
        g.fillStyle = '#7d5230'; g.fillRect(5, 5, 38, 2);
        g.fillStyle = '#54351a'; g.fillRect(5, 41, 38, 2);
        g.fillStyle = '#ffd23f';
        for (const [x, y] of [[5, 5], [41, 5], [5, 41], [41, 41]]) g.fillRect(x, y, 2, 2);
        for (const [x, y] of [[0, 0], [47, 0], [0, 47], [47, 47]]) g.clearRect(x, y, 1, 1);
        registrar(escena, 'panel', c);
    }

    /* ---------- Plataformas (48 × 14): madera, madera con herrajes (móvil) y piedra ---------- */
    function plataformas(escena) {
        const madera = (g, herrajes) => {
            g.fillStyle = '#2a1408'; g.fillRect(0, 0, 48, 13);
            g.fillStyle = '#b5773f'; g.fillRect(1, 1, 46, 11);
            g.fillStyle = '#e0a868'; g.fillRect(1, 1, 46, 2);
            g.fillStyle = '#8a5428'; g.fillRect(1, 9, 46, 3);
            g.fillStyle = '#6b3f1c';
            for (const x of [16, 32]) g.fillRect(x, 1, 1, 11);
            g.fillStyle = '#c98c50';
            for (const [x, y] of [[5, 5], [21, 6], [37, 5], [11, 7], [27, 4], [43, 7]]) g.fillRect(x, y, 3, 1);
            g.fillStyle = '#3a2410';
            for (const x of [3, 13, 19, 29, 35, 45]) g.fillRect(x, 4, 1, 1);
            if (herrajes) {
                g.fillStyle = '#5b6573'; g.fillRect(1, 1, 5, 11); g.fillRect(42, 1, 5, 11);
                g.fillStyle = '#c9d4e0'; g.fillRect(1, 1, 5, 2); g.fillRect(42, 1, 5, 2);
                g.fillStyle = '#ffd23f'; g.fillRect(3, 6, 1, 1); g.fillRect(44, 6, 1, 1);
            }
            // Sombra inferior para que se lea como un objeto sólido
            g.fillStyle = 'rgba(20,10,4,0.55)'; g.fillRect(2, 13, 44, 1);
        };
        let [c, g] = lienzo(48, 14); madera(g, false); registrar(escena, 'plat_madera', c);
        // Pasarela larga (5 casillas): dos tablones unidos
        [c, g] = lienzo(80, 14);
        const [c1, g1] = lienzo(48, 14); madera(g1, false);
        g.drawImage(c1, 0, 0, 40, 14, 0, 0, 40, 14);
        g.drawImage(c1, 8, 0, 40, 14, 40, 0, 40, 14);
        g.fillStyle = '#2a1408'; g.fillRect(0, 0, 1, 13); g.fillRect(79, 0, 1, 13);
        g.fillStyle = '#6b3f1c'; g.fillRect(40, 1, 1, 11);
        registrar(escena, 'plat_larga', c);
        // Cuerda de la que cuelgan las pasarelas: se desvanece hacia arriba, entre las copas
        [c, g] = lienzo(3, 96);
        for (let y = 0; y < 96; y++) {
            const a = Math.min(1, y / 70);
            g.fillStyle = `rgba(122,86,46,${a})`; g.fillRect(1, y, 1, 1);
            g.fillStyle = `rgba(60,38,18,${a})`; g.fillRect(0, y, 1, 1); g.fillRect(2, y, 1, 1);
            if (y % 6 === 0) { g.fillStyle = `rgba(170,128,76,${a})`; g.fillRect(1, y, 1, 1); }
        }
        registrar(escena, 'cuerda', c);
        [c, g] = lienzo(48, 14); madera(g, true); registrar(escena, 'plat_movil', c);

        [c, g] = lienzo(48, 14);
        g.fillStyle = '#1e212b'; g.fillRect(0, 0, 48, 13);
        g.fillStyle = '#8a93a8'; g.fillRect(1, 1, 46, 11);
        g.fillStyle = '#b9c2d4'; g.fillRect(1, 1, 46, 2);
        g.fillStyle = '#5d6478'; g.fillRect(1, 9, 46, 3);
        g.fillStyle = '#4a5064';
        for (const x of [15, 31]) g.fillRect(x, 1, 1, 11);
        g.fillStyle = '#3d4254'; g.fillRect(8, 4, 1, 3); g.fillRect(9, 6, 2, 1); g.fillRect(24, 5, 1, 4); g.fillRect(38, 3, 2, 1); g.fillRect(39, 4, 1, 3);
        g.fillStyle = '#7fae3c'; g.fillRect(1, 0, 9, 2); g.fillRect(19, 0, 6, 2); g.fillRect(34, 0, 10, 2);
        g.fillStyle = '#b6d45a'; g.fillRect(3, 0, 3, 1); g.fillRect(36, 0, 4, 1);
        g.fillStyle = 'rgba(10,10,20,0.55)'; g.fillRect(2, 13, 44, 1);
        registrar(escena, 'plat_piedra', c);
    }

    /* ---------- Partículas y luces ---------- */
    function particulas(escena) {
        let [c, g] = lienzo(2, 2); g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); registrar(escena, 'px', c);
        [c, g] = lienzo(4, 4); g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); registrar(escena, 'px4', c);
        [c, g] = lienzo(7, 7); g.fillStyle = '#fff';
        g.fillRect(3, 0, 1, 7); g.fillRect(0, 3, 7, 1); g.fillRect(2, 2, 3, 3);
        registrar(escena, 'chispa', c);
        [c, g] = lienzo(7, 5);
        elipse(g, 3.5, 2.5, 3.4, 1.8, '#ffffff'); pixelar(g, 0, 0, 7, 5, null);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1, 2, 5, 1);
        registrar(escena, 'hoja', c);

        const suave = (clave, tam, paradas) => {
            const [cc, gg] = lienzo(tam, tam);
            const gr = gg.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
            paradas.forEach(([p, col]) => gr.addColorStop(p, col));
            gg.fillStyle = gr; gg.fillRect(0, 0, tam, tam);
            registrar(escena, clave, cc);
        };
        // Viñeta: transparente en el centro y opaca en los bordes
        [c, g] = lienzo(192, 108);
        const vg = g.createRadialGradient(96, 54, 30, 96, 54, 110);
        vg.addColorStop(0, 'rgba(255,255,255,0)');
        vg.addColorStop(0.55, 'rgba(255,255,255,0.15)');
        vg.addColorStop(1, 'rgba(255,255,255,0.95)');
        g.fillStyle = vg; g.fillRect(0, 0, 192, 108);
        registrar(escena, 'vineta', c);
        suave('humo', 12, [[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
        suave('luz', 128, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
        suave('brillo', 48, [[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);

        [c, g] = lienzo(40, 40);
        g.strokeStyle = '#ffffff'; g.lineWidth = 3;
        g.beginPath(); g.arc(20, 20, 17, 0, Math.PI * 2); g.stroke();
        registrar(escena, 'anillo', c);
    }

    return {
        /** Genera todas las texturas (en la escena de arranque). */
        generar(escena) {
            monedas(escena);
            corazones(escena);
            slime(escena, 'slime_verde', 22, 18, COLORES_SLIME.verde, false);
            slime(escena, 'slime_morado', 22, 18, COLORES_SLIME.morado, false);
            slime(escena, 'slime_azul', 22, 18, COLORES_SLIME.azul, false);
            slime(escena, 'rey', 64, 58, COLORES_SLIME.rey, true);
            murcielago(escena);
            abeja(escena);
            fantasma(escena);
            pinchos(escena);
            bandera(escena);
            proyectiles(escena);
            iconos(escena);
            paneles(escena);
            plataformas(escena);
            particulas(escena);
        },
        COLORES_SLIME,
    };
})();
