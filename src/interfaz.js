/* Escenas de interfaz: menú principal, marcador (HUD), pausa, resumen de nivel y final. */

/** Lista de opciones navegable con teclado (↑ ↓ ENTER) y con ratón o dedo. */
function crearMenu(escena, x, y, opciones, opts = {}) {
    const sep = opts.separacion || 46;
    const tam = opts.tam || 26;
    let sel = 0;
    const items = opciones.map((op, i) => {
        const t = escena.add.text(x, y + i * sep, op.texto, estiloTexto(tam, '#f3e9d2')).setOrigin(0.5).setDepth(60)
            .setInteractive({ useHandCursor: true });
        t.on('pointerover', () => { if (sel !== i) { sel = i; pintar(); Sonido.sfx('menu'); } });
        t.on('pointerdown', () => { Sonido.iniciar(); elegir(i); });
        return t;
    });
    const marca = escena.add.text(0, 0, '▶', estiloTexto(tam * 0.8, '#ffd23f')).setOrigin(0.5).setDepth(60);
    escena.tweens.add({ targets: marca, alpha: 0.4, duration: 450, yoyo: true, repeat: -1 });
    function pintar() {
        items.forEach((t, i) => t.setColor(i === sel ? '#ffd23f' : '#f3e9d2').setScale(i === sel ? 1.08 : 1));
        const t = items[sel];
        marca.setPosition(t.x - t.displayWidth / 2 - 24, t.y);
    }
    function elegir(i) {
        sel = i; pintar();
        Sonido.sfx('elegir');
        opciones[i].accion(items[i]);
    }
    const teclado = escena.input.keyboard;
    const arriba = () => { sel = (sel + items.length - 1) % items.length; pintar(); Sonido.sfx('menu'); };
    const abajo = () => { sel = (sel + 1) % items.length; pintar(); Sonido.sfx('menu'); };
    const ok = () => { Sonido.iniciar(); elegir(sel); };
    const teclas = { UP: arriba, W: arriba, LEFT: arriba, A: arriba, DOWN: abajo, S: abajo, RIGHT: abajo, D: abajo, ENTER: ok, SPACE: ok };
    for (const [k, f] of Object.entries(teclas)) teclado.on('keydown-' + k, f);
    pintar();
    return {
        items, marca,
        destruir() {
            for (const [k, f] of Object.entries(teclas)) teclado.off('keydown-' + k, f);
            items.forEach((t) => t.destroy());
            marca.destroy();
        },
        setTexto(i, texto) { items[i].setText(texto); pintar(); },
    };
}

function panel(escena, x, y, w, h) {
    return escena.add.nineslice(x, y, 'panel', 0, w, h, 8, 8, 8, 8).setDepth(55);
}

