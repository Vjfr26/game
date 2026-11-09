/* Sonido sintetizado con WebAudio: efectos y música chiptune generados en el momento, sin
   archivos. El navegador solo deja sonar audio tras un gesto del jugador, así que todo
   arranca en la primera tecla o toque (Sonido.iniciar). */
const Sonido = (() => {
    const CLAVE = 'forest-quest-sonido';
    let activo = true;
    try { activo = localStorage.getItem(CLAVE) !== 'no'; } catch (e) { /* sin almacenamiento */ }

    let ctx = null, maestro = null, busSfx = null, busMusica = null, ruidoBuffer = null;

    function iniciar() {
        if (ctx) {
            if (ctx.state === 'suspended') ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        maestro = ctx.createGain();
        maestro.gain.value = activo ? 1 : 0;
        maestro.connect(ctx.destination);
        busSfx = ctx.createGain(); busSfx.gain.value = 0.55; busSfx.connect(maestro);
        busMusica = ctx.createGain(); busMusica.gain.value = 0.22; busMusica.connect(maestro);
        ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const datos = ruidoBuffer.getChannelData(0);
        for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
        if (pendiente) { const p = pendiente; pendiente = null; musica(p); }
    }

    /** Un tono con barrido de frecuencia y envolvente corta. */
    function tono({ tipo = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.25, retardo = 0, bus = busSfx }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.02);
    }

    /** Ráfaga de ruido filtrado: golpes, explosiones, salpicaduras. */
    function ruido({ dur = 0.15, vol = 0.3, f0 = 2000, f1 = 300, tipo = 'lowpass', retardo = 0 }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const src = ctx.createBufferSource();
        src.buffer = ruidoBuffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = tipo;
        filtro.frequency.setValueAtTime(f0, t);
        filtro.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filtro); filtro.connect(g); g.connect(busSfx);
        src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }

    const nota = (n) => 440 * Math.pow(2, (n - 69) / 12);

    const EFECTOS = {
        salto: () => tono({ f0: 260, f1: 640, dur: 0.13, vol: 0.12 }),
        sprint: () => { ruido({ dur: 0.18, vol: 0.16, f0: 3500, f1: 700, tipo: 'bandpass' }); tono({ tipo: 'triangle', f0: 300, f1: 520, dur: 0.12, vol: 0.06 }); },
        doble: () => { tono({ f0: 420, f1: 900, dur: 0.1, vol: 0.1 }); tono({ tipo: 'triangle', f0: 900, f1: 1400, dur: 0.12, vol: 0.12, retardo: 0.05 }); },
        moneda: () => { tono({ f0: nota(83), dur: 0.06, vol: 0.09 }); tono({ f0: nota(88), dur: 0.16, vol: 0.09, retardo: 0.06 }); },
        espada: () => ruido({ dur: 0.12, vol: 0.18, f0: 5000, f1: 1200, tipo: 'bandpass' }),
        golpe: () => { ruido({ dur: 0.1, vol: 0.3, f0: 3000, f1: 400 }); tono({ tipo: 'square', f0: 300, f1: 120, dur: 0.08, vol: 0.12 }); },
        pisar: () => { tono({ tipo: 'triangle', f0: 220, f1: 70, dur: 0.14, vol: 0.3 }); ruido({ dur: 0.06, vol: 0.15, f0: 1200, f1: 200 }); },
        muerte: () => { tono({ f0: 520, f1: 70, dur: 0.25, vol: 0.12 }); ruido({ dur: 0.18, vol: 0.12, f0: 2500, f1: 300 }); },
        dano: () => { tono({ tipo: 'sawtooth', f0: 240, f1: 70, dur: 0.3, vol: 0.18 }); ruido({ dur: 0.15, vol: 0.2, f0: 1500, f1: 200 }); },
        caida: () => tono({ tipo: 'triangle', f0: 700, f1: 90, dur: 0.6, vol: 0.2 }),
        chapoteo: () => ruido({ dur: 0.45, vol: 0.3, f0: 1800, f1: 200 }),
        rebote: () => { tono({ tipo: 'sine', f0: 140, f1: 620, dur: 0.22, vol: 0.32 }); tono({ tipo: 'triangle', f0: 300, f1: 900, dur: 0.18, vol: 0.08, retardo: 0.04 }); },
        poder: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tono({ f0: nota(n + 12), dur: 0.14, vol: 0.09, retardo: i * 0.06 })),
        corazon: () => [72, 76, 79, 84].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.16, vol: 0.18, retardo: i * 0.07 })),
        magia: () => { tono({ tipo: 'sine', f0: 500, f1: 1600, dur: 0.18, vol: 0.18 }); ruido({ dur: 0.2, vol: 0.08, f0: 6000, f1: 2500, tipo: 'highpass' }); },
        explosion: () => { ruido({ dur: 0.35, vol: 0.32, f0: 1600, f1: 80 }); tono({ tipo: 'square', f0: 160, f1: 40, dur: 0.3, vol: 0.12 }); },
        control: () => [76, 81, 88].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.3, vol: 0.16, retardo: i * 0.09 })),
        escudo: () => { tono({ tipo: 'sine', f0: 900, f1: 300, dur: 0.3, vol: 0.2 }); ruido({ dur: 0.25, vol: 0.12, f0: 7000, f1: 1500, tipo: 'highpass' }); },
        cofre: () => [67, 72, 76, 79, 84, 88, 91].forEach((n, i) => tono({ f0: nota(n), dur: 0.22, vol: 0.1, retardo: i * 0.075 })),
        cascabel: () => tono({ tipo: 'triangle', f0: nota(96), f1: nota(98), dur: 0.08, vol: 0.06 }),
        temblor: () => { ruido({ dur: 0.6, vol: 0.4, f0: 600, f1: 40 }); tono({ tipo: 'sine', f0: 90, f1: 35, dur: 0.5, vol: 0.4 }); },
        jefeGolpe: () => { tono({ tipo: 'square', f0: 180, f1: 60, dur: 0.16, vol: 0.18 }); ruido({ dur: 0.12, vol: 0.2, f0: 2000, f1: 300 }); },
        escupir: () => { tono({ tipo: 'sine', f0: 300, f1: 90, dur: 0.18, vol: 0.2 }); ruido({ dur: 0.1, vol: 0.12, f0: 800, f1: 200, tipo: 'bandpass' }); },
        menu: () => tono({ f0: nota(84), dur: 0.05, vol: 0.07 }),
        elegir: () => { tono({ f0: nota(79), dur: 0.06, vol: 0.09 }); tono({ f0: nota(86), dur: 0.12, vol: 0.09, retardo: 0.06 }); },
        estrella: () => [79, 84, 91].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.25, vol: 0.16, retardo: i * 0.05 })),
        victoria: () => [72, 72, 72, 72, 68, 70, 72, 70, 72].forEach((n, i) => tono({ f0: nota(n), dur: i === 8 ? 0.6 : 0.13, vol: 0.12, retardo: [0, 0.13, 0.26, 0.39, 0.6, 0.8, 1.0, 1.2, 1.32][i] })),
    };

    function sfx(nombre) {
        if (!ctx || !activo) return;
        const f = EFECTOS[nombre];
        if (f) f();
    }

    /* ---------- Música: un secuenciador de semicorcheas con bajo, arpegio y melodía ---------- */
    // Cada canción: tempo, acordes (raíz MIDI y tipo, uno por compás) y una melodía de 16 pasos
    // por compás (null = silencio). Se repite en bucle.
    const ACORDES = { M: [0, 4, 7, 12], m: [0, 3, 7, 12], sus: [0, 5, 7, 12] };
    const CANCIONES = {
        menu: { bpm: 92, acordes: [[53, 'M'], [57, 'm'], [50, 'm'], [55, 'M']],
            melodia: [77, null, 76, null, 72, null, null, 74, 76, null, null, null, 72, null, 69, null,
                      72, null, 72, 74, 76, null, 79, null, 77, null, null, null, null, null, null, null] },
        verde: { bpm: 126, acordes: [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']],
            melodia: [72, null, 76, null, 79, null, 76, null, 74, null, 79, null, 76, null, 72, null,
                      69, null, 72, null, 76, null, 77, 76, 74, null, 72, null, 74, null, null, null] },
        otono: { bpm: 112, acordes: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']],
            melodia: [76, null, null, 74, 72, null, 69, null, 72, null, 74, null, 76, null, null, null,
                      77, null, 76, null, 74, null, 72, null, 74, null, 71, null, 67, null, null, null] },
        sombrio: { bpm: 88, acordes: [[50, 'm'], [46, 'M'], [43, 'm'], [45, 'M']],
            melodia: [74, null, null, null, 77, null, 76, null, 74, null, null, null, 69, null, null, null,
                      70, null, null, null, 74, null, 72, null, 69, null, null, null, 73, null, null, null] },
        jefe: { bpm: 150, acordes: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M']],
            melodia: [76, 76, null, 79, 76, null, 74, 76, null, 71, null, 72, 74, null, 71, null,
                      72, 72, null, 76, 74, null, 72, 71, null, 67, null, 69, 71, null, 74, null] },
        fin: { bpm: 100, acordes: [[53, 'M'], [55, 'M'], [57, 'm'], [53, 'M']],
            melodia: [77, null, 81, null, 84, null, 81, null, 79, null, 77, null, 79, null, null, null,
                      81, null, 79, null, 77, null, 76, null, 77, null, null, null, null, null, null, null] },
    };

    let actual = null, pendiente = null, temporizador = null, paso = 0, proxima = 0;

    function programar() {
        const c = CANCIONES[actual];
        if (!c || !ctx) return;
        const dur = 60 / c.bpm / 4; // una semicorchea
        while (proxima < ctx.currentTime + 0.12) {
            const compas = Math.floor(paso / 16) % c.acordes.length;
            const p = paso % 16;
            const [raiz, tipo] = c.acordes[compas];
            const tonos = ACORDES[tipo];
            const t0 = proxima - ctx.currentTime;
            // Bajo en corcheas alternando raíz y quinta
            if (p % 4 === 0) tono({ tipo: 'triangle', f0: nota(raiz - 12 + (p % 8 === 4 ? 7 : 0)), dur: dur * 3.2, vol: 0.32, retardo: t0, bus: busMusica });
            // Arpegio suave en semicorcheas
            tono({ tipo: 'square', f0: nota(raiz + 12 + tonos[p % 4]), dur: dur * 0.9, vol: 0.035, retardo: t0, bus: busMusica });
            // Melodía
            const m = c.melodia[(paso % (c.melodia.length))];
            if (m) tono({ tipo: 'square', f0: nota(m), dur: dur * 1.8, vol: 0.07, retardo: t0, bus: busMusica });
            proxima += dur;
            paso++;
        }
    }

    function musica(nombre) {
        if (!ctx) { pendiente = nombre; return; }
        if (actual === nombre) return;
        parar();
        actual = nombre;
        paso = 0;
        proxima = ctx.currentTime + 0.05;
        temporizador = setInterval(programar, 30);
    }

    function parar() {
        if (temporizador) clearInterval(temporizador);
        temporizador = null;
        actual = null;
    }

    function alternar() {
        activo = !activo;
        try { localStorage.setItem(CLAVE, activo ? 'si' : 'no'); } catch (e) { /* sin almacenamiento */ }
        if (maestro) maestro.gain.setTargetAtTime(activo ? 1 : 0, ctx.currentTime, 0.02);
        return activo;
    }

    // Al ocultar la pestaña o cerrar el juego, que no siga sonando
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
        iniciar, sfx, musica, parar, alternar,
        get activo() { return activo; },
        /** Baja la música un momento (p. ej. al ser derrotado). */
        atenuar(seg) {
            if (!busMusica) return;
            const t = ctx.currentTime;
            busMusica.gain.cancelScheduledValues(t);
            busMusica.gain.setValueAtTime(0.04, t);
            busMusica.gain.linearRampToValueAtTime(0.22, t + seg);
        },
    };
})();
