/* Escena de juego: construye un nivel a partir de su descripción (niveles.js) y gestiona
   colisiones, efectos, marcador, puntos de control, el final de nivel y el jefe. */

const ANCHO = 960;
const ALTO = 540;
const Bus = new Phaser.Events.EventEmitter();

/** Progreso guardado en el navegador: niveles desbloqueados, estrellas y poderes. */
const Progreso = {
    clave: 'forest-quest-progreso',
    datos: { desbloqueado: 1, estrellas: [0, 0, 0], puntos: [0, 0, 0], doble: false, magia: false },
    cargar() {
        try {
            const d = JSON.parse(localStorage.getItem(this.clave));
            if (d) Object.assign(this.datos, d);
        } catch (e) { /* sin almacenamiento */ }
    },
    guardar() {
        try { localStorage.setItem(this.clave, JSON.stringify(this.datos)); } catch (e) { /* sin almacenamiento */ }
    },
    completar(i, estrellas, puntos) {
        const d = this.datos;
        d.desbloqueado = Math.min(NIVELES.length, Math.max(d.desbloqueado, i + 2));
        d.estrellas[i] = Math.max(d.estrellas[i] || 0, estrellas);
        d.puntos[i] = Math.max(d.puntos[i] || 0, puntos);
        if (i >= 0) d.doble = true;
        if (i >= 1) d.magia = true;
        this.guardar();
    },
};
Progreso.cargar();

/** Estilo de texto con la fuente pixel y contorno oscuro. */
function estiloTexto(tam, color = '#ffffff', extra = {}) {
    return Object.assign({
        fontFamily: 'Pixelify, monospace', fontSize: tam + 'px', color,
        stroke: '#140c1c', strokeThickness: Math.max(3, Math.round(tam / 5)),
    }, extra);
}