function formatoTiempo(seg) {
    const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/* ===================================================================== */
class Menu extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        this.scene.stop('HUD');
        const cam = this.cameras.main;
        cam.setBackgroundColor('#8fd3e8');
        cam.fadeIn(600, 0, 0, 0);
        // Fondo vivo: cielo, bosque en capas, suelo de hierba y héroe
        this.cielo = this.add.tileSprite(0, 0, ANCHO, ALTO, 'cielo').setOrigin(0).setTileScale(ALTO / 272).setDepth(-50);
        const capas = capasBosque(this, 0xffffff, 0xe8f4ec);
        this.lejos = capas.lejos;
        this.cerca = capas.cerca;
        const rnd = new Phaser.Math.RandomDataGenerator(['menu']);
        for (let x = -20; x < ANCHO + 60; x += rnd.between(90, 170)) {
            this.add.image(x, ALTO - 60, 'atlas', `pino_${rnd.pick(['verde', 'verde', 'amarillo', 'rojo'])}_${rnd.pick(['g', 'm'])}`)
                .setOrigin(0.5, 1).setScale(rnd.realInRange(0.7, 1)).setTint(0xb8d8c0);
        }
        for (let cx = 0; cx < ANCHO / TILE; cx++) {
            const k = cx === 0 ? 'l' : 'm' + (1 + (cx % 3));
            this.add.image(cx * TILE, 29 * TILE, 'atlas', `h_cap_${k}`).setOrigin(0);
            this.add.image(cx * TILE, 30 * TILE, 'atlas', `h_top_${k}`).setOrigin(0);
            this.add.image(cx * TILE, 31 * TILE, 'atlas', `h_mid1_${k}`).setOrigin(0);
            this.add.image(cx * TILE, 32 * TILE, 'atlas', `h_mid2_${k}`).setOrigin(0);
        }
        this.add.rectangle(0, 33 * TILE, ANCHO, ALTO, RELLENO_SUELO).setOrigin(0);
        ['seta_grande', 'flor_azul', 'espadana', 'lavanda', 'seta_media', 'planta'].forEach((fr, i) => {
            this.add.image(60 + i * 170 + (i % 2) * 40, 30 * TILE + 4, 'atlas', fr).setOrigin(0.5, 1).setScale(fr === 'seta_grande' ? 1.4 : 1);
        });
        const heroe = this.add.sprite(170, 30 * TILE + 3, 'heroe_quieto').setOrigin(31 / 64, 64 / 80).play('h_quieto').setScale(1.4);
        this.add.sprite(ANCHO - 170, 30 * TILE + 4, 'slime_verde').setOrigin(0.5, 1).play('s_verde').setScale(1.6);
        this.add.sprite(ANCHO - 240, 30 * TILE + 4, 'slime_morado').setOrigin(0.5, 1).play('s_morado').setScale(1.3).setFlipX(true);
        this.tweens.add({ targets: heroe, y: heroe.y, duration: 1000 });
        this.add.particles(0, 0, 'hoja', {
            x: { min: 0, max: ANCHO + 200 }, y: -20, lifespan: 9000, speedY: { min: 25, max: 55 }, speedX: { min: -40, max: 5 },
            rotate: { start: 0, end: 540 }, scale: { min: 0.9, max: 1.5 }, tint: [0x7fc04a, 0xe8a33a, 0xd2603a], frequency: 260,
        });
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x0a0f1e, 0.28).setOrigin(0);

        // Título
        const titulo = this.add.text(ANCHO / 2, 108, TXT.titulo, estiloTexto(78, '#ffd23f', { strokeThickness: 12, stroke: '#2a1408' }))
            .setOrigin(0.5).setShadow(0, 6, '#000000', 0, true, true);
        this.tweens.add({ targets: titulo, y: 114, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(ANCHO / 2, 168, TXT.lema, estiloTexto(20, '#eaf6ff')).setOrigin(0.5);

        this.mostrarPrincipal();
        Sonido.musica('menu');
        this.input.keyboard.on('keydown', () => Sonido.iniciar());
        this.input.on('pointerdown', () => Sonido.iniciar());
    }

    update(t, dt) {
        this.cielo.tilePositionX += dt * 0.004;
        this.lejos.tilePositionX += dt * 0.012;
        this.cerca.tilePositionX += dt * 0.02;
    }

    limpiarSub() {
        if (this.menu) this.menu.destruir();
        this.menu = null;
        (this.sub || []).forEach((o) => o.destroy());
        this.sub = [];
    }

    mostrarPrincipal() {
        this.limpiarSub();
        const d = Progreso.datos;
        const hayProgreso = d.desbloqueado > 1 || d.estrellas.some((e) => e > 0);
        const fondo = panel(this, ANCHO / 2, 300, 340, 220);
        this.sub = [fondo];
        this.menu = crearMenu(this, ANCHO / 2, 238, [
            { texto: hayProgreso ? TXT.continuar : TXT.jugar, accion: () => this.empezar(hayProgreso ? d.desbloqueado - 1 : 0) },
            { texto: TXT.niveles, accion: () => this.mostrarNiveles() },
            { texto: TXT.controles, accion: () => this.mostrarControles() },
            { texto: Sonido.activo ? TXT.sonidoSi : TXT.sonidoNo, accion: () => this.menu.setTexto(3, Sonido.alternar() ? TXT.sonidoSi : TXT.sonidoNo) },
        ], { separacion: 42, tam: 26 });
        this.sub.push(this.add.text(ANCHO / 2, 420, TouchControls.enabled ? TXT.toca : TXT.pulsa, estiloTexto(15, '#cfe6ff')).setOrigin(0.5).setDepth(60));
    }

    mostrarNiveles() {
        this.limpiarSub();
        const d = Progreso.datos;
        this.sub = [];
        NIVELES.forEach((n, i) => {
            const x = ANCHO / 2 + (i - 1) * 230, y = 300;
            const abierto = i < d.desbloqueado;
            const tarjeta = panel(this, x, y, 210, 190).setAlpha(abierto ? 1 : 0.6);
            const miniatura = this.add.image(x, y - 40, 'atlas', `pino_${n.arboles[0]}_s`).setScale(0.45).setDepth(56).setTint(abierto ? 0xffffff : 0x555555);
            const titulo = this.add.text(x, y + 22, `${TXT.nivel} ${i + 1}`, estiloTexto(16, '#ffd23f')).setOrigin(0.5).setDepth(56);
            const nombre = this.add.text(x, y + 44, TXT.nombres[i], estiloTexto(18, '#f3e9d2')).setOrigin(0.5).setDepth(56);
            this.sub.push(tarjeta, miniatura, titulo, nombre);
            if (abierto) {
                for (let s = 0; s < 3; s++) this.sub.push(this.add.image(x - 30 + s * 30, y + 72, 'estrella', s < d.estrellas[i] ? 0 : 1).setScale(0.8).setDepth(56));
                tarjeta.setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.iniciar(); Sonido.sfx('elegir'); this.empezar(i); });
            } else {
                this.sub.push(this.add.image(x, y - 40, 'iconos', 3).setScale(3).setDepth(57));
                this.sub.push(this.add.text(x, y + 72, TXT.bloqueado, estiloTexto(14, '#b8a888')).setOrigin(0.5).setDepth(56));
            }
        });
        // Selección por teclado: una fila de opciones bajo las tarjetas
        this.menu = crearMenu(this, ANCHO / 2, 430, [
            ...NIVELES.map((n, i) => ({
                texto: i < d.desbloqueado ? `${TXT.nivel} ${i + 1}` : TXT.bloqueado,
                accion: () => { if (i < d.desbloqueado) this.empezar(i); },
            })).slice(0, d.desbloqueado),
            { texto: TXT.volver, accion: () => this.mostrarPrincipal() },
        ], { separacion: 0, tam: 20 });
        // Colocarlas en fila
        const n = this.menu.items.length;
        this.menu.items.forEach((t, i) => t.setPosition(ANCHO / 2 + (i - (n - 1) / 2) * 170, 440));
        this.menu.setTexto(0, this.menu.items[0].text);
    }

    mostrarControles() {
        this.limpiarSub();
        const fondo = panel(this, ANCHO / 2, 330, 640, 292);
        this.sub = [fondo];
        TXT.listaControles.forEach(([tecla, accion], i) => {
            this.sub.push(this.add.text(ANCHO / 2 - 40, 214 + i * 26, tecla, estiloTexto(17, '#ffd23f')).setOrigin(1, 0.5).setDepth(56));
            this.sub.push(this.add.text(ANCHO / 2 - 20, 214 + i * 26, accion, estiloTexto(17, '#f3e9d2')).setOrigin(0, 0.5).setDepth(56));
        });
        this.menu = crearMenu(this, ANCHO / 2, 444, [{ texto: TXT.volver, accion: () => this.mostrarPrincipal() }], { tam: 22 });
    }

    empezar(nivel) {
        if (this.saliendo) return;
        this.saliendo = true;
        Sonido.iniciar();
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Juego', { nivel }));
    }
}

/* ===================================================================== */
class HUD extends Phaser.Scene {
    constructor() { super('HUD'); }

    create(d) {
        this.datos = d;
        // Corazones
        this.corazones = [];
        this.dibujarCorazones(d.vida, d.vidaMax);
        // Magia
        this.cargas = [];
        if (d.magia) this.dibujarMana(d.mana, d.manaMax);
        // Monedas
        this.add.image(ANCHO / 2 - 46, 26, 'moneda', 0).setScale(2.2);
        this.textoMonedas = this.add.text(ANCHO / 2 - 28, 26, `${d.monedas}/${d.total}`, estiloTexto(22, '#ffe680')).setOrigin(0, 0.5);
        // Puntos
        this.textoPuntos = this.add.text(ANCHO - 108, 26, String(d.puntos).padStart(6, '0'), estiloTexto(22, '#ffffff')).setOrigin(1, 0.5);
        // Botones de pausa y sonido
        const boton = (x, frame, accion) => this.add.image(x, 26, 'iconos', frame).setScale(2).setInteractive({ useHandCursor: true })
            .on('pointerdown', (p, lx, ly, e) => { e.stopPropagation(); accion(); });
        this.botonSonido = boton(ANCHO - 76, Sonido.activo ? 1 : 2, () => Bus.emit('hud:sonido', Sonido.alternar()));
        boton(ANCHO - 36, 0, () => Bus.emit('pausar'));
        // Barra del jefe (oculta hasta que aparece)
        this.barraJefe = this.add.container(ANCHO / 2, ALTO - 30).setVisible(false);
        this.barraJefe.add([
            this.add.text(0, -22, TXT.jefe, estiloTexto(18, '#ff8a8a')).setOrigin(0.5),
            this.add.rectangle(0, 0, 404, 18, 0x140c1c).setStrokeStyle(2, 0xffd23f),
            this.add.rectangle(-200, 0, 400, 12, 0x5a1020).setOrigin(0, 0.5),
        ]);
        this.rellenoJefe = this.add.rectangle(-200, 0, 400, 12, 0xff3b5c).setOrigin(0, 0.5);
        this.brilloJefe = this.add.rectangle(-200, -3, 400, 3, 0xff9aaa).setOrigin(0, 0.5);
        this.barraJefe.add([this.rellenoJefe, this.brilloJefe]);

        // Viñeta roja para el daño: marca el golpe sin tapar la acción
        this.vineta = this.add.image(ANCHO / 2, ALTO / 2, 'vineta').setDisplaySize(ANCHO, ALTO).setTint(0xff2040).setAlpha(0).setDepth(-1);

        this.mostrarTitulo(d.nivel);

        const escuchar = {
            'hud:vida': (v, m) => this.dibujarCorazones(v, m, true),
            'hud:mana': (v, m) => this.dibujarMana(v, m),
            'hud:monedas': (n, t) => { this.textoMonedas.setText(`${n}/${t}`); this.latido(this.textoMonedas); },
            'hud:puntos': (n) => this.textoPuntos.setText(String(n).padStart(6, '0')),
            'hud:poder': (tipo) => this.anunciarPoder(tipo),
            'hud:pista': (texto) => this.mostrarPista(texto),
            'hud:aviso': (t, s, ms) => this.mostrarAviso(t, s, ms),
            'hud:jefe': (v, m) => this.actualizarJefe(v, m),
            'hud:sonido': (activo) => this.botonSonido.setFrame(activo ? 1 : 2),
            'hud:danio': () => {
                this.vineta.setAlpha(0.85);
                this.tweens.killTweensOf(this.vineta);
                this.tweens.add({ targets: this.vineta, alpha: 0, duration: 450, ease: 'Quad.easeOut' });
            },
        };
        for (const [ev, fn] of Object.entries(escuchar)) Bus.on(ev, fn);
        this.events.once('shutdown', () => { for (const [ev, fn] of Object.entries(escuchar)) Bus.off(ev, fn); });
    }