/** Multiplica dos colores (como hace el tinte de WebGL). */
function multiplicarColor(a, b) {
    const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
    const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
    const bl = ((a & 255) * (b & 255)) / 255;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

const RELLENO_SUELO = 0x1c1f0a;

/** Las dos capas de bosque del fondo (claras detrás, oscuras delante) con un relleno debajo,
    para que los huecos entre árboles nunca dejen ver el cielo a ras de suelo. Con despY > 0
    acompañan un poco a la cámara cuando sube. */
function capasBosque(escena, tLejos, tCerca, despY = 0) {
    escena.add.rectangle(0, ALTO - 130, ANCHO, 420, multiplicarColor(0x55796f, tLejos)).setOrigin(0).setScrollFactor(0, despY).setDepth(-41);
    const lejos = escena.add.tileSprite(0, ALTO - 300, ANCHO, 256, 'bosque_lejos').setOrigin(0).setScrollFactor(0, despY).setTint(tLejos).setDepth(-40);
    escena.add.rectangle(0, ALTO - 60, ANCHO, 420, multiplicarColor(0x293b3f, tCerca)).setOrigin(0).setScrollFactor(0, despY * 1.4).setDepth(-36);
    const cerca = escena.add.tileSprite(0, ALTO - 248, ANCHO, 256, 'bosque_cerca').setOrigin(0).setScrollFactor(0, despY * 1.4).setTint(tCerca).setDepth(-35);
    return { lejos, cerca };
}
// Plataformas: textura, ancho del dibujo, ancho del cuerpo y a qué altura empieza la superficie
const PLATAFORMAS = {
    tronco: { tex: 'plat_madera', w: 48, cuerpo: 46, oy: 1 },
    rama: { tex: 'plat_larga', w: 80, cuerpo: 78, oy: 1 },
    losa: { tex: 'plat_piedra', w: 48, cuerpo: 46, oy: 1 },
};
// Altura de la superficie respecto a la fila del suelo: la hierba cubre un poco los pies; la
// piedra se pisa justo por encima del borde dibujado
const SUELO_OFF = { h: -1, p: -4 };
const DECORADO = {
    verde: ['flor_azul', 'espadana', 'espadana2', 'seta_peq', 'seta_media', 'planta', 'roca_p', 'musgo_p', 'musgo_m', 'flor_azul', 'seta_grande2'],
    otono: ['espadana', 'espadana2', 'seta_media', 'seta_peq', 'roca_p', 'roca_m', 'musgo_p', 'planta', 'roca_redonda'],
    sombrio: ['roca_p', 'roca_m', 'roca_alta', 'roca_redonda', 'menhir2', 'menhir3', 'seta_peq', 'vela1', 'vela2', 'menhir1', 'vela2'],
};

class Juego extends Phaser.Scene {
    constructor() { super('Juego'); }

    init(datos) {
        this.indice = (datos && datos.nivel) || 0;
        this.def = NIVELES[this.indice];
    }

    create() {
        const def = this.def;
        this.anchoMundo = def.ancho * TILE;
        this.altoMundo = ALTO;
        this.reloj = 0;
        this.tiempoJuego = 0;
        this.stats = { puntos: 0, monedas: 0, monedasTotal: def.monedas.length, enemigos: 0, derrotas: 0 };
        this.terminado = false;
        this.cayendo = false;
        this.jefe = null; this.jefeIniciado = false; this.jefeDerrotado = false; this.muros = [];
        this.superficies = [];
        this.luces = [];
        this.aguas = [];
        this.pistasVistas = new Set();
        this.offSuelo = SUELO_OFF[def.suelo];
        this.ocupado = [];

        this.physics.world.setBounds(0, -400, this.anchoMundo, this.altoMundo + 800);
        this.physics.world.setBoundsCollision(true, true, false, false);
        const cam = this.cameras.main;
        // Por arriba la cámara puede subir un poco: los saltos altos no se salen de la pantalla
        cam.setBounds(0, -200, this.anchoMundo, this.altoMundo + 200);
        cam.setBackgroundColor(def.cielo.fondo);

        this.crearGrupos();
        this.crearFondo();
        this.crearTerreno();
        this.crearPlataformas();
        this.crearPeligros();
        this.crearDecoracion();
        this.crearObjetos();
        this.crearEfectos();
        this.crearJugador();
        this.crearEnemigos();
        this.crearColisiones();
        this.crearControles();
        if (def.noche) this.crearNoche();

        cam.startFollow(this.jugador, true, 0.12, 0.12);
        cam.setDeadzone(60, 70);
        cam.fadeIn(500, 0, 0, 0);

        const j = this.jugador;
        this.scene.stop('HUD');
        this.scene.launch('HUD', {
            nivel: this.indice, vida: j.vida, vidaMax: j.vidaMax, mana: j.mana, manaMax: j.manaMax,
            magia: j.tieneMagia, monedas: 0, total: this.stats.monedasTotal, puntos: 0,
        });
        this.tFisica = 0;
        // Referencia propia: al cerrar la escena, el plugin de física ya ha soltado su mundo
        const mundo = this.physics.world;
        mundo.on('worldstep', this.pasoFisico, this);
        this.events.once('shutdown', () => mundo.off('worldstep', this.pasoFisico, this));
        this.alPausar = () => this.pausar();
        Bus.on('pausar', this.alPausar);
        this.events.once('shutdown', () => {
            Bus.off('pausar', this.alPausar);
            this.tweens.killAll();
        });
        Sonido.musica(def.musica);
    }

    /* ------------------------------------------------------------------ construcción */

    crearGrupos() {
        this.solidos = this.physics.add.staticGroup();
        this.unidireccionales = this.physics.add.staticGroup();
        this.moviles = this.physics.add.group({ allowGravity: false, immovable: true });
        this.caedizas = this.physics.add.group({ allowGravity: false, immovable: true });
        this.enemigos = this.add.group();
        this.terrestres = this.add.group();
        this.monedas = this.physics.add.group({ allowGravity: false, immovable: true });
        this.objetos = this.physics.add.group({ allowGravity: false, immovable: true });
        this.magias = this.physics.add.group({ allowGravity: false });
        this.babas = this.physics.add.group();
        this.ondas = this.physics.add.group({ allowGravity: false });
        this.zonasDanio = this.physics.add.staticGroup();
        this.zonasAgua = this.physics.add.staticGroup();
        this.setas = this.physics.add.staticGroup();
        this.banderas = this.physics.add.staticGroup();
    }

    cuerpoEstatico(grupo, x, y, w, h) {
        const z = this.add.zone(x + w / 2, y + h / 2, w, h);
        this.physics.add.existing(z, true);
        grupo.add(z);
        return z;
    }

    unidireccional(body) {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
    }

    crearFondo() {
        const c = this.def.cielo;
        const esc = ALTO / 272;
        this.fondoCielo = this.add.tileSprite(0, 0, ANCHO, ALTO, 'cielo').setOrigin(0).setScrollFactor(0).setTileScale(esc).setTint(c.tinte).setDepth(-50);
        if (this.def.noche) {
            this.add.image(ANCHO * 0.78, 96, 'brillo').setScrollFactor(0).setScale(4).setTint(0xb8ccff).setAlpha(0.55).setDepth(-49);
            this.add.circle(ANCHO * 0.78, 96, 24, 0xeef3ff).setScrollFactor(0).setDepth(-48);
            this.add.circle(ANCHO * 0.78 + 8, 90, 20, 0xc8d2f0).setScrollFactor(0).setDepth(-48).setAlpha(0.35);
        } else if (this.def.clave === 'otono') {
            this.add.image(ANCHO * 0.3, ALTO - 210, 'brillo').setScrollFactor(0).setScale(7).setTint(0xffb060).setAlpha(0.65).setDepth(-49);
            this.add.circle(ANCHO * 0.3, ALTO - 210, 34, 0xffe2a0).setScrollFactor(0).setDepth(-48).setAlpha(0.9);
        }
        const capas = capasBosque(this, c.lejos, c.cerca, 0.25);
        this.fondoLejos = capas.lejos;
        this.fondoCerca = capas.cerca;

        // Dos filas de pinos a distinta distancia, cada vez más oscuros por la bruma
        const rnd = new Phaser.Math.RandomDataGenerator(['fondo' + this.indice]);
        const filas = [
            // Bases por debajo de la pantalla: sobre los huecos del suelo nunca se ve un tronco acabar en el aire
            { factor: 0.45, paso: [60, 130], escala: [0.55, 0.8], tinte: c.pinosLejos, prof: -30, base: ALTO + 30 },
            { factor: 0.7, paso: [140, 260], escala: [0.8, 1.05], tinte: c.pinosCerca, prof: -25, base: ALTO + 60 },
        ];
        for (const f of filas) {
            const largo = this.anchoMundo * f.factor + ANCHO + 100;
            for (let x = -40; x < largo; x += rnd.between(f.paso[0], f.paso[1])) {
                const tam = rnd.pick(['g', 'm', 'm', 's']);
                const color = rnd.pick(this.def.arboles);
                this.add.image(x, f.base, 'atlas', `pino_${color}_${tam}`).setOrigin(0.5, 1).setScrollFactor(f.factor, 1)
                    .setScale(rnd.realInRange(f.escala[0], f.escala[1])).setTint(f.tinte).setDepth(f.prof);
            }
        }
    }

    crearTerreno() {
        const def = this.def;
        const tinte = def.tinteSuelo || 0xffffff;
        for (const [x0, x1, f] of def.tramos) {
            // Con un tramo pegado, ese lado no lleva borde redondeado (dejaría ver el cielo)
            const izq = def.tramos.find((t) => t[1] === x0);
            const der = def.tramos.find((t) => t[0] === x1);
            this.pintarBloque(x0, x1, f, null, tinte, izq ? izq[2] : null, der ? der[2] : null);
            const y = f * TILE + this.offSuelo;
            this.cuerpoEstatico(this.solidos, x0 * TILE, y, (x1 - x0) * TILE, this.altoMundo + 300 - y);
            this.superficies.push({ x0: x0 * TILE, x1: x1 * TILE, y });
        }
        for (const [x, f, w, h] of def.bloques) {
            this.pintarBloque(x, x + w, f, h, tinte, null, null);
            const y = f * TILE + this.offSuelo;
            this.cuerpoEstatico(this.solidos, x * TILE, y, w * TILE, h * TILE - this.offSuelo - 4);
            this.superficies.push({ x0: x * TILE, x1: (x + w) * TILE, y });
        }
    }

    /** Pinta un tramo de suelo (hasta abajo) o una isla (con alto) con las losetas del atlas.
        filaIzq/filaDer: fila del tramo vecino de cada lado (null si no hay). El borde de un lado
        solo se dibuja en las filas que quedan al aire, por encima del vecino. */
    pintarBloque(x0, x1, f, alto, tinte, filaIzq, filaDer) {
        const e = this.def.suelo;
        const img = (fr, cx, fy) => this.add.image(cx * TILE, fy * TILE, 'atlas', fr).setOrigin(0).setDepth(3).setTint(tinte);
        const hasta = (fv) => (fv === null || fv === undefined ? Infinity : fv > f ? fv : -Infinity);
        const hastaIzq = hasta(filaIzq), hastaDer = hasta(filaDer);
        const pieza = (cx, r) => {
            if (cx === x0 && r < hastaIzq) return 'l';
            if (cx === x1 - 1 && r < hastaDer) return 'r';
            return 'm' + (1 + ((cx * 7 + f) % 3));
        };
        const filaFin = alto ? f + alto - 1 : Math.ceil(ALTO / TILE) + 1;
        for (let cx = x0; cx < x1; cx++) {
            img(`${e}_cap_${pieza(cx, f - 1)}`, cx, f - 1);
            img(`${e}_top_${pieza(cx, f)}`, cx, f);
            if (alto) {
                for (let r = f + 1; r < filaFin; r++) img(`${e}_mid${(r - f) % 2 ? 1 : 2}_${pieza(cx, r)}`, cx, r);
                img(`${e}_bot_${pieza(cx, filaFin)}`, cx, filaFin);
            } else {
                img(`${e}_mid1_${pieza(cx, f + 1)}`, cx, f + 1);
                img(`${e}_mid2_${pieza(cx, f + 2)}`, cx, f + 2);
                // Las columnas de borde siguen con losetas mientras estén al aire
                for (let r = f + 3; r <= filaFin; r++) {
                    const k = pieza(cx, r);
                    if (k === 'l' || k === 'r') img(`${e}_mid${r % 2 ? 1 : 2}_${k}`, cx, r);
                }
            }
        }
        if (alto) return;
        // Relleno macizo bajo las tres primeras filas (y bajo los bordes, donde ya hay vecino)
        const relleno = multiplicarColor(RELLENO_SUELO, tinte);
        const rect = (c0, c1, r0) => {
            if (c1 > c0) this.add.rectangle(c0 * TILE, r0 * TILE, (c1 - c0) * TILE, ALTO + 300 - r0 * TILE, relleno).setOrigin(0).setDepth(3);
        };
        rect(x0 + 1, x1 - 1, f + 3);
        if (x1 - x0 > 1) {
            if (hastaIzq !== Infinity) rect(x0, x0 + 1, Math.max(f + 3, hastaIzq));
            if (hastaDer !== Infinity) rect(x1 - 1, x1, Math.max(f + 3, hastaDer));
        }
    }

    crearPlataformas() {
        const def = this.def;
        const tinte = def.tinteSuelo || 0xffffff;
        for (const [x, f, tipo] of def.plataformas) {
            const c = PLATAFORMAS[tipo];
            const img = this.add.image(x * TILE, f * TILE, c.tex).setOrigin(0).setDepth(4);
            if (def.tinteSuelo) img.setTint(tinte);
            // Las de madera cuelgan de cuerdas que se pierden entre las copas
            if (c.tex !== 'plat_piedra') {
                for (const cx of [x * TILE + 4, x * TILE + c.w - 5]) {
                    const cuerda = this.add.image(cx, f * TILE + 3, 'cuerda').setOrigin(0.5, 1).setDepth(3.5);
                    if (def.noche || def.tinteSuelo) cuerda.setTint(tinte);
                }
            }
            const borde = (c.w - c.cuerpo) / 2;
            const z = this.cuerpoEstatico(this.unidireccionales, x * TILE + borde, f * TILE + c.oy, c.cuerpo, 8);
            this.unidireccional(z.body);
            this.superficies.push({ x0: x * TILE + borde, x1: x * TILE + borde + c.cuerpo, y: f * TILE + c.oy, plataforma: true });
        }
        // Móviles: madera con herrajes, para que se distingan de las fijas
        for (const [x, f, , dx, dy, periodo] of def.moviles) {
            const p = this.moviles.create(x * TILE, f * TILE, 'plat_movil').setOrigin(0).setDepth(4);
            p.body.setSize(46, 8).setOffset(1, 1);
            // Sin fricción de Arcade: el arrastre del héroe se hace a mano en cada paso de física
            p.body.friction.set(0, 0);
            this.unidireccional(p.body);
            // base: dónde empieza el cuerpo físico (la imagen va con origen arriba a la izquierda)
            Object.assign(p, { base: { x: p.x + 1, y: p.y + 1 }, dx: dx * TILE, dy: dy * TILE, periodo });
        }
        for (const [x, f] of def.caen) {
            const p = this.caedizas.create(x * TILE, f * TILE, 'plat_piedra').setOrigin(0).setDepth(4);
            if (def.tinteSuelo) p.setTint(def.tinteSuelo);
            p.body.setSize(46, 8).setOffset(1, 1);
            p.body.friction.set(0, 0);
            this.unidireccional(p.body);
            Object.assign(p, { base: { x: p.x, y: p.y }, estado: 'quieta' });
        }
    }

    crearPeligros() {
        const def = this.def;
        for (const [x0, x1] of def.agua) {
            const w = (x1 - x0) * TILE;
            const sup = this.add.tileSprite(x0 * TILE, 29 * TILE, w, 16, 'atlas', 'agua_sup').setOrigin(0).setDepth(12).setAlpha(0.92);
            const fondo = this.add.tileSprite(x0 * TILE, 30 * TILE, w, ALTO - 30 * TILE, 'atlas', 'agua').setOrigin(0).setDepth(12).setAlpha(0.9);
            if (def.tinteSuelo) { sup.setTint(def.tinteSuelo); fondo.setTint(def.tinteSuelo); }
            this.aguas.push(sup, fondo);
            this.cuerpoEstatico(this.zonasAgua, x0 * TILE, 29 * TILE + 12, w, 300);
        }
        for (const [x, f, n] of def.pinchos) {
            const y = f * TILE + this.offSuelo;
            for (let i = 0; i < n; i++) this.add.image((x + i) * TILE, y + 1, 'pinchos').setOrigin(0, 1).setDepth(5);
            this.cuerpoEstatico(this.zonasDanio, x * TILE + 3, y - 8, n * TILE - 6, 8);
            this.ocupado.push([x * TILE - 10, (x + n) * TILE + 10]);
        }
        for (const [x, f] of def.setas) {
            const y = f * TILE + this.offSuelo;
            const seta = this.add.image(x * TILE + 8, y + 4, 'atlas', 'seta_grande').setOrigin(0.5, 1).setDepth(4).setScale(1.25);
            // Zona de rebote sobre el sombrero (la seta mide 31 px escalada)
            const z = this.cuerpoEstatico(this.setas, x * TILE + 8 - 17, y + 4 - 31 - 4, 34, 12);
            z.seta = seta;
            this.ocupado.push([x * TILE - 22, x * TILE + 38]);
        }
        for (const [x, f] of def.controles) {
            const y = f * TILE + this.offSuelo;
            const b = this.add.sprite(x * TILE, y + 1, 'bandera', 0).setOrigin(0.2, 1).setDepth(5);
            const z = this.cuerpoEstatico(this.banderas, x * TILE - 8, y - 56, 34, 56);
            z.bandera = b;
            z.punto = { x: x * TILE + 6, y };
            this.ocupado.push([x * TILE - 14, x * TILE + 30]);
            if (this.def.noche) this.luces.push({ x: x * TILE + 4, y: y - 30, r: 50, bandera: z });
        }
    }

    superficieBajo(x, y = -1000) {
        let mejor = null;
        for (const s of this.superficies) {
            if (s.plataforma || x < s.x0 || x > s.x1 || s.y < y) continue;
            if (!mejor || s.y < mejor.y) mejor = s;
        }
        return mejor;
    }

    /** ¿Cabe una decoración de ancho w centrada en x sin tapar peligros ni salirse del borde? */
    hueco(x, w, x0, x1) {
        if (x - w / 2 < x0 + 4 || x + w / 2 > x1 - 4) return false;
        return !this.ocupado.some(([a, b]) => x + w / 2 > a && x - w / 2 < b);
    }

    crearDecoracion() {
        const def = this.def;
        const rnd = new Phaser.Math.RandomDataGenerator(['decor' + this.indice]);
        const noche = !!def.noche;
        const lista = DECORADO[def.clave];
        const hundir = def.suelo === 'h' ? 4 : 2;
        if (def.fin.tipo === 'cofre') this.ocupado.push([def.fin.x * TILE - 40, def.fin.x * TILE + 56]);
        for (const [x0, x1, f] of def.tramos) {
            const y = f * TILE + this.offSuelo;
            const a = x0 * TILE, b = x1 * TILE;
            // Pinos del plano de juego, detrás del terreno (el tronco nunca asoma sobre un hueco)
            for (let x = a + rnd.between(24, 80); x < b - 24; x += rnd.between(110, 260)) {
                const tam = rnd.pick(['g', 'm', 'm', 's', 'xs']);
                const img = this.add.image(x, y + 14, 'atlas', `pino_${rnd.pick(def.arboles)}_${tam}`).setOrigin(0.5, 1).setDepth(1);
                if (noche) img.setTint(0x9aa4cc);
            }
            // Arbustos detrás del borde del suelo, para dar volumen sin tapar al héroe
            for (let x = a + rnd.between(30, 90); x < b - 40; x += rnd.between(150, 320)) {
                const fr = rnd.pick(['arbusto1', 'arbusto2', 'arbusto3']);
                if (!this.hueco(x, 80, a, b)) continue;
                this.add.image(x, y + 8, 'atlas', fr).setOrigin(0.5, 1).setDepth(2).setTint(noche ? 0x5a6488 : 0xc8d8b0);
            }
            // Plantas, setas y rocas pegadas al suelo, detrás del héroe
            for (let x = a + rnd.between(14, 50); x < b - 14; x += rnd.between(40, 110)) {
                const fr = rnd.pick(lista);
                const w = this.textures.getFrame('atlas', fr).width;
                if (!this.hueco(x, w, a, b)) continue;
                const img = this.add.image(x, y + hundir, 'atlas', fr).setOrigin(0.5, 1).setDepth(4);
                if (noche && !fr.startsWith('vela')) img.setTint(0xb8c0e0);
                if (fr.startsWith('vela')) {
                    this.add.image(x, y + hundir - img.height + 2, 'brillo').setTint(0xffb050).setBlendMode('ADD').setScale(0.6).setDepth(5);
                    this.luces.push({ x, y: y - img.height, r: 64, parpadeo: true });
                }
                if (fr.startsWith('menhir')) {
                    const runa = this.add.image(x, y - img.height * 0.55, 'atlas', 'runa' + rnd.between(0, 5)).setDepth(5).setTint(0x7fe8ff).setBlendMode('ADD');
                    this.tweens.add({ targets: runa, alpha: 0.35, duration: rnd.between(900, 1600), yoyo: true, repeat: -1 });
                    this.luces.push({ x, y: y - img.height * 0.55, r: 46 });
                }
                this.ocupado.push([x - w / 2 - 6, x + w / 2 + 6]);
            }
        }
        // Colmenas con su pino detrás
        for (const [x, f] of def.colmenas) {
            const suelo = this.superficieBajo(x * TILE + 8, f * TILE);
            if (suelo) this.add.image(x * TILE + 8, suelo.y + 14, 'atlas', `pino_${def.arboles[0]}_g`).setOrigin(0.5, 1).setDepth(1);
            this.add.image(x * TILE + 8, f * TILE, 'atlas', 'colmena').setOrigin(0.5, 0).setDepth(4).setScale(1.2);
        }
    }

    crearObjetos() {
        const def = this.def;
        for (const [x, y] of def.monedas) {
            const m = this.monedas.create(x * TILE + 8, y * TILE + 8, 'moneda').setDepth(6);
            m.body.setSize(10, 10);
            m.play('moneda_gira');
            m.anims.setProgress(Math.random());
        }
        const OBJETOS = {
            pluma: { tex: 'pluma', frame: undefined, color: 0xbfefff, escala: 1.3 },
            orbe: { tex: 'atlas', frame: 'orbe', color: 0x4fd2ff, escala: 1.8 },
            escudo: { tex: 'escudo', frame: undefined, color: 0x7fb6ff, escala: 1.2 },
            pocion: { tex: 'atlas', frame: 'pocion_roja', color: 0xff6b8a, escala: 1.4 },
        };
        for (const [tipo, x, f] of def.objetos) {
            const c = OBJETOS[tipo];
            const o = this.objetos.create(x * TILE + 8, f * TILE, c.tex, c.frame).setScale(c.escala).setDepth(7);
            o.tipo = tipo;
            o.brillo = this.add.image(o.x, o.y, 'brillo').setTint(c.color).setBlendMode('ADD').setScale(1.4).setDepth(6);
            this.tweens.add({ targets: [o, o.brillo], y: o.y - 7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: o.brillo, alpha: 0.45, scale: 1.8, duration: 700, yoyo: true, repeat: -1 });
            if (def.noche) this.luces.push({ x: o.x, y: o.y, r: 60, objeto: o });
        }
        if (def.fin.tipo === 'cofre') this.crearCofre(def.fin.x * TILE + 8, def.fin.fila * TILE + this.offSuelo + 1, false);
    }

    crearCofre(x, y, cae) {
        this.brilloCofre = this.add.image(x, y - 14, 'brillo').setTint(0xffd060).setBlendMode('ADD').setScale(2).setDepth(4);
        this.tweens.add({ targets: this.brilloCofre, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
        this.cofre = this.physics.add.image(x, cae ? 120 : y, 'atlas', 'cofre').setOrigin(0.5, 1).setDepth(5).setScale(1.4);
        this.cofre.body.setSize(28, 26);
        if (cae) {
            this.cofre.body.setBounce(0.35);
            this.physics.add.collider(this.cofre, this.solidos);
        } else {
            this.cofre.body.allowGravity = false;
            this.cofre.body.immovable = true;
        }
        if (this.jugador) this.physics.add.overlap(this.jugador, this.cofre, this.abrirCofre, null, this);
        if (this.def.noche) this.luces.push({ x, y: y - 20, r: 90, cofre: true });
    }

    crearEfectos() {
        this.emPolvo = this.add.particles(0, 0, 'humo', {
            lifespan: { min: 300, max: 600 }, speedX: { min: -55, max: 55 }, speedY: { min: -45, max: -5 },
            scale: { start: 0.7, end: 1.6 }, alpha: { start: 0.55, end: 0 }, tint: this.def.noche ? 0x8a90a8 : 0xd8c8a0, emitting: false,
        }).setDepth(11);
        this.emChispas = this.add.particles(0, 0, 'chispa', {
            lifespan: 380, speed: { min: 80, max: 230 }, scale: { start: 1, end: 0 }, emitting: false, blendMode: 'ADD',
        }).setDepth(13);
        this.emTrozos = this.add.particles(0, 0, 'px4', {
            lifespan: { min: 400, max: 850 }, speed: { min: 90, max: 270 }, angle: { min: 200, max: 340 }, gravityY: 900,
            scale: { start: 1, end: 0.3 }, emitting: false,
        }).setDepth(12);
        this.emBrillo = this.add.particles(0, 0, 'px', {
            lifespan: 520, speed: { min: 30, max: 120 }, scale: { start: 1.6, end: 0 }, emitting: false, blendMode: 'ADD', tint: 0xfff2a0,
        }).setDepth(13);
        this.emMagia = this.add.particles(0, 0, 'px', {
            lifespan: 320, speed: { min: 5, max: 45 }, scale: { start: 1.5, end: 0 }, tint: [0x8ff7ff, 0xffffff, 0x4fd2ff],
            blendMode: 'ADD', emitting: false,
        }).setDepth(12);
        this.emAgua = this.add.particles(0, 0, 'px', {
            lifespan: 700, speed: { min: 120, max: 260 }, angle: { min: 240, max: 300 }, gravityY: 800,
            scale: { start: 1.6, end: 0.4 }, tint: [0xb8ecff, 0x6fc8ff, 0xffffff], emitting: false,
        }).setDepth(13);

        const ambiente = {
            hojas: { textura: 'hoja', tint: [0x7fc04a, 0xa8d45a, 0xd8c24a], frecuencia: 420 },
            otono: { textura: 'hoja', tint: [0xe8a33a, 0xd2603a, 0xc9452f, 0xf0c050], frecuencia: 190 },
        }[this.def.ambiente];
        if (ambiente) {
            this.emAmbiente = this.add.particles(0, 0, ambiente.textura, {
                x: { min: 0, max: ANCHO + 300 }, y: -20, lifespan: 9000, speedY: { min: 25, max: 60 }, speedX: { min: -45, max: 5 },
                rotate: { start: 0, end: 540 }, scale: { min: 0.8, max: 1.4 }, tint: ambiente.tint, frequency: ambiente.frecuencia, alpha: 0.9,
            }).setDepth(14);
        } else if (this.def.ambiente === 'luciernagas') {
            this.emAmbiente = this.add.particles(0, 0, 'px', {
                x: { min: 0, max: ANCHO }, y: { min: 140, max: 470 }, lifespan: 4200, speed: { min: 5, max: 26 },
                scale: { min: 1, max: 1.8 }, tint: [0xd8ff7a, 0xfff0a0, 0xa8ffcc], blendMode: 'ADD', frequency: 140,
                alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) },
            }).setDepth(41);
        }
    }

    crearJugador() {
        const [ix, iy] = this.def.inicio;
        this.control = { x: ix * TILE + 8, y: iy * TILE + this.offSuelo };
        const j = this.jugador = new Jugador(this, this.control.x, this.control.y - 2);
        j.tieneDoble = this.indice >= 1 || Progreso.datos.doble;
        j.tieneMagia = this.indice >= 2 || Progreso.datos.magia;
        this.ultimoSeguro = { ...this.control };
        this.tSeguro = 0;
        this.burbuja = this.add.image(0, 0, 'burbuja').setDepth(11).setVisible(false);
        this.ctrl = { izq: false, der: false, abajo: false, saltar: false, saltarMantenido: false, atacar: false, magia: false };
        if (this.cofre) this.physics.add.overlap(j, this.cofre, this.abrirCofre, null, this);
    }

    crearEnemigos() {
        for (const [tipo, x, f] of this.def.enemigos) {
            const vuela = tipo === 'murcielago' || tipo === 'fantasma';
            this.crearEnemigo(tipo, x * TILE + 8, vuela ? f * TILE : f * TILE + this.offSuelo);
        }
        for (const [x, f, n] of this.def.colmenas) {
            const casa = { x: x * TILE + 8, y: f * TILE + 26 };
            for (let i = 0; i < n; i++) this.crearEnemigo('abeja', casa.x + (i - 1) * 18, casa.y + 10, casa);
        }
    }

    crearEnemigo(tipo, x, y, extra) {
        let e;
        switch (tipo) {
            case 'caracol': e = new Caracol(this, x, y - 1); break;
            case 'slime_verde': e = new Slime(this, x, y, 'verde'); break;
            case 'slime_morado': e = new Slime(this, x, y, 'morado'); break;
            case 'slime_azul': e = new Slime(this, x, y, 'azul'); break;
            case 'slime_azul_mini': e = new Slime(this, x, y, 'azul', true); break;
            case 'murcielago': e = new Murcielago(this, x, y); break;
            case 'abeja': e = new Abeja(this, x, y, extra); break;
            case 'fantasma': e = new Fantasma(this, x, y); break;
            default: return null;
        }
        this.enemigos.add(e);
        if (e.body.allowGravity) this.terrestres.add(e);
        return e;
    }

    crearColisiones() {
        const j = this.jugador;
        const fisica = this.physics;
        fisica.add.collider(j, this.solidos);
        fisica.add.collider(j, this.unidireccionales, null, this.puedePisar, this);
        fisica.add.collider(j, this.moviles, (jj, p) => { if (jj.body.touching.down) jj.montura = p; }, this.puedePisar, this);
        fisica.add.collider(j, this.caedizas, (jj, p) => this.pisarCaediza(jj, p), this.puedePisar, this);
        fisica.add.collider(this.terrestres, this.solidos);
        fisica.add.collider(this.terrestres, this.unidireccionales, null, this.puedePisar, this);
        fisica.add.collider(this.terrestres, this.moviles, null, this.puedePisar, this);
        fisica.add.collider(this.terrestres, this.caedizas, null, this.puedePisar, this);
        fisica.add.overlap(j, this.enemigos, this.tocarEnemigo, null, this);
        fisica.add.overlap(this.magias, this.enemigos, this.impactoMagia, null, this);
        fisica.add.collider(this.magias, this.solidos, (m) => this.explotarMagia(m));
        fisica.add.overlap(j, this.monedas, this.recogerMoneda, null, this);
        fisica.add.overlap(j, this.objetos, this.recogerObjeto, null, this);
        fisica.add.overlap(j, this.zonasDanio, () => this.pincharse(), null, this);
        fisica.add.overlap(j, this.zonasAgua, () => this.caer(true), null, this);
        fisica.add.overlap(j, this.setas, this.rebotarSeta, null, this);
        fisica.add.overlap(j, this.banderas, this.activarBandera, null, this);
        fisica.add.overlap(j, this.babas, (jj, b) => { jj.herir(b.x); this.explotarBaba(b); });
        fisica.add.collider(this.babas, this.solidos, (b) => this.explotarBaba(b));
        fisica.add.overlap(j, this.ondas, (jj, o) => jj.herir(o.x));
        fisica.add.overlap(this.terrestres, this.terrestres, this.choqueConcha, null, this);
    }

    crearControles() {
        this.teclas = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,Z,SPACE,J,X,K,SHIFT,P,ESC,M');
        // Pulsaciones apuntadas al llegar el evento: JustDown de Phaser pierde las que se sueltan
        // antes del siguiente fotograma (un salto rápido en un equipo lento)
        this.pulsos = new Set();
        this.input.keyboard.on('keydown', (ev) => { Sonido.iniciar(); if (!ev.repeat) this.pulsos.add(ev.keyCode); });
        this.input.on('pointerdown', () => Sonido.iniciar());
    }

    leerControles() {
        const k = this.teclas, t = TouchControls.state;
        const pulsada = (...teclas) => teclas.some((tk) => this.pulsos.has(tk.keyCode));
        const previo = this.tactilPrevio || {};
        const pulsoIzqTactil = !!t.left && !previo.left;
        const pulsoDerTactil = !!t.right && !previo.right;
        this.tactilPrevio = { left: !!t.left, right: !!t.right };
        return {
            izq: k.LEFT.isDown || k.A.isDown || !!t.left,
            der: k.RIGHT.isDown || k.D.isDown || !!t.right,
            pulsoIzq: pulsada(k.LEFT, k.A) || pulsoIzqTactil,
            pulsoDer: pulsada(k.RIGHT, k.D) || pulsoDerTactil,
            abajo: k.DOWN.isDown || k.S.isDown || !!t.down,
            saltar: pulsada(k.UP, k.W, k.Z) || TouchControls.consume('up'),
            saltarMantenido: k.UP.isDown || k.W.isDown || k.Z.isDown || !!t.up,
            atacar: pulsada(k.SPACE, k.J) || TouchControls.consume('attack'),
            magia: pulsada(k.X, k.K, k.SHIFT) || TouchControls.consume('magia'),
            bajarTactil: TouchControls.consume('down'),
            pausa: pulsada(k.P, k.ESC),
            sonido: pulsada(k.M),
        };
    }

    crearNoche() {
        this.oscuridad = this.add.renderTexture(0, 0, ANCHO, ALTO).setOrigin(0).setScrollFactor(0).setDepth(40);
        this.pincel = this.make.image({ key: 'luz', add: false });
    }

    /* ------------------------------------------------------------------ bucle */

    update(t, dtReal) {
        const dt = Math.min(dtReal, 50);
        const seg = dt / 1000;
        this.reloj += seg;
        if (!this.terminado) this.tiempoJuego += seg;
        const c = this.ctrl = this.leerControles();
        this.pulsos.clear();
        if (c.pausa) { this.pausar(); return; }
        if (c.sonido) Bus.emit('hud:sonido', Sonido.alternar());
        // En táctil, ▼ sirve para bajar de una plataforma
        if (c.bajarTactil) { c.abajo = true; c.saltar = true; }

        const j = this.jugador;
        j.actualizar(dt, c);

        this.comprobarEspada();
        for (const e of [...this.enemigos.getChildren()]) if (e.active) e.actualizar(seg, j);
        this.actualizarProyectiles(seg);

        if (!this.cayendo && !j.muerto && j.y > this.altoMundo + 50) this.caer(false);
        this.recordarSueloSeguro(seg);
        this.comprobarPistas();
        if (this.def.fin.tipo === 'jefe' && !this.jefeIniciado && !this.jefeDerrotado && j.x > (this.def.fin.x0 + 5) * TILE && !j.muerto) this.iniciarJefe();

        if (j.escudo > 0) this.burbuja.setVisible(true).setPosition(j.x, j.y - 24).setAlpha(j.escudo < 3 ? 0.4 + 0.5 * (Math.floor(j.escudo * 6) % 2) : 0.9);

        // Parallax y ambiente
        const cam = this.cameras.main;
        cam.followOffset.x = Phaser.Math.Linear(cam.followOffset.x, -j.dir * 60, 0.03);
        this.fondoCielo.tilePositionX = (cam.scrollX * 0.05) / (ALTO / 272);
        this.fondoLejos.tilePositionX = cam.scrollX * 0.15;
        this.fondoCerca.tilePositionX = cam.scrollX * 0.28;
        if (this.emAmbiente) this.emAmbiente.setPosition(cam.scrollX - (this.def.noche ? 0 : 150), cam.scrollY);
        for (const a of this.aguas) a.tilePositionX = this.reloj * 14;
        if (this.oscuridad) this.pintarNoche();
    }

    /** Tras cada paso de física (no de pantalla): el héroe sigue a la plataforma que pisa y las
        plataformas móviles reciben la velocidad exacta para el paso siguiente. Hacerlo por
        fotograma de pantalla dejaba al héroe temblando y caía al bajar el ascensor. */
    pasoFisico(delta) {
        this.tFisica += delta;
        const j = this.jugador;
        const m = j && j.montura;
        if (m) {
            const b = j.body, pb = m.body;
            // Sigue encima si no se separa hacia arriba más deprisa que la propia plataforma
            // (al subir, Arcade le pasa al héroe la velocidad de la plataforma)
            const encima = m.active && pb.enable && b.right > pb.x + 2 && b.x < pb.right - 2
                && b.velocity.y >= pb.velocity.y - 2 && b.bottom >= pb.y - 10 && b.bottom <= pb.y + 12 && j.bajando <= 0;
            if (encima) {
                b.x += pb.x - pb.prev.x;
                // Quieto sobre ella, a distancia entera: así no parpadea un píxel al redondear
                if (Math.abs(b.velocity.x) < 1) b.x = pb.x + Math.round(b.x - pb.x);
                b.y = pb.y - b.height;
                b.velocity.y = pb.velocity.y;
            } else {
                j.montura = null;
            }
        }
        const t = this.tFisica + delta;
        for (const p of this.moviles.getChildren()) {
            const k = (1 - Math.cos((t / p.periodo) * Math.PI * 2)) / 2;
            p.body.setVelocity((p.base.x + k * p.dx - p.body.x) / delta, (p.base.y + k * p.dy - p.body.y) / delta);
        }
    }

    puedePisar(cuerpo, p) {
        if (cuerpo.bajando > 0) return false;
        const b = cuerpo.body;
        const arriba = Math.min(p.body.y, p.body.prev ? p.body.prev.y : p.body.y);
        // Una plataforma que sube arrastra al héroe hacia arriba: eso no es saltar a través de ella
        const vMin = Math.min(-5, (p.body.velocity ? p.body.velocity.y : 0) - 5);
        return b.velocity.y >= vMin && b.prev.y + b.height <= arriba + 7;
    }

    sobreUnidireccional(j) {
        const pie = j.body.bottom;
        if (j.montura) return true;
        return this.superficies.some((s) => s.plataforma && j.x >= s.x0 - 4 && j.x <= s.x1 + 4 && Math.abs(s.y - pie) < 5)
            || this.caedizas.getChildren().some((p) => j.x >= p.x && j.x <= p.x + 48 && Math.abs(p.body.y - pie) < 5);
    }

    pisarCaediza(j, p) {
        if (j.body.touching.down) j.montura = p;
        if (p.estado !== 'quieta' || !j.body.touching.down) return;
        p.estado = 'tiembla';
        this.tweens.add({ targets: p, x: p.base.x + 2, duration: 50, yoyo: true, repeat: 4, onComplete: () => { p.x = p.base.x; } });
        this.time.delayedCall(480, () => {
            p.estado = 'cae';
            p.body.allowGravity = true;
            p.body.setVelocityY(40);
            this.polvo(p.x + 24, p.y + 10, 4);
        });
        this.time.delayedCall(3600, () => {
            if (!p.active) return;
            p.body.allowGravity = false;
            p.body.setVelocity(0, 0);
            p.body.reset(p.base.x, p.base.y);
            p.setAlpha(0);
            this.tweens.add({ targets: p, alpha: 1, duration: 400, onComplete: () => { p.estado = 'quieta'; } });
        });
    }

    haySuelo(x, y) {
        return this.superficies.some((s) => x >= s.x0 && x <= s.x1 && s.y >= y - 24 && s.y <= y + 170);
    }

    limitesSuelo(x, y) {
        const s = this.superficies.find((s) => x >= s.x0 && x <= s.x1 && Math.abs(s.y - y) < 24);
        // Patrulla corta alrededor de donde nace, sin salirse del suelo
        return s ? [Math.max(s.x0 + 14, x - 96), Math.min(s.x1 - 14, x + 96)] : null;
    }

    recordarSueloSeguro(seg) {
        const j = this.jugador;
        this.tSeguro -= seg;
        if (this.tSeguro > 0 || !j.enSuelo || j.muerto || this.cayendo) return;
        this.tSeguro = 0.25;
        const pie = j.body.bottom;
        const firme = (x) => this.superficies.some((s) => !s.plataforma && x >= s.x0 && x <= s.x1 && Math.abs(s.y - pie) < 6);
        if (firme(j.x - 18) && firme(j.x + 18)) this.ultimoSeguro = { x: j.x, y: pie };
    }

    comprobarPistas() {
        const x = this.jugador.x;
        for (const [px, clave] of this.def.pistas) {
            if (this.pistasVistas.has(clave) || x < px * TILE) continue;
            this.pistasVistas.add(clave);
            Bus.emit('hud:pista', pista(clave));
        }
    }

    comprobarEspada() {
        const j = this.jugador;
        for (const z of j.zonasEspada()) {
            const r = new Phaser.Geom.Rectangle(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
            for (const e of this.enemigos.getChildren()) {
                if (!e.active || !e.vivo || j.golpeados.has(e)) continue;
                const b = e.body;
                if (!Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) continue;
                j.golpeados.add(e);
                if (e.herir(1, Math.sign(e.x - j.x) || j.dir)) {
                    this.chispas(e.x, e.body.center.y, 0xffffff, 7);
                    this.temblor(70, j.faseAtaque === 2 ? 0.006 : 0.004);
                    this.pausaGolpe(j.faseAtaque === 2 ? 60 : 45);
                    Sonido.sfx('golpe');
                }
            }
            for (const b of this.babas.getChildren()) {
                if (b.active && Phaser.Geom.Rectangle.Contains(r, b.x, b.y)) this.explotarBaba(b);
            }
        }
    }

    actualizarProyectiles(seg) {
        for (const m of [...this.magias.getChildren()]) {
            m.vida -= seg;
            m.brillo.setPosition(m.x, m.y);
            this.emMagia.emitParticleAt(m.x, m.y, 1);
            if (m.vida <= 0) this.explotarMagia(m);
        }
        for (const o of [...this.ondas.getChildren()]) {
            o.vida -= seg;
            if (o.vida <= 0 || o.x < this.def.fin.x0 * TILE + 20 || o.x > this.anchoMundo - 10) {
                this.polvo(o.x, o.y, 4);
                o.destroy();
            } else if (Math.random() < 0.4) this.polvo(o.x, o.y, 1);
        }
        for (const b of [...this.babas.getChildren()]) if (b.y > this.altoMundo + 40) b.destroy();
    }

    pintarNoche() {
        const rt = this.oscuridad;
        const cam = this.cameras.main;
        rt.clear();
        rt.fill(0x05081a, 0.8);
        const luz = (x, y, r, a = 1) => {
            const sx = x - cam.scrollX, sy = y - cam.scrollY;
            if (sx < -r || sx > ANCHO + r || sy < -r || sy > ALTO + r) return;
            this.pincel.setScale(r / 64).setAlpha(a);
            rt.erase(this.pincel, sx, sy);
        };
        const j = this.jugador;
        const temblor = Math.sin(this.reloj * 9) * 4 + Math.sin(this.reloj * 23) * 2;
        luz(j.x, j.y - 28, 185 + temblor, 1);
        luz(j.x, j.y - 28, 90, 1);
        for (const l of this.luces) {
            if (l.objeto && !l.objeto.active) continue;
            if (l.bandera && !l.bandera.activa) { luz(l.x, l.y, l.r * 0.6, 0.5); continue; }
            luz(l.x, l.y, l.r * (l.parpadeo ? 0.92 + Math.random() * 0.12 : 1), 0.95);
        }
        for (const m of this.magias.getChildren()) luz(m.x, m.y, 95, 1);
        for (const b of this.babas.getChildren()) luz(b.x, b.y, 40, 0.8);
        if (this.jefe && this.jefe.active) luz(this.jefe.x, this.jefe.y - 50, 150, 0.7);
        for (const e of this.enemigos.getChildren()) if (e.tipo === 'fantasma' && e.active) luz(e.x, e.y, 40, 0.5);
        let n = 0;
        for (const p of (this.emAmbiente && this.emAmbiente.alive) || []) {
            if (n++ > 24) break;
            luz(p.x, p.y, 18, p.alpha);
        }
        for (const m of this.monedas.getChildren()) {
            if (Math.abs(m.x - j.x) < ANCHO) luz(m.x, m.y, 22, 0.6);
        }
    }

    /* ------------------------------------------------------------------ eventos */

    tocarEnemigo(j, e) {
        if (!e.vivo || j.muerto || j.celebrando || (e.ignorarHasta && this.time.now < e.ignorarHasta)) return;
        const cae = j.body.velocity.y > 40;
        if (e.pisable && cae && j.body.bottom <= e.body.top + 14) {
            e.ignorarHasta = this.time.now + 260;
            e.pisado(j);
            const alto = e.tipo === 'jefe' ? 640 : this.ctrl.saltarMantenido ? 540 : 400;
            j.rebotar(alto, this.ctrl.saltarMantenido);
            this.polvo(j.x, j.y, 5);
            this.pausaGolpe(40);
            if (e.tipo !== 'caracol') Sonido.sfx('pisar');
            return;
        }
        if (e.tipo === 'caracol' && e.estado === 'concha') {
            e.ignorarHasta = this.time.now + 300;
            e.patear(j.x < e.x ? 1 : -1);
            return;
        }
        if (e.peligroso) j.herir(e.x);
    }

    choqueConcha(a, b) {
        for (const [concha, otro] of [[a, b], [b, a]]) {
            if (concha.tipo === 'caracol' && concha.estado === 'patina' && otro !== concha && otro.vivo && otro.tipo !== 'jefe' && !(otro.tipo === 'caracol' && otro.estado === 'patina')) {
                otro.morir(concha.dirPatina);
                this.chispas(otro.x, otro.y - 10, 0xffffff, 6);
            }
        }
    }

    impactoMagia(m, e) {
        if (!m.active || !e.vivo) return;
        if (e.herir(1, Math.sign(m.body.velocity.x) || 1)) this.explotarMagia(m);
    }

    lanzarMagia(j) {
        const m = this.magias.create(j.x + j.dir * 20, j.y - 26, 'magia').setDepth(12);
        m.play('magia_brilla');
        m.body.setSize(10, 10);
        m.setVelocityX(j.dir * 480);
        m.vida = 1.1;
        m.brillo = this.add.image(m.x, m.y, 'brillo').setTint(0x4fd2ff).setBlendMode('ADD').setScale(0.9).setDepth(11);
        Sonido.sfx('magia');
    }

    explotarMagia(m) {
        if (!m.active) return;
        this.emChispas.setParticleTint(0x8ff7ff);
        this.emChispas.explode(8, m.x, m.y);
        m.brillo.destroy();
        m.destroy();
    }

    alMorirEnemigo(e, dirX) {
        this.stats.enemigos++;
        this.sumarPuntos(e.puntos, e.x, e.y - 30);
        this.emTrozos.setParticleTint(e.color);
        this.emTrozos.explode(e.tipo === 'jefe' ? 40 : 14, e.x, e.y - e.displayHeight / 2);
        this.emChispas.setParticleTint(0xffffff);
        this.emChispas.explode(5, e.x, e.y - e.displayHeight / 2);
        Sonido.sfx('muerte');
    }

    recogerMoneda(j, m) {
        if (!m.body.enable) return;
        m.body.enable = false;
        this.tweens.add({ targets: m, y: m.y - 16, alpha: 0, scale: 1.5, duration: 260, onComplete: () => m.destroy() });
        this.stats.monedas++;
        this.stats.puntos += 10;
        this.emBrillo.explode(6, m.x, m.y);
        Sonido.sfx('moneda');
        Bus.emit('hud:monedas', this.stats.monedas, this.stats.monedasTotal);
        Bus.emit('hud:puntos', this.stats.puntos);
    }

    recogerObjeto(j, o) {
        if (!o.active || j.muerto) return;
        const tipo = o.tipo;
        this.emBrillo.explode(16, o.x, o.y);
        this.anilloExpansivo(o.x, o.y, o.brillo.tintTopLeft);
        o.brillo.destroy();
        o.destroy();
        this.sumarPuntos(100, j.x, j.y - 60);
        if (tipo === 'pluma') {
            j.tieneDoble = true;
            Progreso.datos.doble = true; Progreso.guardar();
            Sonido.sfx('poder');
        } else if (tipo === 'orbe') {
            j.tieneMagia = true;
            j.mana = j.manaMax;
            Progreso.datos.magia = true; Progreso.guardar();
            Bus.emit('hud:mana', j.mana, j.manaMax);
            Sonido.sfx('poder');
        } else if (tipo === 'escudo') {
            j.escudo = 15;
            Sonido.sfx('escudo');
        } else if (tipo === 'pocion') {
            if (j.vida >= j.vidaMax && j.vidaMax < 5) j.vidaMax++;
            j.vida = Math.min(j.vidaMax, j.vida + 1);
            Bus.emit('hud:vida', j.vida, j.vidaMax);
            Sonido.sfx('corazon');
        }
        Bus.emit('hud:poder', tipo);
    }

    romperEscudo(golpe) {
        this.jugador.escudo = 0;
        this.burbuja.setVisible(false);
        if (golpe) {
            Sonido.sfx('escudo');
            this.emChispas.setParticleTint(0x9fdcff);
            this.emChispas.explode(14, this.jugador.x, this.jugador.y - 24);
            this.temblor(120, 0.005);
        }
    }

    pincharse() {
        const j = this.jugador;
        if (j.herir(j.x - j.dir * 10)) j.body.setVelocityY(-400);
    }

    rebotarSeta(j, z) {
        if (j.body.velocity.y < 40 || j.body.bottom > z.body.top + 14 || j.muerto) return;
        j.rebotar(this.ctrl.saltarMantenido ? 840 : 740, false);
        this.tweens.add({ targets: z.seta, scaleY: 0.9, scaleX: 1.55, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
        this.emBrillo.setParticleTint(0xff9a6a);
        this.emBrillo.explode(10, z.seta.x, z.seta.y - 30);
        this.emBrillo.setParticleTint(0xfff2a0);
        Sonido.sfx('rebote');
    }

    activarBandera(j, z) {
        if (z.activa || j.muerto) return;
        z.activa = true;
        z.bandera.play('bandera_ondea');
        this.control = { ...z.punto };
        j.vida = Math.max(j.vida, j.vidaMax);
        Bus.emit('hud:vida', j.vida, j.vidaMax);
        this.emBrillo.explode(18, z.punto.x + 8, z.punto.y - 30);
        this.anilloExpansivo(z.punto.x + 4, z.punto.y - 24, 0xffd23f);
        Sonido.sfx('control');
        Bus.emit('hud:aviso', TXT.control, '', 1600);
    }

    caer(agua) {
        const j = this.jugador;
        if (this.cayendo || j.muerto || this.terminado) return;
        this.cayendo = true;
        if (agua) {
            this.emAgua.explode(26, j.x, 29 * TILE + 6);
            Sonido.sfx('chapoteo');
        } else {
            Sonido.sfx('caida');
        }
        j.body.setVelocity(0, 0);
        j.vida--;
        Bus.emit('hud:vida', Math.max(0, j.vida), j.vidaMax);
        if (j.vida <= 0) {
            j.vida = 0;
            j.morir();
            return;
        }
        this.cameras.main.flash(160, 20, 10, 30);
        this.time.delayedCall(450, () => {
            const s = this.ultimoSeguro;
            j.body.reset(s.x, s.y - 2);
            j.invuln = 1.3;
            j.bloqueo = 0.25;
            this.cayendo = false;
            this.polvo(s.x, s.y, 6);
        });
    }

    alSerDerrotado() {
        this.stats.derrotas++;
        Sonido.sfx('dano');
        Sonido.atenuar(2.5);
        this.temblor(220, 0.01);
        this.time.delayedCall(700, () => Bus.emit('hud:aviso', TXT.derrota, TXT.vuelves, 1800));
        this.time.delayedCall(1500, () => this.cameras.main.fadeOut(300, 0, 0, 0));
        this.time.delayedCall(1850, () => {
            if (this.jefeIniciado && !this.jefeDerrotado) this.reiniciarJefe();
            this.jugador.revivir(this.control.x, this.control.y - 2);
            this.ultimoSeguro = { ...this.control };
            this.cayendo = false;
            this.cameras.main.fadeIn(350, 0, 0, 0);
        });
    }

    abrirCofre(j, cofre) {
        if (this.terminado || j.muerto || !cofre.active) return;
        this.terminado = true;
        cofre.setFrame('cofre_abierto');
        j.celebrando = true;
        Sonido.parar();
        Sonido.sfx('cofre');
        this.sumarPuntos(500, cofre.x, cofre.y - 60);
        this.anilloExpansivo(cofre.x, cofre.y - 20, 0xffd23f);
        // Lluvia de monedas que salen del cofre
        for (let i = 0; i < 16; i++) {
            const m = this.add.sprite(cofre.x, cofre.y - 20, 'moneda').setDepth(13).play('moneda_gira');
            this.tweens.add({ targets: m, x: cofre.x + Phaser.Math.Between(-90, 90), duration: 900, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: m, y: cofre.y - Phaser.Math.Between(70, 150), duration: 450, yoyo: true, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
        }
        this.emBrillo.explode(30, cofre.x, cofre.y - 20);
        this.time.delayedCall(2200, () => this.completarNivel());
    }

    completarNivel() {
        const s = this.stats;
        const j = this.jugador;
        const estrellas = [true, s.monedas >= Math.ceil(s.monedasTotal * 0.8), s.derrotas === 0];
        const bonoTiempo = Math.max(0, Math.round(300 - this.tiempoJuego)) * 3;
        const total = s.puntos + j.vida * 100 + bonoTiempo;
        Progreso.completar(this.indice, estrellas.filter(Boolean).length, total);
        Sonido.sfx('victoria');
        this.scene.pause();
        this.scene.launch('Resumen', { nivel: this.indice, stats: { ...s }, estrellas, total, tiempo: this.tiempoJuego, vida: j.vida, bono: bonoTiempo });
    }

    pausar() {
        if (this.terminado || this.jugador.muerto) return;
        Sonido.sfx('menu');
        this.scene.pause();
        this.scene.launch('Pausa', { nivel: this.indice });
    }

    /* ------------------------------------------------------------------ jefe */

    iniciarJefe() {
        this.jefeIniciado = true;
        const f = this.def.fin;
        // Muro de piedra que cierra la arena por detrás
        const x = f.x0 * TILE;
        const muro = this.add.container(x, 0).setDepth(6);
        for (let r = 12; r <= 28; r++) {
            muro.add(this.add.image(0, r * TILE, 'atlas', r === 12 ? 'p_top_m2' : `p_mid${r % 2 ? 1 : 2}_m1`).setOrigin(0).setTint(this.def.tinteSuelo));
            muro.add(this.add.image(TILE, r * TILE, 'atlas', r === 12 ? 'p_top_r' : `p_mid${r % 2 ? 1 : 2}_r`).setOrigin(0).setTint(this.def.tinteSuelo));
        }
        muro.y = 300;
        this.tweens.add({ targets: muro, y: 0, duration: 700, ease: 'Back.easeOut' });
        const cuerpo = this.cuerpoEstatico(this.solidos, x, 12 * TILE, TILE * 2, 17 * TILE);
        this.muros = [muro, cuerpo];
        this.temblor(700, 0.006);
        Sonido.sfx('temblor');
        Sonido.parar();
        Bus.emit('hud:aviso', TXT.jefe, '', 1600);
        this.time.delayedCall(1100, () => {
            if (this.jugador.muerto) return;
            Sonido.musica('jefe');
            this.jefe = new Jefe(this, f.x * TILE, -80, f);
            this.enemigos.add(this.jefe);
            this.terrestres.add(this.jefe);
        });
    }

    jefeListo(jefe) {
        Bus.emit('hud:jefe', jefe.vida, jefe.vidaMax);
    }

    golpeJefe(jefe, grande) {
        // La base del cuerpo físico (el sprite va un paso por detrás durante la caída)
        const suelo = jefe.body.bottom;
        this.temblor(grande ? 380 : 130, grande ? 0.016 : 0.006);
        Sonido.sfx(grande ? 'temblor' : 'pisar');
        this.polvo(jefe.x - 40, suelo, 6);
        this.polvo(jefe.x + 40, suelo, 6);
        if (!grande) return;
        for (const dir of [-1, 1]) {
            const o = this.ondas.create(jefe.x + dir * 56, suelo, 'onda').setOrigin(0.5, 1).setDepth(9).setTint(0xb9f7dc).setScale(1.2);
            o.body.setSize(22, 12).setOffset(3, 4);
            o.setFlipX(dir < 0);
            o.setVelocityX(dir * 250);
            o.vida = 2.4;
        }
    }

    escupirBaba(jefe, jugador, desfase) {
        const b = this.babas.create(jefe.x, jefe.y - 70, 'baba').setDepth(9).setScale(1.4);
        b.body.setSize(9, 9);
        b.body.setGravityY(-500);
        const t = 0.95 + Math.abs(desfase) * 0.08;
        const dx = jugador.x + desfase * 70 - b.x;
        const dy = jugador.y - 20 - b.y;
        b.setVelocity(dx / t, (dy - 0.5 * 900 * t * t) / t);
        Sonido.sfx('escupir');
    }

    explotarBaba(b) {
        if (!b.active) return;
        this.emTrozos.setParticleTint(0x6fdc4f);
        this.emTrozos.explode(8, b.x, b.y);
        b.destroy();
    }

    invocarSubditos(jefe) {
        Sonido.sfx('escupir');
        for (const dir of [-1, 1]) {
            const e = this.crearEnemigo('slime_verde', jefe.x + dir * 30, jefe.y - 50);
            e.body.setVelocity(dir * 190, -400);
            e.esSubdito = true;
            e.espera = 0.8;
        }
    }

    contarSubditos() {
        return this.enemigos.getChildren().filter((e) => e.esSubdito && e.vivo && e.active).length;
    }

    derrotarJefe(jefe) {
        this.jefeDerrotado = true;
        Bus.emit('hud:jefe', null);
        Sonido.parar();
        this.stats.enemigos++;
        this.sumarPuntos(jefe.puntos, jefe.x, jefe.y - 140);
        for (const e of this.enemigos.getChildren()) if (e.esSubdito && e.vivo) e.morir(0);
        this.babas.clear(true, true);
        this.ondas.clear(true, true);
        // Explosiones durante un segundo y medio antes del estallido final
        this.time.addEvent({
            delay: 130, repeat: 11, callback: () => {
                const x = jefe.x + Phaser.Math.Between(-50, 50), y = jefe.y - Phaser.Math.Between(10, 100);
                this.emTrozos.setParticleTint(0x4fc79a);
                this.emTrozos.explode(10, x, y);
                this.emChispas.setParticleTint(0xffffff);
                this.emChispas.explode(6, x, y);
                jefe.setTintFill(Math.random() < 0.5 ? 0xffffff : 0xff7a7a);
                jefe.x += Phaser.Math.Between(-4, 4);
                this.temblor(100, 0.006);
                Sonido.sfx('explosion');
            },
        });
        this.time.delayedCall(1650, () => {
            this.emTrozos.setParticleTint(0x4fc79a);
            this.emTrozos.explode(70, jefe.x, jefe.y - 60);
            this.emBrillo.explode(40, jefe.x, jefe.y - 60);
            this.anilloExpansivo(jefe.x, jefe.y - 60, 0xffffff, 4);
            this.cameras.main.flash(350, 255, 255, 255);
            this.temblor(600, 0.02);
            Sonido.sfx('temblor');
            const x = jefe.x;
            jefe.destroy();
            this.jefe = null;
            // Se abre el muro y cae el cofre dorado
            const [muro, cuerpo] = this.muros;
            this.tweens.add({ targets: muro, y: 320, duration: 800, ease: 'Quad.easeIn', onComplete: () => muro.destroy() });
            cuerpo.destroy();
            this.muros = [];
            this.time.delayedCall(900, () => {
                this.crearCofre(Phaser.Math.Clamp(x, (this.def.fin.x0 + 6) * TILE, this.anchoMundo - 60), 28 * TILE + this.offSuelo + 1, true);
                Sonido.musica('fin');
            });
        });
    }

    reiniciarJefe() {
        if (this.jefe && this.jefe.active) this.jefe.destroy();
        this.jefe = null;
        for (const e of [...this.enemigos.getChildren()]) if (e.esSubdito) e.destroy();
        this.babas.clear(true, true);
        this.ondas.clear(true, true);
        for (const m of this.muros) m.destroy();
        this.muros = [];
        this.jefeIniciado = false;
        Bus.emit('hud:jefe', null);
        Sonido.musica(this.def.musica);
    }

    /* ------------------------------------------------------------------ efectos */

    polvo(x, y, n) { this.emPolvo.explode(n, x, y - 2); }

    chispas(x, y, color, n) {
        this.emChispas.setParticleTint(color);
        this.emChispas.explode(n, x, y);
    }

    efectoDobleSalto(x, y) {
        this.anilloExpansivo(x, y - 4, 0xbfefff, 1.2);
        this.emBrillo.setParticleTint(0xdff6ff);
        this.emBrillo.explode(8, x, y);
        this.emBrillo.setParticleTint(0xfff2a0);
    }

    anilloExpansivo(x, y, color, escala = 2) {
        const a = this.add.image(x, y, 'anillo').setTint(color).setBlendMode('ADD').setScale(0.2).setDepth(13);
        this.tweens.add({ targets: a, scale: escala, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => a.destroy() });
    }

    efectoDanio(j) {
        Sonido.sfx('dano');
        this.temblor(170, 0.008);
        Bus.emit('hud:danio');
        this.pausaGolpe(70);
        this.emChispas.setParticleTint(0xff5a6e);
        this.emChispas.explode(8, j.x, j.y - 24);
    }

    pausaGolpe(ms) {
        if (this.enPausaGolpe) return;
        this.enPausaGolpe = true;
        this.physics.pause();
        this.time.delayedCall(ms, () => {
            this.physics.resume();
            this.enPausaGolpe = false;
        });
    }

    temblor(ms, intensidad) { this.cameras.main.shake(ms, intensidad); }

    textoFlotante(x, y, texto, color, tam = 14) {
        const t = this.add.text(x, y, texto, estiloTexto(tam, color)).setOrigin(0.5).setDepth(45);
        this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }

    sumarPuntos(n, x, y) {
        this.stats.puntos += n;
        Bus.emit('hud:puntos', this.stats.puntos);
        if (x !== undefined) this.textoFlotante(x, y, '+' + n, '#ffe680');
    }
}