    latido(obj) {
        this.tweens.add({ targets: obj, scale: 1.25, duration: 80, yoyo: true });
    }

    dibujarCorazones(vida, max, animar) {
        while (this.corazones.length < max) {
            this.corazones.push(this.add.image(26 + this.corazones.length * 30, 26, 'corazon', 0).setScale(3));
        }
        this.corazones.forEach((c, i) => {
            const lleno = i < vida;
            if (animar && c.frame.name === 0 && !lleno) {
                this.tweens.add({ targets: c, scale: 4.2, duration: 90, yoyo: true });
                this.cameras.main.shake(120, 0.004);
            }
            if (animar && c.frame.name === 1 && lleno) this.tweens.add({ targets: c, scale: 4, duration: 120, yoyo: true });
            c.setFrame(lleno ? 0 : 1);
        });
    }

    dibujarMana(v, max) {
        while (this.cargas.length < max) this.cargas.push(this.add.image(26 + this.cargas.length * 26, 58, 'mana', 0).setScale(2));
        this.cargas.forEach((c, i) => c.setFrame(i < v ? 0 : 1));
    }

    mostrarTitulo(nivel) {
        const grupo = this.add.container(ANCHO / 2, ALTO / 2 - 40).setAlpha(0);
        grupo.add([
            this.add.text(0, -26, `${TXT.nivel} ${nivel + 1}`.toUpperCase(), estiloTexto(22, '#ffd23f')).setOrigin(0.5),
            this.add.text(0, 14, TXT.nombres[nivel], estiloTexto(48, '#ffffff', { strokeThickness: 9 })).setOrigin(0.5),
        ]);
        this.tweens.chain({
            targets: grupo,
            tweens: [
                { alpha: 1, y: ALTO / 2 - 50, duration: 500, ease: 'Quad.easeOut', delay: 300 },
                { alpha: 0, y: ALTO / 2 - 70, duration: 600, delay: 1500, ease: 'Quad.easeIn' },
            ],
            onComplete: () => grupo.destroy(),
        });
    }

    anunciarPoder(tipo) {
        const [titulo, desc] = textoPoder(tipo);
        if (this.cartel) this.cartel.destroy();
        const icono = { pluma: ['pluma', undefined], orbe: ['atlas', 'orbe'], escudo: ['escudo', undefined], pocion: ['atlas', 'pocion_roja'] }[tipo];
        const c = this.cartel = this.add.container(ANCHO / 2, -80);
        const ancho = desc ? 440 : 260;
        c.add([
            this.add.nineslice(0, 0, 'panel', 0, ancho, desc ? 96 : 64, 8, 8, 8, 8),
            this.add.image(-ancho / 2 + 44, 0, icono[0], icono[1]).setScale(2.4),
            this.add.text(-ancho / 2 + 82, desc ? -16 : 0, titulo, estiloTexto(26, '#ffd23f')).setOrigin(0, 0.5),
        ]);
        if (desc) c.add(this.add.text(-ancho / 2 + 82, 18, desc, estiloTexto(17, '#f3e9d2')).setOrigin(0, 0.5));
        this.tweens.chain({
            targets: c,
            tweens: [
                { y: 110, duration: 420, ease: 'Back.easeOut' },
                { y: -90, duration: 380, delay: desc ? 2600 : 1200, ease: 'Quad.easeIn' },
            ],
            onComplete: () => c.destroy(),
        });
    }

    /** Las pistas van en cola: cada una se queda al menos 3 s y no se pisan. */
    mostrarPista(texto) {
        this.colaPistas = this.colaPistas || [];
        this.colaPistas.push(texto);
        if (!this.pistaActiva) this.siguientePista();
    }

    siguientePista() {
        const texto = this.colaPistas.shift();
        if (!texto) { this.pistaActiva = false; return; }
        this.pistaActiva = true;
        const t = this.add.text(0, 0, texto, estiloTexto(18, '#ffffff')).setOrigin(0.5);
        const fondo = this.add.rectangle(0, 0, t.width + 36, 38, 0x0c0a18, 0.72).setStrokeStyle(2, 0xffd23f, 0.6);
        // Arriba, bajo el marcador: abajo taparía al héroe y al suelo
        const c = this.add.container(ANCHO / 2, 92, [fondo, t]).setAlpha(0);
        this.tweens.chain({
            targets: c,
            tweens: [
                { alpha: 1, y: 100, duration: 300 },
                { alpha: 0, duration: 350, delay: this.colaPistas.length ? 2600 : 3400 },
            ],
            onComplete: () => { c.destroy(); this.siguientePista(); },
        });
    }

    mostrarAviso(titulo, sub, ms = 1600) {
        if (this.aviso) this.aviso.destroy();
        const c = this.aviso = this.add.container(ANCHO / 2, ALTO / 2 - 70).setScale(0.6).setAlpha(0);
        c.add(this.add.text(0, 0, titulo, estiloTexto(44, '#ffd23f', { strokeThickness: 9 })).setOrigin(0.5));
        if (sub) c.add(this.add.text(0, 40, sub, estiloTexto(18, '#ffffff')).setOrigin(0.5));
        this.tweens.chain({
            targets: c,
            tweens: [
                { alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' },
                { alpha: 0, duration: 350, delay: ms },
            ],
            onComplete: () => c.destroy(),
        });
    }

    actualizarJefe(vida, max) {
        if (vida === null || vida === undefined) {
            if (this.barraJefe.visible) this.tweens.add({ targets: this.barraJefe, alpha: 0, duration: 400, onComplete: () => this.barraJefe.setVisible(false) });
            return;
        }
        if (!this.barraJefe.visible) {
            this.barraJefe.setVisible(true).setAlpha(0).setScale(0.8);
            this.tweens.add({ targets: this.barraJefe, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
        }
        const p = Math.max(0, vida / max);
        this.tweens.add({ targets: [this.rellenoJefe, this.brilloJefe], scaleX: p, duration: 180 });
        this.rellenoJefe.setFillStyle(p > 0.6 ? 0xff3b5c : p > 0.3 ? 0xff7a2a : 0xffd23f);
    }
}

/* ===================================================================== */
class Pausa extends Phaser.Scene {
    constructor() { super('Pausa'); }

    create(d) {
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x05060f, 0.62).setOrigin(0);
        panel(this, ANCHO / 2, ALTO / 2, 360, 280);
        this.add.text(ANCHO / 2, ALTO / 2 - 92, TXT.pausa, estiloTexto(36, '#ffd23f')).setOrigin(0.5).setDepth(60);
        const reanudar = () => {
            this.scene.stop();
            this.scene.resume('Juego');
        };
        this.menu = crearMenu(this, ANCHO / 2, ALTO / 2 - 24, [
            { texto: TXT.reanudar, accion: reanudar },
            { texto: TXT.reiniciar, accion: () => { this.scene.stop('Juego'); this.scene.start('Juego', { nivel: d.nivel }); } },
            { texto: TXT.salir, accion: () => { this.scene.stop('Juego'); this.scene.stop('HUD'); this.scene.start('Menu'); } },
        ], { separacion: 46, tam: 24 });
        this.input.keyboard.on('keydown-P', reanudar);
        this.input.keyboard.on('keydown-ESC', reanudar);
    }
}

/* ===================================================================== */
class Resumen extends Phaser.Scene {
    constructor() { super('Resumen'); }

    create(d) {
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x05060f, 0.55).setOrigin(0);
        const p = panel(this, ANCHO / 2, ALTO / 2 + 8, 560, 430).setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
        const t = (x, y, s, tam, color, origen = 0.5) => this.add.text(x, y, s, estiloTexto(tam, color)).setOrigin(origen, 0.5).setDepth(60);
        t(ANCHO / 2, 88, TXT.completado, 34, '#ffd23f');
        t(ANCHO / 2, 124, `${TXT.nivel} ${d.nivel + 1} · ${TXT.nombres[d.nivel]}`, 18, '#fff6e0');

        // Estrellas, una a una
        d.estrellas.forEach((ok, i) => {
            const x = ANCHO / 2 + (i - 1) * 96;
            const e = this.add.image(x, 182, 'estrella', ok ? 0 : 1).setScale(0).setDepth(60);
            const etiqueta = t(x, 222, TXT.estrellas[i], 12, ok ? '#fff6e0' : '#9a8a70');
            etiqueta.setWordWrapWidth(92).setAlign('center').setAlpha(0);
            this.tweens.add({
                targets: e, scale: 2.2, duration: 380, delay: 450 + i * 380, ease: 'Back.easeOut',
                onStart: () => { if (ok) Sonido.sfx('estrella'); },
            });
            this.tweens.add({ targets: etiqueta, alpha: 1, duration: 300, delay: 450 + i * 380 });
        });

        const s = d.stats;
        const filas = [
            [TXT.monedas, `${s.monedas} / ${s.monedasTotal}`],
            [TXT.enemigos, String(s.enemigos)],
            [TXT.tiempo, formatoTiempo(d.tiempo)],
            [TXT.muertes, String(s.derrotas)],
        ];
        filas.forEach(([k, v], i) => {
            t(ANCHO / 2 - 170, 266 + i * 28, k, 18, '#fff6e0', 0);
            t(ANCHO / 2 + 170, 266 + i * 28, v, 18, '#ffffff', 1);
        });
        t(ANCHO / 2 - 170, 386, TXT.puntos, 24, '#ffd23f', 0);
        const total = t(ANCHO / 2 + 170, 386, '0', 26, '#ffd23f', 1);
        const contador = { n: 0 };
        this.tweens.add({ targets: contador, n: d.total, duration: 1200, delay: 1500, onUpdate: () => total.setText(String(Math.round(contador.n))) });

        const ultimo = d.nivel >= NIVELES.length - 1;
        this.time.delayedCall(900, () => {
            this.menu = crearMenu(this, ANCHO / 2, 452, [
                ultimo
                    ? { texto: TXT.verFinal, accion: () => this.irA('Final') }
                    : { texto: TXT.siguiente, accion: () => this.irA('Juego', { nivel: d.nivel + 1 }) },
                { texto: TXT.reintentar, accion: () => this.irA('Juego', { nivel: d.nivel }) },
                { texto: TXT.menu, accion: () => this.irA('Menu') },
            ], { separacion: 0, tam: 20 });
            const n = this.menu.items.length;
            this.menu.items.forEach((it, i) => it.setPosition(ANCHO / 2 + (i - (n - 1) / 2) * 190, 452));
            this.menu.setTexto(0, this.menu.items[0].text);
        });
    }

    irA(escena, datos) {
        this.scene.stop('Juego');
        this.scene.stop('HUD');
        this.scene.start(escena, datos);
    }
}

/* ===================================================================== */
class Final extends Phaser.Scene {
    constructor() { super('Final'); }

    create() {
        const cam = this.cameras.main;
        cam.setBackgroundColor('#1a2240');
        cam.fadeIn(800, 0, 0, 0);
        this.add.tileSprite(0, 0, ANCHO, ALTO, 'cielo').setOrigin(0).setTileScale(ALTO / 272).setTint(0xffc4a0).setDepth(-50);
        capasBosque(this, 0xf0b8a8, 0xd89a90);
        for (let cx = 0; cx < ANCHO / TILE; cx++) {
            const k = 'm' + (1 + (cx % 3));
            this.add.image(cx * TILE, 30 * TILE, 'atlas', `h_cap_${k}`).setOrigin(0);
            this.add.image(cx * TILE, 31 * TILE, 'atlas', `h_top_${k}`).setOrigin(0);
            this.add.image(cx * TILE, 32 * TILE, 'atlas', `h_mid1_${k}`).setOrigin(0);
        }
        this.add.rectangle(0, 33 * TILE, ANCHO, ALTO, RELLENO_SUELO).setOrigin(0);
        this.add.sprite(ANCHO / 2, 31 * TILE + 3, 'heroe_quieto').setOrigin(31 / 64, 64 / 80).setScale(1.6).play('h_quieto');
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x0a0f1e, 0.35).setOrigin(0);

        // Fuegos artificiales
        const fuegos = this.add.particles(0, 0, 'px', {
            lifespan: { min: 700, max: 1300 }, speed: { min: 60, max: 260 }, gravityY: 160, scale: { start: 1.8, end: 0 },
            blendMode: 'ADD', emitting: false,
        });
        this.time.addEvent({
            delay: 650, loop: true, callback: () => {
                fuegos.setParticleTint(Phaser.Utils.Array.GetRandom([0xffd23f, 0xff5a6e, 0x5fd0ff, 0x8aff7a, 0xd18cff]));
                fuegos.explode(48, Phaser.Math.Between(120, ANCHO - 120), Phaser.Math.Between(70, 220));
                Sonido.sfx('explosion');
            },
        });

        const d = Progreso.datos;
        const puntos = d.puntos.reduce((a, b) => a + b, 0);
        const estrellas = d.estrellas.reduce((a, b) => a + b, 0);
        const t = (y, s, tam, color) => this.add.text(ANCHO / 2, y, s, estiloTexto(tam, color)).setOrigin(0.5);
        const titulo = t(96, TXT.finTitulo, 50, '#ffd23f').setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: titulo, scale: 1, alpha: 1, duration: 700, ease: 'Back.easeOut' });
        t(150, TXT.finTexto, 19, '#ffffff');
        t(206, `${TXT.totalPuntos}: ${puntos}`, 26, '#ffe680');
        t(244, `${TXT.totalEstrellas}: ${estrellas} / ${NIVELES.length * 3}`, 22, '#ffffff');
        t(296, TXT.gracias, 22, '#cfe6ff');
        t(ALTO - 20, TXT.creditos, 12, '#e8e0d0');
        Sonido.musica('fin');
        this.time.delayedCall(1200, () => {
            this.menu = crearMenu(this, ANCHO / 2, 350, [{ texto: TXT.menu, accion: () => this.scene.start('Menu') }], { tam: 24 });
        });
    }
}
